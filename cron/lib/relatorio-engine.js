// ============================================================================
// MOTOR DE RELATÓRIO DA TRIBO — NLG "IA sem IA" (JS puro, portável).
//
// Usado pelo job agendado (cron/relatorio-discord.js, Node/Actions) E pelo worker
// (botão no app). Não importa nada de Node (`fs`/`process`) nem do Vite (`?raw`):
// quem chama injeta a função de query e (opcionalmente) o CSV do meta já lido.
//
// Contrato de query injetada:
//   queryRows(sql, params) -> Promise<Array<Object>>  (linhas do D1)
//     • Node/cron:  async (sql,p) => (await queryD1(sql,p)).results
//     • Worker:     async (sql,p) => (await env.DB.prepare(sql).bind(...p).all()).results
//
// Correção de schema: game_creation/game_duration/queue_id ficam em `partidas`.
// ============================================================================

export const QUEUES_RANKED = [420, 440];
// Filas ranqueadas. Cada uma é coletada em separado (elos/metas diferentes), mas
// no relatório final ambas convivem no MESMO card do jogador — a prosa usa a fila
// principal (a mais jogada). `id` = queue_id da Riot; `chave` também tempera a semente.
export const FILAS = {
  solo: { id: 420, chave: 'solo', label: 'Solo/Duo', emoji: '🪓', cor: 0x8b5cf6 },
  flex: { id: 440, chave: 'flex', label: 'Flex',     emoji: '🛡️', cor: 0x38bdf8 }
};
// Resolve o seletor de fila do relatório: 'solo' | 'flex' | 'ambas' (default).
export function resolverFilas(fila) {
  const f = String(fila || 'ambas').toLowerCase();
  if (f === 'solo') return ['solo'];
  if (f === 'flex') return ['flex'];
  return ['solo', 'flex'];
}
const DIA = 86400000;

// Períodos. `modo`: 'janela' (recorte por tempo, com tendência vs. período anterior),
// 'jogos' (últimas N partidas por jogador) ou 'tudo' (todo o histórico do alvo).
// `emoji`/`titulo` alimentam o cabeçalho; `janela` é a descrição humana da amostra.
export const PERIODOS = {
  semanal: { modo: 'janela', ms: 7 * DIA,  emoji: '📅', titulo: 'Relatório Semanal',          janela: 'últimos 7 dias' },
  mensal:  { modo: 'janela', ms: 30 * DIA, emoji: '🗓️', titulo: 'Relatório Mensal',           janela: 'últimos 30 dias' },
  '50':    { modo: 'jogos',  n: 50,        emoji: '🎯', titulo: 'Relatório — 50 jogos',       janela: 'últimos 50 jogos' },
  todos:   { modo: 'tudo',                 emoji: '📚', titulo: 'Relatório — Todos os Jogos',  janela: 'todo o histórico' }
};

// Nomes antigos ainda aceitos (workflow/env/atalhos antigos) → mapeiam pros novos.
const ALIAS_PERIODO = { dia: 'semanal', semana: 'mensal', mes: 'mensal', geral: 'todos' };
export function normalizarPeriodo(p) {
  const k = String(p || '').toLowerCase().trim();
  return PERIODOS[k] ? k : (ALIAS_PERIODO[k] || 'semanal');
}

// Benchmarks por rota (mira). Abaixo do 1º = "a melhorar"; acima do 2º = "forte".
// csMin null = métrica irrelevante para a rota (ex.: suporte).
const BENCH = {
  TOP:     { csMin: [6, 8],     visMin: [0.4, 0.7], kp: [0.40, 0.55], kda: 2.0 },
  JUNGLE:  { csMin: [4.5, 6.5], visMin: [0.7, 1.1], kp: [0.55, 0.70], kda: 2.5 },
  MIDDLE:  { csMin: [6, 8],     visMin: [0.5, 0.8], kp: [0.50, 0.65], kda: 2.5 },
  BOTTOM:  { csMin: [7, 9],     visMin: [0.4, 0.7], kp: [0.50, 0.65], kda: 2.5 },
  UTILITY: { csMin: null,       visMin: [1.2, 2.0], kp: [0.55, 0.72], kda: 2.5 }
};

// team_position (Riot) -> rótulo humano e -> role do meta-tiers.csv.
const ROLE_LABEL = { TOP: 'Topo', JUNGLE: 'Selva', MIDDLE: 'Meio', BOTTOM: 'Atirador', UTILITY: 'Suporte' };
const ROLE_META  = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };

// ---------------------------------------------------------------------------
// SQL (placeholders `?` posicionais; params em array — igual nos dois ambientes)
// ---------------------------------------------------------------------------
// Fonte de partidas (CTE `sel`) compartilhada por todas as agregações. `modo`:
//   'janela' -> recorte [desde, ate)     'jogos' -> ranqueia p/ pegar as N últimas
//   'tudo'   -> sem recorte (todo o histórico do alvo)
function cteSel({ modo, desde, ate, puuids, queues = QUEUES_RANKED }) {
  const cond = [`p.queue_id IN (${queues.join(',')})`, 'p.game_creation > 0'];
  const params = [];
  if (modo === 'janela') { cond.push('p.game_creation >= ? AND p.game_creation < ?'); params.push(desde, ate); }
  if (puuids && puuids.length) { cond.push(`e.puuid IN (${puuids.map(() => '?').join(',')})`); params.push(...puuids); }
  const rn = modo === 'jogos' ? ', ROW_NUMBER() OVER (PARTITION BY e.puuid ORDER BY p.game_creation DESC) AS rn' : '';
  const sql = `WITH sel AS (
    SELECT e.puuid, e.win, e.kills, e.deaths, e.assists, e.cs, e.vision_score,
           e.kill_participation, e.gold_per_min, e.damage_champions,
           e.team_position, e.champion_name, p.game_duration AS gd, p.game_creation AS gc${rn}
    FROM estatisticas_jogador_partida e
    JOIN partidas p ON p.match_id = e.match_id
    WHERE ${cond.join(' AND ')}
  )`;
  return { sql, params };
}

// n (limite de últimas partidas) só existe no modo 'jogos'.
function qAgg(cte, { n = null, somentePremium = false } = {}) {
  const extra = [];
  const params = [...cte.params];
  if (n) { extra.push('s.rn <= ?'); params.push(n); }
  if (somentePremium) extra.push('j.has_premium = 1');
  return {
    sql: `${cte.sql}
      SELECT s.puuid, j.game_name, j.tag_line, j.tier, j.rank,
        COUNT(*) jogos, SUM(s.win) vitorias, SUM(s.kills) k, SUM(s.deaths) d, SUM(s.assists) a,
        AVG(s.cs * 60.0 / NULLIF(s.gd,0)) cs_min,
        AVG(s.vision_score * 60.0 / NULLIF(s.gd,0)) vis_min,
        AVG(s.kill_participation) kp, AVG(s.gold_per_min) gpm, AVG(s.damage_champions) dmg
      FROM sel s JOIN jogadores j ON j.puuid = s.puuid
      ${extra.length ? 'WHERE ' + extra.join(' AND ') : ''}
      GROUP BY s.puuid`,
    params
  };
}

function qRotas(cte, { n = null } = {}) {
  const params = [...cte.params];
  const w = n ? (params.push(n), ' WHERE s.rn <= ?') : '';
  return { sql: `${cte.sql}
    SELECT s.puuid, s.team_position, COUNT(*) n, SUM(s.win) v
    FROM sel s${w} GROUP BY s.puuid, s.team_position`, params };
}

function qChamps(cte, { n = null } = {}) {
  const params = [...cte.params];
  const w = n ? (params.push(n), ' WHERE s.rn <= ?') : '';
  return { sql: `${cte.sql}
    SELECT s.puuid, s.champion_name, s.team_position, COUNT(*) n, SUM(s.win) v
    FROM sel s${w} GROUP BY s.puuid, s.champion_name, s.team_position`, params };
}

// Resumo da amostra de UMA fila: quantas partidas foram avaliadas e a data da
// primeira/última (min/max game_creation). Respeita o mesmo filtro (premium + n)
// das análises, pro cabeçalho bater exatamente com o que os cards mostram.
function qResumo(cte, { n = null, somentePremium = false } = {}) {
  const extra = [];
  const params = [...cte.params];
  if (n) { extra.push('s.rn <= ?'); params.push(n); }
  if (somentePremium) extra.push('j.has_premium = 1');
  return {
    sql: `${cte.sql}
      SELECT COUNT(*) partidas, MIN(s.gc) primeira, MAX(s.gc) ultima
      FROM sel s JOIN jogadores j ON j.puuid = s.puuid
      ${extra.length ? 'WHERE ' + extra.join(' AND ') : ''}`,
    params
  };
}

export function sqlMarcos10(desde, ate, puuids, queues = QUEUES_RANKED) {
  const inC = puuids && puuids.length
    ? { frag: ` AND m.puuid IN (${puuids.map(() => '?').join(',')})`, params: [...puuids] }
    : { frag: '', params: [] };
  return {
    sql: `
      SELECT m.puuid, AVG(m.total_gold) ouro10, AVG(m.xp) xp10, COUNT(*) n
      FROM estatisticas_jogador_marcos m
      JOIN partidas p ON p.match_id = m.match_id
      WHERE m.minuto = 10 AND p.game_creation >= ? AND p.game_creation < ? AND p.game_creation > 0
        AND p.queue_id IN (${queues.join(',')})${inC.frag}
      GROUP BY m.puuid`,
    params: [desde, ate, ...inC.params]
  };
}

// ---------------------------------------------------------------------------
// Meta-tiers.csv -> tabela { 'championKey|ROLE': tier }
// ---------------------------------------------------------------------------
function normChamp(nome) {
  return String(nome || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
// championName da Riot vs Data Dragon (casos que divergem).
const ALIAS_CHAMP = { monkeyking: 'wukong', fiddlesticks: 'fiddlesticks' };
function champKey(nome) {
  const n = normChamp(nome);
  return ALIAS_CHAMP[n] || n;
}

export function parseMetaTiers(csvText) {
  const table = {};
  if (!csvText) return { table, patch: '?' };
  const linhas = String(csvText).replace(/\r/g, '').split('\n');
  let patch = '?';
  for (const raw of linhas) {
    const linha = raw.trim();
    if (!linha) continue;
    if (linha.startsWith('#')) {
      const m = linha.match(/patch:\s*([^|]+)/i);
      if (m) patch = m[1].trim();
      continue;
    }
    if (linha.toLowerCase().startsWith('champion,')) continue;
    const [champ, role, tier] = linha.split(',').map(s => s.trim());
    if (!champ || !role || !tier) continue;
    table[`${champKey(champ)}|${role.toUpperCase()}`] = { nome: champ, tier: tier.toUpperCase() };
  }
  return { table, patch };
}

// ---------------------------------------------------------------------------
// Utilidades numéricas / classificação
// ---------------------------------------------------------------------------
const round = (n, c = 0) => { const f = 10 ** c; return Math.round((Number(n) || 0) * f) / f; };
const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

function classificar(valor, faixa) {
  if (!faixa) return 'na';
  if (valor < faixa[0]) return 'fraco';
  if (valor > faixa[1]) return 'forte';
  return 'mediano';
}

// RNG determinístico com semente (mulberry32 sobre hash da string).
function seedRng(str) {
  let h = 1779033703 ^ String(str).length;
  for (let i = 0; i < String(str).length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// Análise de um jogador (objeto pronto pra virar prosa)
// ---------------------------------------------------------------------------
function analisarJogador(agg, rotas, champs, marcos, prev, prevMarcos, metaTable) {
  const jogos = Number(agg.jogos) || 0;
  const kda = (Number(agg.k) + Number(agg.a)) / Math.max(1, Number(agg.d));
  const wr = pct(Number(agg.vitorias), jogos);

  // Rota principal = mais jogada.
  const rotasOrd = [...rotas].filter(r => r.team_position).sort((x, y) => y.n - x.n);
  const rotaPrinc = rotasOrd[0]?.team_position || 'MIDDLE';
  const bench = BENCH[rotaPrinc] || BENCH.MIDDLE;

  const met = {
    csMin: round(agg.cs_min, 1),
    visMin: round(agg.vis_min, 2),
    kp: Number(agg.kp) || 0,
    kda: round(kda, 2),
    gpm: round(agg.gpm),
    dmg: round(agg.dmg)
  };
  const classe = {
    csMin: classificar(met.csMin, bench.csMin),
    visMin: classificar(met.visMin, bench.visMin),
    kp: classificar(met.kp, bench.kp),
    kda: met.kda >= bench.kda ? 'forte' : (met.kda >= bench.kda * 0.75 ? 'mediano' : 'fraco')
  };

  // Tendência vs período anterior.
  const tend = {};
  if (prev && Number(prev.jogos) > 0) {
    const prevWr = pct(Number(prev.vitorias), Number(prev.jogos));
    const prevKda = (Number(prev.k) + Number(prev.a)) / Math.max(1, Number(prev.d));
    tend.wr = { antes: prevWr, agora: wr, delta: wr - prevWr };
    tend.kda = { antes: round(prevKda, 2), agora: met.kda, delta: round(met.kda - prevKda, 2) };
    tend.csMin = { antes: round(prev.cs_min, 1), agora: met.csMin, delta: round(met.csMin - Number(prev.cs_min || 0), 1) };
  }
  if (marcos && prevMarcos && Number(marcos.n) >= 3 && Number(prevMarcos.n) >= 3) {
    tend.ouro10 = { antes: round(prevMarcos.ouro10), agora: round(marcos.ouro10), delta: round(marcos.ouro10 - prevMarcos.ouro10) };
  }

  // Campeões. `champs` vem por (nome, rota); agrego por nome p/ os tops gerais e
  // mantenho por rota p/ o "melhor champ de cada lane".
  const champsOrd = [...champs].sort((a, b) => b.n - a.n);
  const porNome = {};
  for (const c of champs) {
    (porNome[c.champion_name] ||= { nome: c.champion_name, n: 0, v: 0 });
    porNome[c.champion_name].n += Number(c.n);
    porNome[c.champion_name].v += Number(c.v);
  }
  const champsNome = Object.values(porNome).map(c => ({ ...c, wr: pct(c.v, c.n) }));

  // Top 5 mais jogados e Top 5 melhor WR (WR exige amostra mínima p/ não premiar 1-0).
  const topPlayed = [...champsNome].sort((a, b) => b.n - a.n).slice(0, 5);
  const minWr = Math.max(2, Math.round(jogos * 0.05));
  const topWr = [...champsNome].filter(c => c.n >= minWr)
    .sort((a, b) => b.wr - a.wr || b.n - a.n).slice(0, 5);

  // WR por rota + melhor champ de cada rota (melhor WR com amostra, senão o mais jogado).
  const champsPorRota = {};
  for (const c of champs) {
    if (!c.team_position) continue;
    (champsPorRota[c.team_position] ||= []).push({ nome: c.champion_name, n: Number(c.n), v: Number(c.v) });
  }
  const lanes = rotasOrd.map(r => {
    const lista = (champsPorRota[r.team_position] || []).sort((a, b) => b.n - a.n);
    // Mínimo escala com o volume da rota (evita "melhor: Talon 100%" com 2 jogos em 157).
    const minLane = Math.max(3, Math.round(Number(r.n) * 0.1));
    const comAmostra = lista.filter(c => c.n >= minLane).sort((a, b) => (b.v / b.n) - (a.v / a.n) || b.n - a.n);
    const melhor = comAmostra[0] || lista[0];
    return {
      rota: r.team_position, label: ROLE_LABEL[r.team_position] || r.team_position,
      n: Number(r.n), wr: pct(r.v, r.n),
      melhorChamp: melhor ? { nome: melhor.nome, n: melhor.n, wr: pct(melhor.v, melhor.n) } : null
    };
  });

  // "main" = mais jogado DENTRO da rota principal (evita "no Atirador, main Renekton").
  const champsRota = champsOrd.filter(c => c.team_position === rotaPrinc);
  const mainChamp = (champsRota[0] || champsOrd[0])?.champion_name || null;
  const bestChamps = champsNome
    .filter(c => c.n >= Math.max(3, Math.round(jogos * 0.1)))
    .sort((a, b) => b.wr - a.wr);

  // Off-role que derruba a WR: 2ª rota mais jogada com amostra e WR pior que a principal.
  const wrPrinc = pct(rotasOrd[0]?.v || 0, rotasOrd[0]?.n || 1);
  let offRole = null;
  for (const r of rotasOrd.slice(1)) {
    if (r.n >= 5) {
      const w = pct(r.v, r.n);
      if (w < wrPrinc - 8) { offRole = { rota: r.team_position, n: r.n, wr: w }; break; }
    }
  }

  // Sugestão do meta: campeão S/A na rota principal que ele ainda não spamma.
  let sugestaoMeta = null;
  if (metaTable) {
    const roleMeta = ROLE_META[rotaPrinc];
    const jogados = new Set(champsOrd.map(c => champKey(c.champion_name)));
    const candidatos = Object.entries(metaTable)
      .filter(([chave, v]) => chave.endsWith(`|${roleMeta}`) && (v.tier === 'S' || v.tier === 'A'))
      .filter(([chave]) => !jogados.has(chave.split('|')[0]))
      .map(([, v]) => v);
    if (candidatos.length) {
      // pseudo-aleatório estável entre os candidatos, priorizando S.
      const s = candidatos.filter(c => c.tier === 'S');
      const pool = s.length ? s : candidatos;
      sugestaoMeta = pool[Math.floor(seedRng(agg.puuid + '|meta')() * pool.length)];
    }
  }

  return {
    puuid: agg.puuid,
    nome: `${agg.game_name}#${agg.tag_line}`,
    gameName: agg.game_name,
    jogos, wr, met, classe, rotaPrinc, rotaLabel: ROLE_LABEL[rotaPrinc] || rotaPrinc,
    tend, mainChamp, bestChamps, offRole, sugestaoMeta,
    topPlayed, topWr, lanes
  };
}

// ---------------------------------------------------------------------------
// Geração da prosa (banco de frases + semente puuid+data)
// ---------------------------------------------------------------------------
const NOME_METRICA = {
  csMin: 'farm (CS/min)', visMin: 'visão de mapa', kp: 'participação em abates', kda: 'KDA'
};

function fraseAbertura(rng, a, periodoJanela) {
  if (a.jogos >= 20) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela} — presença de sobra.`,
    `**${a.jogos} jogos** no período: você não deu descanso pra fila.`,
    `Com **${a.jogos} partidas**, você foi um dos pilares de atividade da tribo.`,
    `**${a.jogos} partidas** no retrovisor — maratonista de ranqueada, hein?`,
    `Grind de respeito: **${a.jogos} jogos** nos ${periodoJanela}.`,
    `A fila viu você **${a.jogos} vezes** no período — dedicação de sobra.`
  ]);
  if (a.jogos >= 5) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela}.`,
    `**${a.jogos} jogos** no período — um ritmo saudável.`,
    `Você somou **${a.jogos} partidas** nos ${periodoJanela}, presença constante.`,
    `**${a.jogos} jogos** na conta: nem de menos, nem exagero.`
  ]);
  return pick(rng, [
    `Poucas partidas dessa vez (**${a.jogos}**), então leve os números com um grão de sal.`,
    `Só **${a.jogos} jogo(s)** — amostra pequena, mas dá pra sentir a direção.`,
    `Aparição relâmpago: **${a.jogos} jogo(s)** no período.`,
    `Com apenas **${a.jogos} partida(s)**, é mais um retrato do que um filme.`
  ]);
}

// Tempero por fila: Solo/Duo e Flex têm naturezas diferentes — reforça a
// personalização (o mesmo jogador ouve algo distinto em cada relatório).
function fraseFilaFlavor(rng, a, filaInfo) {
  if (!filaInfo) return '';
  if (filaInfo.chave === 'flex') return ' ' + pick(rng, [
    'No Flex o que decide é o entrosamento — jogar afinado com a tribo pesa mais que o elo individual.',
    'Flex é território de premade: composição e comunicação ditam o ritmo do jogo.',
    'No Flex dá pra ousar em comps coordenadas que a Solo jamais perdoaria.',
    'Aqui é jogo de equipe de verdade — o Flex premia quem soma com o time.'
  ]);
  return ' ' + pick(rng, [
    'Na Solo/Duo é você contra o mundo — cada erro é seu, cada carry também.',
    'Solo/Duo não perdoa: aqui o elo mede o quanto você segura o time sozinho.',
    'Na fila solo o mérito é individual — subir aqui é o teste mais puro de skill.',
    'Solo/Duo é a prova de fogo: sem premade pra cobrir, o que sobra é você.'
  ]);
}

function frasesFortes(rng, a) {
  const out = [];
  if (a.classe.kp === 'forte') out.push(pick(rng, [
    `sua **participação em abates (${Math.round(a.met.kp * 100)}%)** é de quem aparece nas brigas`,
    `você vive as jogadas do time — **${Math.round(a.met.kp * 100)}% de KP**`,
    `**${Math.round(a.met.kp * 100)}% de KP**: onde a luta acontece, você está lá`
  ]));
  if (a.classe.csMin === 'forte') out.push(pick(rng, [
    `o **farm está afiado (${a.met.csMin} CS/min)**, acima do padrão da rota`,
    `você não perde onda: **${a.met.csMin} CS/min**`,
    `**${a.met.csMin} CS/min** — a última hitbox é sempre sua`
  ]));
  if (a.classe.visMin === 'forte') out.push(pick(rng, [
    `a **visão de mapa (${a.met.visMin}/min)** está exemplar`,
    `você ilumina o mapa como poucos (**${a.met.visMin} de visão/min**)`,
    `**${a.met.visMin} de visão/min**: o mapa não tem segredo pro seu time`
  ]));
  if (a.classe.kda === 'forte') out.push(pick(rng, [
    `o **KDA ${a.met.kda}** mostra que você troca bem e morre pouco`,
    `**KDA ${a.met.kda}** — consistência de quem sobrevive pra carregar`,
    `**KDA ${a.met.kda}**: você escolhe as brigas e sai vivo delas`
  ]));
  return out;
}

function frasesFracas(rng, a) {
  const out = [];
  if (a.classe.csMin === 'fraco') out.push(pick(rng, [
    `o **farm (${a.met.csMin} CS/min)** está abaixo do que a rota pede — é ouro que vira item, e item que vira vitória`,
    `dá pra apertar o **CS/min (hoje ${a.met.csMin})**: cada onda perdida é um item a menos no meio do jogo`,
    `**${a.met.csMin} CS/min** deixa ouro na mesa — 10 minions a mais por jogo já é outra história`
  ]));
  if (a.classe.kda === 'fraco') out.push(pick(rng, [
    `o **KDA ${a.met.kda}** conta que você está morrendo demais — segurar essas mortes já empurraria a WR pra cima`,
    `**KDA ${a.met.kda}**: menos mortes arriscadas e o resultado muda sozinho`,
    `**KDA ${a.met.kda}** — cada morte evitada é um objetivo a mais pro time; respeite o mapa`
  ]));
  if (a.classe.visMin === 'fraco') out.push(pick(rng, [
    `a **visão (${a.met.visMin}/min)** está baixa — mais sentinelas = menos emboscadas e mais objetivos`,
    `invista em **visão (hoje ${a.met.visMin}/min)**: enxergar o mapa evita mortes bobas`,
    `**${a.met.visMin} de visão/min** é pouco — a wardzinha barata salva mais jogo que parece`
  ]));
  if (a.classe.kp === 'fraco') out.push(pick(rng, [
    `sua **participação (${Math.round(a.met.kp * 100)}%)** está tímida — aparecer mais nas jogadas do time rende`,
    `**KP ${Math.round(a.met.kp * 100)}%**: rotacionar junto do time aumenta seu impacto`,
    `**KP ${Math.round(a.met.kp * 100)}%** — o time briga e você está longe; chegar junto muda o placar`
  ]));
  return out;
}

function fraseEvolucao(rng, a) {
  const t = a.tend;
  const partes = [];
  if (t.wr && Math.abs(t.wr.delta) >= 3) {
    partes.push(t.wr.delta > 0
      ? pick(rng, [`sua **WR subiu de ${t.wr.antes}% para ${t.wr.agora}%**`, `a vitória **cresceu (${t.wr.antes}% → ${t.wr.agora}%)**`, `você **destravou a WR (${t.wr.antes}% → ${t.wr.agora}%)**`])
      : pick(rng, [`a **WR caiu de ${t.wr.antes}% para ${t.wr.agora}%**`, `a vitória **recuou (${t.wr.antes}% → ${t.wr.agora}%)**`, `a **WR esfriou (${t.wr.antes}% → ${t.wr.agora}%)**`]));
  }
  if (t.kda && Math.abs(t.kda.delta) >= 0.3) {
    partes.push(t.kda.delta > 0
      ? pick(rng, [`o **KDA melhorou (${t.kda.antes} → ${t.kda.agora})**`, `você está morrendo menos — **KDA ${t.kda.antes} → ${t.kda.agora}**`])
      : pick(rng, [`o **KDA piorou (${t.kda.antes} → ${t.kda.agora})**`, `o **KDA recuou (${t.kda.antes} → ${t.kda.agora})**`]));
  }
  if (t.ouro10 && Math.abs(t.ouro10.delta) >= 150) {
    partes.push(t.ouro10.delta > 0
      ? `e o **ouro aos 10min** está mais alto (+${t.ouro10.delta}), sinal de early melhor`
      : `e o **ouro aos 10min** caiu (${t.ouro10.delta}), o começo de jogo travou`);
  }
  if (!partes.length) return null;
  const abre = pick(rng, ['Comparando com o período anterior, ', 'Na evolução, ', 'Olhando a tendência, ', 'De lá pra cá, ', 'Na comparação com antes, ']);
  return abre + partes.join('; ') + '.';
}

function fraseRecomendacao(rng, a) {
  const partes = [];
  const bom = a.bestChamps[0];
  if (bom && bom.n >= 3) {
    partes.push(pick(rng, [
      `no **${bom.nome} você segura ${bom.wr}%** em ${bom.n} jogos — é sua zona de conforto`,
      `seu melhor pick é **${bom.nome} (${bom.wr}% em ${bom.n})**`,
      `quando bate o desespero, **${bom.nome}** (${bom.wr}% em ${bom.n}) é o pick que raramente falha`
    ]));
  }
  if (a.offRole) {
    partes.push(pick(rng, [
      `de **${ROLE_LABEL[a.offRole.rota] || a.offRole.rota} a coisa cai pra ${a.offRole.wr}%** (${a.offRole.n} jogos) — se a meta é subir, concentre as filas na sua rota principal`,
      `evite forçar **${ROLE_LABEL[a.offRole.rota] || a.offRole.rota}** (só ${a.offRole.wr}% em ${a.offRole.n}); seu rendimento é melhor no ${a.rotaLabel}`,
      `o **${ROLE_LABEL[a.offRole.rota] || a.offRole.rota}** te puxa pra baixo (${a.offRole.wr}% em ${a.offRole.n}) — deixa essa rota pro modo normal`
    ]));
  }
  if (a.sugestaoMeta) {
    partes.push(pick(rng, [
      `no patch atual, **${a.sugestaoMeta.nome} (tier ${a.sugestaoMeta.tier})** está forte no ${a.rotaLabel} e combina com seu perfil — vale testar`,
      `de olho no meta: **${a.sugestaoMeta.nome}** (${a.sugestaoMeta.tier}) é uma boa aposta no ${a.rotaLabel} agora`,
      `se quiser um pick novo, **${a.sugestaoMeta.nome}** (${a.sugestaoMeta.tier}) está brilhando no ${a.rotaLabel} neste patch`
    ]));
  }
  if (!partes.length) return null;
  return partes.join('. ').replace(/\.\./g, '.') + '.';
}

// Assinatura motivacional de fechamento (varia por semente; dá personalidade).
function fraseFechamento(rng, a) {
  if (a.wr >= 55) return pick(rng, [
    'Segue nesse embalo que o próximo elo é questão de tempo. 🔥',
    'Tá voando — mantém a cabeça fria e continua subindo. 🚀',
    'Fase quente dessas é pra aproveitar: bora de PDL. 📈'
  ]);
  if (a.wr >= 48) return pick(rng, [
    'Equilíbrio é base — um ajuste fino e a balança vira pro seu lado. ⚖️',
    'Você está no fio: pequenos detalhes decidem a próxima subida. 🎯',
    'Constância aqui, e o próximo degrau vem naturalmente. 🧗'
  ]);
  return pick(rng, [
    'Período difícil acontece — foco no que dá pra controlar e a maré volta. 💪',
    'Cabeça erguida: todo mundo tem sequência ruim, o importante é ajustar. 🛠️',
    'Respira, revisa um ponto de cada vez e volta com tudo na próxima. 🌊'
  ]);
}

export function gerarProsa(a, periodoJanela, filaInfo = null) {
  const filaChave = filaInfo?.chave || 'geral';
  const rng = seedRng(a.puuid + '|' + new Date().toISOString().slice(0, 10) + '|' + periodoJanela + '|' + filaChave);
  const paras = [];

  // 1) Abertura: atividade + WR/rota/main + tempero da fila.
  const linhaWr = pick(rng, [
    `WR de **${a.wr}%** no **${a.rotaLabel}**, com **${a.mainChamp || '—'}** como principal.`,
    `Fechou **${a.wr}% de vitórias** puxando o **${a.rotaLabel}** (**${a.mainChamp || '—'}** na linha de frente).`,
    `**${a.wr}%** de aproveitamento, a maior parte no **${a.rotaLabel}** com **${a.mainChamp || '—'}**.`
  ]);
  paras.push(fraseAbertura(rng, a, periodoJanela) + ' ' + linhaWr + fraseFilaFlavor(rng, a, filaInfo));

  // 2) Fortes.
  const fortes = frasesFortes(rng, a);
  if (fortes.length) {
    const abre = pick(rng, ['Do lado bom: ', 'Seus trunfos: ', 'O que está funcionando: ', 'No que você brilha: ']);
    paras.push('✅ ' + abre + fortes.slice(0, 2).join(', e ') + '.');
  }

  // 3) A melhorar.
  const fracas = frasesFracas(rng, a);
  if (fracas.length) {
    const abre = pick(rng, ['Onde dá pra crescer: ', 'Pontos de atenção: ', 'Pra evoluir: ', 'A lição de casa: ']);
    paras.push('⚠️ ' + abre + fracas.slice(0, 2).join(', e ') + '.');
  } else {
    paras.push('✅ ' + pick(rng, [
      'Sem pontos fracos gritantes nas métricas da rota — bom equilíbrio.',
      'Nenhuma métrica destoando pra baixo: base sólida e consistente.',
      'Fundamentos redondos — nada gritando por conserto por aqui.'
    ]));
  }

  // 4) Evolução.
  const evo = fraseEvolucao(rng, a);
  if (evo) paras.push('📈 ' + evo);

  // 5) Recomendação.
  const rec = fraseRecomendacao(rng, a);
  if (rec) paras.push('🎯 ' + rec);

  // 6) Fechamento motivacional.
  paras.push('— ' + fraseFechamento(rng, a));

  return paras.join('\n\n');
}

// ---------------------------------------------------------------------------
// Embeds do Discord — UM card por jogador (com as duas filas), paginado em
// mensagens de até 10 embeds; cabeçalho repetido no topo de CADA mensagem.
// ---------------------------------------------------------------------------
function corPorWr(wr) {
  if (wr >= 55) return 0x22c55e;   // verde
  if (wr >= 48) return 0x8b5cf6;   // roxo
  return 0xef4444;                 // vermelho
}

function mencao(a, userMap) {
  if (!userMap) return '';
  const id = userMap[a.puuid] || userMap[a.gameName] || userMap[a.nome];
  return id ? `<@${id}>` : '';
}

// game_creation (epoch ms) -> data curta pt-BR (fuso de Brasília).
function fmtData(ms) {
  if (ms == null) return '—';
  return new Date(Number(ms)).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// Bloco compacto de UMA fila dentro do card do jogador (Solo/Duo e Flex convivem
// no mesmo card): um "field" por fila jogada, com o essencial em poucas linhas.
function campoFila(filaInfo, a) {
  const linhas = [
    `**${a.jogos} jogos · ${a.wr}% WR** · KDA ${a.met.kda}`,
    `🌾 ${a.met.csMin} CS/min · 👁️ ${a.met.visMin} visão/min · 🤝 ${Math.round(a.met.kp * 100)}% KP`
  ];
  const topWr = a.topWr.slice(0, 3);
  if (topWr.length) linhas.push('🏆 ' + topWr.map(c => `${c.nome} ${c.wr}% (${c.n})`).join(' · '));
  const topPlayed = a.topPlayed.slice(0, 3);
  if (topPlayed.length) linhas.push('🔁 ' + topPlayed.map(c => `${c.nome} ${c.n}j`).join(' · '));
  const lanes = a.lanes.slice(0, 3);
  if (lanes.length) linhas.push('🧭 ' + lanes.map(l => `${l.label} ${l.wr}% (${l.n})`).join(' · '));
  return { name: `${filaInfo.emoji} Ranked ${filaInfo.label}`, value: linhas.join('\n'), inline: false };
}

// Card do jogador: prosa da fila principal (a mais jogada) + um bloco por fila.
function montarCardJogador(jog, P, userMap) {
  const prim = jog[jog.primaria];
  const m = mencao(jog, userMap);
  const fields = [];
  if (jog.solo) fields.push(campoFila(FILAS.solo, jog.solo));
  if (jog.flex) fields.push(campoFila(FILAS.flex, jog.flex));
  return {
    title: jog.nome,
    description: (m ? m + '\n\n' : '') + gerarProsa(prim, P.janela, FILAS[jog.primaria]),
    color: corPorWr(prim.wr),
    fields
  };
}

// Cabeçalho (topo de CADA mensagem): período, filas cobertas, quantas partidas
// foram avaliadas (por fila) e a data da primeira/última partida da amostra.
function montarHeader(P, resumo, ativos, chaves) {
  const filaLabel = chaves.map(k => FILAS[k].label).join(' + ');
  const partidas = chaves
    .map(k => `${FILAS[k].emoji} ${FILAS[k].label}: **${resumo.porFila[k]?.partidas || 0}**`)
    .join(' · ');
  const desc = [
    `**Ranked ${filaLabel}** · ${P.janela}`,
    `🎮 Partidas avaliadas — ${partidas}`,
    `📆 Primeira: **${fmtData(resumo.primeira)}** · Última: **${fmtData(resumo.ultima)}**`,
    `👥 ${ativos} jogador(es) avaliado(s)`
  ].join('\n');
  return {
    title: `${P.emoji} ${P.titulo}`,
    description: desc,
    color: 0x8b5cf6,
    footer: { text: `Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` },
    timestamp: new Date().toISOString()
  };
}

export function montarMensagens(jogadores, periodoKey, userMap, { resumo, ativos, chaves }) {
  const P = PERIODOS[periodoKey] || PERIODOS.semanal;
  const header = montarHeader(P, resumo, ativos, chaves);
  const cards = jogadores.map(j => montarCardJogador(j, P, userMap));

  // Paginação: o Discord limita a SOMA de caracteres de TODOS os embeds de uma
  // mensagem a 6000 e no máx. 10 embeds. O cabeçalho vai no topo de CADA mensagem
  // (por isso já entra no orçamento de tamanho e conta como 1 embed em cada página).
  const headerSz = embedSize(header);
  const LIMITE_CHARS = 5500;   // folga sob os 6000
  const empacotar = (lista) => ({ username: 'Cronista da Tribo', embeds: [header, ...lista], allowed_mentions: { parse: ['users'] } });

  const mensagens = [];
  let atual = [];
  let soma = headerSz;
  for (const c of cards) {
    const sz = embedSize(c);
    if (atual.length && (soma + sz > LIMITE_CHARS || atual.length + 1 >= 10)) {
      mensagens.push(empacotar(atual));
      atual = []; soma = headerSz;
    }
    atual.push(c);
    soma += sz;
  }
  if (atual.length) mensagens.push(empacotar(atual));
  return mensagens;
}

// Soma de caracteres que o Discord conta no limite de 6000 por mensagem.
function embedSize(e) {
  let n = (e.title || '').length + (e.description || '').length + (e.footer?.text || '').length;
  for (const f of e.fields || []) n += (f.name || '').length + (f.value || '').length;
  return n;
}

// ---------------------------------------------------------------------------
// Envio ao Discord (sequencial, com tratamento de 429)
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function postarDiscord(webhookUrl, mensagens) {
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK ausente.');
  for (const msg of mensagens) {
    let tentativas = 0;
    while (true) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
      if (res.status === 429 && tentativas < 3) {
        let retry = 1;
        try { retry = (await res.clone().json())?.retry_after || 1; } catch { /* usa 1s */ }
        await sleep((Number(retry) + 0.3) * 1000);
        tentativas++;
        continue;
      }
      if (!res.ok) throw new Error(`Discord respondeu ${res.status}: ${await res.text()}`);
      break;
    }
    await sleep(600); // respiro entre mensagens paginadas
  }
}

// ---------------------------------------------------------------------------
// Coleta + análise para UMA fila (queue_id). Devolve as análises já ordenadas e
// o resumo da amostra (nº de partidas + data da primeira/última).
// ---------------------------------------------------------------------------
async function coletarAnalises({ queryRows, P, puuids, soPrem, meta, agora, queues }) {
  const ate = agora;
  const desde = P.modo === 'janela' ? agora - P.ms : null;
  const nLimite = P.modo === 'jogos' ? P.n : null;

  const cte = cteSel({ modo: P.modo, desde, ate, puuids, queues });
  const qA = qAgg(cte, { n: nLimite, somentePremium: soPrem });
  const qR = qRotas(cte, { n: nLimite });
  const qC = qChamps(cte, { n: nLimite });
  const qRes = qResumo(cte, { n: nLimite, somentePremium: soPrem });

  const promessas = [
    queryRows(qA.sql, qA.params),
    queryRows(qR.sql, qR.params),
    queryRows(qC.sql, qC.params),
    queryRows(qRes.sql, qRes.params).catch(() => [])
  ];

  // Tendência (período anterior) + marcos @10 só fazem sentido no modo 'janela'.
  const temJanela = P.modo === 'janela';
  if (temJanela) {
    const antesDesde = desde - P.ms;
    const ctePrev = cteSel({ modo: 'janela', desde: antesDesde, ate: desde, puuids, queues });
    const qAP = qAgg(ctePrev, { somentePremium: soPrem });
    const qM = sqlMarcos10(desde, ate, puuids, queues);
    const qMP = sqlMarcos10(antesDesde, desde, puuids, queues);
    promessas.push(
      queryRows(qAP.sql, qAP.params).catch(() => []),
      queryRows(qM.sql, qM.params).catch(() => []),
      queryRows(qMP.sql, qMP.params).catch(() => [])
    );
  }

  const [aggs, rotas, champs, resumoRows, aggsPrev = [], marcos = [], marcosPrev = []] = await Promise.all(promessas);

  const byPuuid = (arr) => arr.reduce((m, r) => ((m[r.puuid] ||= []).push(r), m), {});
  const rotasBy = byPuuid(rotas);
  const champsBy = byPuuid(champs);
  const marcosBy = Object.fromEntries(marcos.map(m => [m.puuid, m]));
  const prevBy = Object.fromEntries(aggsPrev.map(m => [m.puuid, m]));
  const prevMarcosBy = Object.fromEntries(marcosPrev.map(m => [m.puuid, m]));

  const r0 = resumoRows[0] || {};
  const resumo = {
    partidas: Number(r0.partidas) || 0,
    primeira: r0.primeira != null ? Number(r0.primeira) : null,
    ultima: r0.ultima != null ? Number(r0.ultima) : null
  };

  const analises = aggs
    .filter(a => Number(a.jogos) > 0)
    .map(a => analisarJogador(a, rotasBy[a.puuid] || [], champsBy[a.puuid] || [], marcosBy[a.puuid], prevBy[a.puuid], prevMarcosBy[a.puuid], meta))
    .sort((x, y) => y.jogos - x.jogos);

  return { analises, resumo };
}

// ---------------------------------------------------------------------------
// ORQUESTRADOR — gera UM relatório onde cada jogador é um card com AS DUAS filas
// (Solo/Duo e Flex). A fila fica no cabeçalho de cada mensagem, não em mensagens
// separadas. `fila`: 'solo' | 'flex' | 'ambas' (default) restringe as filas cobertas.
//   opts: { queryRows, periodo, fila?, puuids?, metaCsv?, userMap?, agora? }
//   retorna { mensagens, ativos, periodo, fila }
// ---------------------------------------------------------------------------
export async function gerarRelatorio({ queryRows, periodo = 'semanal', fila = 'ambas', puuids = null, somentePremium = null, metaCsv = null, userMap = null, agora = Date.now() }) {
  const periodoKey = normalizarPeriodo(periodo);
  const P = PERIODOS[periodoKey];

  // Regra: sem seleção explícita de puuids ("para todos") o relatório cobre SÓ premium
  // (has_premium = 1) — igual ao sync/backfill. Alvo explícito ignora o filtro.
  const soPrem = somentePremium == null ? !puuids : somentePremium;

  const meta = metaCsv ? parseMetaTiers(metaCsv).table : null;
  const chaves = resolverFilas(fila);

  // Coleta por fila (Solo 420 / Flex 440 têm dados separados) e depois FUNDE por
  // jogador: cada um vira UM card com as duas filas.
  const porFila = {};
  for (const chave of chaves) {
    porFila[chave] = await coletarAnalises({ queryRows, P, puuids, soPrem, meta, agora, queues: [FILAS[chave].id] });
  }

  const map = new Map();
  for (const chave of chaves) {
    for (const a of porFila[chave].analises) {
      if (!map.has(a.puuid)) map.set(a.puuid, { puuid: a.puuid, nome: a.nome, gameName: a.gameName, solo: null, flex: null });
      map.get(a.puuid)[chave] = a;
    }
  }
  const jogadores = [...map.values()]
    .map(j => {
      const soloJ = j.solo?.jogos || 0;
      const flexJ = j.flex?.jogos || 0;
      // Fila principal = a mais jogada (empate/só-solo → solo). É a que dita a prosa.
      return { ...j, totalJogos: soloJ + flexJ, primaria: flexJ > soloJ ? 'flex' : 'solo' };
    })
    .sort((x, y) => y.totalJogos - x.totalJogos);

  // Resumo agregado (contagem por fila + janela global de datas) pro cabeçalho.
  const resumo = { porFila: {}, primeira: null, ultima: null };
  for (const chave of chaves) {
    const r = porFila[chave].resumo;
    resumo.porFila[chave] = r;
    if (r.primeira != null) resumo.primeira = resumo.primeira == null ? r.primeira : Math.min(resumo.primeira, r.primeira);
    if (r.ultima != null) resumo.ultima = resumo.ultima == null ? r.ultima : Math.max(resumo.ultima, r.ultima);
  }

  const ativos = jogadores.length;
  let mensagens;
  if (!jogadores.length) {
    const filaLabel = chaves.map(k => FILAS[k].label).join(' + ');
    mensagens = [{
      username: 'Cronista da Tribo',
      content: `${P.emoji} **${P.titulo} — Ranked ${filaLabel}**: ninguém da tribo jogou ranqueada nos ${P.janela}. 😴`
    }];
  } else {
    mensagens = montarMensagens(jogadores, periodoKey, userMap, { resumo, ativos, chaves });
  }

  return { ativos, periodo: periodoKey, fila, mensagens };
}
