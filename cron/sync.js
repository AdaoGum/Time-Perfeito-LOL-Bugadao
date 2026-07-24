// ============================================================================
// TRATOR DA MADRUGADA — Ingestão + Processamento unificados (Marcos Temporais).
//
// Papel duplo e definitivo:
//   1) Ingestão: para cada jogador, baixa as ÚLTIMAS 200 partidas (paginando
//      a Riot de 100 em 100) e detecta as inéditas.
//   2) Processamento: para cada partida inédita faz a CHAMADA DUPLA à Riot
//      (resumo + timeline), grava metadados + estatísticas de fim de jogo e
//      extrai os Marcos Temporais (52 colunas) nos minutos [0,5,10,15,25].
//      A timeline bruta é DESCARTADA logo após a extração (não ocupa o banco).
//
// Ordem de prioridade: os 5 PUUIDs do NÚCLEO DO TIME rodam primeiro; os demais
// jogadores cadastrados são processados sequencialmente em seguida.
//
// BACKFILL=1 reprocessa TODAS as partidas baixadas (reescreve linhas via INSERT
// OR REPLACE), útil para preencher colunas novas no histórico recente.
// ============================================================================

import {
  SQL_PARTIDAS, valoresPartida, montarTeams,
  SQL_ESTATISTICAS, valoresEstatisticas,
  SQL_MARCOS, extrairMarcos, MARCOS_MINUTOS
} from '../shared/match-extract.js';

import { queryD1 } from './lib/d1.js';
import { fetchFromRiotHost, respeitarRateLimit } from './lib/riot.js';

const REGION_ROUTE = 'americas';
const LIMITE_PARTIDAS = 200; // 🔒 Rodada noturna: olha as 200 últimas e baixa só as inéditas
const PAGINA_IDS = 100;      // A Riot devolve no máx. 100 ids por chamada -> paginamos

// 🌟 NÚCLEO DO TIME — sempre processados PRIMEIRO, nesta ordem.
const PUUIDS_PRIORITARIOS = [
  '9t-kjlDiabw7Br6dj5pq4H7ulYloLp5DBVJAAydDdIjBxBp3oNXXG2Y-igp9j7XEGjGBTFuQPcxTfQ',
  'DitIIHgFfSgTu92vQZDadmBDDl6qr84NHnAuMiyk6EHv6GtGvRGH-K1_xg3PUNlAwdSJcCVudTQSrg',
  'p-yebFHaXORPI_xcZ2NJW6C2_oPP7wWH3BxIPl2OHfFPfnKHTk23acLjmWZ65ShHGNWBM0knAFbx6g',
  'kaEzM3m6zjWx3pijWPvRv7dJnKY0aDiSE_1O81kdc71IaZhHATt0E-Ws_66Q9NbV7j0y06QZWslznQ',
  'K_PROi5ZKvNuZd_F5meGTE-ZZ-IObaSLwHQrkRoogcmgpJEAHyCPtz1NzTPDwlUgMEXWULrmfJdDmw'
];

const BACKFILL = process.env.BACKFILL === '1' || process.env.BACKFILL === 'true';

// 🎯 ALVO OPCIONAL — se tiver puuids aqui (ou na env PUUIDS, separada por vírgula),
// o trator processa SÓ esses jogadores e ignora o resto do banco.
// Deixe VAZIO para o comportamento normal (todos os jogadores monitorados).
const PUUIDS_ALVO = (
  process.env.PUUIDS
    ? process.env.PUUIDS.split(',').map(s => s.trim()).filter(Boolean)
    : [
        // cole aqui os puuids para rodar filtrado, ex.:
        // '9t-kjlDiabw7Br6dj5pq4H7ulYloLp5DBVJAAydDdIjBxBp3oNXXG2Y-igp9j7XEGjGBTFuQPcxTfQ',
      ]
);

// Fetch regional "americas". O resfriamento de chave (respeitarRateLimit) é chamado
// explicitamente antes de cada request, como nas versões anteriores.
const fetchFromRiot = (endpoint) => fetchFromRiotHost(REGION_ROUTE, endpoint, { source: 'cron' });

// ----------------------------------------------------------------------------
// MAESTRIAS — 1 chamada por jogador (champion-mastery-v4, endpoint de PLATAFORMA,
// ex.: br1 — vem de jogadores.platform_host). Upsert em LOTES multi-VALUES para
// não fazer 150+ round-trips no D1. Colunas em paridade com o upsert do worker.
// ----------------------------------------------------------------------------
// A API REST do D1 limita ~100 variáveis por statement: 12 linhas × 8 params = 96.
const MAESTRIA_LOTE = 12;

async function sincronizarMaestrias(jogador, logger) {
  const host = (jogador.platform_host || 'br1').toLowerCase();
  await respeitarRateLimit(logger);
  const rawMasteries = await fetchFromRiotHost(host, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${jogador.puuid}`, { source: 'cron' });
  if (!Array.isArray(rawMasteries) || !rawMasteries.length) {
    logger('   🏅 [MAESTRIAS] Nenhuma maestria retornada.');
    return 0;
  }

  const COLUNAS = '(puuid, champion_id, champion_level, champion_points, last_play_time, season_milestone, milestone_grades, mark_required_next_level, atualizado)';
  for (let i = 0; i < rawMasteries.length; i += MAESTRIA_LOTE) {
    const lote = rawMasteries.slice(i, i + MAESTRIA_LOTE);
    const placeholders = lote.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').join(', ');
    const params = lote.flatMap(m => [
      jogador.puuid,
      m.championId,
      m.championLevel ?? null,
      m.championPoints ?? null,
      m.lastPlayTime ?? null,
      m.championSeasonMilestone ?? null,
      m.milestoneGrades ? JSON.stringify(m.milestoneGrades) : null,
      m.markRequiredForNextLevel ?? null
    ]);
    await queryD1(`INSERT OR REPLACE INTO maestrias ${COLUNAS} VALUES ${placeholders}`, params);
  }
  logger(`   🏅 [MAESTRIAS] ${rawMasteries.length} campeões gravados (host ${host}).`);
  return rawMasteries.length;
}

// ----------------------------------------------------------------------------
// PERFIL — elo/LP/ícone/nível/V-D (summoner-v4 + league-v4, endpoints de PLATAFORMA,
// ex.: br1 — vem de jogadores.platform_host). Espelha o worker.js (atualizarPerfilRiot):
// 2 chamadas, e persiste no `jogadores` pra o app e o relatório servirem elo fresco
// SEM depender de alguém abrir o perfil no app. Os valores atuais do banco entram como
// fallback: se a Riot não retornar uma fila, não rebaixamos o que já estava salvo.
// ----------------------------------------------------------------------------
async function sincronizarPerfil(jogador, logger) {
  const host = (jogador.platform_host || 'br1').toLowerCase();
  const wr = (w, l) => ((w + l) > 0 ? (w / (w + l)) * 100 : 0);

  let profileIconId = jogador.profile_icon_id ?? null;
  let summonerLevel = jogador.summoner_level ?? null;
  let solo = { tier: jogador.tier || 'UNRANKED', rank: jogador.rank || '', lp: jogador.lp ?? 0, wins: jogador.solo_wins ?? 0, losses: jogador.solo_losses ?? 0, wr: jogador.win_rate ?? 0 };
  let flex = { tier: jogador.flex_tier || 'UNRANKED', rank: jogador.flex_rank || '', lp: jogador.flex_lp ?? 0, wins: jogador.flex_wins ?? 0, losses: jogador.flex_losses ?? 0, wr: jogador.flex_win_rate ?? 0 };

  await respeitarRateLimit(logger);
  const s = await fetchFromRiotHost(host, `/lol/summoner/v4/summoners/by-puuid/${jogador.puuid}`, { source: 'cron', logger });
  if (s) { profileIconId = s.profileIconId ?? profileIconId; summonerLevel = s.summonerLevel ?? summonerLevel; }

  await respeitarRateLimit(logger);
  const entries = await fetchFromRiotHost(host, `/lol/league/v4/entries/by-puuid/${jogador.puuid}`, { source: 'cron', logger });
  if (Array.isArray(entries)) {
    const so = entries.find(q => q.queueType === 'RANKED_SOLO_5x5');
    if (so) solo = { tier: so.tier, rank: so.rank, lp: so.leaguePoints, wins: so.wins, losses: so.losses, wr: wr(so.wins, so.losses) };
    const fl = entries.find(q => q.queueType === 'RANKED_FLEX_SR');
    if (fl) flex = { tier: fl.tier, rank: fl.rank, lp: fl.leaguePoints, wins: fl.wins, losses: fl.losses, wr: wr(fl.wins, fl.losses) };
  }

  await queryD1(
    `UPDATE jogadores SET
       tier = ?, rank = ?, lp = ?, win_rate = ?,
       flex_tier = ?, flex_rank = ?, flex_lp = ?, flex_win_rate = ?,
       profile_icon_id = ?, summoner_level = ?,
       solo_wins = ?, solo_losses = ?, flex_wins = ?, flex_losses = ?,
       ultima_atualizacao = CURRENT_TIMESTAMP
     WHERE puuid = ?`,
    [
      solo.tier, solo.rank, solo.lp, solo.wr,
      flex.tier, flex.rank, flex.lp, flex.wr,
      profileIconId, summonerLevel,
      solo.wins, solo.losses, flex.wins, flex.losses,
      jogador.puuid
    ]
  );
  logger(`   👤 [PERFIL] Solo ${solo.tier}${solo.rank ? ' ' + solo.rank : ''} ${solo.lp}LP · Flex ${flex.tier}${flex.rank ? ' ' + flex.rank : ''} · nível ${summonerLevel ?? '?'} (host ${host}).`);
}

// Reordena os jogadores do banco: núcleo do time primeiro (na ordem fixa), resto depois.
function ordenarPorPrioridade(jogadores) {
  const prioridade = new Map(PUUIDS_PRIORITARIOS.map((p, i) => [p, i]));
  const nucleo = [];
  const resto = [];
  for (const j of jogadores) {
    if (prioridade.has(j.puuid)) nucleo.push(j);
    else resto.push(j);
  }
  nucleo.sort((a, b) => prioridade.get(a.puuid) - prioridade.get(b.puuid));
  return [...nucleo, ...resto];
}

async function processarJogador(jogador, fs) {
  const ehNucleo = PUUIDS_PRIORITARIOS.includes(jogador.puuid);
  console.log(`\n---------------------------------------------------------`);
  console.log(`⛏️  [ALVO${ehNucleo ? ' ⭐ NÚCLEO' : ''}] Escavando: ${jogador.game_name}#${jogador.tag_line}`);
  console.log(`---------------------------------------------------------`);

  const nomeArquivoClean = `${jogador.game_name.replace(/[^a-zA-Z0-9]/g, '_')}_${jogador.tag_line.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  const logPath = `logs/${nomeArquivoClean}`;
  fs.writeFileSync(logPath, `=========================================================\n`);
  fs.appendFileSync(logPath, `📋 RELATÓRIO DE INGESTÃO (MARCOS TEMPORAIS)\n`);
  fs.appendFileSync(logPath, `JOGADOR: ${jogador.game_name}#${jogador.tag_line}${ehNucleo ? ' ⭐ NÚCLEO DO TIME' : ''}\n`);
  fs.appendFileSync(logPath, `DATA: ${new Date().toLocaleString('pt-BR')}\n`);
  fs.appendFileSync(logPath, `=========================================================\n\n`);

  const logger = (texto) => {
    console.log(texto);
    fs.appendFileSync(logPath, texto + '\n');
  };

  // 0) Perfil (elo/LP/ícone/nível/V-D) + Maestrias: rodam ANTES das partidas para não
  //    serem puladas pelos early-returns de "banco já atualizado" (o elo precisa ser
  //    atualizado mesmo quando não há jogo novo). Falha em qualquer um NÃO derruba o jogador.
  try {
    await sincronizarPerfil(jogador, logger);
  } catch (pErr) {
    logger(`   ⚠️ [PERFIL] Falhou (${pErr.message}) — mantendo elo/ícone anteriores.`);
  }
  try {
    await sincronizarMaestrias(jogador, logger);
  } catch (mErr) {
    logger(`   ⚠️ [MAESTRIAS] Falhou (${mErr.message}) — seguindo para as partidas.`);
  }

  // 1) Últimas LIMITE_PARTIDAS partidas (a Riot limita a 100 ids por chamada, então paginamos).
  logger(`🔍 [Riot API] Buscando as últimas ${LIMITE_PARTIDAS} partidas (paginando de ${PAGINA_IDS} em ${PAGINA_IDS})...`);
  const allMatchIds = [];
  for (let start = 0; start < LIMITE_PARTIDAS; start += PAGINA_IDS) {
    await respeitarRateLimit(logger);
    const count = Math.min(PAGINA_IDS, LIMITE_PARTIDAS - start);
    const pagina = await fetchFromRiot(`/lol/match/v5/matches/by-puuid/${jogador.puuid}/ids?start=${start}&count=${count}`);
    if (!pagina || pagina.length === 0) break; // acabou o histórico do jogador
    allMatchIds.push(...pagina);
    if (pagina.length < count) break; // última página (jogador tem menos que o limite)
  }
  logger(`🔹 Partidas retornadas pela Riot: ${allMatchIds.length}`);
  if (allMatchIds.length === 0) return;

  // 2) Quais já estão no banco (para baixar só as inéditas).
  // ⚠️ A checagem é POR JOGADOR (estatisticas_jogador_partida WHERE puuid), NÃO na
  // tabela global `partidas`. Se olhasse `partidas`, uma partida jogada por 2+ membros
  // do banco seria "carimbada" pelo primeiro a processá-la e os demais a pulariam para
  // sempre — perdendo as estatísticas deles. (Paridade com worker.js.)
  const existentes = new Set();
  for (let i = 0; i < allMatchIds.length; i += 50) {
    const chunk = allMatchIds.slice(i, i + 50);
    const placeholders = chunk.map(() => '?').join(',');
    const res = await queryD1(
      `SELECT match_id FROM estatisticas_jogador_partida WHERE puuid = ? AND match_id IN (${placeholders})`,
      [jogador.puuid, ...chunk]
    );
    (res.results || []).forEach(row => existentes.add(row.match_id));
  }

  const novasPartidas = BACKFILL ? allMatchIds : allMatchIds.filter(id => !existentes.has(id));
  if (BACKFILL) logger(`🔁 [BACKFILL] Reprocessando TODAS as ${novasPartidas.length} partidas.`);
  else logger(`📈 [BALANÇO] Já no D1: ${existentes.size} | Inéditas: ${novasPartidas.length}`);

  if (novasPartidas.length === 0) {
    logger('✨ [OK] Banco já atualizado para este jogador.');
    await queryD1('UPDATE jogadores SET ultima_atualizacao = CURRENT_TIMESTAMP WHERE puuid = ?', [jogador.puuid]);
    return;
  }

  // 3) Para cada inédita: CHAMADA DUPLA (resumo + timeline) e extração.
  let processadas = 0;
  for (const matchId of novasPartidas) {
    try {
      await respeitarRateLimit(logger);
      const matchData = await fetchFromRiot(`/lol/match/v5/matches/${matchId}`);
      const info = matchData.info;

      // Metadados globais (patch, modo, fila, bans, objetivos)
      await queryD1(SQL_PARTIDAS, valoresPartida(matchId, info, montarTeams(info)));

      const participant = info.participants.find(p => p.puuid === jogador.puuid);
      if (participant) {
        // Estatísticas consolidadas de fim de jogo (37 colunas) — FK exige isto antes dos marcos.
        await queryD1(SQL_ESTATISTICAS, valoresEstatisticas(jogador.puuid, matchId, info, participant));

        // Timeline detalhada (+1 request) -> extrai marcos -> descarta o JSON pesado.
        try {
          await respeitarRateLimit(logger);
          const timeline = await fetchFromRiot(`/lol/match/v5/matches/${matchId}/timeline`);
          const marcos = extrairMarcos(jogador.puuid, matchId, timeline);
          for (const linha of marcos) {
            await queryD1(SQL_MARCOS, linha);
          }
          logger(`   💾 [${++processadas}/${novasPartidas.length}] ${matchId} | ${participant.championName} | ${marcos.length} marcos (de ${MARCOS_MINUTOS.length})`);
        } catch (tlErr) {
          logger(`   ⚠️ Timeline indisponível para ${matchId}: ${tlErr.message} (estatísticas gravadas mesmo assim)`);
          processadas++;
        }

        fs.appendFileSync(logPath, `      📊 ${participant.win ? '▶ VITÓRIA' : '❌ DERROTA'} | KDA ${participant.kills}/${participant.deaths}/${participant.assists} | ${participant.goldEarned.toLocaleString('pt-BR')}g\n`);
      } else {
        logger(`   ⚠️ Participante ${jogador.game_name} não encontrado em ${matchId} (partida ignorada).`);
      }
    } catch (matchError) {
      logger(`   ❌ Erro na partida ${matchId}: ${matchError.message}`);
    }
  }

  await queryD1('UPDATE jogadores SET ultima_atualizacao = CURRENT_TIMESTAMP WHERE puuid = ?', [jogador.puuid]);
  logger(`\n🎉 [SUCESSO] ${jogador.game_name}: ${processadas} partidas processadas.`);
}

async function rodarSincronizacao() {
  const fs = await import('fs');

  console.log('=========================================================');
  console.log(`🚀 [SISTEMA] TRATOR DE MARCOS TEMPORAIS (limite ${LIMITE_PARTIDAS}/jogador)`);
  console.log('=========================================================');

  try {
    if (!fs.existsSync('logs')) fs.mkdirSync('logs');

    console.log('🗄️  [D1] Baixando a lista de jogadores monitorados...');
    const dbResult = await queryD1(
      `SELECT puuid, game_name, tag_line, has_premium, platform_host,
              tier, rank, lp, win_rate, flex_tier, flex_rank, flex_lp, flex_win_rate,
              profile_icon_id, summoner_level, solo_wins, solo_losses, flex_wins, flex_losses
       FROM jogadores`
    );
    let jogadores = ordenarPorPrioridade(dbResult.results || []);

    // 🎯 Filtro opcional: roda só os puuids-alvo, se configurados (escape hatch manual,
    //    ignora o premium). Sem alvos, o job automático processa SÓ jogadores premium.
    if (PUUIDS_ALVO.length) {
      const alvo = new Set(PUUIDS_ALVO);
      jogadores = jogadores.filter(j => alvo.has(j.puuid));
      console.log(`🎯 [FILTRO] Rodando SÓ ${jogadores.length} de ${PUUIDS_ALVO.length} puuid(s) alvo.`);
    } else {
      const antes = jogadores.length;
      jogadores = jogadores.filter(j => Number(j.has_premium) === 1);
      console.log(`⭐ [PREMIUM] ${jogadores.length}/${antes} jogador(es) premium — só eles rodam no job automático.`);
    }

    console.log(`📋 [D1] ${jogadores.length} jogador(es). Núcleo do time roda primeiro.`);

    let falhas = 0;
    for (const jogador of jogadores) {
      try {
        await processarJogador(jogador, fs);
      } catch (erroJogador) {
        // Blindagem: um jogador que falhar (ex.: erro persistente na paginação de IDs)
        // NÃO pode derrubar a rodada e deixar os jogadores seguintes sem sincronizar.
        falhas++;
        console.error(`❌ [PULANDO] ${jogador.game_name}#${jogador.tag_line} falhou: ${erroJogador.message}`);
      }
    }

    console.log('\n=========================================================');
    console.log(`✅ [FINALIZADO] O trator encerrou a rodada${falhas ? ` com ${falhas} jogador(es) pulado(s)` : ' com sucesso'}!`);
    console.log('=========================================================');
  } catch (error) {
    console.error('\n❌ [FALHA CRÍTICA] O motor engasgou por um erro externo:', error.message);
    process.exit(1);
  }
}

rodarSincronizacao();
