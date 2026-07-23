import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarRelatorio, parseMetaTiers, resolverFilas, normalizarPeriodo, FILAS
} from '../../../cron/lib/relatorio-engine.js';

// queryRows falso: devolve a forma certa conforme o SQL; separa Solo (420) x Flex (440).
function fakeQuery(dados) {
  return async (sql, params) => {
    const isFlex = /queue_id IN \(440\)/.test(sql);
    const d = isFlex ? dados.flex : dados.solo;
    if (!d) return [];
    if (/COUNT\(\*\) partidas/.test(sql)) return d.resumo || [];   // qResumo (nº + datas)
    if (/COUNT\(\*\) jogos/.test(sql)) return d.agg || [];
    if (/estatisticas_jogador_marcos/.test(sql)) return d.marcos || [];
    if (/s\.champion_name/.test(sql)) return d.champs || [];       // 's.' evita casar a CTE
    return d.rotas || [];
  };
}

const DATA = {
  solo: {
    agg: [{ puuid: 'P1', game_name: 'UGA Teste', tag_line: '2109', tier: 'GOLD', rank: 'II', jogos: 20, vitorias: 12, k: 100, d: 80, a: 180, cs_min: 7, vis_min: 0.9, kp: 0.55, gpm: 380, dmg: 18000 }],
    rotas: [{ puuid: 'P1', team_position: 'MIDDLE', n: 20, v: 12 }],
    champs: [{ puuid: 'P1', champion_name: 'Ahri', team_position: 'MIDDLE', n: 20, v: 12 }],
    marcos: [{ puuid: 'P1', ouro10: 3500, xp10: 4200, n: 20 }],
    resumo: [{ partidas: 20, primeira: Date.parse('2026-07-01T12:00:00Z'), ultima: Date.parse('2026-07-20T12:00:00Z') }]
  },
  flex: {
    agg: [{ puuid: 'P1', game_name: 'UGA Teste', tag_line: '2109', tier: 'GOLD', rank: 'II', jogos: 6, vitorias: 2, k: 30, d: 40, a: 60, cs_min: 5, vis_min: 0.8, kp: 0.5, gpm: 340, dmg: 12000 }],
    rotas: [{ puuid: 'P1', team_position: 'MIDDLE', n: 6, v: 2 }],
    champs: [{ puuid: 'P1', champion_name: 'Lux', team_position: 'MIDDLE', n: 6, v: 2 }],
    marcos: [{ puuid: 'P1', ouro10: 3100, xp10: 4000, n: 6 }],
    resumo: [{ partidas: 6, primeira: Date.parse('2026-07-05T12:00:00Z'), ultima: Date.parse('2026-07-18T12:00:00Z') }]
  }
};

const titulos = (r) => r.mensagens.flatMap(m => (m.embeds || []).map(e => e.title));
const cardDe = (r, nome) => r.mensagens.flatMap(m => (m.embeds || []).filter(e => e.title === nome));
const headerDe = (r) => r.mensagens.flatMap(m => m.embeds || []).find(e => /Relatório/.test(e.title || ''));

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

test('normalizarPeriodo: novos nomes + aliases antigos', () => {
  assert.equal(normalizarPeriodo('semanal'), 'semanal');
  assert.equal(normalizarPeriodo('mensal'), 'mensal');
  assert.equal(normalizarPeriodo('50'), '50');
  assert.equal(normalizarPeriodo('todos'), 'todos');
  assert.equal(normalizarPeriodo('dia'), 'semanal');    // aliases antigos → novos
  assert.equal(normalizarPeriodo('semana'), 'mensal');
  assert.equal(normalizarPeriodo('mes'), 'mensal');
  assert.equal(normalizarPeriodo('geral'), 'todos');
  assert.equal(normalizarPeriodo(undefined), 'semanal'); // default
});

test('gerarRelatorio "ambas": UM card por jogador com as duas filas no mesmo embed', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  const cards = cardDe(r, 'UGA Teste#2109');
  assert.equal(cards.length, 1, 'um único card por jogador (não um por fila)');
  const nomesCampos = cards[0].fields.map(f => f.name).join(' ');
  assert.ok(/Solo\/Duo/.test(nomesCampos), 'card traz o bloco Solo/Duo');
  assert.ok(/Flex/.test(nomesCampos), 'card traz o bloco Flex');
  assert.equal(r.ativos, 1);
});

test('gerarRelatorio: cabeçalho diz nº de partidas por fila e a primeira/última data', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  const header = headerDe(r);
  assert.ok(header, 'existe um embed de cabeçalho');
  assert.ok(/Solo\/Duo: \*\*20\*\*/.test(header.description), 'partidas avaliadas na Solo/Duo');
  assert.ok(/Flex: \*\*6\*\*/.test(header.description), 'partidas avaliadas na Flex');
  assert.ok(/01\/07\/2026/.test(header.description), 'primeira partida (janela global)');
  assert.ok(/20\/07\/2026/.test(header.description), 'última partida (janela global)');
});

test('gerarRelatorio: cabeçalho vai no topo de TODAS as mensagens', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  for (const m of r.mensagens.filter(m => m.embeds)) {
    assert.ok(/Relatório/.test(m.embeds[0].title || ''), 'cada mensagem começa pelo cabeçalho');
  }
});

test('gerarRelatorio "solo": card só com o bloco Solo/Duo', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'solo', somentePremium: false });
  const card = cardDe(r, 'UGA Teste#2109')[0];
  const nomes = card.fields.map(f => f.name).join(' ');
  assert.ok(/Solo\/Duo/.test(nomes));
  assert.ok(!/Flex/.test(nomes));
});

test('gerarRelatorio: card usa a fila principal (mais jogada) na cor/prosa', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  const card = cardDe(r, 'UGA Teste#2109')[0];
  assert.equal(card.color, 0x22c55e, 'cor vem da WR da Solo/Duo (60% → verde), fila mais jogada');
  assert.ok(card.description.length > 0, 'tem prosa');
});

test('gerarRelatorio: ninguém jogou vira uma mensagem "ninguém jogou"', async () => {
  const vazio = { solo: null, flex: null };
  const r = await gerarRelatorio({ queryRows: fakeQuery(vazio), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  assert.equal(r.ativos, 0);
  assert.ok(r.mensagens.some(m => m.content && /ninguém/.test(m.content)), 'sai um aviso de vazio');
});
