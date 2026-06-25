// ----------------------------------------------------------------------
// MIGRAÇÃO IDEMPOTENTE DO SCHEMA (roda 1x por isolate; ignora "duplicate column")
// ----------------------------------------------------------------------
let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  // As colunas de estatisticas_jogador_partida vêm da migração (migrations/001_analytics.sql).
  // Aqui garantimos apenas a tabela de maestrias, que não faz parte da migração.
  try {
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS maestrias (puuid TEXT NOT NULL, champion_id INTEGER NOT NULL, champion_level INTEGER, champion_points INTEGER, last_play_time INTEGER, atualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (puuid, champion_id))"
    ).run();
  } catch (e) { /* tabela já existe */ }
  schemaReady = true;
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
    let action, gameName, tagLine, puuid;
    
    if (request.method === "POST") {
      try {
        const body = await request.json();
        action = body.action;
        gameName = body.gameName;
        tagLine = body.tagLine;
        puuid = body.puuid;
      } catch (e) {
        return new Response(JSON.stringify({ error: "JSON inválido." }), { status: 400, headers: corsHeaders });
      }
    } else if (request.method === "GET") {
      const url = new URL(request.url);
      action = url.searchParams.get("action");
      gameName = url.searchParams.get("gameName");
      tagLine = url.searchParams.get("tagLine");
      puuid = url.searchParams.get("puuid");
    }

    const API_KEY = env.RIOT_API_KEY;
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: "Chave RIOT_API_KEY ausente." }), { status: 401, headers: corsHeaders });
    }

    const routingAmericas = "https://americas.api.riotgames.com";
    const queueMap = { 420: "Ranked Solo", 440: "Ranked Flex", 400: "Normal Draft", 430: "Normal Blind", 450: "ARAM", 1700: "Arena" };

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

      apiCalls++;
      const accountRes = await fetch(`${routingAmericas}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
      if (!accountRes.ok) {
        return new Response(JSON.stringify({ error: "Jogador não encontrado." }), { status: accountRes.status, headers: corsHeaders });
      }
      
      const accountData = await accountRes.json();
      const playerPuuid = accountData.puuid;
      const exactGameName = accountData.gameName;
      const exactTagLine = accountData.tagLine;

      let platformHost = 'br1';
      try {
        apiCalls++;
        const shardRes = await fetch(`${routingAmericas}/riot/account/v1/active-shards/by-game/lol/by-puuid/${playerPuuid}?api_key=${API_KEY}`);
        if (shardRes.ok) {
          const shardData = await shardRes.json();
          platformHost = (shardData.platform || shardData.shard || 'br1').toString().toLowerCase();
        }
      } catch (e) { }

      const routingPlatform = `https://${platformHost}.api.riotgames.com`;

      apiCalls++;
      const summonerRes = await fetch(`${routingPlatform}/lol/summoner/v4/summoners/by-puuid/${playerPuuid}?api_key=${API_KEY}`);
      let profileIconId = 29;
      let summonerLevel = 0;
      if (summonerRes.ok) {
        const sData = await summonerRes.json();
        profileIconId = sData.profileIconId;
        summonerLevel = sData.summonerLevel;
      }

      let statsSolo = { wins: 0, losses: 0, winRate: 0, tier: "UNRANKED", rank: "", lp: 0 };
      let statsFlex = { wins: 0, losses: 0, winRate: 0, tier: "UNRANKED", rank: "", lp: 0 };
      
      apiCalls++;
      const leagueRes = await fetch(`${routingPlatform}/lol/league/v4/entries/by-puuid/${playerPuuid}?api_key=${API_KEY}`);
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
          INSERT INTO jogadores (puuid, game_name, tag_line, tier, rank, lp, win_rate, flex_tier, flex_rank, flex_lp, flex_win_rate, ultima_atualizacao)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
            ultima_atualizacao = CURRENT_TIMESTAMP
        `).bind(
          playerPuuid, exactGameName, exactTagLine, 
          statsSolo.tier, statsSolo.rank, statsSolo.lp, statsSolo.winRate,
          statsFlex.tier, statsFlex.rank, statsFlex.lp, statsFlex.winRate
        ).run();
      } catch (dbError) {
        console.error("Erro D1:", dbError.message);
      }

      let realMatches = [];
      let proficiencyMatches = [];

      if (includeMatches) {
        try {
          await ensureSchema(env);

          // Baixa o detalhe de UMA partida na API e a persiste no D1 (em segundo plano)
          const fetchMatchDetail = async (matchId) => {
            try {
              apiCalls++;
              const detailRes = await fetch(`${routingAmericas}/lol/match/v5/matches/${matchId}?api_key=${API_KEY}`);
              if (!detailRes.ok) return null;
              const detail = await detailRes.json();
              const info = detail.info;

              const participant = info.participants.find(p => p.puuid === playerPuuid);
              if (!participant) return null;

              const teams = info.participants.map(p => ({
                gameName: p.riotIdGameName || p.summonerName,
                tagLine: p.riotIdTagline,
                championName: p.championName,
                teamId: p.teamId,
                kills: p.kills,
                role: p.teamPosition
              }));

              const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);

              // 🌟 Campos analíticos (mesma extração usada no cron/sync.js)
              const ch = participant.challenges || {};
              const keystone = participant.perks?.styles?.[0]?.selections?.[0]?.perk ?? null;
              const secondaryStyle = participant.perks?.styles?.[1]?.style ?? null;

              ctx.waitUntil((async () => {
                try {
                  // 🌟 MUDANÇA: Insere a lista completa de jogadores estruturada em formato de texto JSON
                  await env.DB.prepare("INSERT OR IGNORE INTO partidas (match_id, game_duration, game_creation, participants) VALUES (?, ?, ?, ?)")
                    .bind(matchId, info.gameDuration, info.gameCreation, JSON.stringify(teams)).run();

                  // 🌟 FASE 1: grava team_position, queue_id, game_creation, cs e game_duration
                  // 🌟 FASE 2: grava também os campos analíticos (visão, wards, solo kills, dano, etc.)
                  await env.DB.prepare(`
                    INSERT OR IGNORE INTO estatisticas_jogador_partida
                    (puuid, match_id, champion_name, kills, deaths, assists, win, gold_earned, items, team_position, queue_id, game_creation, cs, game_duration,
                     vision_score, control_wards, solo_kills, damage_champions, gold_per_min, kill_participation, summoner1_id, summoner2_id, perk_keystone, perk_secondary_style)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).bind(
                    playerPuuid, matchId, participant.championName, participant.kills, participant.deaths, participant.assists,
                    participant.win ? 1 : 0, participant.goldEarned,
                    JSON.stringify([participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5]),
                    participant.teamPosition || "", info.queueId, info.gameCreation, cs, info.gameDuration,
                    participant.visionScore ?? null,
                    participant.visionWardsBoughtInGame ?? null,
                    ch.soloKills ?? null,
                    participant.totalDamageDealtToChampions ?? null,
                    ch.goldPerMinute ?? null,
                    ch.killParticipation ?? null,
                    participant.summoner1Id ?? null,
                    participant.summoner2Id ?? null,
                    keystone,
                    secondaryStyle
                  ).run();
                } catch (err) { }
              })());

              return {
                matchId,
                win: participant.win,
                queueType: queueMap[info.queueId] || "Outro Modo",
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
                // 🌟 FASE 2: campos analíticos para os cards (feitiços, runa, visão, etc.)
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
              };
            } catch (e) { return null; }
          };

          // 🌟 MUDANÇA: Agora selecionamos a coluna p.participants do banco
          // Lê até 100 partidas detalhadas do D1 (cache, sem gastar API) p/ paginação 20/20 no front
          const { results: cachePartidas } = await env.DB.prepare(`
            SELECT e.*, p.game_duration AS p_game_duration, p.game_creation AS p_game_creation, p.participants
            FROM estatisticas_jogador_partida e
            JOIN partidas p ON e.match_id = p.match_id
            WHERE e.puuid = ?
            ORDER BY p.game_creation DESC
            LIMIT 100
          `).bind(playerPuuid).all();

          // Partidas já guardadas (servidas do D1, não gastam a API da Riot)
          const cachedMatches = (cachePartidas || []).map(row => {
            const items = JSON.parse(row.items || "[0,0,0,0,0,0]");
            return {
              matchId: row.match_id,
              win: row.win === 1,
              queueType: queueMap[row.queue_id] || "Dados Guardados (D1)",
              championName: row.champion_name,
              teamPosition: row.team_position || "UNKNOWN",
              gameDuration: row.game_duration || row.p_game_duration,
              gameStartTimestamp: row.game_creation || row.p_game_creation,
              gameCreation: row.game_creation || row.p_game_creation,
              kills: row.kills,
              deaths: row.deaths,
              assists: row.assists,
              item0: items[0] || 0, item1: items[1] || 0, item2: items[2] || 0, item3: items[3] || 0, item4: items[4] || 0, item5: items[5] || 0, item6: 0,
              totalMinionsKilled: row.cs || 0, neutralMinionsKilled: 0, firstBloodKill: false, visionWardsBoughtInGame: row.control_wards || 0,
              // 🌟 FASE 2: campos analíticos vindos do D1 (NULL em partidas antigas, até o backfill rodar)
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
              // 🌟 MUDANÇA: Retorna os dados reais dos jogadores cacheados
              players: row.participants ? JSON.parse(row.participants) : []
            };
          });

          // 🌟 CORREÇÃO: SEMPRE consulta a API pelos IDs recentes (50 Solo/Duo 420 + 25 Flex 440)
          // para captar partidas novas mesmo quando já existe cache no D1.
          apiCalls += 2;
          const [soloIdsRes, flexIdsRes] = await Promise.all([
            fetch(`${routingAmericas}/lol/match/v5/matches/by-puuid/${playerPuuid}/ids?start=0&count=50&queue=420&api_key=${API_KEY}`),
            fetch(`${routingAmericas}/lol/match/v5/matches/by-puuid/${playerPuuid}/ids?start=0&count=25&queue=440&api_key=${API_KEY}`)
          ]);

          const soloIds = soloIdsRes.ok ? await soloIdsRes.json() : [];
          const flexIds = flexIdsRes.ok ? await flexIdsRes.json() : [];
          const recentIds = [...new Set([...soloIds, ...flexIds])];

          // Descobre quais desses IDs já estão salvos para baixar SÓ os novos (economiza API)
          let newIds = recentIds;
          if (recentIds.length) {
            const placeholders = recentIds.map(() => "?").join(",");
            const { results: existing } = await env.DB.prepare(
              `SELECT match_id FROM estatisticas_jogador_partida WHERE puuid = ? AND match_id IN (${placeholders})`
            ).bind(playerPuuid, ...recentIds).all();
            const known = new Set((existing || []).map(r => r.match_id));
            newIds = recentIds.filter(id => !known.has(id));
          }

          // Baixa o detalhe apenas das partidas novas (lotes de 5 para respeitar o rate limit)
          const freshMatches = [];
          for (let i = 0; i < newIds.length; i += 5) {
            const lote = newIds.slice(i, i + 5);
            const parcial = await Promise.all(lote.map(fetchMatchDetail));
            freshMatches.push(...parcial.filter(m => m !== null));
          }

          // Combina novas (topo) + cache, sem duplicar, ordenado por data desc, limitado a 100
          const seen = new Set();
          realMatches = [...freshMatches, ...cachedMatches]
            .filter(m => {
              if (m.matchId && seen.has(m.matchId)) return false;
              if (m.matchId) seen.add(m.matchId);
              return true;
            })
            .sort((a, b) => (b.gameCreation || b.gameStartTimestamp || 0) - (a.gameCreation || a.gameStartTimestamp || 0))
            .slice(0, 100);

          // 🌟 Proficiência: usa o MÁXIMO de partidas salvas no D1 (cron enche até 1000)
          try {
            const { results: profRows } = await env.DB.prepare(`
              SELECT champion_name, win, kills, deaths, assists, team_position, queue_id, game_creation, cs, game_duration
              FROM estatisticas_jogador_partida
              WHERE puuid = ?
              ORDER BY game_creation DESC
              LIMIT 1000
            `).bind(playerPuuid).all();
            proficiencyMatches = (profRows || []).map(row => ({
              championName: row.champion_name,
              win: row.win === 1,
              kills: row.kills, deaths: row.deaths, assists: row.assists,
              teamPosition: row.team_position || "",
              queueId: row.queue_id,
              gameCreation: row.game_creation,
              cs: row.cs || 0,
              gameDuration: row.game_duration || 0
            }));
          } catch (e) { }

          // Fallback: se o D1 ainda não tem dados (primeira visita), deriva das partidas recém-baixadas
          if (!proficiencyMatches.length && realMatches.length) {
            proficiencyMatches = realMatches.map(m => ({
              championName: m.championName,
              win: m.win,
              kills: m.kills, deaths: m.deaths, assists: m.assists,
              teamPosition: m.teamPosition || "",
              queueId: m.queueId || 0,
              gameCreation: m.gameCreation || m.gameStartTimestamp || 0,
              cs: (m.totalMinionsKilled || 0) + (m.neutralMinionsKilled || 0),
              gameDuration: m.gameDuration || 0
            }));
          }
        } catch (err) {
          console.error("Erro cache D1:", err.message);
        }
      }

      // 🌟 Companheiros por fila: quem mais jogou com ele (Solo/Duo 420 e Flex 440)
      let companions = { solo: [], flex: [] };
      if (includeMatches) {
        try {
          const { results: coRows } = await env.DB.prepare(`
            SELECT e.queue_id AS queue_id, p.participants AS participants
            FROM estatisticas_jogador_partida e
            JOIN partidas p ON e.match_id = p.match_id
            WHERE e.puuid = ? AND p.participants IS NOT NULL
            ORDER BY e.game_creation DESC
            LIMIT 400
          `).bind(playerPuuid).all();

          const countSolo = {};
          const countFlex = {};
          const selfName = (exactGameName || "").toLowerCase().trim();
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
          companions = { solo: top5(countSolo), flex: top5(countFlex) };
        } catch (e) { }
      }

      return new Response(JSON.stringify({
        loading: false, error: null, puuid: playerPuuid, gameName: exactGameName, tagLine: exactTagLine,
        profileIconId, summonerLevel, statsSolo, statsFlex, matches: realMatches.slice(0, 100), proficiencyMatches, companions,
        apiCalls
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "masteries") {
      let apiCalls = 0;
      let targetPuuid = puuid;
      if (!targetPuuid && gameName && tagLine) {
        apiCalls++;
        const accRes = await fetch(`${routingAmericas}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
        if (accRes.ok) { const accData = await accRes.json(); targetPuuid = accData.puuid; }
      }
      if (!targetPuuid) return new Response(JSON.stringify({ error: "Falta PUUID." }), { status: 400, headers: corsHeaders });

      let platformHost = 'br1';
      try {
        apiCalls++;
        const shardRes = await fetch(`${routingAmericas}/riot/account/v1/active-shards/by-game/lol/by-puuid/${targetPuuid}?api_key=${API_KEY}`);
        if (shardRes.ok) {
          const shardData = await shardRes.json();
          platformHost = (shardData.platform || shardData.shard || 'br1').toString().toLowerCase();
        }
      } catch (e) { }

      apiCalls++;
      const masteryRes = await fetch(`https://${platformHost}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${targetPuuid}?api_key=${API_KEY}`);
      if (!masteryRes.ok) return new Response(JSON.stringify({ error: "Erro Maestrias." }), { status: masteryRes.status, headers: corsHeaders });
      const rawMasteries = await masteryRes.json();
      // 🌟 FASE 1: repassa lastPlayTime (usado pela recência da proficiência)
      const masteries = (rawMasteries || []).map(m => ({
        championId: m.championId,
        championLevel: m.championLevel,
        championPoints: m.championPoints,
        lastPlayTime: m.lastPlayTime
      }));

      // 🌟 Persiste as maestrias no D1 (tabela maestrias) em segundo plano
      ctx.waitUntil((async () => {
        try {
          await ensureSchema(env);
          if (!masteries.length) return;
          const stmt = env.DB.prepare(`
            INSERT INTO maestrias (puuid, champion_id, champion_level, champion_points, last_play_time, atualizado)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(puuid, champion_id) DO UPDATE SET
              champion_level = excluded.champion_level,
              champion_points = excluded.champion_points,
              last_play_time = excluded.last_play_time,
              atualizado = CURRENT_TIMESTAMP
          `);
          await env.DB.batch(masteries.map(m => stmt.bind(targetPuuid, m.championId, m.championLevel, m.championPoints, m.lastPlayTime)));
        } catch (e) { }
      })());

      return new Response(JSON.stringify({ masteries, apiCalls }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ======================================================================
    // ROTA: ANCESTRALIDADE (DASHBOARD TOTAL DE DADOS)
    // ======================================================================
if (action === "admin_all_history") {
      try {
        const { results } = await env.DB.prepare(`
          SELECT
            j.game_name, j.tag_line, j.tier, j.rank, j.lp, j.win_rate,
            j.flex_tier, j.flex_rank, j.flex_lp, j.flex_win_rate,
            e.champion_name, e.kills, e.deaths, e.assists, e.win, e.items, e.match_id,
            e.team_position, e.queue_id, e.cs, e.gold_earned,
            e.vision_score, e.control_wards, e.solo_kills, e.damage_champions,
            e.gold_per_min, e.kill_participation, e.summoner1_id, e.summoner2_id,
            e.perk_keystone, e.perk_secondary_style,
            p.game_duration, p.game_creation, p.participants
          FROM estatisticas_jogador_partida e
          JOIN jogadores j ON e.puuid = j.puuid
          JOIN partidas p ON e.match_id = p.match_id
          ORDER BY p.game_creation DESC
        `).all();
        
        return new Response(JSON.stringify({ success: true, history: results || [] }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ error: "Rota inválida." }), { status: 404, headers: corsHeaders });
  }
};