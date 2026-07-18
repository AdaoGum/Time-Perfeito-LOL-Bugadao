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
} from './lib/match-extract.js';

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;

const REGION_ROUTE = 'americas';
const LIMITE_PARTIDAS = 200; // 🔒 Rodada noturna: olha as 200 últimas e baixa só as inéditas
const PAGINA_IDS = 100;      // A Riot devolve no máx. 100 ids por chamada -> paginamos
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Códigos internos transitórios do D1 (o Cloudflare "soluça" e pede retry):
//   7500 = internal error | 7502 = network/overloaded. Retentamos com backoff em vez
//   de perder a gravação da partida (paridade com o retry de 5xx do fetchFromRiot).
const D1_CODIGOS_TRANSITORIOS = new Set([7500, 7502]);

function erroD1EhTransitorio(status, data) {
  if (status >= 500) return true;
  const erros = (data && data.errors) || [];
  return erros.some(e => D1_CODIGOS_TRANSITORIOS.has(e && e.code));
}

async function queryD1(sql, params = [], tentativa = 0) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  let response, data;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql, params })
    });
    data = await response.json();
  } catch (netErr) {
    // Falha de rede (conexão caiu, DNS, etc.) — também é transitória.
    if (tentativa < 4) {
      const espera = 1500 * (tentativa + 1);
      console.warn(`⚠️ [D1 REDE] ${netErr.message}. Tentativa ${tentativa + 1}/4 em ${espera / 1000}s...`);
      await sleep(espera);
      return queryD1(sql, params, tentativa + 1);
    }
    throw netErr;
  }

  if (!response.ok || !data.success) {
    if (erroD1EhTransitorio(response.status, data) && tentativa < 4) {
      const espera = 1500 * (tentativa + 1);
      console.warn(`⚠️ [D1 ${response.status}] Erro transitório ${JSON.stringify(data.errors)}. Tentativa ${tentativa + 1}/4 em ${espera / 1000}s...`);
      await sleep(espera);
      return queryD1(sql, params, tentativa + 1);
    }
    throw new Error(`Erro no D1: ${JSON.stringify(data.errors)}`);
  }
  return data.result[0];
}

let totalRequestsFeitas = 0;

// Contador GLOBAL compartilhado (mesma tabela api_usage lida pelo worker/front).
// Best-effort e SEM await: nunca deve atrasar nem derrubar a coleta.
function registrarUsoGlobal(source) {
  queryD1('INSERT INTO api_usage (ts, count, source, action) VALUES (?, ?, ?, ?)', [Date.now(), 1, source, 'riot_fetch'])
    .catch(() => {});
}

// Resfriamento de chave: pausa preventiva antes de estourar o limite de 100/2min.
async function respeitarRateLimit(logger) {
  if (totalRequestsFeitas >= 90) {
    logger('⏳ [ESFRIANDO CHAVE] Quase no limite de 100 reqs. Pausando 2 min...');
    await sleep(125000);
    totalRequestsFeitas = 0;
  }
}

// Fetch genérico à Riot com host explícito (regional "americas" OU de plataforma
// tipo "br1"): rate limit, retry de 429 e backoff de 5xx compartilhados.
async function fetchFromRiotHost(host, endpoint, tentativa = 0) {
  const url = `https://${host}.api.riotgames.com${endpoint}`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
  totalRequestsFeitas++;
  registrarUsoGlobal('cron');
  if (response.status === 429) {
    console.warn('⚠️ [RIOT LIMIT] Chave esquentou demais! Pausando 2 min para esfriar...');
    await sleep(125000);
    totalRequestsFeitas = 0;
    return fetchFromRiotHost(host, endpoint, tentativa);
  }
  // Erros transitórios (500, 502, 503, 504): a Riot às vezes soluça. Tenta de novo
  // com backoff em vez de derrubar a rodada — até 3 tentativas.
  if (response.status >= 500 && tentativa < 3) {
    const espera = 2000 * (tentativa + 1);
    console.warn(`⚠️ [RIOT ${response.status}] Erro transitório. Tentativa ${tentativa + 1}/3 em ${espera / 1000}s...`);
    await sleep(espera);
    return fetchFromRiotHost(host, endpoint, tentativa + 1);
  }
  if (!response.ok) throw new Error(`Erro na Riot API: ${response.status}`);
  return response.json();
}

const fetchFromRiot = (endpoint) => fetchFromRiotHost(REGION_ROUTE, endpoint);

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
  const rawMasteries = await fetchFromRiotHost(host, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${jogador.puuid}`);
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

  // 0) Maestrias (1 chamada): roda ANTES das partidas para não ser pulada pelos
  //    early-returns de "banco já atualizado". Falha aqui não derruba o jogador.
  try {
    await sincronizarMaestrias(jogador, logger);
  } catch (mErr) {
    logger(`   ⚠️ [MAESTRIAS] Falhou (${mErr.message}) — seguindo para as partidas.`);
  }

  // 1) Últimas 500 partidas (a Riot limita a 100 ids por chamada, então paginamos).
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
    const dbResult = await queryD1('SELECT puuid, game_name, tag_line, has_premium, platform_host FROM jogadores');
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
