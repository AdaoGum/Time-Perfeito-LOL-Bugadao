const RIOT_API_KEY = process.env.RIOT_API_KEY;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;

const REGION_ROUTE = 'americas'; 
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Função auxiliar para conversar com o Banco D1 da Cloudflare via HTTP
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
  if (!response.ok || !data.success) {
    throw new Error(`Erro no D1: ${JSON.stringify(data.errors)}`);
  }
  return data.result[0]; // Retorna o resultado da query
}

// Função auxiliar para buscar dados na Riot com tratamento de limite (429)
async function fetchFromRiot(endpoint) {
  const url = `https://${REGION_ROUTE}.api.riotgames.com${endpoint}`;
  const response = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY }
  });
  
  if (response.status === 429) {
    console.warn("⚠️ Rate limit atingido! Forçando pausa de 2 minutos...");
    await sleep(125000); 
    return fetchFromRiot(endpoint); 
  }
  
  if (!response.ok) throw new Error(`Erro na Riot API: ${response.status}`);
  return response.json();
}

async function rodarSincronizacao() {
  console.log("🚀 Iniciando o trator da madrugada do Uga Buga Analytics...");
  let totalRequestsFeitas = 0;

  try {
    // 1. Pega todos os jogadores que o Worker cadastrou no D1
    const dbResult = await queryD1("SELECT puuid, game_name, tag_line FROM jogadores");
    const jogadores = dbResult.results || [];
    console.log(`📋 Encontrados ${jogadores.length} jogadores para monitorar.`);

    for (const jogador of jogadores) {
      console.log(`\n🔍 Verificando histórico de: ${jogador.game_name}#${jogador.tag_line}`);
      
      // 2. Puxa as últimas 20 partidas do jogador na Riot
      const matchIds = await fetchFromRiot(`/lol/match/v5/matches/by-puuid/${jogador.puuid}/ids?start=0&count=20`);
      totalRequestsFeitas++;

      for (const matchId of matchIds) {
        // Pausa de segurança a cada 90 chamadas para não estourar o limite de 100 req / 2 min
        if (totalRequestsFeitas >= 90) {
          console.log("⏳ Quase no limite de requisições. Pausando por 2 minutos para esfriar a chave...");
          await sleep(125000);
          totalRequestsFeitas = 0;
        }

        // 3. Verifica se a partida já existe no D1
        const checarPartida = await queryD1("SELECT match_id FROM partidas WHERE match_id = ?", [matchId]);
        if (checarPartida.results && checarPartida.results.length > 0) {
          continue; // Já tem no banco, pula!
        }

        // 4. Se for nova, busca o detalhado na Riot
        console.log(`📥 Baixando dados da partida nova: ${matchId}`);
        const matchData = await fetchFromRiot(`/lol/match/v5/matches/${matchId}`);
        totalRequestsFeitas++;

        // 5. Salva a partida na tabela global do D1
        await queryD1(
          "INSERT OR IGNORE INTO partidas (match_id, game_duration, game_creation) VALUES (?, ?, ?)",
          [matchId, matchData.info.gameDuration, matchData.info.gameCreation]
        );

        // 6. Filtra os dados do nosso jogador e salva na tabela de estatísticas
        const participant = matchData.info.participants.find(p => p.puuid === jogador.puuid);
        if (participant) {
          await queryD1(
            `INSERT OR IGNORE INTO estatisticas_jogador_partida 
            (puuid, match_id, champion_name, kills, deaths, assists, win, gold_earned, items) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              jogador.puuid,
              matchId,
              participant.championName,
              participant.kills,
              participant.deaths,
              participant.assists,
              participant.win ? 1 : 0,
              participant.goldEarned,
              JSON.stringify([participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5])
            ]
          );
        }
      }

      // Atualiza a data de checagem do jogador
      await queryD1("UPDATE jogadores SET ultima_atualizacao = CURRENT_TIMESTAMP WHERE puuid = ?", [jogador.puuid]);
    }

    console.log("\n✅ Sincronização concluída com sucesso no Cloudflare D1!");
  } catch (error) {
    console.error("❌ Falha no trator da madrugada:", error.message);
  }
}

rodarSincronizacao();