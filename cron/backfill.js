// ============================================================================
// BACKFILL COMPLETO — preenche o histórico antigo com TODOS os campos novos:
//   • team_position (corrige o balde "Outro" no front)
//   • colunas da migration 002 (champion_id, challenges, multikills, dano
//     detalhado, objetivos, sobrevivência, surrender, etc.)
//   • metadados da partida (game_version, game_mode, bans, team_objectives)
//   • timeline bruta (ouro/xp por minuto, ordem de itens) — salvo se faltar
//
// Marcador de "linha antiga": champion_id IS NULL. Toda linha gravada pelo código
// novo tem champion_id; as antigas (anteriores à migration 002) estão NULL.
//
// Como rodar:
//   RIOT_API_KEY=... CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... D1_DATABASE_ID=... \
//   node cron/backfill.js
//   (SKIP_TIMELINE=1 pula a coleta de timeline -> metade das requests, mais rápido)
// (ou via GitHub Actions: .github/workflows/backfill.yaml, gatilho manual)
//
// Estratégia: re-baixa cada match_id ÚNICO uma só vez e reescreve as linhas de
// todos os puuids daquela partida via INSERT OR REPLACE. Respeita o rate limit.
// Partidas que a Riot já expurgou retornam 404 e são contadas como falha (o dado
// não existe mais; o front já ignora esses jogos na contagem de rotas).
// ============================================================================

import { SQL_PARTIDAS, valoresPartida, montarTeams, SQL_ESTATISTICAS, valoresEstatisticas, SQL_TIMELINE, valoresTimeline } from './lib/match-extract.js';

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const SKIP_TIMELINE = process.env.SKIP_TIMELINE === '1' || process.env.SKIP_TIMELINE === 'true';

const REGION_ROUTE = 'americas';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
async function fetchFromRiot(endpoint) {
  if (totalRequestsFeitas >= 90) {
    console.log('⏳ [ESFRIANDO CHAVE] Quase no limite de 100 reqs. Pausando 2 min...');
    await sleep(125000);
    totalRequestsFeitas = 0;
  }
  const url = `https://${REGION_ROUTE}.api.riotgames.com${endpoint}`;
  const response = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
  totalRequestsFeitas++;
  if (response.status === 429) {
    console.warn('⚠️ [RIOT LIMIT] Chave esquentou! Pausando 2 min...');
    await sleep(125000);
    totalRequestsFeitas = 0;
    return fetchFromRiot(endpoint);
  }
  if (!response.ok) throw new Error(`Erro na Riot API: ${response.status}`);
  return response.json();
}

async function rodarBackfill() {
  console.log('=========================================================');
  console.log('🩹 [BACKFILL COMPLETO] Reescrevendo histórico antigo...');
  console.log(`   Timeline: ${SKIP_TIMELINE ? 'PULADA (SKIP_TIMELINE)' : 'incluída'}`);
  console.log('=========================================================');

  // Linhas anteriores à migration 002 (champion_id ainda NULL).
  const pendentes = await queryD1(
    `SELECT puuid, match_id FROM estatisticas_jogador_partida WHERE champion_id IS NULL`
  );
  const linhas = pendentes.results || [];
  console.log(`📋 Linhas pendentes (champion_id NULL): ${linhas.length}`);
  if (!linhas.length) {
    console.log('✨ Nada a fazer. Histórico já está completo.');
    return;
  }

  // Agrupa por match_id -> conjunto de puuids daquela partida que precisam de update
  const porPartida = new Map();
  for (const { puuid, match_id } of linhas) {
    if (!porPartida.has(match_id)) porPartida.set(match_id, new Set());
    porPartida.get(match_id).add(puuid);
  }
  console.log(`🎯 Partidas únicas para re-baixar: ${porPartida.size}`);

  // Timelines que já existem (pra não re-baixar à toa)
  const timelinesExistentes = new Set();
  if (!SKIP_TIMELINE) {
    try {
      const tl = await queryD1(`SELECT match_id FROM partidas_timeline`);
      (tl.results || []).forEach((r) => timelinesExistentes.add(r.match_id));
    } catch (e) { /* tabela pode não existir ainda */ }
  }

  let feitas = 0, atualizadas = 0, falhas = 0, timelines = 0;
  for (const [matchId, puuids] of porPartida) {
    feitas++;
    try {
      const matchData = await fetchFromRiot(`/lol/match/v5/matches/${matchId}`);
      const info = matchData.info;

      // Metadados globais da partida (patch, modo, bans, objetivos)
      await queryD1(SQL_PARTIDAS, valoresPartida(matchId, info, montarTeams(info)));

      // Reescreve a linha de cada puuid daquela partida
      for (const puuid of puuids) {
        const participant = info.participants.find((p) => p.puuid === puuid);
        if (!participant) continue;
        await queryD1(SQL_ESTATISTICAS, valoresEstatisticas(puuid, matchId, info, participant));
        atualizadas++;
      }

      // Timeline (+1 request) — só se ainda não temos
      if (!SKIP_TIMELINE && !timelinesExistentes.has(matchId)) {
        try {
          const tl = await fetchFromRiot(`/lol/match/v5/matches/${matchId}/timeline`);
          await queryD1(SQL_TIMELINE, valoresTimeline(matchId, tl));
          timelines++;
        } catch (tlErr) {
          console.warn(`   ⚠️ Timeline indisponível para ${matchId}: ${tlErr.message}`);
        }
      }

      if (feitas % 50 === 0) {
        console.log(`   ⏱️  Progresso: ${feitas}/${porPartida.size} partidas | ${atualizadas} linhas | ${timelines} timelines | ${falhas} falhas`);
      }
    } catch (err) {
      falhas++;
      console.warn(`   ❌ Falha na partida ${matchId}: ${err.message}`);
    }
  }

  console.log('=========================================================');
  console.log(`✅ [FIM] Partidas: ${feitas} | Linhas reescritas: ${atualizadas} | Timelines: ${timelines} | Falhas (404/expurgadas): ${falhas}`);
  console.log('=========================================================');
}

rodarBackfill().catch((e) => {
  console.error('❌ [FALHA CRÍTICA]', e.message);
  process.exit(1);
});
