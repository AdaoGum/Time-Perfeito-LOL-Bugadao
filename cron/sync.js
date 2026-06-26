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

async function fetchFromRiot(endpoint) {
  const url = `https://${REGION_ROUTE}.api.riotgames.com${endpoint}`;
  const response = await fetch(url, { headers: { "X-Riot-Token": RIOT_API_KEY } });
  if (response.status === 429) {
    console.warn("⚠️ [RIOT LIMIT] Chave esquentou demais! Pausando por 2 minutos para esfriar...");
    await sleep(125000); 
    return fetchFromRiot(endpoint); 
  }
  if (!response.ok) throw new Error(`Erro na Riot API: ${response.status}`);
  return response.json();
}

// Modo backfill: BACKFILL=1 re-baixa TODAS as partidas (mesmo as já salvas)
// e reescreve as linhas via INSERT OR REPLACE, preenchendo as colunas novas
// no histórico antigo. Sem a flag, só baixa partidas inéditas (rápido/diário).
const BACKFILL = process.env.BACKFILL === '1' || process.env.BACKFILL === 'true';

// ----------------------------------------------------------------------
// EXTRAÇÃO ANALÍTICA (match-v5) — espelha exatamente o worker.js
// ----------------------------------------------------------------------
const SQL_PARTIDAS =
  "INSERT OR REPLACE INTO partidas (match_id, game_duration, game_creation, participants, game_version, game_mode, game_type, bans, team_objectives) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

function valoresPartida(matchId, info, teams) {
  const bans = JSON.stringify((info.teams || []).map(t => ({ teamId: t.teamId, bans: t.bans || [] })));
  const objetivos = JSON.stringify((info.teams || []).map(t => ({ teamId: t.teamId, objectives: t.objectives || {} })));
  return [matchId, info.gameDuration, info.gameCreation, JSON.stringify(teams), info.gameVersion ?? null, info.gameMode ?? null, info.gameType ?? null, bans, objetivos];
}

const SQL_ESTATISTICAS = `
  INSERT OR REPLACE INTO estatisticas_jogador_partida
  (puuid, match_id, champion_name, champion_id, kills, deaths, assists, win, gold_earned, items,
   team_position, queue_id, game_creation, cs, game_duration,
   vision_score, control_wards, solo_kills, damage_champions, gold_per_min, kill_participation,
   summoner1_id, summoner2_id, perk_keystone, perk_secondary_style, challenges,
   double_kills, triple_kills, quadra_kills, penta_kills, largest_multi_kill,
   physical_damage_champions, magic_damage_champions, true_damage_champions, damage_taken, damage_mitigated,
   total_heal, total_heal_teammates, damage_shielded_teammates, time_ccing_others,
   wards_placed, wards_killed, detector_wards_placed,
   dragon_kills, baron_kills, turret_kills, inhibitor_kills, damage_objectives, objectives_stolen,
   total_time_spent_dead, longest_time_living, champ_level,
   game_ended_surrender, game_ended_early_surrender)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function valoresEstatisticas(puuid, matchId, info, participant) {
  const ch = participant.challenges || {};
  const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
  const keystone = participant.perks?.styles?.[0]?.selections?.[0]?.perk ?? null;
  const secondaryStyle = participant.perks?.styles?.[1]?.style ?? null;
  return [
    puuid, matchId, participant.championName, participant.championId ?? null,
    participant.kills, participant.deaths, participant.assists, participant.win ? 1 : 0, participant.goldEarned,
    JSON.stringify([participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5]),
    participant.teamPosition || "", info.queueId, info.gameCreation, cs, info.gameDuration,
    participant.visionScore ?? null, participant.visionWardsBoughtInGame ?? null, ch.soloKills ?? null,
    participant.totalDamageDealtToChampions ?? null, ch.goldPerMinute ?? null, ch.killParticipation ?? null,
    participant.summoner1Id ?? null, participant.summoner2Id ?? null, keystone, secondaryStyle, JSON.stringify(ch),
    participant.doubleKills ?? 0, participant.tripleKills ?? 0, participant.quadraKills ?? 0, participant.pentaKills ?? 0, participant.largestMultiKill ?? 0,
    participant.physicalDamageDealtToChampions ?? null, participant.magicDamageDealtToChampions ?? null, participant.trueDamageDealtToChampions ?? null,
    participant.totalDamageTaken ?? null, participant.damageSelfMitigated ?? null,
    participant.totalHeal ?? null, participant.totalHealsOnTeammates ?? null, participant.totalDamageShieldedOnTeammates ?? null, participant.timeCCingOthers ?? null,
    participant.wardsPlaced ?? null, participant.wardsKilled ?? null, participant.detectorWardsPlaced ?? null,
    participant.dragonKills ?? null, participant.baronKills ?? null, participant.turretKills ?? null, participant.inhibitorKills ?? null,
    participant.damageDealtToObjectives ?? null, participant.objectivesStolen ?? null,
    participant.totalTimeSpentDead ?? null, participant.longestTimeSpentLiving ?? null, participant.champLevel ?? null,
    participant.gameEndedInSurrender ? 1 : 0, participant.gameEndedInEarlySurrender ? 1 : 0
  ];
}

async function rodarSincronizacao() {
  const fs = await import('fs');

  console.log("=========================================================");
  console.log("🚀 [SISTEMA] INICIANDO TRATOR DE HISTÓRICO PROFUNDO (1000)");
  console.log("=========================================================");
  let totalRequestsFeitas = 0;

  try {
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }

    console.log("強 [D1] Baixando a lista de jogadores monitorados...");
    const dbResult = await queryD1("SELECT puuid, game_name, tag_line FROM jogadores");
    const jogadores = dbResult.results || [];
    console.log(`📋 [D1] Sucesso! Encontrado(s) ${jogadores.length} jogador(es) para escanear.`);

    for (const jogador of jogadores) {
      console.log(`\n---------------------------------------------------------`);
      console.log(`⛏️  [ALVO] Iniciando escavação de: ${jogador.game_name}#${jogador.tag_line}`);
      console.log(`---------------------------------------------------------`);
      
      const nomeArquivoClean = `${jogador.game_name.replace(/[^a-zA-Z0-9]/g, '_')}_${jogador.tag_line.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      const logPath = `logs/${nomeArquivoClean}`;
      
      fs.writeFileSync(logPath, `=========================================================\n`);
      fs.appendFileSync(logPath, `📋 RELATÓRIO DE ESCAVAÇÃO DE HISTÓRICO\n`);
      fs.appendFileSync(logPath, `JOGADOR: ${jogador.game_name}#${jogador.tag_line}\n`);
      fs.appendFileSync(logPath, `DATA DA OPERAÇÃO: ${new Date().toLocaleString('pt-BR')}\n`);
      fs.appendFileSync(logPath, `=========================================================\n\n`);

      const loggerhibrido = (texto) => {
        console.log(texto);
        fs.appendFileSync(logPath, texto + '\n');
      };

      let allMatchIds = [];

      for (let start = 0; start < 1000; start += 100) {
        if (totalRequestsFeitas >= 90) {
          loggerhibrido("⏳ [ESFRIANDO CHAVE] Quase no limite de 100 reqs. Pausando 2 min...");
          await sleep(125000);
          totalRequestsFeitas = 0;
        }

        const numPagina = (start / 100) + 1;
        loggerhibrido(`🔍 [Riot API] Buscando Página ${numPagina}/10 (IDs do índice ${start} ao ${start + 100})...`);
        
        const chunkIds = await fetchFromRiot(`/lol/match/v5/matches/by-puuid/${jogador.puuid}/ids?start=${start}&count=100`);
        totalRequestsFeitas++;

        if (!chunkIds || chunkIds.length === 0) {
          loggerhibrido(`🏁 [FIM DE HISTÓRICO] Riot retornou 0 partidas na página ${numPagina}. Parando coleta de IDs.`);
          break; 
        }

        loggerhibrido(`   └─> Sucesso! +${chunkIds.length} IDs capturados.`);
        allMatchIds = allMatchIds.concat(chunkIds);
      }

      loggerhibrido(`\n🔹 Total de partidas encontradas na Riot: ${allMatchIds.length}`);
      if (allMatchIds.length === 0) continue;

      loggerhibrido("📡 [D1] Verificando quais partidas já estão salvas no banco...");
      const partidasExistentesNoBanco = new Set();
      
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

      // No modo backfill, reprocessa TUDO para preencher as colunas novas no histórico.
      const novasPartidas = BACKFILL ? allMatchIds : allMatchIds.filter(id => !partidasExistentesNoBanco.has(id));
      if (BACKFILL) {
        loggerhibrido(`🔁 [BACKFILL ATIVO] Reprocessando TODAS as ${novasPartidas.length} partidas (reescreve linhas antigas).`);
      } else {
        loggerhibrido(`📈 [BALANÇO] Já gravadas no D1: ${partidasExistentesNoBanco.size} | Inéditas para baixar: ${novasPartidas.length}`);
      }

      if (novasPartidas.length === 0) {
        loggerhibrido("✨ [OK] O banco já está 100% atualizado com este jogador. Nenhuma ação necessária.");
        continue;
      }

      loggerhibrido(`\n📥 [DOWNLOAD] Baixando dados detalhados das ${novasPartidas.length} partidas novas...`);
      let processadas = 0;

      for (const matchId of novasPartidas) {
        if (totalRequestsFeitas >= 90) {
          loggerhibrido("⏳ [ESFRIANDO CHAVE] Pausando por 2 minutos para evitar erro 429...");
          await sleep(125000);
          totalRequestsFeitas = 0;
        }

        try {
          const matchData = await fetchFromRiot(`/lol/match/v5/matches/${matchId}`);
          totalRequestsFeitas++;
          const info = matchData.info;

          // 🌟 MUDANÇA: Estrutura os 10 jogadores aqui igualzinho ao worker do back-end
          const teams = info.participants.map(p => ({
            gameName: p.riotIdGameName || p.summonerName,
            tagLine: p.riotIdTagline,
            championName: p.championName,
            teamId: p.teamId,
            kills: p.kills,
            role: p.teamPosition
          }));

          // Metadados globais (patch, modo, bans, objetivos dos times)
          await queryD1(SQL_PARTIDAS, valoresPartida(matchId, info, teams));

          const participant = info.participants.find(p => p.puuid === jogador.puuid);
          if (participant) {
            // Estatísticas completas do jogador (combate, dano, visão, objetivos)
            await queryD1(SQL_ESTATISTICAS, valoresEstatisticas(jogador.puuid, matchId, info, participant));
          }

          // 🌟 Timeline bruta (+1 request): ouro/xp por minuto, ordem de itens, eventos
          try {
            const tl = await fetchFromRiot(`/lol/match/v5/matches/${matchId}/timeline`);
            totalRequestsFeitas++;
            await queryD1(
              "INSERT OR REPLACE INTO partidas_timeline (match_id, frame_interval, timeline_json, atualizado) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
              [matchId, tl?.info?.frameInterval ?? null, JSON.stringify(tl?.info ?? {})]
            );
          } catch (tlErr) {
            loggerhibrido(`   ⚠️ Timeline indisponível para ${matchId}: ${tlErr.message}`);
          }


          processadas++;
          loggerhibrido(`   💾 [PROGRESSO: ${processadas}/${novasPartidas.length}] Guardada: ${matchId} | Campeão: ${participant?.championName || 'N/A'}`);
          
          if (participant) {
            fs.appendFileSync(logPath, `      📊 [DADOS TÁTICOS GRAVADOS]:\n`);
            fs.appendFileSync(logPath, `         - Resultado: ${participant.win ? '▶ VITÓRIA' : '❌ DERROTA'}\n`);
            fs.appendFileSync(logPath, `         - KDA Final: ${participant.kills} / ${participant.deaths} / ${participant.assists}\n`);
            fs.appendFileSync(logPath, `         - Ouro Acumulado: ${participant.goldEarned.toLocaleString('pt-BR')}g\n`);
            fs.appendFileSync(logPath, `         - Build Final (IDs): [${[participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5].join(', ')}]\n`);
            fs.appendFileSync(logPath, `         -----------------------------------------------------\n`);
          }
        } catch (matchError) {
          loggerhibrido(`   ❌ Erro ao baixar dados da partida ${matchId}: ${matchError.message}`);
          continue; 
        }
      }

      await queryD1("UPDATE jogadores SET ultima_atualizacao = CURRENT_TIMESTAMP WHERE puuid = ?", [jogador.puuid]);
      loggerhibrido(`\n🎉 [SUCESSO] Todo o histórico disponível de ${jogador.game_name} foi sincronizado!`);
    }

    console.log("\n=========================================================");
    console.log("✅ [FINALIZADO] O trator encerrou a rodada com sucesso!");
    console.log("=========================================================");
  } catch (error) {
    console.error("\n❌ [FALHA CRÍTICA] O motor engasgou por um erro externo:", error.message);
  }
}

rodarSincronizacao();