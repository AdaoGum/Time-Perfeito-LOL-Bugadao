export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não permitido. Use POST." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { action, gameName, tagLine, puuid } = body;
      const API_KEY = env.RIOT_API_KEY;

      if (!API_KEY) {
        return new Response(JSON.stringify({ error: "Chave RIOT_API_KEY não configurada na Cloudflare." }), { status: 401, headers: corsHeaders });
      }

      const routingAmericas = "https://americas.api.riotgames.com";
      const routingBr = "https://br1.api.riotgames.com";

      // --- ACTION: PROFILE OVERVIEW ---
      if (action === "profile_overview") {
        if (!gameName || !tagLine) {
          return new Response(JSON.stringify({ error: "Nome e Tag são obrigatórios." }), { status: 400, headers: corsHeaders });
        }

        // 1. Buscar PUUID pelo Riot ID
        const accountRes = await fetch(`${routingAmericas}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
        
        if (!accountRes.ok) {
          let msg = `Erro da API da Riot: ${accountRes.status}`;
          if (accountRes.status === 404) msg = "Erro: Invocador não encontrado. Verifique o nome e a tag.";
          if (accountRes.status === 401 || accountRes.status === 403) msg = "Erro de Autenticação: Sua RIOT_API_KEY expirou.";
          return new Response(JSON.stringify({ error: msg }), { status: accountRes.status, headers: corsHeaders });
        }

        const accountData = await accountRes.json();
        const playerPuuid = accountData.puuid;

        // 2. Buscar dados básicos do Invocador (Ícone e Nível)
        const summonerRes = await fetch(`${routingBr}/lol/summoner/v4/summoners/by-puuid/${playerPuuid}?api_key=${API_KEY}`);
        const summonerData = summonerRes.ok ? await summonerRes.json() : { profileIconId: 29, summonerLevel: 0, id: "" };

        // 3. Buscar Elo (Vitórias e Derrotas)
        let stats = { wins: 0, losses: 0, winRate: 0 };
        if (summonerData.id) {
          const leagueRes = await fetch(`${routingBr}/lol/league/v1/entries/by-summoner/${summonerData.id}?api_key=${API_KEY}`);
          if (leagueRes.ok) {
            const leagueData = await leagueRes.json();
            const soloQueue = leagueData.find(queue => queue.queueType === "RANKED_SOLO_5x5") || leagueData[0];
            if (soloQueue) {
              stats.wins = soloQueue.wins;
              stats.losses = soloQueue.losses;
              stats.winRate = (stats.wins / (stats.wins + stats.losses)) * 100 || 0;
            }
          }
        }

        // 4. HISTÓRICO REAL DE PARTIDAS (MATCH-V5)
        // Buscamos os IDs das últimas 5 partidas do jogador
        const matchIdsRes = await fetch(`${routingAmericas}/lol/match/v5/matches/by-puuid/${playerPuuid}/ids?start=0&count=20&api_key=${API_KEY}`);
        // const matchIdsRes = await fetch(`${routingAmericas}/lol/match/v5/matches/${playerPuuid}/ids?start=0&count=20&api_key=${API_KEY}`);

        let realMatches = [];

        if (matchIdsRes.ok) {
          const matchIds = await matchIdsRes.json();
          
          // Fazemos requisições simultâneas para abrir os detalhes de cada um dos 5 jogos
          const matchPromises = matchIds.map(async (matchId) => {
            try {
              const matchDetailRes = await fetch(`${routingAmericas}/lol/match/v5/matches/${matchId}?api_key=${API_KEY}`);
              if (!matchDetailRes.ok) return null;
              
              const matchDetail = await matchDetailRes.json();
              const info = matchDetail.info;
              
              // Localiza o seu perfil de jogo dentro dos 10 jogadores da partida
              const participant = info.participants.find(p => p.puuid === playerPuuid);
              
              if (participant) {
                return {
                  win: participant.win,
                  championName: participant.championName,
                  gameDuration: info.gameDuration,
                  kills: participant.kills,
                  deaths: participant.deaths,
                  assists: participant.assists,
                  item0: participant.item0,
                  item1: participant.item1,
                  item2: participant.item2,
                  item3: participant.item3,
                  item4: participant.item4,
                  item5: participant.item5,
                  item6: participant.item6
                };
              }
            } catch (e) {
              return null;
            }
            return null;
          });

          const resolvedMatches = await Promise.all(matchPromises);
          // Remove qualquer falha para não quebrar a lista
          realMatches = resolvedMatches.filter(m => m !== null);
        }

        // Devolve os dados 100% legítimos ao frontend
        return new Response(JSON.stringify({
          puuid: playerPuuid,
          gameName: accountData.gameName,
          tagLine: accountData.tagLine,
          profileIconId: summonerData.profileIconId,
          summonerLevel: summonerData.summonerLevel,
          stats,
          matches: realMatches
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // --- ACTION: MASTERIES ---
      if (action === "masteries") {
        let targetPuuid = puuid;

        if (!targetPuuid && gameName && tagLine) {
          const accRes = await fetch(`${routingAmericas}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
          if (accRes.ok) {
            const accData = await accRes.json();
            targetPuuid = accData.puuid;
          }
        }

        if (!targetPuuid) {
          return new Response(JSON.stringify({ error: "PUUID não encontrado para esta busca de maestria." }), { status: 400, headers: corsHeaders });
        }

        const masteryRes = await fetch(`${routingBr}/lol/champion-mastery/v4/champion-masteries/by-puuid/${targetPuuid}?api_key=${API_KEY}`);
        if (!masteryRes.ok) return new Response(JSON.stringify({ error: `Erro de maestria na Riot: ${masteryRes.status}` }), { status: masteryRes.status, headers: corsHeaders });
        
        const rawMasteries = await masteryRes.json();
        return new Response(JSON.stringify({ masteries: rawMasteries }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ error: `Ação '${action}' não implementada no Worker.` }), { status: 404, headers: corsHeaders });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
};