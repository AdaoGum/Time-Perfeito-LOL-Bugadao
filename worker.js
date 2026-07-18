import {
  SQL_PARTIDAS, valoresPartida, montarTeams,
  SQL_ESTATISTICAS, valoresEstatisticas,
  SQL_MARCOS, extrairMarcos
} from "./shared/match-extract.js";

// ----------------------------------------------------------------------
// MIGRAÇÃO IDEMPOTENTE DO SCHEMA (roda 1x por isolate; ignora "duplicate column")
// As migrations "de verdade" vivem em migrations/*.sql; isto aqui é só a auto-cura
// que mantém o worker de pé mesmo num banco que ainda não recebeu alguma migration.
// São 3 cadeias INDEPENDENTES (maestrias / api_usage / jogadores) rodadas em
// PARALELO — cada statement engole o próprio erro de "coluna/tabela já existe" —,
// cortando pela metade a latência do cold start em relação ao encadeamento serial.
// ----------------------------------------------------------------------
let schemaReady = false;

// Executa um DDL e ignora o erro esperado quando o objeto já existe.
async function ddlSilencioso(env, sql) {
  try { await env.DB.prepare(sql).run(); } catch (e) { /* já existe */ }
}
// Roda uma sequência de DDLs em ordem (o CREATE precisa vir antes dos ALTER/INDEX dele).
async function ddlEmSequencia(env, sqls) {
  for (const sql of sqls) await ddlSilencioso(env, sql);
}

async function ensureSchema(env) {
  if (schemaReady) return;
  await Promise.all([
    // Cadeia 1 — tabela `maestrias` (não vem de migração) + colunas de milestone
    // (migrations/006_maestrias.sql). Sem elas o upsert de maestrias falhava calado.
    ddlEmSequencia(env, [
      "CREATE TABLE IF NOT EXISTS maestrias (puuid TEXT NOT NULL, champion_id INTEGER NOT NULL, champion_level INTEGER, champion_points INTEGER, last_play_time INTEGER, season_milestone INTEGER, milestone_grades TEXT, mark_required_next_level INTEGER, atualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (puuid, champion_id))",
      "ALTER TABLE maestrias ADD COLUMN season_milestone INTEGER",
      "ALTER TABLE maestrias ADD COLUMN milestone_grades TEXT",
      "ALTER TABLE maestrias ADD COLUMN mark_required_next_level INTEGER"
    ]),
    // Cadeia 2 — contador global de chamadas (migrations/003_api_usage.sql) + índice.
    ddlEmSequencia(env, [
      "CREATE TABLE IF NOT EXISTS api_usage (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, count INTEGER NOT NULL, source TEXT, action TEXT)",
      "CREATE INDEX IF NOT EXISTS idx_api_usage_ts ON api_usage (ts)"
    ]),
    // Cadeia 3 — colunas de CACHE de perfil em `jogadores` (migrations/004+005).
    // SQLite/D1 não tem "ADD COLUMN IF NOT EXISTS" -> tenta uma a uma, ignora duplicata.
    ddlEmSequencia(env, [
      "ALTER TABLE jogadores ADD COLUMN platform_host TEXT",
      "ALTER TABLE jogadores ADD COLUMN solo_wins INTEGER",
      "ALTER TABLE jogadores ADD COLUMN solo_losses INTEGER",
      "ALTER TABLE jogadores ADD COLUMN flex_wins INTEGER",
      "ALTER TABLE jogadores ADD COLUMN flex_losses INTEGER",
      "ALTER TABLE jogadores ADD COLUMN has_premium INTEGER NOT NULL DEFAULT 0"
    ])
  ]);
  schemaReady = true;
}

// Busca no D1 (case-insensitive) um jogador já conhecido pelo nome#tag. Serve como
// atalho para NÃO gastar a chave da Riot (account/summoner/league/shard) quando já
// temos o cadastro salvo. Retorna a linha inteira de `jogadores` ou undefined.
async function loadCachedPlayer(env, gameName, tagLine) {
  try {
    return await env.DB.prepare(
      "SELECT * FROM jogadores WHERE game_name = ? COLLATE NOCASE AND tag_line = ? COLLATE NOCASE LIMIT 1"
    ).bind(gameName, tagLine).first();
  } catch (e) {
    return null;
  }
}

// ----------------------------------------------------------------------
// AUTENTICAÇÃO DO PAINEL ADMIN (Ancestralidade + premium)
// Fecha por padrão ("fail closed"): sem o secret ADMIN_PASSWORD configurado no
// Worker, TODAS as rotas admin ficam indisponíveis (503) — nada de senha embutida
// no código. As rotas de leitura (admin_all_history / admin_players_list) e de
// escrita (admin_set_premium) usam este mesmo portão, validado no SERVIDOR.
// Retorna { ok: true } ou { ok: false, status, error }.
// ----------------------------------------------------------------------
function verificarAdmin(env, password) {
  const esperada = env.ADMIN_PASSWORD;
  if (!esperada) {
    return { ok: false, status: 503, error: "Painel administrativo indisponível: o segredo ADMIN_PASSWORD não está configurado no Worker." };
  }
  if (String(password || "") !== String(esperada)) {
    return { ok: false, status: 403, error: "Senha inválida." };
  }
  return { ok: true };
}

// ----------------------------------------------------------------------
// CONTADOR GLOBAL DE CHAMADAS À RIOT (janela deslizante compartilhada no D1)
// Reflete o consumo REAL da chave por TODOS: buscas no site + cron/backfill.
// Assim o orçamento aparece igual para todos os usuários e podemos recusar
// buscas quando estoura (protegendo contra o 429 da própria Riot).
// ----------------------------------------------------------------------
const RATE_WINDOW_MS = 120000;  // janela de 2 min (limite da chave de dev)
const RATE_LIMIT = 100;         // 100 chamadas / 2 min
const RIOT_ACTIONS = new Set(["profile_overview", "visão_geral_do_perfil", "profile_brief", "masteries", "fetch_recent_matches"]);

// Soma as chamadas dentro da janela e calcula quanto falta para o reset.
async function sumUsageGlobal(env, now = Date.now()) {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(count), 0) AS used, MIN(ts) AS oldest FROM api_usage WHERE ts > ?"
  ).bind(now - RATE_WINDOW_MS).first();
  const used = Number(row?.used || 0);
  const oldest = row?.oldest ? Number(row.oldest) : null;
  const resetMs = oldest ? Math.max(0, (oldest + RATE_WINDOW_MS) - now) : 0;
  return { used, limit: RATE_LIMIT, available: Math.max(0, RATE_LIMIT - used), resetMs, windowMs: RATE_WINDOW_MS };
}

// Grava (em background) as chamadas reais feitas por este request + poda o histórico.
function recordUsageGlobal(env, ctx, count, source, action, now = Date.now()) {
  if (!count || count <= 0) return;
  ctx.waitUntil((async () => {
    try {
      await env.DB.prepare("INSERT INTO api_usage (ts, count, source, action) VALUES (?, ?, ?, ?)")
        .bind(now, count, source, action || null).run();
      // Poda oportunista: descarta o que já saiu de uma janela generosa (10 min).
      await env.DB.prepare("DELETE FROM api_usage WHERE ts < ?").bind(now - 10 * 60 * 1000).run();
    } catch (e) { /* telemetria é best-effort, nunca derruba o request */ }
  })());
}

// ----------------------------------------------------------------------
// EXTRAÇÃO ANALÍTICA (match-v5) — importada de shared/match-extract.js (fonte
// única compartilhada com cron/sync.js e cron/backfill.js). Ver import no topo.
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// HELPERS DE PERFIL/PARTIDAS — compartilhados por `profile_overview` (busca
// barata) e `fetch_recent_matches` (botão "buscar últimos 10" / auto-10 do
// jogador novo). Cada helper devolve também o nº de chamadas REAIS à Riot.
// ----------------------------------------------------------------------
const ROUTING_AMERICAS = "https://americas.api.riotgames.com";
const QUEUE_MAP = { 420: "Ranked Solo", 440: "Ranked Flex", 400: "Normal Draft", 430: "Normal Blind", 450: "ARAM", 1700: "Arena" };
// Máx. de partidas baixadas por interação (auto-10 do jogador novo e botão
// "buscar últimos 10"): 10×2 chamadas + ~6 fixas cabem folgadas no orçamento.
const MAX_PARTIDAS_POR_BUSCA = 10;

// IDs ranqueados recentes (50 Solo/Duo + 25 Flex). Custo fixo: 2 chamadas.
async function buscarIdsRecentes(apiKey, puuid) {
  const [soloRes, flexRes] = await Promise.all([
    fetch(`${ROUTING_AMERICAS}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=50&queue=420&api_key=${apiKey}`),
    fetch(`${ROUTING_AMERICAS}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=25&queue=440&api_key=${apiKey}`)
  ]);
  const soloIds = soloRes.ok ? await soloRes.json() : [];
  const flexIds = flexRes.ok ? await flexRes.json() : [];
  return { recentIds: [...new Set([...soloIds, ...flexIds])], apiCalls: 2 };
}

// Quais desses IDs ainda NÃO têm estatísticas DESTE puuid no D1. A checagem é
// POR JOGADOR (não na tabela global `partidas`) — paridade com cron/sync.js.
async function filtrarIneditas(env, puuid, recentIds) {
  if (!recentIds.length) return [];
  const placeholders = recentIds.map(() => "?").join(",");
  const { results: existing } = await env.DB.prepare(
    `SELECT match_id FROM estatisticas_jogador_partida WHERE puuid = ? AND match_id IN (${placeholders})`
  ).bind(puuid, ...recentIds).all();
  const known = new Set((existing || []).map(r => r.match_id));
  return recentIds.filter(id => !known.has(id));
}

// Atualiza ícone/nível (summoner-v4) + elo/LP (league-v4) na Riot e persiste tudo
// no D1 (W/L e plataforma inclusos, p/ servir do cache depois). Custo: 2 chamadas.
// `atual` traz os valores vigentes (do cache) usados como fallback.
async function atualizarPerfilRiot(env, apiKey, { puuid, gameName, tagLine, platformHost }, atual) {
  const routingPlatform = `https://${platformHost}.api.riotgames.com`;
  let { profileIconId, summonerLevel, statsSolo, statsFlex } = atual;
  let apiCalls = 0;

  apiCalls++;
  const summonerRes = await fetch(`${routingPlatform}/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${apiKey}`);
  if (summonerRes.ok) {
    const sData = await summonerRes.json();
    profileIconId = sData.profileIconId;
    summonerLevel = sData.summonerLevel;
  }

  apiCalls++;
  const leagueRes = await fetch(`${routingPlatform}/lol/league/v4/entries/by-puuid/${puuid}?api_key=${apiKey}`);
  if (leagueRes.ok) {
    const leagueData = await leagueRes.json();
    if (leagueData && leagueData.length > 0) {
      const soloData = leagueData.find(q => q.queueType === "RANKED_SOLO_5x5");
      if (soloData) { statsSolo = { wins: soloData.wins, losses: soloData.losses, winRate: (soloData.wins / (soloData.wins + soloData.losses)) * 100 || 0, tier: soloData.tier, rank: soloData.rank, lp: soloData.leaguePoints }; }
      const flexData = leagueData.find(q => q.queueType === "RANKED_FLEX_SR");
      if (flexData) { statsFlex = { wins: flexData.wins, losses: flexData.losses, winRate: (flexData.wins / (flexData.wins + flexData.losses)) * 100 || 0, tier: flexData.tier, rank: flexData.rank, lp: flexData.leaguePoints }; }
    }
  }

  try {
    await env.DB.prepare(`
      INSERT INTO jogadores (puuid, game_name, tag_line, tier, rank, lp, win_rate, flex_tier, flex_rank, flex_lp, flex_win_rate, profile_icon_id, summoner_level, platform_host, solo_wins, solo_losses, flex_wins, flex_losses, ultima_atualizacao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(puuid) DO UPDATE SET
        game_name = excluded.game_name,
        tag_line = excluded.tag_line,
        tier = excluded.tier,
        rank = excluded.rank,
        lp = excluded.lp,
        win_rate = excluded.win_rate,
        flex_tier = excluded.flex_tier,
        flex_rank = excluded.flex_rank,
        flex_lp = excluded.flex_lp,
        flex_win_rate = excluded.flex_win_rate,
        profile_icon_id = excluded.profile_icon_id,
        summoner_level = excluded.summoner_level,
        platform_host = excluded.platform_host,
        solo_wins = excluded.solo_wins,
        solo_losses = excluded.solo_losses,
        flex_wins = excluded.flex_wins,
        flex_losses = excluded.flex_losses,
        ultima_atualizacao = CURRENT_TIMESTAMP
    `).bind(
      puuid, gameName, tagLine,
      statsSolo.tier, statsSolo.rank, statsSolo.lp, statsSolo.winRate,
      statsFlex.tier, statsFlex.rank, statsFlex.lp, statsFlex.winRate,
      profileIconId, summonerLevel, platformHost,
      statsSolo.wins, statsSolo.losses, statsFlex.wins, statsFlex.losses
    ).run();
  } catch (dbError) {
    console.error("Erro D1:", dbError.message);
  }

  return { profileIconId, summonerLevel, statsSolo, statsFlex, apiCalls };
}

// Baixa o detalhe de UMA partida, grava partidas+estatísticas+marcos no D1 (em
// segundo plano) e devolve o card pro front. Custo: 2 chamadas quando o detalhe
// responde (resumo + timeline agendada), 1 quando o detalhe falha.
async function baixarPartida(env, ctx, apiKey, playerPuuid, matchId) {
  let calls = 0;
  try {
    calls++;
    const detailRes = await fetch(`${ROUTING_AMERICAS}/lol/match/v5/matches/${matchId}?api_key=${apiKey}`);
    if (!detailRes.ok) return { match: null, calls };
    const detail = await detailRes.json();
    const info = detail.info;

    const participant = info.participants.find(p => p.puuid === playerPuuid);
    if (!participant) return { match: null, calls };

    const teams = montarTeams(info);

    // 🌟 Campos analíticos (mesma extração usada no cron/sync.js)
    const ch = participant.challenges || {};
    const keystone = participant.perks?.styles?.[0]?.selections?.[0]?.perk ?? null;
    const secondaryStyle = participant.perks?.styles?.[1]?.style ?? null;

    // A timeline é uma chamada extra à Riot — contabiliza no orçamento.
    calls++;

    ctx.waitUntil((async () => {
      try {
        // Metadados globais (patch, modo, fila, bans, objetivos dos times)
        await env.DB.prepare(SQL_PARTIDAS).bind(...valoresPartida(matchId, info, teams)).run();

        // Estatísticas consolidadas de fim de jogo (FK exige isto antes dos marcos)
        await env.DB.prepare(SQL_ESTATISTICAS).bind(...valoresEstatisticas(playerPuuid, matchId, info, participant)).run();

        // Timeline detalhada -> extrai Marcos Temporais (52 colunas) -> descarta o JSON pesado.
        // Paridade total com o trator da madrugada (cron/sync.js).
        const tlRes = await fetch(`${ROUTING_AMERICAS}/lol/match/v5/matches/${matchId}/timeline?api_key=${apiKey}`);
        if (tlRes.ok) {
          const tl = await tlRes.json();
          const marcos = extrairMarcos(playerPuuid, matchId, tl);
          if (marcos.length) {
            const stmt = env.DB.prepare(SQL_MARCOS);
            await env.DB.batch(marcos.map(linha => stmt.bind(...linha)));
          }
        }
      } catch (err) { }
    })());

    return {
      match: {
        matchId,
        win: participant.win,
        queueType: QUEUE_MAP[info.queueId] || "Outro Modo",
        queueId: info.queueId,
        championName: participant.championName,
        teamPosition: participant.teamPosition,
        gameDuration: info.gameDuration,
        gameStartTimestamp: info.gameStartTimestamp,
        gameCreation: info.gameCreation,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        item0: participant.item0, item1: participant.item1, item2: participant.item2, item3: participant.item3, item4: participant.item4, item5: participant.item5, item6: participant.item6,
        totalMinionsKilled: participant.totalMinionsKilled, neutralMinionsKilled: participant.neutralMinionsKilled, firstBloodKill: participant.firstBloodKill, visionWardsBoughtInGame: participant.visionWardsBoughtInGame,
        visionScore: participant.visionScore ?? null,
        controlWards: participant.visionWardsBoughtInGame ?? null,
        soloKills: ch.soloKills ?? null,
        damageChampions: participant.totalDamageDealtToChampions ?? null,
        goldPerMin: ch.goldPerMinute ?? null,
        killParticipation: ch.killParticipation ?? null,
        summoner1Id: participant.summoner1Id ?? null,
        summoner2Id: participant.summoner2Id ?? null,
        perkKeystone: keystone,
        perkSecondaryStyle: secondaryStyle,
        players: teams
      },
      calls
    };
  } catch (e) { return { match: null, calls }; }
}

// Baixa VÁRIAS partidas em lotes de 5 (respeita o rate limit sem serializar tudo).
async function baixarPartidasEmLotes(env, ctx, apiKey, puuid, matchIds) {
  const matches = [];
  let apiCalls = 0;
  for (let i = 0; i < matchIds.length; i += 5) {
    const lote = matchIds.slice(i, i + 5);
    const parcial = await Promise.all(lote.map(id => baixarPartida(env, ctx, apiKey, puuid, id)));
    for (const r of parcial) {
      apiCalls += r.calls;
      if (r.match) matches.push(r.match);
    }
  }
  return { matches, apiCalls };
}

// Lê até 100 partidas detalhadas do D1 (cards do histórico; 0 chamadas à Riot).
async function lerPartidasD1(env, puuid) {
  const { results: cachePartidas } = await env.DB.prepare(`
    SELECT e.*, p.game_duration AS p_game_duration, p.game_creation AS p_game_creation, p.queue_id AS p_queue_id, p.participants
    FROM estatisticas_jogador_partida e
    JOIN partidas p ON e.match_id = p.match_id
    WHERE e.puuid = ?
    ORDER BY p.game_creation DESC
    LIMIT 100
  `).bind(puuid).all();

  return (cachePartidas || []).map(row => {
    const items = JSON.parse(row.items || "[0,0,0,0,0,0]");
    return {
      matchId: row.match_id,
      win: row.win === 1,
      queueType: QUEUE_MAP[row.p_queue_id] || "Dados Guardados (D1)",
      championName: row.champion_name,
      teamPosition: row.team_position || "UNKNOWN",
      gameDuration: row.p_game_duration,
      gameStartTimestamp: row.p_game_creation,
      gameCreation: row.p_game_creation,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      item0: items[0] || 0, item1: items[1] || 0, item2: items[2] || 0, item3: items[3] || 0, item4: items[4] || 0, item5: items[5] || 0, item6: 0,
      totalMinionsKilled: row.cs || 0, neutralMinionsKilled: 0, firstBloodKill: false, visionWardsBoughtInGame: row.control_wards || 0,
      visionScore: row.vision_score ?? null,
      controlWards: row.control_wards ?? null,
      soloKills: row.solo_kills ?? null,
      damageChampions: row.damage_champions ?? null,
      goldPerMin: row.gold_per_min ?? null,
      killParticipation: row.kill_participation ?? null,
      summoner1Id: row.summoner1_id ?? null,
      summoner2Id: row.summoner2_id ?? null,
      perkKeystone: row.perk_keystone ?? null,
      perkSecondaryStyle: row.perk_secondary_style ?? null,
      players: row.participants ? JSON.parse(row.participants) : []
    };
  });
}

// Combina partidas frescas (topo) + cache do D1, sem duplicar, por data desc, máx. 100.
function combinarPartidas(freshMatches, cachedMatches) {
  const seen = new Set();
  return [...freshMatches, ...cachedMatches]
    .filter(m => {
      if (m.matchId && seen.has(m.matchId)) return false;
      if (m.matchId) seen.add(m.matchId);
      return true;
    })
    .sort((a, b) => (b.gameCreation || b.gameStartTimestamp || 0) - (a.gameCreation || a.gameStartTimestamp || 0))
    .slice(0, 100);
}

// Base analítica leve do D1 (até 1000 jogos) para a "Análise do Jogador".
async function lerProficienciaD1(env, puuid) {
  try {
    const { results: profRows } = await env.DB.prepare(`
      SELECT e.champion_name, e.champion_id, e.win, e.kills, e.deaths, e.assists, e.team_position, e.cs,
             e.gold_earned, e.gold_per_min, e.damage_champions, e.damage_taken, e.damage_mitigated,
             e.vision_score, e.control_wards, e.wards_placed, e.wards_killed,
             e.kill_participation, e.total_time_spent_dead,
             e.solo_kills, e.double_kills, e.triple_kills, e.quadra_kills, e.penta_kills,
             e.total_heal_teammates, e.damage_shielded_teammates,
             p.queue_id, p.game_creation, p.game_duration, p.game_version
      FROM estatisticas_jogador_partida e
      JOIN partidas p ON e.match_id = p.match_id
      WHERE e.puuid = ?
      ORDER BY p.game_creation DESC
      LIMIT 1000
    `).bind(puuid).all();
    return (profRows || []).map(row => ({
      championName: row.champion_name,
      championId: row.champion_id,
      win: row.win === 1,
      kills: row.kills, deaths: row.deaths, assists: row.assists,
      teamPosition: row.team_position || "",
      queueId: row.queue_id,
      gameCreation: row.game_creation,
      gameVersion: row.game_version || null,
      cs: row.cs || 0,
      gameDuration: row.game_duration || 0,
      goldEarned: row.gold_earned ?? 0,
      goldPerMin: row.gold_per_min ?? 0,
      damageChampions: row.damage_champions ?? 0,
      damageTaken: row.damage_taken ?? 0,
      damageMitigated: row.damage_mitigated ?? 0,
      visionScore: row.vision_score ?? 0,
      controlWards: row.control_wards ?? 0,
      wardsPlaced: row.wards_placed ?? 0,
      wardsKilled: row.wards_killed ?? 0,
      killParticipation: row.kill_participation ?? null,
      totalTimeSpentDead: row.total_time_spent_dead ?? 0,
      soloKills: row.solo_kills ?? 0,
      doubleKills: row.double_kills ?? 0,
      tripleKills: row.triple_kills ?? 0,
      quadraKills: row.quadra_kills ?? 0,
      pentaKills: row.penta_kills ?? 0,
      totalHealTeammates: row.total_heal_teammates ?? 0,
      damageShieldedTeammates: row.damage_shielded_teammates ?? 0
    }));
  } catch (e) { return []; }
}

// Fallback quando o D1 ainda está vazio (jogador novo): deriva a base analítica
// das partidas recém-baixadas em memória.
function proficienciaDasPartidas(realMatches) {
  return realMatches.map(m => ({
    championName: m.championName,
    win: m.win,
    kills: m.kills, deaths: m.deaths, assists: m.assists,
    teamPosition: m.teamPosition || "",
    queueId: m.queueId || 0,
    gameCreation: m.gameCreation || m.gameStartTimestamp || 0,
    cs: (m.totalMinionsKilled || 0) + (m.neutralMinionsKilled || 0),
    gameDuration: m.gameDuration || 0,
    goldEarned: 0,
    goldPerMin: m.goldPerMin ?? 0,
    damageChampions: m.damageChampions ?? 0,
    visionScore: m.visionScore ?? 0,
    controlWards: m.controlWards ?? 0,
    killParticipation: m.killParticipation ?? null,
    soloKills: m.soloKills ?? 0,
    doubleKills: 0, tripleKills: 0, quadraKills: 0, pentaKills: 0
  }));
}

// Companheiros por fila (quem mais jogou com ele) — leitura do D1, 0 chamadas.
async function lerCompanionsD1(env, puuid, selfNameRaw) {
  const companions = { solo: [], flex: [] };
  try {
    const { results: coRows } = await env.DB.prepare(`
      SELECT p.queue_id AS queue_id, p.participants AS participants
      FROM estatisticas_jogador_partida e
      JOIN partidas p ON e.match_id = p.match_id
      WHERE e.puuid = ? AND p.participants IS NOT NULL
      ORDER BY p.game_creation DESC
      LIMIT 400
    `).bind(puuid).all();

    const countSolo = {};
    const countFlex = {};
    const selfName = (selfNameRaw || "").toLowerCase().trim();
    for (const row of coRows || []) {
      const bucket = row.queue_id === 440 ? countFlex : (row.queue_id === 420 ? countSolo : null);
      if (!bucket) continue;
      let players;
      try { players = JSON.parse(row.participants); } catch (e) { continue; }
      if (!Array.isArray(players)) continue;
      for (const pl of players) {
        const nm = (pl?.gameName || "").trim();
        if (!nm || nm.toLowerCase() === selfName) continue;
        const key = pl.tagLine ? `${nm}#${pl.tagLine}` : nm;
        bucket[key] = (bucket[key] || 0) + 1;
      }
    }
    const top5 = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, games]) => ({ name, games }));
    companions.solo = top5(countSolo);
    companions.flex = top5(countFlex);
  } catch (e) { }
  return companions;
}

export default {
  async fetch(request, env, ctx) {
    // ----------------------------------------------------------------------
    // 1. CONFIGURAÇÃO DE SEGURANÇA (CORS)
    // ----------------------------------------------------------------------
    const allowedOrigins = [
      "https://ugabugatimeperfeito.bugadao.com",
      "http://localhost:5173",
      "http://localhost:8080",
      "http://localhost:3000",
      "http://127.0.0.1:5173"
    ];

    const requestOrigin = request.headers.get("Origin");
    const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : "https://ugabugatimeperfeito.bugadao.com";

    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Origem não autorizada." }), 
        { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://ugabugatimeperfeito.bugadao.com" } }
      );
    }

    // ----------------------------------------------------------------------
    // 2. CAPTURA DE PARÂMETROS
    // ----------------------------------------------------------------------
    let action, gameName, tagLine, puuid, refresh, q, premium, password, limit;

    if (request.method === "POST") {
      try {
        const body = await request.json();
        action = body.action;
        gameName = body.gameName;
        tagLine = body.tagLine;
        puuid = body.puuid;
        refresh = body.refresh === true;
        q = body.q;
        premium = body.premium;
        password = body.password;
        limit = body.limit;
      } catch (e) {
        return new Response(JSON.stringify({ error: "JSON inválido." }), { status: 400, headers: corsHeaders });
      }
    } else if (request.method === "GET") {
      const url = new URL(request.url);
      action = url.searchParams.get("action");
      gameName = url.searchParams.get("gameName");
      tagLine = url.searchParams.get("tagLine");
      puuid = url.searchParams.get("puuid");
      refresh = url.searchParams.get("refresh") === "true";
      q = url.searchParams.get("q");
    }

    const API_KEY = env.RIOT_API_KEY;
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: "Chave RIOT_API_KEY ausente." }), { status: 401, headers: corsHeaders });
    }

    // Garante a tabela do contador global antes de qualquer leitura/escrita de uso.
    await ensureSchema(env);

    // Rota leve de status do contador global (só LÊ o D1, não gasta a chave da Riot).
    // O front faz polling disto para todos verem o mesmo número ao vivo.
    // Autocomplete de jogadores: sugere até 5 nomes do D1 que contenham o texto
    // digitado (prefixo primeiro). Só LÊ o banco — não gasta a chave da Riot.
    if (action === "player_suggest") {
      const termo = String(q || "").trim();
      if (termo.length < 1) {
        return new Response(JSON.stringify({ suggestions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        // Escapa curingas do LIKE para tratar o texto como literal.
        const safe = termo.replace(/[\\%_]/g, (c) => `\\${c}`);
        const contains = `%${safe}%`;
        const prefix = `${safe}%`;
        const { results } = await env.DB.prepare(`
          SELECT game_name, tag_line, profile_icon_id, tier, rank, flex_tier, flex_rank
          FROM jogadores
          WHERE game_name LIKE ?1 ESCAPE '\\' COLLATE NOCASE
             OR (game_name || '#' || tag_line) LIKE ?1 ESCAPE '\\' COLLATE NOCASE
          ORDER BY CASE WHEN game_name LIKE ?2 ESCAPE '\\' COLLATE NOCASE THEN 0 ELSE 1 END, game_name
          LIMIT 5
        `).bind(contains, prefix).all();
        return new Response(JSON.stringify({ suggestions: results || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        // Best-effort: em erro devolve lista vazia (não quebra a busca).
        return new Response(JSON.stringify({ suggestions: [], error: err.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "rate_status") {
      const rate = await sumUsageGlobal(env);
      return new Response(JSON.stringify(rate), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Antes de qualquer ação que gaste a chave, checa o orçamento GLOBAL compartilhado.
    // Se já estourou, recusa sem chamar a Riot (o front mostra o aviso).
    let usageBefore = { used: 0, available: RATE_LIMIT };
    if (RIOT_ACTIONS.has(action)) {
      usageBefore = await sumUsageGlobal(env);
      if (usageBefore.used >= RATE_LIMIT) {
        return new Response(JSON.stringify({
          error: "Limite global da API da Riot atingido. Nenhuma busca pode ser feita agora — aguarde o reset.",
          rateLimited: true,
          rate: usageBefore
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ======================================================================
    // ROTA: VISÃO GERAL DO PERFIL
    // ======================================================================
    if (action === "profile_overview" || action === "visão_geral_do_perfil" || action === "profile_brief") {
      if (!gameName || !tagLine) {
        return new Response(JSON.stringify({ error: "Faltam parâmetros." }), { status: 400, headers: corsHeaders });
      }

      const includeMatches = action === "profile_overview" || action === "visão_geral_do_perfil";

      // 🌟 Conta apenas as chamadas REAIS à API da Riot (leituras do D1 não entram).
      // É devolvido no JSON para o front contabilizar o orçamento de rate limit com precisão.
      let apiCalls = 0;

      // ----------------------------------------------------------------------
      // IDENTIDADE + ESTADO: tenta servir do D1 (0 chamadas à Riot). Só bate na
      // Riot quando o jogador ainda NÃO é conhecido (1ª visita) — aí resolve
      // puuid (account-v1) e a plataforma (active-shards) e marca para buscar elo.
      // ----------------------------------------------------------------------
      const cached = await loadCachedPlayer(env, gameName, tagLine);

      let playerPuuid, exactGameName, exactTagLine;
      let platformHost = 'br1';
      let profileIconId = 29;
      let summonerLevel = 0;
      let statsSolo = { wins: 0, losses: 0, winRate: 0, tier: "UNRANKED", rank: "", lp: 0 };
      let statsFlex = { wins: 0, losses: 0, winRate: 0, tier: "UNRANKED", rank: "", lp: 0 };
      // Sem cache (1ª visita) o elo/ícone precisam vir frescos da Riot de qualquer jeito.
      let precisaPerfilFresco = false;

      if (cached && cached.puuid) {
        playerPuuid = cached.puuid;
        exactGameName = cached.game_name;
        exactTagLine = cached.tag_line;
        platformHost = cached.platform_host || 'br1';
        profileIconId = cached.profile_icon_id ?? 29;
        summonerLevel = cached.summoner_level ?? 0;
        statsSolo = { wins: cached.solo_wins ?? 0, losses: cached.solo_losses ?? 0, winRate: cached.win_rate ?? 0, tier: cached.tier || "UNRANKED", rank: cached.rank || "", lp: cached.lp ?? 0 };
        statsFlex = { wins: cached.flex_wins ?? 0, losses: cached.flex_losses ?? 0, winRate: cached.flex_win_rate ?? 0, tier: cached.flex_tier || "UNRANKED", rank: cached.flex_rank || "", lp: cached.flex_lp ?? 0 };
        // 1ª visita após o deploy: cache novo ainda vazio (plataforma ou V/D nunca gravados).
        // Faz UM refresh para preencher as colunas — depois as próximas visitas ficam baratas.
        if (cached.platform_host == null || cached.solo_wins == null) precisaPerfilFresco = true;
      } else {
        apiCalls++;
        const accountRes = await fetch(`${ROUTING_AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
        if (!accountRes.ok) {
          recordUsageGlobal(env, ctx, apiCalls, "worker", action);
          return new Response(JSON.stringify({ error: "Jogador não encontrado." }), { status: accountRes.status, headers: corsHeaders });
        }
        const accountData = await accountRes.json();
        playerPuuid = accountData.puuid;
        exactGameName = accountData.gameName;
        exactTagLine = accountData.tagLine;

        try {
          apiCalls++;
          const shardRes = await fetch(`${ROUTING_AMERICAS}/riot/account/v1/active-shards/by-game/lol/by-puuid/${playerPuuid}?api_key=${API_KEY}`);
          if (shardRes.ok) {
            const shardData = await shardRes.json();
            platformHost = (shardData.platform || shardData.shard || 'br1').toString().toLowerCase();
          }
        } catch (e) { }

        precisaPerfilFresco = true;
      }

      // Premium vem do cadastro (jogador novo nasce 0 — o INSERT usa o DEFAULT).
      const hasPremium = cached ? Number(cached.has_premium) === 1 : false;

      // Wrapper do helper de módulo: aplica o resultado nas variáveis locais.
      // Custo: 2 chamadas. Só é chamado quando há dado novo: 1ª visita ou partida nova.
      const refrescarPerfil = async () => {
        const r = await atualizarPerfilRiot(env, API_KEY,
          { puuid: playerPuuid, gameName: exactGameName, tagLine: exactTagLine, platformHost },
          { profileIconId, summonerLevel, statsSolo, statsFlex });
        profileIconId = r.profileIconId;
        summonerLevel = r.summonerLevel;
        statsSolo = r.statsSolo;
        statsFlex = r.statsFlex;
        apiCalls += r.apiCalls;
      };

      let realMatches = [];
      let proficiencyMatches = [];
      let hadNewGames = false;
      let pendingCount = 0;
      // Jogador 100% novo (não estava no banco): ganha o auto-download das 10 últimas.
      const isNovoJogador = !cached;

      if (includeMatches) {
        try {
          await ensureSchema(env);

          // Cache do D1 PRIMEIRO (as partidas novas gravam via waitUntil — ler antes
          // do download evita corrida de leitura) — 0 chamadas à Riot.
          const cachedMatches = await lerPartidasD1(env, playerPuuid);

          // Verificação de novidades (2 chamadas fixas): IDs ranqueados recentes
          // versus o que já está gravado DESTE puuid no D1.
          const { recentIds, apiCalls: idsCalls } = await buscarIdsRecentes(API_KEY, playerPuuid);
          apiCalls += idsCalls;
          const newIds = await filtrarIneditas(env, playerPuuid, recentIds);

          // 🌟 GATILHO DE ECONOMIA: ícone/elo (2 chamadas) só quando há partida
          // ranqueada nova — elo só muda jogando ranqueada, que aparece como ID novo.
          hadNewGames = newIds.length > 0;
          if (precisaPerfilFresco || hadNewGames) {
            await refrescarPerfil();
          }

          // 🌟 BUSCA BARATA: jogador CONHECIDO não baixa partida nenhuma aqui — o
          // front exibe "pendingCount jogos não buscados" e um botão que dispara a
          // action fetch_recent_matches (10 por clique). Jogador NOVO baixa as 10
          // mais recentes automaticamente (histórico nasce preenchido; 1ª visita
          // custa ~26 chamadas no total, bem abaixo do orçamento de 100/2min).
          let freshMatches = [];
          if (isNovoJogador && newIds.length) {
            const alvo = newIds.slice(0, MAX_PARTIDAS_POR_BUSCA);
            const baixadas = await baixarPartidasEmLotes(env, ctx, API_KEY, playerPuuid, alvo);
            freshMatches = baixadas.matches;
            apiCalls += baixadas.apiCalls;
            pendingCount = Math.max(0, newIds.length - alvo.length);
          } else {
            pendingCount = newIds.length;
          }

          realMatches = combinarPartidas(freshMatches, cachedMatches);

          // Base analítica (até 1000 jogos do D1); jogador novo cai para as recém-baixadas.
          proficiencyMatches = await lerProficienciaD1(env, playerPuuid);
          if (!proficiencyMatches.length && realMatches.length) {
            proficiencyMatches = proficienciaDasPartidas(realMatches);
          }
        } catch (err) {
          console.error("Erro cache D1:", err.message);
        }
      }

      // profile_brief (perfil leve, sem histórico): não há verificação de partidas,
      // então na 1ª visita (sem cache) buscamos o perfil fresco; já conhecido = 0 chamadas.
      if (!includeMatches && precisaPerfilFresco) {
        await refrescarPerfil();
      }

      // 🌟 Companheiros por fila: quem mais jogou com ele (Solo/Duo 420 e Flex 440)
      const companions = includeMatches
        ? await lerCompanionsD1(env, playerPuuid, exactGameName)
        : { solo: [], flex: [] };

      recordUsageGlobal(env, ctx, apiCalls, "worker", action);
      const usedNow = usageBefore.used + apiCalls;
      return new Response(JSON.stringify({
        loading: false, error: null, puuid: playerPuuid, gameName: exactGameName, tagLine: exactTagLine,
        profileIconId, summonerLevel, statsSolo, statsFlex, matches: realMatches.slice(0, 100), proficiencyMatches, companions,
        hadNewGames, hasPremium, pendingCount, apiCalls,
        rate: { used: usedNow, limit: RATE_LIMIT, available: Math.max(0, RATE_LIMIT - usedNow), windowMs: RATE_WINDOW_MS }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ======================================================================
    // ROTA: FETCH_RECENT_MATCHES — botão "buscar últimos 10 jogos".
    // Baixa (detalhe + timeline) as até 10 partidas ranqueadas mais recentes que
    // ainda não estão no D1 para este puuid, grava tudo e devolve o estado novo.
    // Custo máx.: 2 (ids) + 20 (10×2) + 2 (elo) = 24 chamadas.
    // ======================================================================
    if (action === "fetch_recent_matches") {
      let apiCalls = 0;

      // Resolve o alvo: puuid direto OU nome#tag já conhecido no D1.
      let alvo = null;
      if (puuid) {
        try {
          alvo = await env.DB.prepare("SELECT * FROM jogadores WHERE puuid = ? LIMIT 1").bind(puuid).first();
        } catch (e) { }
      } else if (gameName && tagLine) {
        alvo = await loadCachedPlayer(env, gameName, tagLine);
      }
      if (!alvo || !alvo.puuid) {
        return new Response(JSON.stringify({ error: "Jogador não encontrado no banco. Busque o perfil primeiro." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const playerPuuid = alvo.puuid;
      const platformHost = alvo.platform_host || 'br1';
      let profileIconId = alvo.profile_icon_id ?? 29;
      let summonerLevel = alvo.summoner_level ?? 0;
      let statsSolo = { wins: alvo.solo_wins ?? 0, losses: alvo.solo_losses ?? 0, winRate: alvo.win_rate ?? 0, tier: alvo.tier || "UNRANKED", rank: alvo.rank || "", lp: alvo.lp ?? 0 };
      let statsFlex = { wins: alvo.flex_wins ?? 0, losses: alvo.flex_losses ?? 0, winRate: alvo.flex_win_rate ?? 0, tier: alvo.flex_tier || "UNRANKED", rank: alvo.flex_rank || "", lp: alvo.flex_lp ?? 0 };

      let realMatches = [];
      let proficiencyMatches = [];
      let baixadasCount = 0;
      let pendingCount = 0;

      try {
        await ensureSchema(env);

        // Cache ANTES do download (gravações novas vão via waitUntil).
        const cachedMatches = await lerPartidasD1(env, playerPuuid);

        const { recentIds, apiCalls: idsCalls } = await buscarIdsRecentes(API_KEY, playerPuuid);
        apiCalls += idsCalls;
        const newIds = await filtrarIneditas(env, playerPuuid, recentIds);

        const alvoIds = newIds.slice(0, MAX_PARTIDAS_POR_BUSCA);
        pendingCount = Math.max(0, newIds.length - alvoIds.length);

        let freshMatches = [];
        if (alvoIds.length) {
          const baixadas = await baixarPartidasEmLotes(env, ctx, API_KEY, playerPuuid, alvoIds);
          freshMatches = baixadas.matches;
          apiCalls += baixadas.apiCalls;
          baixadasCount = baixadas.matches.length;

          // Jogo ranqueado novo = elo pode ter mudado → atualiza perfil (2 chamadas).
          const r = await atualizarPerfilRiot(env, API_KEY,
            { puuid: playerPuuid, gameName: alvo.game_name, tagLine: alvo.tag_line, platformHost },
            { profileIconId, summonerLevel, statsSolo, statsFlex });
          profileIconId = r.profileIconId;
          summonerLevel = r.summonerLevel;
          statsSolo = r.statsSolo;
          statsFlex = r.statsFlex;
          apiCalls += r.apiCalls;
        }

        realMatches = combinarPartidas(freshMatches, cachedMatches);

        proficiencyMatches = await lerProficienciaD1(env, playerPuuid);
        if (!proficiencyMatches.length && realMatches.length) {
          proficiencyMatches = proficienciaDasPartidas(realMatches);
        }
      } catch (err) {
        console.error("Erro fetch_recent_matches:", err.message);
      }

      const companions = await lerCompanionsD1(env, playerPuuid, alvo.game_name);

      recordUsageGlobal(env, ctx, apiCalls, "worker", action);
      const usedNow = usageBefore.used + apiCalls;
      return new Response(JSON.stringify({
        puuid: playerPuuid, gameName: alvo.game_name, tagLine: alvo.tag_line,
        profileIconId, summonerLevel, statsSolo, statsFlex,
        matches: realMatches, proficiencyMatches, companions,
        fetched: baixadasCount, pendingCount, hadNewGames: baixadasCount > 0,
        hasPremium: Number(alvo.has_premium) === 1, apiCalls,
        rate: { used: usedNow, limit: RATE_LIMIT, available: Math.max(0, RATE_LIMIT - usedNow), windowMs: RATE_WINDOW_MS }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "masteries") {
      let apiCalls = 0;
      let targetPuuid = puuid;
      // Resolve o puuid: primeiro do D1 (0 chamadas), só depois via account-v1.
      if (!targetPuuid && gameName && tagLine) {
        const c = await loadCachedPlayer(env, gameName, tagLine);
        if (c && c.puuid) targetPuuid = c.puuid;
      }
      if (!targetPuuid && gameName && tagLine) {
        apiCalls++;
        const accRes = await fetch(`${ROUTING_AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
        if (accRes.ok) { const accData = await accRes.json(); targetPuuid = accData.puuid; }
      }
      if (!targetPuuid) return new Response(JSON.stringify({ error: "Falta PUUID." }), { status: 400, headers: corsHeaders });

      // 🌟 CACHE: sem refresh forçado (o front só força quando o perfil detectou jogo
      // novo), servimos as maestrias guardadas no D1 — 0 chamadas à Riot.
      if (!refresh) {
        try {
          const { results } = await env.DB.prepare(
            "SELECT champion_id, champion_level, champion_points, last_play_time, season_milestone, milestone_grades, mark_required_next_level FROM maestrias WHERE puuid = ? ORDER BY champion_points DESC"
          ).bind(targetPuuid).all();
          if (results && results.length) {
            const masteries = results.map(r => ({
              championId: r.champion_id,
              championLevel: r.champion_level,
              championPoints: r.champion_points,
              lastPlayTime: r.last_play_time,
              seasonMilestone: r.season_milestone ?? null,
              milestoneGrades: r.milestone_grades ?? null,
              markRequiredForNextLevel: r.mark_required_next_level ?? null
            }));
            return new Response(JSON.stringify({
              masteries, apiCalls: 0, fromCache: true,
              rate: { used: usageBefore.used, limit: RATE_LIMIT, available: Math.max(0, RATE_LIMIT - usageBefore.used), windowMs: RATE_WINDOW_MS }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        } catch (e) { /* sem cache -> segue para a Riot */ }
      }

      // Plataforma: reaproveita a guardada no D1 (evita o active-shards) quando houver.
      let platformHost = 'br1';
      let platformResolvida = false;
      try {
        const prow = await env.DB.prepare("SELECT platform_host FROM jogadores WHERE puuid = ?").bind(targetPuuid).first();
        if (prow && prow.platform_host) { platformHost = prow.platform_host; platformResolvida = true; }
      } catch (e) { }
      if (!platformResolvida) {
        try {
          apiCalls++;
          const shardRes = await fetch(`${ROUTING_AMERICAS}/riot/account/v1/active-shards/by-game/lol/by-puuid/${targetPuuid}?api_key=${API_KEY}`);
          if (shardRes.ok) {
            const shardData = await shardRes.json();
            platformHost = (shardData.platform || shardData.shard || 'br1').toString().toLowerCase();
          }
        } catch (e) { }
      }

      apiCalls++;
      const masteryRes = await fetch(`https://${platformHost}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${targetPuuid}?api_key=${API_KEY}`);
      if (!masteryRes.ok) return new Response(JSON.stringify({ error: "Erro Maestrias." }), { status: masteryRes.status, headers: corsHeaders });
      const rawMasteries = await masteryRes.json();
      // 🌟 FASE 1: repassa lastPlayTime (usado pela recência da proficiência)
      const masteries = (rawMasteries || []).map(m => ({
        championId: m.championId,
        championLevel: m.championLevel,
        championPoints: m.championPoints,
        lastPlayTime: m.lastPlayTime,
        seasonMilestone: m.championSeasonMilestone ?? null,
        milestoneGrades: m.milestoneGrades ? JSON.stringify(m.milestoneGrades) : null,
        markRequiredForNextLevel: m.markRequiredForNextLevel ?? null
      }));

      // 🌟 Persiste as maestrias no D1 (tabela maestrias) em segundo plano
      ctx.waitUntil((async () => {
        try {
          await ensureSchema(env);
          if (!masteries.length) return;
          const stmt = env.DB.prepare(`
            INSERT INTO maestrias (puuid, champion_id, champion_level, champion_points, last_play_time, season_milestone, milestone_grades, mark_required_next_level, atualizado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(puuid, champion_id) DO UPDATE SET
              champion_level = excluded.champion_level,
              champion_points = excluded.champion_points,
              last_play_time = excluded.last_play_time,
              season_milestone = excluded.season_milestone,
              milestone_grades = excluded.milestone_grades,
              mark_required_next_level = excluded.mark_required_next_level,
              atualizado = CURRENT_TIMESTAMP
          `);
          await env.DB.batch(masteries.map(m => stmt.bind(targetPuuid, m.championId, m.championLevel, m.championPoints, m.lastPlayTime, m.seasonMilestone, m.milestoneGrades, m.markRequiredForNextLevel)));
        } catch (e) { }
      })());

      recordUsageGlobal(env, ctx, apiCalls, "worker", "masteries");
      const usedNow = usageBefore.used + apiCalls;
      return new Response(JSON.stringify({
        masteries, apiCalls,
        rate: { used: usedNow, limit: RATE_LIMIT, available: Math.max(0, RATE_LIMIT - usedNow), windowMs: RATE_WINDOW_MS }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ======================================================================
    // ROTA: ANCESTRALIDADE (DASHBOARD TOTAL DE DADOS) — protegida por senha.
    // Limitada: devolve no máx. HIST_MAX linhas (as mais recentes) para não
    // estourar memória/CPU do Worker conforme o histórico cresce. `truncated`
    // avisa o front quando há mais dados além do teto.
    // ======================================================================
    if (action === "admin_all_history") {
      const auth = verificarAdmin(env, password);
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const HIST_MAX = 20000; // teto duro; protege o isolate de payloads gigantes
      const pedido = Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : HIST_MAX;
      const efetivo = Math.max(1, Math.min(HIST_MAX, pedido));
      try {
        const { results } = await env.DB.prepare(`
          SELECT
            j.game_name, j.tag_line, j.tier, j.rank, j.lp, j.win_rate,
            j.flex_tier, j.flex_rank, j.flex_lp, j.flex_win_rate,
            e.champion_name, e.kills, e.deaths, e.assists, e.win, e.items, e.match_id,
            e.team_position, e.cs, e.gold_earned,
            e.vision_score, e.control_wards, e.solo_kills, e.damage_champions,
            e.gold_per_min, e.kill_participation, e.summoner1_id, e.summoner2_id,
            e.perk_keystone, e.perk_secondary_style,
            p.queue_id, p.game_duration, p.game_creation, p.participants
          FROM estatisticas_jogador_partida e
          JOIN jogadores j ON e.puuid = j.puuid
          JOIN partidas p ON e.match_id = p.match_id
          ORDER BY p.game_creation DESC
          LIMIT ?
        `).bind(efetivo + 1).all();

        const linhas = results || [];
        const truncated = linhas.length > efetivo;
        if (truncated) linhas.length = efetivo;

        return new Response(JSON.stringify({ success: true, history: linhas, truncated, limit: efetivo }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // ======================================================================
    // ROTA: LISTA DE JOGADORES (aba "Jogadores" da Ancestralidade)
    // Só LÊ o cadastro de `jogadores` (não gasta a chave da Riot). 1 linha/jogador.
    // ======================================================================
    if (action === "admin_players_list") {
      const auth = verificarAdmin(env, password);
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const { results } = await env.DB.prepare(`
          SELECT
            puuid, game_name, tag_line, tier, rank, lp, win_rate,
            flex_tier, flex_rank, flex_lp, flex_win_rate,
            profile_icon_id, summoner_level, has_premium, ultima_atualizacao
          FROM jogadores
          ORDER BY has_premium DESC, game_name COLLATE NOCASE ASC
        `).all();
        return new Response(JSON.stringify({ success: true, players: results || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // ======================================================================
    // ROTA: MARCAR/DESMARCAR PREMIUM de um jogador (escrita protegida por senha)
    // Espera { puuid, premium: true|false, password }. A senha é validada contra
    // o secret env.ADMIN_PASSWORD do Worker — SEM fallback embutido (fail closed).
    // ======================================================================
    if (action === "admin_set_premium") {
      const auth = verificarAdmin(env, password);
      if (!auth.ok) {
        return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!puuid) {
        return new Response(JSON.stringify({ error: "puuid ausente." }), { status: 400, headers: corsHeaders });
      }
      try {
        const novoValor = premium ? 1 : 0;
        await env.DB.prepare("UPDATE jogadores SET has_premium = ? WHERE puuid = ?").bind(novoValor, puuid).run();
        return new Response(JSON.stringify({ success: true, puuid, has_premium: novoValor }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ error: "Rota inválida." }), { status: 404, headers: corsHeaders });
  }
};