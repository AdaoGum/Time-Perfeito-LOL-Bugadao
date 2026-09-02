// Testes da fatia NOVA do motor de relatório — a que a tela /relatorios usa:
// intervalo de datas livre, série diária, sugestão do meta no front e a prosa
// rodando fora do Discord. O caminho do Discord segue coberto por
// relatorio-engine.test.js (que agora exercita as camadas de baixo por tabela).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  DIA, SQL_PREMIUM_HISTORICO, SQL_PREMIUM_JOGADORES, coletarAnalises, cteSel,
  diaParaEpoch, parseMetaTiers, periodoIntervalo, qSerieDiaria, resolverJanela,
  sqlPremiumAtividade, sugerirDoMeta
} from '../../../shared/relatorio-metricas.js';
import { gerarProsa } from '../../../shared/relatorio-prosa.js';

const T = (iso) => Date.parse(iso);

// Mesma forma de dados que o D1 devolve (ver relatorio-engine.test.js).
const SOLO = {
  agg: [{
    puuid: 'P1', game_name: 'UGA Teste', tag_line: '2109',
    tier: 'GOLD', rank: 'II', lp: 42, flex_tier: 'SILVER', flex_rank: 'I', flex_lp: 88,
    jogos: 20, vitorias: 12, k: 100, d: 80, a: 180,
    cs_min: 7, vis_min: 0.9, kp: 0.55, gpm: 380, dmg: 18000,
    primeira: T('2026-08-01T15:00:00Z'), ultima: T('2026-08-07T23:30:00Z'),
    tempo_total: 20 * 1900, dur_media: 1900, dias_ativos: 6, pool: 3
  }],
  rotas: [{ puuid: 'P1', team_position: 'MIDDLE', n: 20, v: 12 }],
  champs: [
    { puuid: 'P1', champion_name: 'Ahri', team_position: 'MIDDLE', n: 12, v: 8, k: 60, d: 40, a: 110, cs_min: 7.2, dmg: 19000, primeira: T('2026-08-01T15:00:00Z'), ultima: T('2026-08-07T23:30:00Z') },
    { puuid: 'P1', champion_name: 'Viktor', team_position: 'MIDDLE', n: 5, v: 3, k: 25, d: 25, a: 45, cs_min: 7.5, dmg: 20000, primeira: T('2026-08-02T15:00:00Z'), ultima: T('2026-08-06T22:00:00Z') },
    { puuid: 'P1', champion_name: 'Zed', team_position: 'MIDDLE', n: 3, v: 1, k: 15, d: 15, a: 25, cs_min: 6.8, dmg: 15000, primeira: T('2026-08-03T15:00:00Z'), ultima: T('2026-08-05T21:00:00Z') }
  ],
  seq: [{ puuid: 'P1', win: 1, tam_seq: 5, fim: T('2026-08-07T23:30:00Z') }],
  horarios: [{ puuid: 'P1', dia_semana: 6, faixa_dia: 3, n: 20, v: 12 }],
  resumo: [{ partidas: 20, primeira: T('2026-08-01T15:00:00Z'), ultima: T('2026-08-07T23:30:00Z') }],
  serie: [
    { dia: '2026-08-01', jogos: 4, vitorias: 3, k: 20, d: 12, a: 30, cs_min: 7.1 },
    { dia: '2026-08-04', jogos: 9, vitorias: 5, k: 45, d: 40, a: 80, cs_min: 6.9 },
    { dia: '2026-08-07', jogos: 7, vitorias: 4, k: 35, d: 28, a: 70, cs_min: 7.2 }
  ]
};

// queryRows falso: reconhece a consulta pelo SQL e registra o que foi pedido, para
// os testes conseguirem afirmar sobre a JANELA que chegou ao banco.
function fakeQuery(chamadas, dados = SOLO) {
  return async (sql, params) => {
    chamadas.push({ sql, params });
    // `GROUP BY dia` é exclusivo da série; casar por `date(s.gc` pegaria também o
    // agregado principal, que usa a mesma função no COUNT(DISTINCT ...) dias_ativos.
    if (/GROUP BY dia\b/.test(sql)) return dados.serie || [];
    if (/tam_seq/.test(sql)) return dados.seq || [];
    if (/dia_semana/.test(sql)) return dados.horarios || [];
    if (/COUNT\(\*\) partidas/.test(sql)) return dados.resumo || [];
    if (/COUNT\(\*\) jogos/.test(sql)) return dados.agg || [];
    if (/estatisticas_jogador_marcos/.test(sql)) return [];
    if (/GROUP BY s\.puuid, s\.champion_name/.test(sql)) return dados.champs || [];
    return dados.rotas || [];
  };
}

// A consulta agregada principal (a que o `qAgg` monta) — é dela que sai a janela.
const agregadas = (chamadas) => chamadas.filter((c) => /COUNT\(\*\) jogos/.test(c.sql));

// ---------------------------------------------------------------------------
// Datas: o contrato entre o <input type="date"> e o SQL
// ---------------------------------------------------------------------------
test('diaParaEpoch: AAAA-MM-DD vira meia-noite de Brasília, não de UTC', () => {
  // 00:00 em BRT (-03:00) é 03:00Z. Usar Date.parse cru daria 00:00Z e jogaria
  // as partidas da noite anterior para dentro do recorte.
  assert.equal(new Date(diaParaEpoch('2026-08-04')).toISOString(), '2026-08-04T03:00:00.000Z');
});

test('diaParaEpoch: a data FINAL é inclusiva para o usuário (vira o dia seguinte)', () => {
  // Todo o SQL usa [desde, ate). Sem esse empurrão, o último dia escolhido pelo
  // usuário ficaria de fora do relatório inteiro.
  const ini = diaParaEpoch('2026-08-04');
  const fim = diaParaEpoch('2026-08-04', true);
  assert.equal(fim - ini, DIA);
});

test('diaParaEpoch: formato inválido devolve null (não uma data maluca)', () => {
  assert.equal(diaParaEpoch('04/08/2026'), null);
  assert.equal(diaParaEpoch(''), null);
  assert.equal(diaParaEpoch(null), null);
  assert.equal(diaParaEpoch('2026-13-99'), null);
});

// ---------------------------------------------------------------------------
// Intervalo livre: é o que substitui um snapshot semanal/mensal gravado
// ---------------------------------------------------------------------------
test('periodoIntervalo: o recorte que chega ao SQL é exatamente o que foi pedido', async () => {
  const desde = diaParaEpoch('2026-08-01');
  const ate = diaParaEpoch('2026-08-07', true);
  const chamadas = [];
  await coletarAnalises({
    queryRows: fakeQuery(chamadas), P: periodoIntervalo(desde, ate), puuids: ['P1'],
    soPrem: false, meta: null, agora: ate, queues: [420], filaChave: 'solo'
  });
  const [atual] = agregadas(chamadas);
  assert.equal(atual.params[0], desde);
  assert.equal(atual.params[1], ate);
  assert.equal(atual.params[2], 'P1');   // o alvo entra depois das datas
});

test('periodoIntervalo: a tendência compara com a janela de MESMO tamanho logo antes', async () => {
  const desde = diaParaEpoch('2026-08-01');
  const ate = diaParaEpoch('2026-08-07', true);   // 7 dias
  const chamadas = [];
  await coletarAnalises({
    queryRows: fakeQuery(chamadas), P: periodoIntervalo(desde, ate), puuids: ['P1'],
    soPrem: false, meta: null, agora: ate, queues: [420], filaChave: 'solo'
  });
  const [, anterior] = agregadas(chamadas);
  assert.equal(anterior.params[1], desde);              // termina onde o atual começa
  assert.equal(desde - anterior.params[0], 7 * DIA);    // e tem os mesmos 7 dias
});

test('desloc: o período ancorado compara com a MESMA janela da semana passada', async () => {
  const sexta9h = Date.parse('2026-09-11T12:00:00Z');
  const P = resolverJanela('semana-util', sexta9h);   // segunda 09h -> sexta 09h
  const chamadas = [];
  await coletarAnalises({
    queryRows: fakeQuery(chamadas), P, puuids: ['P1'],
    soPrem: false, meta: null, agora: sexta9h, queues: [420], filaChave: 'solo'
  });
  const [atual, anterior] = agregadas(chamadas);
  // A comparação recua 7 dias INTEIROS (a semana útil passada), e não os 4 dias da
  // janela — que jogariam a referência em cima de uma quinta e de um domingo.
  assert.equal(atual.params[0] - anterior.params[0], 7 * DIA);
  assert.equal(atual.params[1] - anterior.params[1], 7 * DIA);
  assert.equal(anterior.params[1] - anterior.params[0], atual.params[1] - atual.params[0]);
});

test('periodoIntervalo: rótulo da janela mostra a data final que o usuário escolheu', () => {
  const P = periodoIntervalo(diaParaEpoch('2026-08-01'), diaParaEpoch('2026-08-07', true));
  // E não 08/08, que é só o limite exclusivo interno do SQL.
  assert.match(P.janela, /01\/08\/2026 a 07\/08\/2026/);
});

test('periodoIntervalo: um único dia não vira janela de duração zero', () => {
  const P = periodoIntervalo(diaParaEpoch('2026-08-04'), diaParaEpoch('2026-08-04', true));
  assert.ok(P.ms >= DIA, 'janela de 1 dia precisa sobreviver ao piso');
});

test('coletarAnalises: uma fila por vez — o queue_id fica preso no SQL', async () => {
  const chamadas = [];
  const ate = diaParaEpoch('2026-08-08', true);
  await coletarAnalises({
    queryRows: fakeQuery(chamadas), P: periodoIntervalo(diaParaEpoch('2026-08-01'), ate),
    puuids: ['P1'], soPrem: false, meta: null, agora: ate, queues: [440], filaChave: 'flex'
  });
  assert.ok(chamadas.every((c) => !/queue_id IN \(420\)/.test(c.sql)));
  assert.ok(chamadas.some((c) => /queue_id IN \(440\)/.test(c.sql)));
});

// ---------------------------------------------------------------------------
// Série diária (o "dia a dia" da tela)
// ---------------------------------------------------------------------------
test('qSerieDiaria: agrupa por dia no fuso de Brasília e reaproveita os params do recorte', () => {
  const desde = diaParaEpoch('2026-08-01');
  const ate = diaParaEpoch('2026-08-07', true);
  const q = qSerieDiaria(cteSel({ modo: 'janela', desde, ate, puuids: ['P1'], queues: [420] }));
  assert.match(q.sql, /GROUP BY dia/);
  assert.match(q.sql, /'-3 hours'/);                 // mesmo fuso do dias_ativos
  assert.deepEqual(q.params, [desde, ate, 'P1']);
});

// ---------------------------------------------------------------------------
// Sugestão do meta: sai da análise porque o Worker não lê o CSV do repo
// ---------------------------------------------------------------------------
const META = parseMetaTiers(
  '# patch: 26.15 | atualizado: 2026-08-04\nchampion,role,tier\nAhri,MID,S\nSyndra,MID,S\nViktor,MID,A\nOrianna,MID,B\n'
).table;

test('sugerirDoMeta: indica S/A da rota que o jogador ainda não joga', () => {
  const s = sugerirDoMeta('MIDDLE', ['ahri', 'viktor'], 'P1', META);
  assert.equal(s.nome, 'Syndra');   // Ahri e Viktor estão fora por já serem jogados
  assert.equal(s.tier, 'S');
});

test('sugerirDoMeta: é estável para o mesmo jogador (semente no puuid)', () => {
  const a = sugerirDoMeta('MIDDLE', [], 'P1', META);
  const b = sugerirDoMeta('MIDDLE', [], 'P1', META);
  assert.deepEqual(a, b);
});

test('sugerirDoMeta: sem tabela de meta devolve null em vez de quebrar', () => {
  assert.equal(sugerirDoMeta('MIDDLE', ['ahri'], 'P1', null), null);
});

test('sugerirDoMeta: rota sem candidato livre devolve null', () => {
  assert.equal(sugerirDoMeta('MIDDLE', ['ahri', 'syndra', 'viktor'], 'P1', META), null);
});

test('a análise carrega `jogados` para o front calcular a dica do meta', async () => {
  const ate = diaParaEpoch('2026-08-07', true);
  const { analises } = await coletarAnalises({
    queryRows: fakeQuery([]), P: periodoIntervalo(diaParaEpoch('2026-08-01'), ate),
    puuids: ['P1'], soPrem: false, meta: null, agora: ate, queues: [420], filaChave: 'solo'
  });
  const a = analises[0];
  // O Worker manda `meta: null` (não tem o CSV) — quem completa é a tela.
  assert.equal(a.sugestaoMeta, null);
  assert.deepEqual([...a.jogados].sort(), ['ahri', 'viktor', 'zed']);
  assert.equal(sugerirDoMeta(a.rotaPrinc, a.jogados, a.puuid, META).nome, 'Syndra');
});

// ---------------------------------------------------------------------------
// Prosa fora do Discord: é o que o browser executa
// ---------------------------------------------------------------------------
test('gerarProsa roda sobre a análise crua, sem passar por embed nenhum', async () => {
  const ate = diaParaEpoch('2026-08-07', true);
  const P = periodoIntervalo(diaParaEpoch('2026-08-01'), ate);
  const { analises } = await coletarAnalises({
    queryRows: fakeQuery([]), P, puuids: ['P1'], soPrem: false, meta: null,
    agora: ate, queues: [420], filaChave: 'solo'
  });
  const texto = gerarProsa(analises[0], P.janela, { chave: 'solo', label: 'Solo/Duo' });
  assert.ok(texto.length > 200, 'a narração precisa ter corpo');
  assert.match(texto, /20 partidas|20 jogos/);
  assert.match(texto, /60%/);            // 12V em 20 jogos
  assert.match(texto, /Ahri/);           // campeão mais jogado do recorte
  assert.ok(texto.includes('\n\n'), 'a prosa vem em parágrafos separáveis');
});

test('gerarProsa: a mesma fila e o mesmo dia dão o mesmo texto (semente estável)', async () => {
  const ate = diaParaEpoch('2026-08-07', true);
  const P = periodoIntervalo(diaParaEpoch('2026-08-01'), ate);
  const { analises } = await coletarAnalises({
    queryRows: fakeQuery([]), P, puuids: ['P1'], soPrem: false, meta: null,
    agora: ate, queues: [420], filaChave: 'solo'
  });
  const fila = { chave: 'solo', label: 'Solo/Duo' };
  assert.equal(gerarProsa(analises[0], P.janela, fila), gerarProsa(analises[0], P.janela, fila));
});

test('gerarProsa: Solo e Flex narram diferente (a semente inclui a fila)', async () => {
  const ate = diaParaEpoch('2026-08-07', true);
  const P = periodoIntervalo(diaParaEpoch('2026-08-01'), ate);
  const { analises } = await coletarAnalises({
    queryRows: fakeQuery([]), P, puuids: ['P1'], soPrem: false, meta: null,
    agora: ate, queues: [420], filaChave: 'solo'
  });
  const solo = gerarProsa(analises[0], P.janela, { chave: 'solo', label: 'Solo/Duo' });
  const flex = gerarProsa(analises[0], P.janela, { chave: 'flex', label: 'Flex' });
  assert.notEqual(solo, flex);
});

// ---------------------------------------------------------------------------
// GRID DE CARDS (/relatorios) — as três consultas da rota `premium_players`.
//
// Rodam contra um SQLite de verdade porque o risco aqui não é de lógica, é de
// ORDEM: `sqlPremiumAtividade` tem cinco `?` posicionais e devolve os params num
// array à parte. Trocar dois de lugar não quebra nada — só faz o chip "7d" do
// card mostrar o número dos 15 dias, calado, para sempre.
// ---------------------------------------------------------------------------
const AGORA = Date.parse('2026-09-01T12:00:00-03:00');

function bancoPremium() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE jogadores (
      puuid TEXT PRIMARY KEY, game_name TEXT, tag_line TEXT, profile_icon_id INTEGER,
      summoner_level INTEGER, tier TEXT, rank TEXT, lp INTEGER, win_rate REAL,
      flex_tier TEXT, flex_rank TEXT, flex_lp INTEGER, flex_win_rate REAL,
      ultima_atualizacao INTEGER, has_premium INTEGER DEFAULT 0
    );
    CREATE TABLE partidas (match_id TEXT PRIMARY KEY, queue_id INTEGER, game_creation INTEGER);
    CREATE TABLE estatisticas_jogador_partida (
      puuid TEXT NOT NULL, match_id TEXT NOT NULL, win INTEGER,
      PRIMARY KEY (puuid, match_id)
    );`);

  db.prepare('INSERT INTO jogadores (puuid, game_name, tag_line, has_premium) VALUES (?,?,?,?)')
    .run('P1', 'UGA Premium', '2109', 1);
  db.prepare('INSERT INTO jogadores (puuid, game_name, tag_line, has_premium) VALUES (?,?,?,?)')
    .run('P2', 'UGA Comum', '0001', 0);

  // dias atrás -> (match, fila, vitória, dono). O de 40 dias existe só para provar
  // que a atividade recente para nos 30 — mas o histórico total continua vendo.
  const jogos = [
    ['m3d', 420, 3, 1, 'P1'],
    ['m10d', 420, 10, 0, 'P1'],
    ['m20d', 420, 20, 1, 'P1'],
    ['m40d', 420, 40, 1, 'P1'],
    ['m5dFlex', 440, 5, 1, 'P1'],
    ['m2dComum', 420, 2, 1, 'P2']   // não-premium: não pode aparecer em lugar nenhum
  ];
  for (const [id, queue, dias, venceu, dono] of jogos) {
    db.prepare('INSERT INTO partidas (match_id, queue_id, game_creation) VALUES (?,?,?)')
      .run(id, queue, AGORA - dias * DIA);
    db.prepare('INSERT INTO estatisticas_jogador_partida (puuid, match_id, win) VALUES (?,?,?)')
      .run(dono, id, venceu);
  }
  return db;
}

const roda = (db, { sql, params = [] }) => db.prepare(sql).all(...params);

test('premium_players: os chips 7/15/30 contam a janela certa (os `?` estão na ordem)', () => {
  const db = bancoPremium();
  const q = sqlPremiumAtividade(AGORA - 7 * DIA, AGORA - 15 * DIA, AGORA - 30 * DIA);
  const porFila = Object.fromEntries(roda(db, q).map((r) => [r.queue_id, r]));

  // Solo: 3d (V), 10d (D), 20d (V) entram; a de 40d fica fora até do recorte de 30.
  assert.deepEqual(
    { j7: porFila[420].j7, v7: porFila[420].v7, j15: porFila[420].j15, v15: porFila[420].v15, j30: porFila[420].j30, v30: porFila[420].v30 },
    { j7: 1, v7: 1, j15: 2, v15: 1, j30: 3, v30: 2 }
  );
  // Flex é linha própria: as filas nunca se somam num número.
  assert.equal(porFila[440].j7, 1);
  assert.equal(porFila[440].j30, 1);
});

test('premium_players: quem não é premium não entra em nenhuma das três consultas', () => {
  const db = bancoPremium();
  const q = sqlPremiumAtividade(AGORA - 7 * DIA, AGORA - 15 * DIA, AGORA - 30 * DIA);
  for (const linhas of [roda(db, q), roda(db, { sql: SQL_PREMIUM_HISTORICO }), roda(db, { sql: SQL_PREMIUM_JOGADORES })]) {
    assert.ok(linhas.length, 'a consulta devolveu algo');
    assert.ok(linhas.every((r) => r.puuid === 'P1'), 'só o jogador premium');
  }
});

test('premium_players: o histórico vê ALÉM dos 30 dias (é o limite do filtro de datas)', () => {
  const db = bancoPremium();
  const porFila = Object.fromEntries(roda(db, { sql: SQL_PREMIUM_HISTORICO }).map((r) => [r.queue_id, r]));
  assert.equal(porFila[420].total, 4, 'inclui a partida de 40 dias, que a atividade recente corta');
  assert.equal(porFila[420].primeira, AGORA - 40 * DIA);
  assert.equal(porFila[420].ultima, AGORA - 3 * DIA);
});
