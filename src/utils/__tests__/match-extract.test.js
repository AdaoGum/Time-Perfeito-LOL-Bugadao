import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SQL_PARTIDAS, valoresPartida, montarTeams,
  SQL_ESTATISTICAS, valoresEstatisticas,
  SQL_MARCOS, extrairMarcos, MARCOS_MINUTOS
} from '../../../shared/match-extract.js';

// Conta os placeholders posicionais (?) da cláusula VALUES.
const nPlaceholders = (sql) => (sql.match(/\?/g) || []).length;

// Índices das colunas em SQL_MARCOS (52 col) que o teste inspeciona.
const COL = { minuto: 2, level: 3, totalGold: 6, posX: 43, posY: 44, items: 45, skills: 46, kills: 47, deaths: 48, assists: 49, wardsPost: 50, wardsKill: 51 };

// ---------------------------------------------------------------------------
// PARIDADE DE COLUNAS: a contagem de valores tem que bater com os placeholders.
// Este é o guarda que trava o "mesmo INSERT nos dois lugares" agora que a lógica
// é única (shared/match-extract.js), importada pelo worker e pelo coletor.
// ---------------------------------------------------------------------------
test('SQL_PARTIDAS: nº de valores == nº de placeholders (9)', () => {
  const info = { gameDuration: 1800, gameCreation: 1, queueId: 420, gameVersion: '15.13', gameMode: 'CLASSIC', teams: [], participants: [] };
  const vals = valoresPartida('M1', info, []);
  assert.equal(nPlaceholders(SQL_PARTIDAS), 9);
  assert.equal(vals.length, 9);
});

test('SQL_ESTATISTICAS: nº de valores == nº de placeholders (37)', () => {
  const participant = {
    championId: 1, championName: 'Annie', teamPosition: 'MIDDLE', win: true,
    kills: 5, deaths: 2, assists: 8, doubleKills: 1, tripleKills: 0, quadraKills: 0, pentaKills: 0,
    goldEarned: 12000, totalMinionsKilled: 150, neutralMinionsKilled: 10,
    totalDamageDealtToChampions: 20000, physicalDamageDealtToChampions: 5000, magicDamageDealtToChampions: 14000, trueDamageDealtToChampions: 1000,
    totalDamageTaken: 15000, damageSelfMitigated: 8000, totalHealsOnTeammates: 0, totalDamageShieldedOnTeammates: 0,
    totalTimeSpentDead: 60, visionScore: 20, visionWardsBoughtInGame: 3, wardsPlaced: 10, wardsKilled: 2,
    summoner1Id: 4, summoner2Id: 14, item0: 1, item1: 2, item2: 3, item3: 4, item4: 5, item5: 6,
    challenges: { soloKills: 2, goldPerMinute: 400, killParticipation: 0.6 },
    perks: { styles: [{ selections: [{ perk: 8112 }] }, { style: 8000 }] }
  };
  const vals = valoresEstatisticas('P1', 'M1', {}, participant);
  assert.equal(nPlaceholders(SQL_ESTATISTICAS), 37);
  assert.equal(vals.length, 37);
});

// ---------------------------------------------------------------------------
// Timeline sintética -> extrairMarcos
// ---------------------------------------------------------------------------
function timelineFake() {
  const pfBase = (over) => ({
    level: 1, xp: 0, currentGold: 0, totalGold: 500,
    championStats: {}, damageStats: {}, position: { x: 100, y: 200 }, ...over
  });
  return {
    info: {
      participants: [{ puuid: 'P1', participantId: 1 }, { puuid: 'P2', participantId: 2 }],
      frames: [
        { // minuto 0
          timestamp: 0,
          events: [],
          participantFrames: { 1: pfBase({ level: 1, totalGold: 500 }), 2: pfBase() }
        },
        { // ~1min (NÃO é minuto de fechamento -> não vira linha, mas acumula eventos)
          timestamp: 61000,
          events: [
            { type: 'ITEM_PURCHASED', participantId: 1, itemId: 1001 },
            { type: 'SKILL_LEVEL_UP', participantId: 1, skillSlot: 1 },
            { type: 'WARD_PLACED', creatorId: 1 }
          ],
          participantFrames: { 1: pfBase({ level: 2, totalGold: 900 }), 2: pfBase() }
        },
        { // minuto 5 (fechamento)
          timestamp: 300000,
          events: [
            { type: 'ITEM_PURCHASED', participantId: 1, itemId: 3020 },
            { type: 'CHAMPION_KILL', killerId: 1, victimId: 2, assistingParticipantIds: [] },
            { type: 'CHAMPION_KILL', killerId: 2, victimId: 1, assistingParticipantIds: [] },
            { type: 'WARD_KILL', killerId: 1 },
            { type: 'SKILL_LEVEL_UP', participantId: 1, skillSlot: 3 }
          ],
          participantFrames: { 1: pfBase({ level: 6, totalGold: 2500, position: { x: 500, y: 600 } }), 2: pfBase() }
        }
      ]
    }
  };
}

test('extrairMarcos: uma linha por minuto de fechamento presente (0 e 5)', () => {
  const linhas = extrairMarcos('P1', 'M1', timelineFake());
  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas.map(l => l[COL.minuto]), [0, 5]);
  // Cada linha bate com os placeholders do SQL_MARCOS (52).
  assert.equal(nPlaceholders(SQL_MARCOS), 52);
  for (const l of linhas) assert.equal(l.length, 52);
});

test('extrairMarcos: mochila e skills acumulam até o minuto de fechamento', () => {
  const [m0, m5] = extrairMarcos('P1', 'M1', timelineFake());
  // minuto 0: nada comprado ainda.
  assert.deepEqual(JSON.parse(m0[COL.items]), []);
  assert.deepEqual(JSON.parse(m0[COL.skills]), []);
  // minuto 5: itens 1001 (min ~1) + 3020 (min 5); skills [1,3].
  assert.deepEqual(JSON.parse(m5[COL.items]), [1001, 3020]);
  assert.deepEqual(JSON.parse(m5[COL.skills]), [1, 3]);
});

test('extrairMarcos: kills/deaths/wards acumulados são coerentes no minuto 5', () => {
  const [, m5] = extrairMarcos('P1', 'M1', timelineFake());
  assert.equal(m5[COL.kills], 1);       // P1 matou P2 uma vez
  assert.equal(m5[COL.deaths], 1);      // P1 morreu uma vez
  assert.equal(m5[COL.assists], 0);
  assert.equal(m5[COL.wardsPost], 1);   // um WARD_PLACED do P1
  assert.equal(m5[COL.wardsKill], 1);   // um WARD_KILL do P1
  assert.equal(m5[COL.level], 6);
  assert.equal(m5[COL.totalGold], 2500);
});

test('extrairMarcos: puuid ausente na timeline devolve []', () => {
  assert.deepEqual(extrairMarcos('FANTASMA', 'M1', timelineFake()), []);
});

test('extrairMarcos: timeline malformada não quebra', () => {
  assert.deepEqual(extrairMarcos('P1', 'M1', null), []);
  assert.deepEqual(extrairMarcos('P1', 'M1', { info: {} }), []);
  assert.deepEqual(extrairMarcos('P1', 'M1', { info: { frames: [] } }), []);
});

test('montarTeams: 1 entrada por participante, com nome/tag/campeão', () => {
  const info = { participants: [
    { riotIdGameName: 'Fulano', riotIdTagline: '2109', championName: 'Annie', teamId: 100, kills: 5, teamPosition: 'MIDDLE' },
    { summonerName: 'Beltrano', riotIdTagline: 'BR1', championName: 'Lux', teamId: 200, kills: 2, teamPosition: 'UTILITY' }
  ] };
  const teams = montarTeams(info);
  assert.equal(teams.length, 2);
  assert.equal(teams[0].gameName, 'Fulano');
  assert.equal(teams[0].championName, 'Annie');
  assert.equal(teams[1].gameName, 'Beltrano'); // cai no summonerName quando não há riotIdGameName
});

test('MARCOS_MINUTOS é o conjunto esperado', () => {
  assert.deepEqual(MARCOS_MINUTOS, [0, 5, 10, 15, 25]);
});
