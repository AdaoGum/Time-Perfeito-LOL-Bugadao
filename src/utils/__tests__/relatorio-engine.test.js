import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarRelatorio, parseMetaTiers, resolverFilas, normalizarPeriodo, nomeCampeao, FILAS,
  corteAnterior, resolverJanela
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
// Cada relatório de jogador é uma mensagem com o nome dele no título do embed.
const msgDoJogador = (r, nome) => r.mensagens.filter(m => (m.embeds || []).some(e => (e.title || '').includes(nome)));
const embedFila = (msgs, label) => msgs.flatMap(m => m.embeds || []).find(e => (e.title || '').includes(`Ranked ${label}`));
// A mensagem (não o embed) do relatório de uma fila.
const msgDaFila = (msgs, label) => msgs.find(m => (m.embeds || []).some(e => (e.title || '').includes(`Ranked ${label}`)));

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

// ---------------------------------------------------------------------------
// FORMATO DO DISCORD (set/2026): o post deixou de carregar o relatório inteiro.
// Agora é UM card curto por jogador — nome, alguns KPIs, a menção e o LINK para
// a tela /relatorios, que é onde o detalhe (prosa, gráficos, top 5) passou a
// viver. Antes eram DUAS mensagens por jogador com cinco quadros de números.
// ---------------------------------------------------------------------------
const cardDe = (r, nome) => embedsDe(r).find((e) => (e.title || '').includes(nome));
const msgDe = (r, nome) => r.mensagens.find((m) => (m.embeds || []).some((e) => (e.title || '').includes(nome)));

test('gerarRelatorio: cabeçalho + UM card por jogador (não mais dois)', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', agora: T('2026-08-01T00:00:00Z') });
  assert.equal(r.mensagens.length, 2, 'cabeçalho + 1 card do único jogador');
  assert.match(r.mensagens[0].embeds[0].title, /Relatório Semanal/);
  assert.equal(r.mensagens[1].embeds.length, 1);
  assert.equal(r.ativos, 1);
});

test('o card traz o nome do jogador e o link do relatório completo', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', agora: T('2026-08-01T00:00:00Z') });
  const card = cardDe(r, 'UGA Teste');
  assert.match(card.title, /UGA Teste#2109/);
  // O título do embed vira link clicável, e a descrição repete a chamada.
  assert.match(card.url, /^https:\/\/ugabugatimeperfeito\.bugadao\.com\/relatorios\//);
  assert.match(card.description, /Acesse o link para ver o relat/);
  assert.ok(card.description.includes(card.url), 'a descrição precisa carregar o mesmo link');
});

test('o link aponta para o jogador, a fila mais jogada e o período do post', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', agora: T('2026-08-01T00:00:00Z') });
  const url = new URL(cardDe(r, 'UGA Teste').url);
  assert.equal(url.pathname, '/relatorios/UGA%20Teste/2109');
  assert.equal(url.searchParams.get('fila'), 'solo', 'solo tem 20 jogos contra 6 do flex');
  assert.equal(url.searchParams.get('preset'), 'semana');
});

test('período mensal manda o preset "mes"; período sem equivalente vai sem query', async () => {
  const mensal = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'mensal', agora: T('2026-08-01T00:00:00Z') });
  assert.equal(new URL(cardDe(mensal, 'UGA Teste').url).searchParams.get('preset'), 'mes');

  const cinquenta = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: '50', agora: T('2026-08-01T00:00:00Z') });
  const url = new URL(cardDe(cinquenta, 'UGA Teste').url);
  assert.equal(url.searchParams.get('preset'), null, '"50 jogos" não tem preset na tela');
  assert.equal(url.searchParams.get('fila'), 'solo');
});

test('o card resume as DUAS filas em poucos KPIs, sem misturar os números', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', agora: T('2026-08-01T00:00:00Z') });
  const d = cardDe(r, 'UGA Teste').description;
  assert.match(d, /Solo\/Duo.*20j.*12V-8D.*60% WR/s);
  assert.match(d, /Flex.*6j.*2V-4D.*33% WR/s);
  assert.match(d, /KDA/, 'o KDA é um dos KPIs do resumo');
});

test('o card NÃO carrega mais a prosa nem os quadros de números', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', agora: T('2026-08-01T00:00:00Z') });
  const card = cardDe(r, 'UGA Teste');
  assert.equal(card.fields, undefined, 'os quadros (placar, top 5, rotas, destaques) saíram do Discord');
  assert.ok(card.description.length < 700, `resumo deve ser curto, veio com ${card.description.length} chars`);
  assert.ok(!/Top 5 campe/i.test(card.description));
});

test('a menção vai no content da mensagem do próprio jogador', async () => {
  const r = await gerarRelatorio({
    queryRows: fakeQuery(DATA), periodo: 'semanal', agora: T('2026-08-01T00:00:00Z'),
    userMap: { P1: '123456789' }
  });
  const msg = msgDe(r, 'UGA Teste');
  assert.match(msg.content, /<@123456789>/);
  assert.deepEqual(msg.allowed_mentions, { parse: ['users'] });
  // Uma mensagem por jogador => uma menção por jogador, nunca duas.
  assert.equal(r.mensagens.filter((m) => (m.content || '').includes('<@123456789>')).length, 1);
});

test('sem userMap o card sai igual, só que sem ping', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', agora: T('2026-08-01T00:00:00Z') });
  const msg = msgDe(r, 'UGA Teste');
  assert.equal(msg.content, undefined);
  assert.ok(msg.embeds[0].url, 'o link continua lá');
});

test('quem só jogou uma fila tem só a linha dela no card', async () => {
  const soSolo = { solo: DATA.solo, flex: null };
  const r = await gerarRelatorio({ queryRows: fakeQuery(soSolo), periodo: 'semanal', agora: T('2026-08-01T00:00:00Z') });
  const d = cardDe(r, 'UGA Teste').description;
  assert.match(d, /Solo\/Duo/);
  assert.ok(!/\*\*Flex\*\*/.test(d), 'fila sem partida não vira linha vazia');
  assert.equal(new URL(cardDe(r, 'UGA Teste').url).searchParams.get('fila'), 'solo');
});

test('gerarRelatorio "flex": o link e os KPIs cobrem só o Flex', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), fila: 'flex', periodo: 'semanal', agora: T('2026-08-01T00:00:00Z') });
  const card = cardDe(r, 'UGA Teste');
  assert.match(card.description, /Flex.*6j/s);
  assert.ok(!/Solo\/Duo/.test(card.description));
  assert.equal(new URL(card.url).searchParams.get('fila'), 'flex');
});

test('todos os períodos entregam UM card por jogador', async () => {
  for (const periodo of ['semanal', 'mensal', '50', 'todos']) {
    const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo, agora: T('2026-08-01T00:00:00Z') });
    assert.equal(r.mensagens.length, 2, `${periodo}: cabeçalho + 1 card`);
    assert.ok(cardDe(r, 'UGA Teste').url, `${periodo}: o card precisa do link`);
  }
});

test('o cabeçalho diz o período, quantos jogaram e quantas partidas', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', agora: T('2026-08-01T00:00:00Z') });
  const h = r.mensagens[0].embeds[0];
  assert.match(h.description, /Ranked Solo\/Duo \+ Flex/);
  assert.match(h.description, /1\*{0,2} jogador/);
  assert.match(h.description, /26\*{0,2} partidas/, '20 do solo + 6 do flex');
  assert.match(h.description, /link do relat/i, 'o cabeçalho explica onde está o detalhe');
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

// ---------------------------------------------------------------------------
// OS DOIS POSTS AGENDADOS (set/2026) — janela ANCORADA no corte anterior.
// O que se testa aqui não é o número de dias por si: é o ENCAIXE. Se a janela da
// sexta não começar exatamente onde a da segunda terminou, ou fica um buraco (uma
// manhã de jogos que nenhum post conta) ou uma sobreposição (a mesma partida
// contada duas vezes, em dois relatórios seguidos).
// ---------------------------------------------------------------------------
const SEG_9H = T('2026-09-07T12:00:00Z');   // segunda, 09:00 de Brasília
const SEX_9H = T('2026-09-11T12:00:00Z');   // sexta,   09:00 de Brasília

test('as janelas de segunda e sexta se encaixam: sem buraco e sem sobreposição', () => {
  const fds = resolverJanela('fim-de-semana', SEG_9H);
  const util = resolverJanela('semana-util', SEX_9H);
  assert.equal(fds.dias, 3, 'o post de segunda cobre sexta de manhã -> segunda de manhã');
  assert.equal(util.dias, 4, 'o post de sexta cobre segunda de manhã -> sexta de manhã');
  assert.equal(fds.ate, SEG_9H);
  assert.equal(util.desde, SEG_9H, 'a janela da sexta começa onde a da segunda terminou');
});

test('rodar atrasado alarga a janela pelo fim, sem mexer no começo', () => {
  const atrasado = SEG_9H + 37 * 60000;    // o Actions raramente dispara no minuto
  const noHorario = resolverJanela('fim-de-semana', SEG_9H);
  const tardio = resolverJanela('fim-de-semana', atrasado);
  assert.equal(tardio.desde, noHorario.desde, 'o corte anterior é o mesmo');
  assert.equal(tardio.ate, atrasado, 'e a janela vai até o instante do post');
});

test('corteAnterior: no próprio dia, antes da hora, volta uma semana', () => {
  const segCedo = T('2026-09-07T10:00:00Z');           // segunda, 07:00 BRT
  assert.equal(corteAnterior(segCedo, 1, 9), T('2026-08-31T12:00:00Z'));
  // Depois da hora, é o corte de hoje mesmo.
  assert.equal(corteAnterior(SEG_9H + 3600000, 1, 9), SEG_9H);
});

test('período de "últimos N dias" não ganha âncora nenhuma', () => {
  const P = resolverJanela('semanal', SEG_9H);
  assert.equal(P.ms, 7 * 86400000);
  assert.equal(P.desde, undefined, 'janela relativa não carrega datas fixas');
});

test('período ancorado: o link leva o intervalo exato para a tela', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'fim-de-semana', agora: SEG_9H });
  const url = new URL(cardDe(r, 'UGA Teste').url);
  assert.equal(url.searchParams.get('preset'), 'outro', 'só o intervalo livre representa "de sexta a segunda"');
  assert.equal(url.searchParams.get('de'), '2026-09-04');
  assert.equal(url.searchParams.get('ate'), '2026-09-07');
  assert.equal(url.searchParams.get('fila'), 'solo');
});

test('período relativo continua mandando preset, e sem datas', async () => {
  const url = new URL(cardDe(await gerarRelatorio({
    queryRows: fakeQuery(DATA), periodo: 'semanal', agora: SEG_9H
  }), 'UGA Teste').url);
  assert.equal(url.searchParams.get('preset'), 'semana');
  assert.equal(url.searchParams.get('de'), null);
});

// ---------------------------------------------------------------------------
// POST INDIVIDUAL — o campo "jogador" do Actions.
// ---------------------------------------------------------------------------
test('individual: um card só, sem o cabeçalho da tribo', async () => {
  const r = await gerarRelatorio({
    queryRows: fakeQuery(DATA), periodo: 'semanal', agora: SEG_9H, puuids: ['P1'], individual: true
  });
  assert.equal(r.mensagens.length, 1, 'o cabeçalho resumiria uma tribo que ninguém pediu');
  assert.equal(r.individual, true);
  const card = r.mensagens[0].embeds[0];
  assert.ok(card.description.includes('Relatório individual'), 'o card se apresenta');
  assert.ok(card.footer.text.includes('pedido avulso'));
  assert.ok(card.url, 'o link para o relatório completo continua lá');
});

test('individual: a menção avisa que o relatório é avulso', async () => {
  const r = await gerarRelatorio({
    queryRows: fakeQuery(DATA), periodo: 'semanal', agora: SEG_9H, puuids: ['P1'],
    individual: true, userMap: { P1: '123456789' }
  });
  assert.ok(r.mensagens[0].content.includes('<@123456789>'));
  assert.ok(r.mensagens[0].content.includes('individual'));
});

test('individual sem partidas no período: o aviso sai nominal', async () => {
  const r = await gerarRelatorio({
    queryRows: fakeQuery({ solo: null, flex: null }), periodo: 'semanal',
    puuids: ['P1'], individual: true, rotuloAlvo: 'UGA Teste#2109'
  });
  assert.equal(r.ativos, 0);
  assert.ok(r.mensagens[0].content.includes('UGA Teste#2109'));
  assert.ok(!r.mensagens[0].content.includes('ninguém da tribo'));
});

test('a rodada normal da tribo não vira individual por acidente', async () => {
  const r = await gerarRelatorio({ queryRows: fakeQuery(DATA), periodo: 'semanal', agora: SEG_9H });
  assert.equal(r.individual, false);
  assert.equal(r.mensagens.length, 2, 'cabeçalho + card');
  assert.ok(!r.mensagens[1].embeds[0].description.includes('Relatório individual'));
});
