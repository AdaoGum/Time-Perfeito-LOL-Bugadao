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

      // 1. Busca na Riot
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
        const shardRes = await fetch(`${routingAmericas}/riot/account/v1/active-shards/by-game/lol/by-puuid/${playerPuuid}?api_key=${API_KEY}`);
        if (shardRes.ok) {
          const shardData = await shardRes.json();
          platformHost = (shardData.platform || shardData.shard || 'br1').toString().toLowerCase();
        }
      } catch (e) { }

      const routingPlatform = `https://${platformHost}.api.riotgames.com`;

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

      // 🌟 GRAVAÇÃO AUTOMÁTICA NATIVA NO CLOUDFLARE D1
      try {
        await env.DB.prepare(`
          INSERT INTO jogadores (puuid, game_name, tag_line, tier, rank, lp, win_rate, ultima_atualizacao)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(puuid) DO UPDATE SET
            game_name = excluded.game_name,
            tag_line = excluded.tag_line,
            tier = excluded.tier,
            rank = excluded.rank,
            lp = excluded.lp,
            win_rate = excluded.win_rate,
            ultima_atualizacao = CURRENT_TIMESTAMP
        `).bind(playerPuuid, exactGameName, exactTagLine, statsSolo.tier, statsSolo.rank, statsSolo.lp, statsSolo.winRate).run();
      } catch (dbError) {
        console.error("Erro D1:", dbError.message);
      }

      let realMatches = [];

      if (includeMatches) {
        try {
          // Tenta ler o histórico direto do cache do D1
          const { results: cachePartidas } = await env.DB.prepare(`
            SELECT e.*, p.game_duration, p.game_creation 
            FROM estatisticas_jogador_partida e
            JOIN partidas p ON e.match_id = p.match_id
            WHERE e.puuid = ?
            ORDER BY p.game_creation DESC
            LIMIT 20
          `).bind(playerPuuid).all();

          if (cachePartidas && cachePartidas.length > 0) {
            realMatches = cachePartidas.map(row => {
              const items = JSON.parse(row.items || "[0,0,0,0,0,0]");
              return {
                win: row.win === 1,
                queueType: "Dados Guardados (D1)",
                championName: row.champion_name,
                teamPosition: "UNKNOWN",
                gameDuration: row.game_duration,
                gameStartTimestamp: row.game_creation,
                kills: row.kills,
                deaths: row.deaths,
                assists: row.assists,
                item0: items[0] || 0, item1: items[1] || 0, item2: items[2] || 0, item3: items[3] || 0, item4: items[4] || 0, item5: items[5] || 0, item6: 0,
                totalMinionsKilled: 0, neutralMinionsKilled: 0, firstBloodKill: false, visionWardsBoughtInGame: 0, players: []
              };
            });
            console.log("⚡ Histórico carregado via D1.");
          } else {
            // Se o D1 estiver vazio para esse player, busca na Riot
            const matchIdsRes = await fetch(`${routingAmericas}/lol/match/v5/matches/by-puuid/${playerPuuid}/ids?start=0&count=20&api_key=${API_KEY}`);

            if (matchIdsRes.ok) {
              const matchIds = await matchIdsRes.json();
              const matchPromises = matchIds.map(async (matchId) => {
                try {
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

                  // Salva no D1 em segundo plano
                  ctx.waitUntil((async () => {
                    try {
                      await env.DB.prepare("INSERT OR IGNORE INTO partidas (match_id, game_duration, game_creation) VALUES (?, ?, ?)")
                        .bind(matchId, info.gameDuration, info.gameCreation).run();
                      
                      await env.DB.prepare(`
                        INSERT OR IGNORE INTO estatisticas_jogador_partida 
                        (puuid, match_id, champion_name, kills, deaths, assists, win, gold_earned, items)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                      `).bind(
                        playerPuuid, matchId, participant.championName, participant.kills, participant.deaths, participant.assists,
                        participant.win ? 1 : 0, participant.goldEarned, 
                        JSON.stringify([participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5])
                      ).run();
                    } catch (err) { }
                  })());

                  return {
                    win: participant.win, 
                    queueType: queueMap[info.queueId] || "Outro Modo",
                    championName: participant.championName,
                    teamPosition: participant.teamPosition,
                    gameDuration: info.gameDuration,
                    gameStartTimestamp: info.gameStartTimestamp,
                    kills: participant.kills,
                    deaths: participant.deaths,
                    assists: participant.assists,
                    item0: participant.item0, item1: participant.item1, item2: participant.item2, item3: participant.item3, item4: participant.item4, item5: participant.item5, item6: participant.item6,
                    totalMinionsKilled: participant.totalMinionsKilled, neutralMinionsKilled: participant.neutralMinionsKilled, firstBloodKill: participant.firstBloodKill, visionWardsBoughtInGame: participant.visionWardsBoughtInGame,
                    players: teams
                  };
                } catch (e) { return null; }
              });
              const resolved = await Promise.all(matchPromises);
              realMatches = resolved.filter(m => m !== null);
            }
          }
        } catch (err) {
          console.error("Erro cache D1:", err.message);
        }
      }

      return new Response(JSON.stringify({
        loading: false, error: null, puuid: playerPuuid, gameName: exactGameName, tagLine: exactTagLine,
        profileIconId, summonerLevel, statsSolo, statsFlex, matches: realMatches
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ======================================================================
    // ROTA: MAESTRIAS
    // ======================================================================
    if (action === "masteries") {
      let targetPuuid = puuid;
      if (!targetPuuid && gameName && tagLine) {
        const accRes = await fetch(`${routingAmericas}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
        if (accRes.ok) { const accData = await accRes.json(); targetPuuid = accData.puuid; }
      }
      if (!targetPuuid) return new Response(JSON.stringify({ error: "Falta PUUID." }), { status: 400, headers: corsHeaders });
      
      let platformHost = 'br1';
      try {
        const shardRes = await fetch(`${routingAmericas}/riot/account/v1/active-shards/by-game/lol/by-puuid/${targetPuuid}?api_key=${API_KEY}`);
        if (shardRes.ok) {
          const shardData = await shardRes.json();
          platformHost = (shardData.platform || shardData.shard || 'br1').toString().toLowerCase();
        }
      } catch (e) { }

      const masteryRes = await fetch(`https://${platformHost}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${targetPuuid}?api_key=${API_KEY}`);
      if (!masteryRes.ok) return new Response(JSON.stringify({ error: "Erro Maestrias." }), { status: masteryRes.status, headers: corsHeaders });
      const rawMasteries = await masteryRes.json();
      return new Response(JSON.stringify({ masteries: rawMasteries }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Rota inválida." }), { status: 404, headers: corsHeaders });
  }
};