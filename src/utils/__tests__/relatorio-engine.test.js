import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarRelatorio, parseMetaTiers, resolverFilas, normalizarPeriodo, nomeCampeao, FILAS
} from '../../../cron/lib/relatorio-engine.js';

// queryRows falso: devolve a forma certa conforme o SQL; separa Solo (420) x Flex (440).
// A ordem dos testes importa — as consultas mais específicas vêm primeiro.
function fakeQuery(dados) {
  return async (sql, params) => {
    const isFlex = /queue_id IN \(440\)/.test(sql);
    const d = isFlex ? dados.flex : dados.solo;
    if (!d) return [];
    if (/tam_seq/.test(sql)) return d.seq || [];                    // qSequencias
    if (/dia_semana/.test(sql)) return d.horarios || [];            // qHorarios
    if (/COUNT\(\*\) partidas/.test(sql)) return d.resumo || [];    // qResumo (nº + datas)
    if (/COUNT\(\*\) jogos/.test(sql)) return d.agg || [];
    if (/estatisticas_jogador_marcos/.test(sql)) return d.marcos || [];
    if (/GROUP BY s\.puuid, s\.champion_name/.test(sql)) return d.champs || [];
    return d.rotas || [];
  };
}

const T = (iso) => Date.parse(iso);

const DATA = {
  solo: {
    agg: [{
      puuid: 'P1', game_name: 'UGA Teste', tag_line: '2109',
      tier: 'GOLD', rank: 'II', lp: 42, flex_tier: 'SILVER', flex_rank: 'I', flex_lp: 88,
      jogos: 20, vitorias: 12, k: 100, d: 80, a: 180,
      cs_min: 7, vis_min: 0.9, kp: 0.55, gpm: 380, dmg: 18000,
      primeira: T('2026-07-01T15:00:00Z'), ultima: T('2026-07-20T23:30:00Z'),
      tempo_total: 20 * 1900, dur_media: 1900, dias_ativos: 9, pool: 3
    }],
    rotas: [{ puuid: 'P1', team_position: 'MIDDLE', n: 20, v: 12 }],
    champs: [
      { puuid: 'P1', champion_name: 'Ahri', team_position: 'MIDDLE', n: 12, v: 8, k: 60, d: 40, a: 110, cs_min: 7.2, dmg: 19000, primeira: T('2026-07-01T15:00:00Z'), ultima: T('2026-07-20T23:30:00Z') },
      { puuid: 'P1', champion_name: 'Viktor', team_position: 'MIDDLE', n: 5, v: 3, k: 25, d: 25, a: 45, cs_min: 7.5, dmg: 20000, primeira: T('2026-07-03T15:00:00Z'), ultima: T('2026-07-18T22:00:00Z') },
      { puuid: 'P1', champion_name: 'Zed', team_position: 'MIDDLE', n: 3, v: 1, k: 15, d: 15, a: 25, cs_min: 6.8, dmg: 15000, primeira: T('2026-07-05T15:00:00Z'), ultima: T('2026-07-14T21:00:00Z') }
    ],
    marcos: [{ puuid: 'P1', ouro10: 3500, xp10: 4200, n: 20 }],
    seq: [
      { puuid: 'P1', win: 1, tam_seq: 5, fim: T('2026-07-10T20:00:00Z') },
      { puuid: 'P1', win: 0, tam_seq: 3, fim: T('2026-07-20T23:30:00Z') }
    ],
    horarios: [
      { puuid: 'P1', dia_semana: 6, faixa_dia: 3, n: 12, v: 8 },
      { puuid: 'P1', dia_semana: 2, faixa_dia: 3, n: 8, v: 4 }
    ],
    resumo: [{ partidas: 20, primeira: T('2026-07-01T15:00:00Z'), ultima: T('2026-07-20T23:30:00Z') }]
  },
  flex: {
    agg: [{
      puuid: 'P1', game_name: 'UGA Teste', tag_line: '2109',
      tier: 'GOLD', rank: 'II', lp: 42, flex_tier: 'SILVER', flex_rank: 'I', flex_lp: 88,
      jogos: 6, vitorias: 2, k: 30, d: 40, a: 60,
      cs_min: 5, vis_min: 0.8, kp: 0.5, gpm: 340, dmg: 12000,
      primeira: T('2026-07-05T18:00:00Z'), ultima: T('2026-07-18T22:00:00Z'),
      tempo_total: 6 * 1750, dur_media: 1750, dias_ativos: 4, pool: 1
    }],
    rotas: [{ puuid: 'P1', team_position: 'MIDDLE', n: 6, v: 2 }],
    champs: [{ puuid: 'P1', champion_name: 'Lux', team_position: 'MIDDLE', n: 6, v: 2, k: 30, d: 40, a: 60, cs_min: 5, dmg: 12000, primeira: T('2026-07-05T18:00:00Z'), ultima: T('2026-07-18T22:00:00Z') }],
    marcos: [{ puuid: 'P1', ouro10: 3100, xp10: 4000, n: 6 }],
    seq: [{ puuid: 'P1', win: 0, tam_seq: 4, fim: T('2026-07-18T22:00:00Z') }],
    horarios: [{ puuid: 'P1', dia_semana: 0, faixa_dia: 2, n: 6, v: 2 }],
    resumo: [{ partidas: 6, primeira: T('2026-07-05T18:00:00Z'), ultima: T('2026-07-18T22:00:00Z') }]
  }
};

const embedsDe = (r) => r.mensagens.flatMap(m => m.embeds || []);
const headerDe = (r) => embedsDe(r).find(e => /Relatório/.test(e.title || ''));
// A mensagem de um jogador é a que tem o embed de resumo com o nome dele.
const msgDoJogador = (r, nome) => r.mensagens.filter(m => (m.embeds || []).some(e => (e.title || '').includes(nome)));
const embedFila = (msgs, label) => msgs.flatMap(m => m.embeds || []).find(e => (e.title || '').includes(label));

test('parseMetaTiers: extrai patch e tiers normalizados', () => {
  const { table, patch } = parseMetaTiers('# patch: 15.13 | atualizado: 2026-07-15\nchampion,role,tier\nAhri,MID,S\nWukong,JUNGLE,A\n');
  assert.equal(patch, '15.13');
  assert.equal(table['ahri|MID'].tier, 'S');
  // monkeyking (Riot) casa com wukong (alias) — championName vs Data Dragon
  assert.ok(table['wukong|JUNGLE']);
});

test('nomeCampeao: championName da Riot vira nome legível', () => {
  assert.equal(nomeCampeao('XinZhao'), 'Xin Zhao');       // camelCase
  assert.equal(nomeCampeao('MissFortune'), 'Miss Fortune');
  assert.equal(nomeCampeao('Kaisa'), "Kai'Sa");           // pontuação perdida pela Riot
  assert.equal(nomeCampeao('Chogath'), "Cho'Gath");
  assert.equal(nomeCampeao('MonkeyKing'), 'Wukong');      // nome interno ≠ nome de exibição
  assert.equal(nomeCampeao('Ahri'), 'Ahri');              // sem mudança
  assert.equal(nomeCampeao(''), '—');                     // ausente degrada
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

test('gerarRelatorio: cabeçalho é a 1ª mensagem e cada jogador tem a SUA mensagem', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  assert.equal(r.ativos, 1);
  assert.equal(r.mensagens.length, 2, 'cabeçalho + 1 mensagem do jogador');
  assert.ok(/Relatório/.test(r.mensagens[0].embeds[0].title), 'a 1ª mensagem é o cabeçalho');
  const msgs = msgDoJogador(r, 'UGA Teste#2109');
  assert.equal(msgs.length, 1, 'uma mensagem por jogador');
});

test('gerarRelatorio "ambas": a mensagem do jogador tem prosa própria de Solo/Duo E de Flex', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  const msgs = msgDoJogador(r, 'UGA Teste#2109');
  const solo = embedFila(msgs, 'Solo/Duo');
  const flex = embedFila(msgs, 'Flex');
  assert.ok(solo && flex, 'existe um embed por fila');
  assert.ok(solo.description.length > 200, 'prosa da Solo/Duo');
  assert.ok(flex.description.length > 200, 'prosa da Flex');
  assert.notEqual(solo.description, flex.description, 'as duas filas têm textos distintos');
  // Cada fila mostra os próprios números e o próprio elo.
  assert.ok(/20j · 60% WR/.test(solo.title), 'título da Solo/Duo com jogos e WR');
  assert.ok(/6j · 33% WR/.test(flex.title), 'título da Flex com jogos e WR');
  assert.ok(/Ouro II/.test(solo.title), 'elo Solo/Duo no título');
  assert.ok(/Prata I/.test(flex.title), 'elo Flex no título');
  assert.equal(solo.color, 0x22c55e, 'cor da fila vem da WR dela (60% → verde)');
  assert.equal(flex.color, 0xef4444, 'Flex em 33% → vermelho');
});

test('gerarRelatorio: cada fila lista o top 5 campeões com taxa de vitória', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  const solo = embedFila(msgDoJogador(r, 'UGA Teste#2109'), 'Solo/Duo');
  const top = solo.fields.find(f => /Top \d+ campeões/.test(f.name));
  assert.ok(top, 'existe o campo de top campeões');
  assert.ok(/Ahri.*12j.*67%/.test(top.value), 'Ahri com jogos e WR');
  assert.ok(/Viktor.*5j.*60%/.test(top.value), 'Viktor com jogos e WR');
  assert.ok(/Zed.*3j.*33%/.test(top.value), 'Zed com jogos e WR');
  assert.ok(/KDA/.test(top.value), 'KDA por campeão');
});

test('gerarRelatorio: cada fila diz quando foi o primeiro e o último jogo', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  const msgs = msgDoJogador(r, 'UGA Teste#2109');
  const solo = embedFila(msgs, 'Solo/Duo');
  const quando = solo.fields.find(f => /Quando/.test(f.name));
  assert.ok(quando, 'existe o campo da janela');
  assert.ok(/01\/07/.test(quando.value), 'data do primeiro jogo');
  assert.ok(/20\/07/.test(quando.value), 'data do último jogo');
  assert.ok(/dia\(s\) com jogo/.test(quando.value), 'dias ativos');
  assert.ok(/em jogo \(média/.test(quando.value), 'tempo total e duração média');
  // E o resumo do jogador cruza as duas filas na mesma janela.
  const resumo = msgs[0].embeds[0].fields.find(f => /Resumo do período/.test(f.name));
  assert.ok(/26 jogos/.test(resumo.value), 'total das duas filas');
  assert.ok(/14V-12D/.test(resumo.value), 'placar somado');
});

test('gerarRelatorio: destaques trazem sequências, pool e horário', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  const solo = embedFila(msgDoJogador(r, 'UGA Teste#2109'), 'Solo/Duo');
  const dest = solo.fields.find(f => /Destaques/.test(f.name));
  assert.ok(/Melhor sequência: \*\*5V\*\*/.test(dest.value), 'maior sequência de vitórias');
  assert.ok(/Pior sequência: \*\*3D\*\*/.test(dest.value), 'maior sequência de derrotas');
  assert.ok(/Terminou com \*\*3D\*\*/.test(dest.value), 'sequência mais recente');
  assert.ok(/3 campeão\(ões\) diferente\(s\)/.test(dest.value), 'tamanho do pool');
  assert.ok(/sábado à noite/.test(dest.value), 'dia/faixa em que mais joga');
});

test('gerarRelatorio: cabeçalho diz nº de partidas por fila e a primeira/última data', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  const header = headerDe(r);
  assert.ok(header, 'existe um embed de cabeçalho');
  assert.ok(/Solo\/Duo: \*\*20\*\*/.test(header.description), 'partidas avaliadas na Solo/Duo');
  assert.ok(/Flex: \*\*6\*\*/.test(header.description), 'partidas avaliadas na Flex');
  assert.ok(/total \*\*26\*\*/.test(header.description), 'total geral');
  assert.ok(/01\/07\/2026/.test(header.description), 'primeira partida (janela global)');
  assert.ok(/20\/07\/2026/.test(header.description), 'última partida (janela global)');
});

test('gerarRelatorio "solo": mensagem do jogador só com o bloco Solo/Duo', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'solo', somentePremium: false });
  const msgs = msgDoJogador(r, 'UGA Teste#2109');
  const titulos = msgs.flatMap(m => m.embeds).map(e => e.title).join(' ');
  assert.ok(/Solo\/Duo/.test(titulos));
  assert.ok(!/Ranked Flex/.test(titulos));
});

test('gerarRelatorio: todos os períodos entregam mensagem por jogador com as duas filas', async () => {
  for (const periodo of ['semanal', 'mensal', '50', 'todos']) {
    const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo, fila: 'ambas', somentePremium: false });
    const msgs = msgDoJogador(r, 'UGA Teste#2109');
    assert.equal(msgs.length, 1, `${periodo}: uma mensagem por jogador`);
    assert.ok(embedFila(msgs, 'Solo/Duo'), `${periodo}: bloco Solo/Duo`);
    assert.ok(embedFila(msgs, 'Flex'), `${periodo}: bloco Flex`);
    const top = embedFila(msgs, 'Solo/Duo').fields.find(f => /Top \d+ campeões/.test(f.name));
    assert.ok(top && /Ahri/.test(top.value), `${periodo}: top campeões com WR`);
  }
});

test('gerarRelatorio: respeita o limite de 6000 caracteres por mensagem do Discord', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  for (const m of r.mensagens) {
    const soma = (m.embeds || []).reduce((n, e) =>
      n + (e.title || '').length + (e.description || '').length + (e.footer?.text || '').length +
      (e.fields || []).reduce((x, f) => x + f.name.length + f.value.length, 0), 0);
    assert.ok(soma <= 6000, `mensagem com ${soma} caracteres`);
    assert.ok((m.embeds || []).length <= 10, 'no máximo 10 embeds');
    for (const e of m.embeds || []) {
      assert.ok((e.description || '').length <= 4096, 'descrição dentro do limite');
      for (const f of e.fields || []) assert.ok(f.value.length <= 1024, 'field dentro do limite');
    }
  }
});

test('gerarRelatorio: ninguém jogou vira uma mensagem "ninguém jogou"', async () => {
  const vazio = { solo: null, flex: null };
  const r = await gerarRelatorio({ queryRows: fakeQuery(vazio), periodo: 'semanal', fila: 'ambas', somentePremium: false });
  assert.equal(r.ativos, 0);
  assert.ok(r.mensagens.some(m => m.content && /ninguém/.test(m.content)), 'sai um aviso de vazio');
});
