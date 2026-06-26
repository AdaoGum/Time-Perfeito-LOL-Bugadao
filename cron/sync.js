// ============================================================================
// TRATOR DA MADRUGADA — Ingestão + Processamento unificados (Marcos Temporais).
//
// Papel duplo e definitivo:
//   1) Ingestão: para cada jogador, baixa as ÚLTIMAS 500 partidas (paginando
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
const LIMITE_PARTIDAS = 500; // 🔒 Limite de segurança: até as 500 últimas por jogador
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

async function queryD1(sql, params = []) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, params })
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Erro no D1: ${JSON.stringify(data.errors)}`);
  return data.result[0];
}

let totalRequestsFeitas = 0;

// Resfriamento de chave: pausa preventiva antes de estourar o limite de 100/2min.
async function respeitarRateLimit(logger) {
  if (totalRequestsFeitas >= 90) {
    logger('⏳ [ESFRIANDO CHAVE] Quase no limite de 100 reqs. Pausando 2 min...');
    await sleep(125000);
    totalRequestsFeitas = 0;
  }
}

async function fetchFromRiot(endpoint) {
  const url = `https://${REGION_ROUTE}.api.riotgames.com${endpoint}`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
  totalRequestsFeitas++;
  if (response.status === 429) {
    console.warn('⚠️ [RIOT LIMIT] Chave esquentou demais! Pausando 2 min para esfriar...');
    await sleep(125000);
    totalRequestsFeitas = 0;
    return fetchFromRiot(endpoint);
  }
  if (!response.ok) throw new Error(`Erro na Riot API: ${response.status}`);
  return response.json();
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
  const existentes = new Set();
  for (let i = 0; i < allMatchIds.length; i += 50) {
    const chunk = allMatchIds.slice(i, i + 50);
    const placeholders = chunk.map(() => '?').join(',');
    const res = await queryD1(`SELECT match_id FROM partidas WHERE match_id IN (${placeholders})`, chunk);
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
    const dbResult = await queryD1('SELECT puuid, game_name, tag_line FROM jogadores');
    const jogadores = ordenarPorPrioridade(dbResult.results || []);
    console.log(`📋 [D1] ${jogadores.length} jogador(es). Núcleo do time roda primeiro.`);

    for (const jogador of jogadores) {
      await processarJogador(jogador, fs);
    }

    console.log('\n=========================================================');
    console.log('✅ [FINALIZADO] O trator encerrou a rodada com sucesso!');
    console.log('=========================================================');
  } catch (error) {
    console.error('\n❌ [FALHA CRÍTICA] O motor engasgou por um erro externo:', error.message);
    process.exit(1);
  }
}

rodarSincronizacao();
