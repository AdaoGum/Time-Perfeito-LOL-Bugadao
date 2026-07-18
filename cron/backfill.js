// ============================================================================
// BACKFILL CENTRADO NA PARTIDA — recupera as estatísticas + marcos que se perderam
// quando duas ou mais contas do banco jogaram a MESMA partida.
//
// Contexto do bug (já corrigido em cron/sync.js): a dedup antiga olhava a tabela
// global `partidas`; a primeira conta a processar uma partida "carimbava" ela e as
// demais a pulavam para sempre, ficando sem linha em estatisticas_jogador_partida.
//
// Este script conserta o histórico já existente SEM a ineficiência do trator
// (que baixa jogador-por-jogador). Aqui:
//   1) Descobre, por puuid, quais partidas faltam (lista de IDs da Riot − o que já
//      existe em estatisticas_jogador_partida daquele puuid).
//   2) Tira a UNIÃO dessas partidas -> cada match_id único é baixado UMA só vez.
//   3) Para cada partida: grava metadados (partidas), e para CADA jogador registrado
//      que jogou nela grava estatísticas (37 col) + marcos (52 col via timeline).
//
// Rodar aqui no VS:  node --env-file=local/.env cron/backfill.js
// ============================================================================

import {
  SQL_PARTIDAS, valoresPartida, montarTeams,
  SQL_ESTATISTICAS, valoresEstatisticas,
  SQL_MARCOS, extrairMarcos, MARCOS_MINUTOS
} from '../shared/match-extract.js';

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;

const REGION_ROUTE = 'americas';
const LIMITE_PARTIDAS = 1000; // backfill mira o histórico fundo: até as 1000 últimas por jogador
const PAGINA_IDS = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 🎯 VETOR DE ALVOS — quem o backfill vai preencher.
//   • Vetor VAZIO  -> processa TODOS os jogadores da tabela `jogadores`.
//   • Com puuids   -> processa SÓ esses.
// A env PUUIDS (separada por vírgula) tem prioridade sobre o vetor abaixo.
const PUUIDS_ALVO = (
  process.env.PUUIDS
    ? process.env.PUUIDS.split(',').map((s) => s.trim()).filter(Boolean)
    : [
        '9t-kjlDiabw7Br6dj5pq4H7ulYloLp5DBVJAAydDdIjBxBp3oNXXG2Y-igp9j7XEGjGBTFuQPcxTfQ',
        'DitIIHgFfSgTu92vQZDadmBDDl6qr84NHnAuMiyk6EHv6GtGvRGH-K1_xg3PUNlAwdSJcCVudTQSrg',
        'p-yebFHaXORPI_xcZ2NJW6C2_oPP7wWH3BxIPl2OHfFPfnKHTk23acLjmWZ65ShHGNWBM0knAFbx6g',
        'kaEzM3m6zjWx3pijWPvRv7dJnKY0aDiSE_1O81kdc71IaZhHATt0E-Ws_66Q9NbV7j0y06QZWslznQ',
        'K_PROi5ZKvNuZd_F5meGTE-ZZ-IObaSLwHQrkRoogcmgpJEAHyCPtz1NzTPDwlUgMEXWULrmfJdDmw',
        'uTts_m9BnLW01TJYtrAXGZkMJ9oLK_g6VpDRRHvJqF26_R12mJeLjxulZZ29erBGawlEkXHQr3RfpA',
        'ppYb7FWcqkSxkrZljEngkhBBGh43uR--W0P2wmJmMXWSXv7jqPwAhJiEoAE8eRlOBCRORV-Q6I53lw',
        'ki7xmHfVKsYazm0hxbeNWM_WCl5R6KFgtoDn5vlT4_P1CK7Nr_OGocK3Z_jClSS5CTU5BwQr_oZCAQ',
        '3AJZQYxwnPwPv0fVWdaMX5RyOBs9edx_w1H9rRXoJySl4Z41eGAqRDfxguJSh0tAl2eMftuRm3FS-g',
        'FdJla6Emd2kxg6f_SMItj3APgBw0Ym3dIO_aTrwWE6Kb3NSVKmd7-nSEY_QpbfCuRU3vs4cSgweaYQ',
        'QG4BNY82vllniOvGQW6-Mk9SI6Zg-SyGUa062NUjRkaeZVsn-_fmXSE9WDI-R7AtS219UsR0jnBARA',
        'krvaMYD-6dN5nliuh1qnz77lMePOb_vYK-ZYSKBiUNmMYuYviHL89HPSDLH-Xie5xccno1LM_Pnv9Q',
        'l1SYhhZA0_LY70pLEakcAzYK8Itj98H_dsEjIplp9NF-y-rRV_xvflxsD5A8KepPVTGh0M6wxVYiDw',
        'ztMmU5x_lp4dTw2oY5HO3FwlxrPN1WQvshQbzSV1NSIlEgOJvK-0MK8LDAlbs-X_NJFr9kUQqvLpvw',
        'IkN1Su--BHnJN28-2PnD-bPWGby3BFDVHLzNpskPlJqdXgPrj0cmhD58pN897DdLf05x54wz7NtCIw',
      ]
);

// ----------------------------------------------------------------------------
// Infra: D1 (REST) + Riot (com resfriamento de chave e retry em 5xx)
// ----------------------------------------------------------------------------
async function queryD1(sql, params = []) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params })
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Erro no D1: ${JSON.stringify(data.errors)}`);
  return data.result[0];
}

let totalRequestsFeitas = 0;

// Contador GLOBAL compartilhado (mesma tabela api_usage lida pelo worker/front).
// Best-effort e SEM await: nunca deve atrasar nem derrubar o backfill.
function registrarUsoGlobal(source) {
  queryD1('INSERT INTO api_usage (ts, count, source, action) VALUES (?, ?, ?, ?)', [Date.now(), 1, source, 'riot_fetch'])
    .catch(() => {});
}

async function respeitarRateLimit() {
  if (totalRequestsFeitas >= 90) {
    console.log('⏳ [ESFRIANDO CHAVE] Quase no limite de 100 reqs. Pausando 2 min...');
    await sleep(125000);
    totalRequestsFeitas = 0;
  }
}

async function fetchFromRiot(endpoint, tentativa = 0) {
  await respeitarRateLimit();
  const response = await fetch(`https://${REGION_ROUTE}.api.riotgames.com${endpoint}`, {
    headers: { 'X-Riot-Token': RIOT_API_KEY }
  });
  totalRequestsFeitas++;
  registrarUsoGlobal('backfill');
  if (response.status === 429) {
    console.warn('⚠️ [RIOT LIMIT] Chave esquentou. Pausando 2 min...');
    await sleep(125000);
    totalRequestsFeitas = 0;
    return fetchFromRiot(endpoint, tentativa);
  }
  if (response.status >= 500 && tentativa < 3) {
    const espera = 2000 * (tentativa + 1);
    console.warn(`⚠️ [RIOT ${response.status}] transitório. Tentativa ${tentativa + 1}/3 em ${espera / 1000}s...`);
    await sleep(espera);
    return fetchFromRiot(endpoint, tentativa + 1);
  }
  if (response.status === 404) return null; // partida/timeline sumiu do lado da Riot
  if (!response.ok) throw new Error(`Riot ${response.status} em ${endpoint}`);
  return response.json();
}

// Lista todos os match_ids buscáveis de um puuid (todas as filas), paginando.
async function listarIdsRiot(puuid) {
  const ids = [];
  for (let start = 0; start < LIMITE_PARTIDAS; start += PAGINA_IDS) {
    const count = Math.min(PAGINA_IDS, LIMITE_PARTIDAS - start);
    const pagina = await fetchFromRiot(`/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${start}&count=${count}`);
    if (!pagina || pagina.length === 0) break;
    ids.push(...pagina);
    if (pagina.length < count) break;
  }
  return ids;
}

// match_ids que ESTE puuid já tem em estatisticas_jogador_partida (dentre os candidatos).
async function jaTemEstatisticas(puuid, candidatos) {
  const existentes = new Set();
  for (let i = 0; i < candidatos.length; i += 50) {
    const chunk = candidatos.slice(i, i + 50);
    const ph = chunk.map(() => '?').join(',');
    const res = await queryD1(
      `SELECT match_id FROM estatisticas_jogador_partida WHERE puuid = ? AND match_id IN (${ph})`,
      [puuid, ...chunk]
    );
    (res.results || []).forEach((row) => existentes.add(row.match_id));
  }
  return existentes;
}

// ----------------------------------------------------------------------------
// FASE 1 — Descoberta: quem falta em qual partida.
// ----------------------------------------------------------------------------
async function descobrirLacunas(jogadores) {
  const neededByMatch = new Map(); // match_id -> Set(puuid) que precisa dele
  const puuidToNome = new Map(jogadores.map((j) => [j.puuid, `${j.game_name}#${j.tag_line}`]));

  for (const jogador of jogadores) {
    const nome = puuidToNome.get(jogador.puuid);
    console.log(`\n🔎 [DESCOBERTA] ${nome}: listando partidas na Riot...`);
    const riotIds = await listarIdsRiot(jogador.puuid);
    const jaTem = await jaTemEstatisticas(jogador.puuid, riotIds);
    let faltam = 0;
    for (const id of riotIds) {
      if (jaTem.has(id)) continue;
      faltam++;
      if (!neededByMatch.has(id)) neededByMatch.set(id, new Set());
      neededByMatch.get(id).add(jogador.puuid);
    }
    console.log(`   Riot: ${riotIds.length} | já no D1: ${jaTem.size} | faltando: ${faltam}`);
  }
  return { neededByMatch, puuidToNome };
}

// ----------------------------------------------------------------------------
// FASE 2 — Preenchimento: uma partida por vez, todos os jogadores que faltam nela.
// ----------------------------------------------------------------------------
async function preencherPartida(matchId, puuidsNecessarios, contadores) {
  const matchData = await fetchFromRiot(`/lol/match/v5/matches/${matchId}`);
  if (!matchData || !matchData.info) {
    console.log(`   ⚠️ ${matchId}: detalhe indisponível na Riot (pulado).`);
    return;
  }
  const info = matchData.info;

  // Metadados globais (FK exige a partida antes das estatísticas).
  await queryD1(SQL_PARTIDAS, valoresPartida(matchId, info, montarTeams(info)));

  // Só os jogadores registrados que realmente jogaram esta partida E ainda faltam.
  const alvos = info.participants.filter((p) => puuidsNecessarios.has(p.puuid));
  if (alvos.length === 0) {
    console.log(`   ⚠️ ${matchId}: nenhum jogador-alvo encontrado nos participantes (pulado).`);
    return;
  }

  // Estatísticas de fim de jogo (uma linha por jogador-alvo).
  for (const participant of alvos) {
    await queryD1(SQL_ESTATISTICAS, valoresEstatisticas(participant.puuid, matchId, info, participant));
    contadores.estat++;
  }

  // Marcos: uma única timeline serve para TODOS os jogadores-alvo da partida.
  const timeline = await fetchFromRiot(`/lol/match/v5/matches/${matchId}/timeline`);
  if (timeline) {
    const linhas = [];
    for (const participant of alvos) {
      linhas.push(...extrairMarcos(participant.puuid, matchId, timeline));
    }
    // D1 tem teto de parâmetros por statement; marcos tem 52 colunas -> 1 linha por call,
    // mas disparadas em paralelo (D1 não é rate-limited como a Riot) para não serializar.
    await Promise.all(linhas.map((l) => queryD1(SQL_MARCOS, l)));
    contadores.marcos += linhas.length;
  }

  const nomes = alvos.map((p) => p.championName).join(', ');
  console.log(`   💾 ${matchId} | ${alvos.length} jogador(es): ${nomes}`);
}

// ----------------------------------------------------------------------------
// Orquestração
// ----------------------------------------------------------------------------
(async () => {
  if (!RIOT_API_KEY || !CF_ACCOUNT_ID || !CF_API_TOKEN || !D1_DATABASE_ID) {
    console.error('❌ Faltam variáveis de ambiente (RIOT_API_KEY / CLOUDFLARE_* / D1_DATABASE_ID).');
    process.exit(1);
  }

  console.log('=========================================================');
  console.log('🩹 BACKFILL CENTRADO NA PARTIDA (estatísticas + marcos)');
  console.log('=========================================================');

  const jogadoresRes = await queryD1('SELECT puuid, game_name, tag_line, has_premium FROM jogadores');
  let jogadores = jogadoresRes.results || [];

  // 🎯 Filtro do vetor de alvos: preenchido = só esses puuids (escape hatch manual,
  //    ignora o premium). Vetor vazio = processa SÓ jogadores premium.
  if (PUUIDS_ALVO.length) {
    const alvo = new Set(PUUIDS_ALVO);
    jogadores = jogadores.filter((j) => alvo.has(j.puuid));
    console.log(`🎯 [FILTRO] ${jogadores.length} de ${PUUIDS_ALVO.length} puuid(s) alvo encontrados no banco.`);
  } else {
    const antes = jogadores.length;
    jogadores = jogadores.filter((j) => Number(j.has_premium) === 1);
    console.log(`⭐ [PREMIUM] ${jogadores.length}/${antes} jogador(es) premium (vetor vazio → só premium).`);
  }

  const { neededByMatch } = await descobrirLacunas(jogadores);
  const matchIds = [...neededByMatch.keys()];
  console.log(`\n🎯 [PLANO] ${matchIds.length} partidas ÚNICAS a baixar (cada uma 1 só vez).`);

  if (matchIds.length === 0) {
    console.log('✨ Nada a preencher — o histórico já está completo.');
    return;
  }

  const contadores = { estat: 0, marcos: 0 };
  let feitas = 0;
  for (const matchId of matchIds) {
    try {
      await preencherPartida(matchId, neededByMatch.get(matchId), contadores);
    } catch (e) {
      console.error(`   ❌ Erro em ${matchId}: ${e.message}`);
    }
    feitas++;
    if (feitas % 25 === 0) console.log(`   … ${feitas}/${matchIds.length} partidas processadas`);
  }

  console.log('\n=========================================================');
  console.log(`✅ [FIM] ${feitas}/${matchIds.length} partidas | ${contadores.estat} estatísticas | ${contadores.marcos} marcos gravados.`);
  console.log('=========================================================');
})().catch((e) => {
  console.error('❌ [FALHA CRÍTICA]', e.message);
  process.exit(1);
});
