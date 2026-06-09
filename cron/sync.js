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
  return data.result[0];
}

// Função auxiliar para buscar dados na Riot com tratamento de limite (429)
async function fetchFromRiot(endpoint) {
  const url = `https://${REGION_ROUTE}.api.riotgames.com${endpoint}`;
  const response = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY }
  });
  
  if (response.status === 429) {
    console.warn("⚠️ Rate limit atingido! Forçando pausa de 2 minutos para esfriar a chave...");
    await sleep(125000); 
    return fetchFromRiot(endpoint); 
  }
  
  if (!response.ok) throw new Error(`Erro na Riot API: ${response.status}`);
  return response.json();
}

async function rodarSincronizacao() {
  console.log("🚀 [PRO] Iniciando o super trator de histórico (1000 partidas) no D1...");
  let totalRequestsFeitas = 0;

  try {
    // 1. Pega os jogadores cadastrados
    const dbResult = await queryD1("SELECT puuid, game_name, tag_line FROM jogadores");
    const jogadores = dbResult.results || [];
    console.log(`📋 Encontrados ${jogadores.length} jogadores para escavar o histórico.`);

    for (const jogador of jogadores) {
      console.log(`\n⛏️  Escavando até 1000 partidas de: ${jogador.game_name}#${jogador.tag_line}`);
      let allMatchIds = [];

      // 2. Loop de Paginação: Busca blocos de 100 IDs até atingir 1000
      for (let start = 0; start < 1000; start += 100) {
        if (totalRequestsFeitas >= 90) {
          console.log("⏳ Limite estrito chegando. Pausando 2 minutos antes de listar mais IDs...");
          await sleep(125000);
          totalRequestsFeitas = 0;
        }

        console.log(`📡 Buscando IDs de partidas ${start} até ${start + 100}...`);
        const chunkIds = await fetchFromRiot(`/lol/match/v5/matches/by-puuid/${jogador.puuid}/ids?start=${start}&count=100`);
        totalRequestsFeitas++;

        if (!chunkIds || chunkIds.length === 0) {
          console.log("🏁 O jogador não possui mais partidas antigas neste perfil.");
          break; 
        }

        allMatchIds = allMatchIds.concat(chunkIds);
      }

      console.log(`Total de IDs encontrados para analisar: ${allMatchIds.length}`);

      // 3. FILTRO EM MASSA: Descobre quais dessas partidas já existem no seu D1 de uma vez só
      const partidasExistentes NoBanco = new Set();
      
      // Perguntamos pro D1 em blocos de 50 IDs usando a cláusula SQL IN (?,?,?...)
      for (let i = 0; i < allMatchIds.length; i += 50) {
        const chunkVerificacao = allMatchIds.slice(i, i + 50);
        const placeholders = chunkVerificacao.map(() => '?').join(',');
        
        const checarBloco = await queryD1(
          `SELECT match_id FROM partidas WHERE match_id IN (${placeholders})`,
          chunkVerificacao
        );

        if (checarBloco.results) {
          checarBloco.results.forEach(row => partidasExistentesNoBanco.add(row.match_id));
        }
      }

      // Filtra a lista mantendo APENAS o que for estritamente inédito para o banco
      const novasPartidas = allMatchIds.filter(id => !partidasExistentesNoBanco.has(id));
      console.log(`📊 Estatísticas do banco: ${partidasExistentesNoBanco.size} já salvas | ${novasPartidas.length} novas para baixar.`);

      // 4. DOWNLOAD E SALVAMENTO: Baixa os dados reais apenas das partidas inéditas
      for (const matchId of novasPartidas) {
        if (totalRequestsFeitas >= 90) {
          console.log("⏳ Limite de 100 requisições atingido. Pausando por 2 minutos para não tomar block da Riot...");
          await sleep(125000);
          totalRequestsFeitas = 0;
        }

        console.log(`📥 Baixando e indexando partida nova: ${matchId}`);
        try {
          const matchData = await fetchFromRiot(`/lol/match/v5/matches/${matchId}`);
          totalRequestsFeitas++;

          // Insere os dados globais da partida
          await queryD1(
            "INSERT OR IGNORE INTO partidas (match_id, game_duration, game_creation) VALUES (?, ?, ?)",
            [matchId, matchData.info.gameDuration, matchData.info.gameCreation]
          );

          // Procura o registro tático do nosso jogador dentro dos 10 da partida
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
        } catch (matchError) {
          console.error(`❌ Falha ao processar dados da partida ${matchId}:`, matchError.message);
          // Se der erro em uma partida específica, continua o loop para não quebrar o resto do histórico
          continue; 
        }
      }

      // Atualiza a timestamp do jogador indicando que a escavação profunda foi concluída hoje
      await queryD1("UPDATE jogadores SET ultima_atualizacao = CURRENT_TIMESTAMP WHERE puuid = ?", [jogador.puuid]);
      console.log(`✨ Histórico de ${jogador.game_name} completamente atualizado!`);
    }

    console.log("\n✅ [PRO] Sincronização em massa finalizada com sucesso no D1!");
  } catch (error) {
    console.error("❌ Falha crítica no trator de volume:", error.message);
  }
}

rodarSincronizacao();