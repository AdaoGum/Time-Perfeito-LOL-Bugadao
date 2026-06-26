// ============================================================================
// Extração analítica de match-v5 — fonte ÚNICA usada por cron/sync.js e
// cron/backfill.js. (worker.js mantém uma cópia própria por ser bundle do
// Cloudflare Worker; qualquer coluna nova precisa ser refletida lá também.)
// ============================================================================

// Metadados globais da partida (tabela `partidas`).
// INSERT OR REPLACE reescreve a linha inteira -> permite backfill das colunas novas.
export const SQL_PARTIDAS =
  "INSERT OR REPLACE INTO partidas (match_id, game_duration, game_creation, participants, game_version, game_mode, game_type, bans, team_objectives) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

export function valoresPartida(matchId, info, teams) {
  const bans = JSON.stringify((info.teams || []).map(t => ({ teamId: t.teamId, bans: t.bans || [] })));
  const objetivos = JSON.stringify((info.teams || []).map(t => ({ teamId: t.teamId, objectives: t.objectives || {} })));
  return [matchId, info.gameDuration, info.gameCreation, JSON.stringify(teams), info.gameVersion ?? null, info.gameMode ?? null, info.gameType ?? null, bans, objetivos];
}

// Estrutura os 10 jogadores (usado no campo `participants` da partida).
export function montarTeams(info) {
  return info.participants.map(p => ({
    gameName: p.riotIdGameName || p.summonerName,
    tagLine: p.riotIdTagline,
    championName: p.championName,
    teamId: p.teamId,
    kills: p.kills,
    role: p.teamPosition
  }));
}

// Estatísticas completas de um jogador na partida (tabela `estatisticas_jogador_partida`).
export const SQL_ESTATISTICAS = `
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

export function valoresEstatisticas(puuid, matchId, info, participant) {
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

// Timeline bruta (endpoint separado: /lol/match/v5/matches/{id}/timeline)
export const SQL_TIMELINE =
  "INSERT OR REPLACE INTO partidas_timeline (match_id, frame_interval, timeline_json, atualizado) VALUES (?, ?, ?, CURRENT_TIMESTAMP)";

export function valoresTimeline(matchId, timeline) {
  return [matchId, timeline?.info?.frameInterval ?? null, JSON.stringify(timeline?.info ?? {})];
}
