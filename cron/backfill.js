// ============================================================================
// BACKFILL — preenche os campos analíticos (vision_score, control_wards,
// solo_kills, damage_champions, gold_per_min, kill_participation, summoner1/2_id,
// perk_keystone, perk_secondary_style) nas partidas JÁ gravadas que estão NULL.
//
// Como rodar:
//   RIOT_API_KEY=... CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... D1_DATABASE_ID=... \
//   node cron/backfill.js
// (ou via GitHub Actions: .github/workflows/backfill.yaml, gatilho manual)
//
// Estratégia: re-baixa cada match_id ÚNICO uma só vez e dá UPDATE em todas as
// linhas (puuids) daquela partida. Respeita o rate limit como o sync.js.
// ============================================================================

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;

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

function extrairAnaliticos(participant) {
  const ch = participant.challenges || {};
  return {
    vision_score: participant.visionScore ?? null,
    control_wards: participant.visionWardsBoughtInGame ?? null,
    solo_kills: ch.soloKills ?? null,
    damage_champions: participant.totalDamageDealtToChampions ?? null,
    gold_per_min: ch.goldPerMinute ?? null,
    kill_participation: ch.killParticipation ?? null,
    summoner1_id: participant.summoner1Id ?? null,
    summoner2_id: participant.summoner2Id ?? null,
    perk_keystone: participant.perks?.styles?.[0]?.selections?.[0]?.perk ?? null,
    perk_secondary_style: participant.perks?.styles?.[1]?.style ?? null
  };
}

async function rodarBackfill() {
  console.log('=========================================================');
  console.log('🩹 [BACKFILL] Preenchendo campos analíticos faltantes...');
  console.log('=========================================================');

  // Linhas que ainda não têm os dados (qualquer campo-chave NULL)
  const pendentes = await queryD1(
    `SELECT puuid, match_id FROM estatisticas_jogador_partida
     WHERE vision_score IS NULL OR summoner1_id IS NULL OR perk_keystone IS NULL`
  );
  const linhas = pendentes.results || [];
  console.log(`📋 Linhas pendentes: ${linhas.length}`);
  if (!linhas.length) {
    console.log('✨ Nada a fazer. Todos os campos já estão preenchidos.');
    return;
  }

  // Agrupa por match_id -> conjunto de puuids que precisam de update
  const porPartida = new Map();
  for (const { puuid, match_id } of linhas) {
    if (!porPartida.has(match_id)) porPartida.set(match_id, new Set());
    porPartida.get(match_id).add(puuid);
  }
  console.log(`🎯 Partidas únicas para re-baixar: ${porPartida.size}`);

  let feitas = 0, atualizadas = 0, falhas = 0;
  for (const [matchId, puuids] of porPartida) {
    feitas++;
    try {
      const matchData = await fetchFromRiot(`/lol/match/v5/matches/${matchId}`);
      for (const puuid of puuids) {
        const participant = matchData.info.participants.find((p) => p.puuid === puuid);
        if (!participant) continue;
        const a = extrairAnaliticos(participant);
        await queryD1(
          `UPDATE estatisticas_jogador_partida
           SET vision_score = ?, control_wards = ?, solo_kills = ?, damage_champions = ?,
               gold_per_min = ?, kill_participation = ?, summoner1_id = ?, summoner2_id = ?,
               perk_keystone = ?, perk_secondary_style = ?
           WHERE puuid = ? AND match_id = ?`,
          [
            a.vision_score, a.control_wards, a.solo_kills, a.damage_champions,
            a.gold_per_min, a.kill_participation, a.summoner1_id, a.summoner2_id,
            a.perk_keystone, a.perk_secondary_style, puuid, matchId
          ]
        );
        atualizadas++;
      }
      if (feitas % 25 === 0) console.log(`   ⏱️  Progresso: ${feitas}/${porPartida.size} partidas | ${atualizadas} linhas atualizadas`);
    } catch (err) {
      falhas++;
      console.warn(`   ❌ Falha na partida ${matchId}: ${err.message}`);
    }
  }

  console.log('=========================================================');
  console.log(`✅ [FIM] Partidas processadas: ${feitas} | Linhas atualizadas: ${atualizadas} | Falhas: ${falhas}`);
  console.log('=========================================================');
}

rodarBackfill().catch((e) => {
  console.error('❌ [FALHA CRÍTICA]', e.message);
  process.exit(1);
});
