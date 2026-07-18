import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarRelatorio, parseMetaTiers, resolverFilas, FILAS
} from '../../../cron/lib/relatorio-engine.js';

// queryRows falso: devolve a forma certa conforme o SQL; separa Solo (420) x Flex (440).
function fakeQuery(dados) {
  return async (sql, params) => {
    const isFlex = /queue_id IN \(440\)/.test(sql);
    const d = isFlex ? dados.flex : dados.solo;
    if (!d) return [];
    if (/COUNT\(\*\) jogos/.test(sql)) return d.agg || [];
    if (/champion_name/.test(sql)) return d.champs || [];
    if (/estatisticas_jogador_marcos/.test(sql)) return d.marcos || [];
    return d.rotas || [];
  };
}

const DATA = {
  solo: {
    agg: [{ puuid: 'P1', game_name: 'UGA Teste', tag_line: '2109', tier: 'GOLD', rank: 'II', jogos: 20, vitorias: 12, k: 100, d: 80, a: 180, cs_min: 7, vis_min: 0.9, kp: 0.55, gpm: 380, dmg: 18000 }],
    rotas: [{ puuid: 'P1', team_position: 'MIDDLE', n: 20, v: 12 }],
    champs: [{ puuid: 'P1', champion_name: 'Ahri', team_position: 'MIDDLE', n: 20, v: 12 }],
    marcos: [{ puuid: 'P1', ouro10: 3500, xp10: 4200, n: 20 }]
  },
  flex: {
    agg: [{ puuid: 'P1', game_name: 'UGA Teste', tag_line: '2109', tier: 'GOLD', rank: 'II', jogos: 6, vitorias: 2, k: 30, d: 40, a: 60, cs_min: 5, vis_min: 0.8, kp: 0.5, gpm: 340, dmg: 12000 }],
    rotas: [{ puuid: 'P1', team_position: 'MIDDLE', n: 6, v: 2 }],
    champs: [{ puuid: 'P1', champion_name: 'Lux', team_position: 'MIDDLE', n: 6, v: 2 }],
    marcos: [{ puuid: 'P1', ouro10: 3100, xp10: 4000, n: 6 }]
  }
};

test('parseMetaTiers: extrai patch e tiers normalizados', () => {
  const { table, patch } = parseMetaTiers('# patch: 15.13 | atualizado: 2026-07-15\nchampion,role,tier\nAhri,MID,S\nWukong,JUNGLE,A\n');
  assert.equal(patch, '15.13');
  assert.equal(table['ahri|MID'].tier, 'S');
  // monkeyking (Riot) casa com wukong (alias) — championName vs Data Dragon
  assert.ok(table['wukong|JUNGLE']);
});

test('resolverFilas: solo|flex|ambas', () => {
  assert.deepEqual(resolverFilas('solo'), ['solo']);
  assert.deepEqual(resolverFilas('flex'), ['flex']);
  assert.deepEqual(resolverFilas('ambas'), ['solo', 'flex']);
  assert.deepEqual(resolverFilas(undefined), ['solo', 'flex']);
});

test('gerarRelatorio "ambas": produz DOIS relatórios (Solo e Flex) com cabeçalhos distintos', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'dia', fila: 'ambas', somentePremium: false });
  const titulos = r.mensagens.flatMap(m => (m.embeds || []).map(e => e.title)).filter(t => /Ranked/.test(t));
  assert.ok(titulos.some(t => t.includes('Solo/Duo')), 'deve ter cabeçalho Solo/Duo');
  assert.ok(titulos.some(t => t.includes('Flex')), 'deve ter cabeçalho Flex');
  assert.equal(r.ativos, 1); // mesmo puuid ativo nas duas filas conta 1 (distinto)
});

test('gerarRelatorio "solo": só o relatório Solo', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'dia', fila: 'solo', somentePremium: false });
  const titulos = r.mensagens.flatMap(m => (m.embeds || []).map(e => e.title)).filter(t => /Ranked/.test(t));
  assert.ok(titulos.every(t => t.includes('Solo/Duo')));
  assert.ok(!titulos.some(t => t.includes('Flex')));
});

test('gerarRelatorio: fila sem jogos vira mensagem "ninguém jogou"', async () => {
  const soSolo = { solo: DATA.solo, flex: null };
  const r = await gerarRelatorio({ queryRows: fakeQuery(soSolo), periodo: 'dia', fila: 'ambas', somentePremium: false });
  const conteudos = r.mensagens.filter(m => m.content).map(m => m.content);
  assert.ok(conteudos.some(c => /Flex/.test(c) && /ninguém/.test(c)), 'Flex vazio deve virar aviso');
});

test('gerarRelatorio: prosa do mesmo jogador difere entre Solo e Flex (personalização por fila)', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'dia', fila: 'ambas', somentePremium: false });
  const descrs = r.mensagens.flatMap(m => (m.embeds || []).filter(e => e.title === 'UGA Teste#2109').map(e => e.description));
  assert.equal(descrs.length, 2, 'um card por fila');
  assert.notEqual(descrs[0], descrs[1], 'a prosa deve mudar entre Solo e Flex');
});
