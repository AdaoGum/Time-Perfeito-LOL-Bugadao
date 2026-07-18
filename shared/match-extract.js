// ============================================================================
// Extração analítica de match-v5 — FONTE ÚNICA E COMPARTILHADA.
// Importada por cron/sync.js, cron/backfill.js E worker.js. O bundle do Cloudflare
// (Wrangler/esbuild) resolve este import relativo normalmente — por isso não há
// mais cópia duplicada no worker. Este arquivo é JS puro (sem `fs`/`process`/Vite),
// então roda igual no Node do coletor e no isolate do Worker.
//
// ⚠️ QUALQUER coluna/INSERT novo entra AQUI e vale para os três de uma vez.
//
// Arquitetura "Marcos Temporais": NÃO guardamos mais a timeline bruta. A timeline
// é baixada, processada frame a frame para extrair snapshots compactos (52 colunas)
// nos minutos de fechamento, e o JSON pesado é descartado em seguida.
// ============================================================================

// ----------------------------------------------------------------------------
// 1) Metadados globais da partida (tabela `partidas`).
//    INSERT OR REPLACE reescreve a linha inteira -> idempotente / permite reprocesso.
// ----------------------------------------------------------------------------
export const SQL_PARTIDAS =
  "INSERT OR REPLACE INTO partidas (match_id, game_duration, game_creation, queue_id, game_version, game_mode, bans, team_objectives, participants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

export function valoresPartida(matchId, info, teams) {
  const bans = JSON.stringify((info.teams || []).map(t => ({ teamId: t.teamId, bans: t.bans || [] })));
  const objetivos = JSON.stringify((info.teams || []).map(t => ({ teamId: t.teamId, objectives: t.objectives || {} })));
  return [
    matchId,
    info.gameDuration,
    info.gameCreation,
    info.queueId ?? null,
    info.gameVersion ?? null,
    info.gameMode ?? null,
    bans,
    objetivos,
    JSON.stringify(teams)
  ];
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

// ----------------------------------------------------------------------------
// 2) Estatísticas consolidadas de fim de jogo (tabela `estatisticas_jogador_partida`).
//    37 colunas — espelha exatamente o schema D1 recriado.
// ----------------------------------------------------------------------------
export const SQL_ESTATISTICAS = `
  INSERT OR REPLACE INTO estatisticas_jogador_partida
  (puuid, match_id, champion_id, champion_name, team_position, win,
   kills, deaths, assists, solo_kills, double_kills, triple_kills, quadra_kills, penta_kills,
   gold_earned, gold_per_min, items, cs, damage_champions,
   physical_damage, magic_damage, true_damage, damage_taken, damage_mitigated,
   total_heal_teammates, damage_shielded_teammates, kill_participation, total_time_spent_dead,
   vision_score, control_wards, wards_placed, wards_killed,
   summoner1_id, summoner2_id, perk_keystone, perk_secondary_style, challenges)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export function valoresEstatisticas(puuid, matchId, info, participant) {
  const ch = participant.challenges || {};
  const cs = (participant.totalMinionsKilled || 0) + (participant.neutralMinionsKilled || 0);
  const keystone = participant.perks?.styles?.[0]?.selections?.[0]?.perk ?? null;
  const secondaryStyle = participant.perks?.styles?.[1]?.style ?? null;
  return [
    puuid, matchId, participant.championId ?? null, participant.championName, participant.teamPosition || "",
    participant.win ? 1 : 0,
    participant.kills ?? 0, participant.deaths ?? 0, participant.assists ?? 0,
    ch.soloKills ?? 0, participant.doubleKills ?? 0, participant.tripleKills ?? 0, participant.quadraKills ?? 0, participant.pentaKills ?? 0,
    participant.goldEarned ?? 0, ch.goldPerMinute ?? 0,
    JSON.stringify([participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5]),
    cs, participant.totalDamageDealtToChampions ?? 0,
    participant.physicalDamageDealtToChampions ?? 0, participant.magicDamageDealtToChampions ?? 0, participant.trueDamageDealtToChampions ?? 0,
    participant.totalDamageTaken ?? 0, participant.damageSelfMitigated ?? 0,
    participant.totalHealsOnTeammates ?? 0, participant.totalDamageShieldedOnTeammates ?? 0,
    ch.killParticipation ?? 0, participant.totalTimeSpentDead ?? 0,
    participant.visionScore ?? 0, participant.visionWardsBoughtInGame ?? 0,
    participant.wardsPlaced ?? 0, participant.wardsKilled ?? 0,
    participant.summoner1Id ?? null, participant.summoner2Id ?? null,
    keystone, secondaryStyle, JSON.stringify(ch)
  ];
}

// ----------------------------------------------------------------------------
// 3) Marcos Temporais (tabela `estatisticas_jogador_marcos`) — 52 colunas.
//    Snapshots compactos extraídos da timeline nos minutos de fechamento.
//    A timeline bruta é DESCARTADA após esta extração (não vai para o D1).
// ----------------------------------------------------------------------------
export const MARCOS_MINUTOS = [0, 5, 10, 15, 25];

export const SQL_MARCOS = `
  INSERT OR REPLACE INTO estatisticas_jogador_marcos
  (puuid, match_id, minuto, level, xp, current_gold, total_gold,
   attack_damage, ability_power, armor, magic_resist, attack_speed, ability_haste,
   cooldown_reduction, movement_speed, health, health_max, health_regen,
   power, power_max, power_regen, lifesteal, omnivamp, physical_vamp, spell_vamp,
   armor_pen, armor_pen_percent, bonus_armor_pen_percent,
   magic_pen, magic_pen_percent, bonus_magic_pen_percent, cc_reduction,
   total_damage_done, total_damage_done_to_champions,
   magic_damage_done, magic_damage_done_to_champions, magic_damage_taken,
   physical_damage_done, physical_damage_done_to_champions, physical_damage_taken,
   true_damage_done, true_damage_done_to_champions, true_damage_taken,
   position_x, position_y, items, skills_upgraded,
   kills_no_minuto, deaths_no_minuto, assists_no_minuto,
   wards_colocadas, wards_destruidas)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

// Simula a "mochila de compras" e o estado acumulado do jogador frame a frame,
// devolvendo UMA linha (array de 52 valores) por minuto de fechamento existente
// na timeline. As contagens de kills/deaths/assists/wards são acumuladas até o
// instante do snapshot (coerente com os stats de frame, que também são acumulados).
export function extrairMarcos(puuid, matchId, timeline) {
  const info = timeline?.info;
  if (!info || !Array.isArray(info.frames)) return [];

  // puuid -> participantId (1..10) via info.participants da própria timeline
  const participante = (info.participants || []).find(p => p.puuid === puuid);
  if (!participante) return [];
  const pid = participante.participantId;

  const alvos = new Set(MARCOS_MINUTOS);
  const mochila = [];   // itens atualmente no inventário (compras/vendas/undo)
  const skills = [];    // slots de habilidade upados, em ordem cronológica
  let kills = 0, deaths = 0, assists = 0, wardsColocadas = 0, wardsDestruidas = 0;
  const linhas = [];

  for (let i = 0; i < info.frames.length; i++) {
    const frame = info.frames[i];

    // Atualiza o estado acumulado com os eventos deste frame
    for (const ev of frame.events || []) {
      switch (ev.type) {
        case 'ITEM_PURCHASED':
          if (ev.participantId === pid) mochila.push(ev.itemId);
          break;
        case 'ITEM_SOLD':
        case 'ITEM_DESTROYED':
          if (ev.participantId === pid) {
            const idx = mochila.indexOf(ev.itemId);
            if (idx !== -1) mochila.splice(idx, 1);
          }
          break;
        case 'ITEM_UNDO':
          if (ev.participantId === pid) {
            // beforeId: item que existia antes do undo (remover); afterId: item restaurado (recolocar)
            if (ev.beforeId) { const idx = mochila.indexOf(ev.beforeId); if (idx !== -1) mochila.splice(idx, 1); }
            if (ev.afterId) mochila.push(ev.afterId);
          }
          break;
        case 'SKILL_LEVEL_UP':
          if (ev.participantId === pid) skills.push(ev.skillSlot);
          break;
        case 'CHAMPION_KILL':
          if (ev.killerId === pid) kills++;
          if (ev.victimId === pid) deaths++;
          if (Array.isArray(ev.assistingParticipantIds) && ev.assistingParticipantIds.includes(pid)) assists++;
          break;
        case 'WARD_PLACED':
          if (ev.creatorId === pid) wardsColocadas++;
          break;
        case 'WARD_KILL':
          if (ev.killerId === pid) wardsDestruidas++;
          break;
      }
    }

    // Minuto de fechamento deste frame (frames ~60s; arredonda contra drift de ms)
    const minuto = Math.round((frame.timestamp ?? 0) / 60000);
    if (!alvos.has(minuto)) continue;

    const pf = (frame.participantFrames || {})[pid] || (frame.participantFrames || {})[String(pid)] || {};
    const cs = pf.championStats || {};
    const ds = pf.damageStats || {};
    const pos = pf.position || {};

    linhas.push([
      puuid, matchId, minuto,
      pf.level ?? 1, pf.xp ?? 0, pf.currentGold ?? 0, pf.totalGold ?? 0,
      cs.attackDamage ?? 0, cs.abilityPower ?? 0, cs.armor ?? 0, cs.magicResist ?? 0,
      cs.attackSpeed ?? 100, cs.abilityHaste ?? 0, cs.cooldownReduction ?? 0, cs.movementSpeed ?? 330,
      cs.health ?? 0, cs.healthMax ?? 0, cs.healthRegen ?? 0,
      cs.power ?? 0, cs.powerMax ?? 0, cs.powerRegen ?? 0,
      cs.lifesteal ?? 0, cs.omnivamp ?? 0, cs.physicalVamp ?? 0, cs.spellVamp ?? 0,
      cs.armorPen ?? 0, cs.armorPenPercent ?? 0, cs.bonusArmorPenPercent ?? 0,
      cs.magicPen ?? 0, cs.magicPenPercent ?? 0, cs.bonusMagicPenPercent ?? 0, cs.ccReduction ?? 0,
      ds.totalDamageDone ?? 0, ds.totalDamageDoneToChampions ?? 0,
      ds.magicDamageDone ?? 0, ds.magicDamageDoneToChampions ?? 0, ds.magicDamageTaken ?? 0,
      ds.physicalDamageDone ?? 0, ds.physicalDamageDoneToChampions ?? 0, ds.physicalDamageTaken ?? 0,
      ds.trueDamageDone ?? 0, ds.trueDamageDoneToChampions ?? 0, ds.trueDamageTaken ?? 0,
      pos.x ?? 0, pos.y ?? 0,
      JSON.stringify(mochila), JSON.stringify(skills),
      kills, deaths, assists, wardsColocadas, wardsDestruidas
    ]);
  }

  return linhas;
}
