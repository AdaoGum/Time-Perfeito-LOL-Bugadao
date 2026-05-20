export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return new Response(JSON.stringify({ error: "Use POST." }), { status: 405, headers: corsHeaders });

    try {
      const body = await request.json();
      const { action, gameName, tagLine, puuid } = body;
      const API_KEY = env.RIOT_API_KEY;

      if (!API_KEY) return new Response(JSON.stringify({ error: "Chave ausente." }), { status: 401, headers: corsHeaders });

      const routingAmericas = "https://americas.api.riotgames.com";
      const routingBr = "https://br1.api.riotgames.com";

      // Dicionário simples de filas comuns do LoL
      const queueMap = {
        420: "Ranked Solo",
        440: "Ranked Flex",
        400: "Normal Draft",
        430: "Normal Blind",
        450: "ARAM",
        1700: "Arena"
      };

      if (action === "profile_overview") {
        if (!gameName || !tagLine) return new Response(JSON.stringify({ error: "Faltam dados." }), { status: 400, headers: corsHeaders });

        const accountRes = await fetch(`${routingAmericas}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
        if (!accountRes.ok) return new Response(JSON.stringify({ error: "Jogador não encontrado." }), { status: 404, headers: corsHeaders });
        
        const accountData = await accountRes.json();
        const playerPuuid = accountData.puuid;

        const summonerRes = await fetch(`${routingBr}/lol/summoner/v4/summoners/by-puuid/${playerPuuid}?api_key=${API_KEY}`);
        const summonerData = summonerRes.ok ? await summonerRes.json() : { profileIconId: 29, summonerLevel: 0, id: "" };

        // 3. Buscar Elo (Vitórias, Derrotas, Tier e LP)
        let stats = { wins: 0, losses: 0, winRate: 0, tier: "UNRANKED", rank: "", lp: 0 };
        if (summonerData.id) {
          const leagueRes = await fetch(`${routingBr}/lol/league/v1/entries/by-summoner/${summonerData.id}?api_key=${API_KEY}`);
          if (leagueRes.ok) {
            const leagueData = await leagueRes.json();
            const soloQueue = leagueData.find(q => q.queueType === "RANKED_SOLO_5x5") || leagueData[0];
            if (soloQueue) {
              stats.wins = soloQueue.wins;
              stats.losses = soloQueue.losses;
              stats.winRate = (stats.wins / (stats.wins + stats.losses)) * 100 || 0;
              stats.tier = soloQueue.tier; // Ex: GOLD
              stats.rank = soloQueue.rank; // Ex: IV
              stats.lp = soloQueue.leaguePoints; // Ex: 75
            }
          }
        }

        // Puxar histórico real (20 partidas)
        const matchIdsRes = await fetch(`${routingAmericas}/lol/match/v5/matches/by-puuid/${playerPuuid}/ids?start=0&count=20&api_key=${API_KEY}`);
        let realMatches = [];

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

              // Mapeia os outros jogadores (Nome e Campeão) para o feed do histórico
              const teams = info.participants.map(p => ({
                gameName: p.riotIdGameName || p.summonerName,
                tagLine: p.riotIdTagline,
                championName: p.championName,
                teamId: p.teamId
              }));

              return {
                win: participant.win, // true ou false direto do participante correto
                queueType: queueMap[info.queueId] || "Outro Modo",
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
                item6: participant.item6,
                players: teams // Envia a lista dos 10 jogadores filtrados
              };
            } catch (e) { return null; }
          });
          const resolved = await Promise.all(matchPromises);
          realMatches = resolved.filter(m => m !== null);
        }

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

      // Action masteries permanece igual, o front-end cuidará do novo design
      if (action === "masteries") {
        let targetPuuid = puuid;
        if (!targetPuuid && gameName && tagLine) {
          const accRes = await fetch(`${routingAmericas}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${API_KEY}`);
          if (accRes.ok) { const accData = await accRes.json(); targetPuuid = accData.puuid; }
        }
        if (!targetPuuid) return new Response(JSON.stringify({ error: "PUUID não encontrado." }), { status: 400, headers: corsHeaders });
        const masteryRes = await fetch(`${routingBr}/lol/champion-mastery/v4/champion-masteries/by-puuid/${targetPuuid}?api_key=${API_KEY}`);
        if (!masteryRes.ok) return new Response(JSON.stringify({ error: "Erro Riot." }), { status: masteryRes.status, headers: corsHeaders });
        const rawMasteries = await masteryRes.json();
        return new Response(JSON.stringify({ masteries: rawMasteries }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ error: "Não implementado." }), { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
  }
};