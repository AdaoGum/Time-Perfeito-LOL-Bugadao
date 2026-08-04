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
//
// FORMATO (vale para TODOS os períodos — semanal/mensal/50/todos):
//   1 mensagem de cabeçalho + 1 MENSAGEM POR JOGADOR. Cada mensagem de jogador
//   tem um embed de resumo (cruzando as filas) e UM EMBED POR FILA com prosa
//   própria — Solo/Duo e Flex são analisadas e narradas separadamente.
// ============================================================================

export const QUEUES_RANKED = [420, 440];
// Filas ranqueadas. Cada uma é coletada, analisada e NARRADA em separado (elos e
// metas diferentes), mas ambas convivem na MESMA mensagem do jogador.
// `id` = queue_id da Riot; `chave` também tempera a semente do gerador de frases.
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
const NOME_BOT = 'Cronista da Tribo';

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
// "a Selva" é o único rótulo feminino — sem isto a prosa diz "no Selva".
const ROLE_FEMININO = new Set(['JUNGLE']);
const PREPOSICOES = { em: ['no', 'na'], de: ['do', 'da'], para: ['pro', 'pra'], artigo: ['o', 'a'] };
// pRota('JUNGLE', 'em') -> 'na'   |   pRota('TOP', 'para') -> 'pro'
function pRota(rotaKey, tipo = 'em') {
  const par = PREPOSICOES[tipo] || PREPOSICOES.em;
  return ROLE_FEMININO.has(rotaKey) ? par[1] : par[0];
}

// Elo (league-v4) -> rótulo pt-BR.
const TIER_LABEL = {
  IRON: 'Ferro', BRONZE: 'Bronze', SILVER: 'Prata', GOLD: 'Ouro', PLATINUM: 'Platina',
  EMERALD: 'Esmeralda', DIAMOND: 'Diamante', MASTER: 'Mestre', GRANDMASTER: 'Grão-Mestre',
  CHALLENGER: 'Desafiante'
};
const TIER_SEM_DIVISAO = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
// Artigo por dia (domingo/sábado são masculinos; os outros, "segunda-feira" etc.).
const DIAS_ARTIGO = ['no domingo', 'na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado'];
// faixa_dia = hora/6 → 0: 00-05, 1: 06-11, 2: 12-17, 3: 18-23.
const FAIXAS_DIA = ['de madrugada', 'de manhã', 'à tarde', 'à noite'];

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

// Fuso do relatório dentro do SQLite (gc é epoch ms, UTC): 'unixepoch' + offset.
const TZ_SQL = "'unixepoch', '-3 hours'";

// n (limite de últimas partidas) só existe no modo 'jogos'.
function qAgg(cte, { n = null, somentePremium = false } = {}) {
  const extra = [];
  const params = [...cte.params];
  if (n) { extra.push('s.rn <= ?'); params.push(n); }
  if (somentePremium) extra.push('j.has_premium = 1');
  return {
    sql: `${cte.sql}
      SELECT s.puuid, j.game_name, j.tag_line, j.tier, j.rank, j.lp,
        j.flex_tier, j.flex_rank, j.flex_lp,
        COUNT(*) jogos, SUM(s.win) vitorias, SUM(s.kills) k, SUM(s.deaths) d, SUM(s.assists) a,
        AVG(s.cs * 60.0 / NULLIF(s.gd,0)) cs_min,
        AVG(s.vision_score * 60.0 / NULLIF(s.gd,0)) vis_min,
        AVG(s.kill_participation) kp, AVG(s.gold_per_min) gpm, AVG(s.damage_champions) dmg,
        MIN(s.gc) primeira, MAX(s.gc) ultima,
        SUM(s.gd) tempo_total, AVG(s.gd) dur_media,
        COUNT(DISTINCT date(s.gc/1000, ${TZ_SQL})) dias_ativos,
        COUNT(DISTINCT s.champion_name) pool
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

// Campeões por (jogador × campeão × rota) — com KDA e janela de datas próprias,
// que alimentam o "Top 5 campeões" do card e a prosa sobre o pool.
function qChamps(cte, { n = null } = {}) {
  const params = [...cte.params];
  const w = n ? (params.push(n), ' WHERE s.rn <= ?') : '';
  return { sql: `${cte.sql}
    SELECT s.puuid, s.champion_name, s.team_position, COUNT(*) n, SUM(s.win) v,
           SUM(s.kills) k, SUM(s.deaths) d, SUM(s.assists) a,
           AVG(s.cs * 60.0 / NULLIF(s.gd,0)) cs_min, AVG(s.damage_champions) dmg,
           MIN(s.gc) primeira, MAX(s.gc) ultima
    FROM sel s${w} GROUP BY s.puuid, s.champion_name, s.team_position`, params };
}

// Sequências de V/D (gaps-and-islands): agrupa partidas consecutivas de mesmo
// resultado. Devolve poucas linhas por jogador (uma por sequência), em vez de
// trazer o histórico bruto pro Node. `fim` = data da última partida da sequência
// (a sequência mais recente é a "atual").
function qSequencias(cte, { n = null } = {}) {
  const params = [...cte.params];
  const w = n ? (params.push(n), ' WHERE s.rn <= ?') : '';
  return { sql: `${cte.sql}, ord AS (
      SELECT s.puuid, s.win, s.gc, ROW_NUMBER() OVER (PARTITION BY s.puuid ORDER BY s.gc) i
      FROM sel s${w}
    ), ilhas AS (
      SELECT puuid, win, gc, i - ROW_NUMBER() OVER (PARTITION BY puuid, win ORDER BY gc) ilha FROM ord
    )
    SELECT puuid, win, COUNT(*) tam_seq, MAX(gc) fim FROM ilhas GROUP BY puuid, win, ilha`, params };
}

// Quando o jogador joga: dia da semana × faixa do dia (madrugada/manhã/tarde/noite).
// No máximo 28 linhas por jogador — barato e rende uma linha boa de prosa.
function qHorarios(cte, { n = null } = {}) {
  const params = [...cte.params];
  const w = n ? (params.push(n), ' WHERE s.rn <= ?') : '';
  return { sql: `${cte.sql}
    SELECT s.puuid,
      CAST(strftime('%w', s.gc/1000, ${TZ_SQL}) AS INTEGER) dia_semana,
      CAST(strftime('%H', s.gc/1000, ${TZ_SQL}) AS INTEGER) / 6 faixa_dia,
      COUNT(*) n, SUM(s.win) v
    FROM sel s${w} GROUP BY s.puuid, dia_semana, faixa_dia`, params };
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

// O `championName` da Riot vem sem espaço nem pontuação ("XinZhao", "Kaisa").
// Aqui não temos o Data Dragon (o motor roda no Node e no worker), então a
// exibição é resolvida por um mapa dos casos com pontuação + quebra de camelCase
// pro resto ("MissFortune" -> "Miss Fortune"). Nome desconhecido passa intacto.
const NOME_EXIBICAO = {
  aurelionsol: 'Aurelion Sol', belveth: "Bel'Veth", chogath: "Cho'Gath", drmundo: 'Dr. Mundo',
  jarvaniv: 'Jarvan IV', kaisa: "Kai'Sa", khazix: "Kha'Zix", kogmaw: "Kog'Maw", ksante: "K'Sante",
  leblanc: 'LeBlanc', leesin: 'Lee Sin', masteryi: 'Master Yi', missfortune: 'Miss Fortune',
  monkeyking: 'Wukong', nunuwillump: 'Nunu & Willump', reksai: "Rek'Sai", renata: 'Renata Glasc',
  tahmkench: 'Tahm Kench', twistedfate: 'Twisted Fate', velkoz: "Vel'Koz", xinzhao: 'Xin Zhao'
};
export function nomeCampeao(nome) {
  const bruto = String(nome || '').trim();
  if (!bruto) return '—';
  const conhecido = NOME_EXIBICAO[normChamp(bruto)];
  if (conhecido) return conhecido;
  return bruto.replace(/([a-z])([A-Z])/g, '$1 $2');
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
// Utilidades numéricas / formatação / classificação
// ---------------------------------------------------------------------------
const round = (n, c = 0) => { const f = 10 ** c; return Math.round((Number(n) || 0) * f) / f; };
const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);
const TZ = 'America/Sao_Paulo';

// game_creation (epoch ms) -> data curta pt-BR (fuso de Brasília).
function fmtData(ms) {
  if (ms == null) return '—';
  return new Date(Number(ms)).toLocaleDateString('pt-BR', { timeZone: TZ });
}
// ... e a versão com hora ("01/07 às 21:38") — usada na janela de cada jogador.
function fmtDataHora(ms) {
  if (ms == null) return '—';
  return new Date(Number(ms))
    .toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .replace(', ', ' às ');
}
// Segundos -> "18h 42min" / "34min".
function fmtDuracao(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}
// 18432 -> "18,4k" (dano médio cabe melhor assim no embed).
function fmtMilhar(n) {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : String(Math.round(v));
}
const plural = (n, sing, plur) => `${n} ${Number(n) === 1 ? sing : plur}`;
// KDA sempre com 2 casas nos campos tabulares (3 vira "3.00", alinha a lista).
const fmtKda = (n) => (Number(n) || 0).toFixed(2);
// Capitaliza a 1ª letra de cada frase, pulando marcação markdown (`**Vi** …`).
function capitalizarFrases(txt) {
  return String(txt || '').replace(/(^|[.!?]\s+)([*_`]*)([a-zà-ÿ])/g,
    (_, antes, marca, letra) => antes + marca + letra.toUpperCase());
}
function fmtElo(tier, rank, lp) {
  if (!tier) return null;
  const T = String(tier).toUpperCase();
  const nome = TIER_LABEL[T] || tier;
  const div = TIER_SEM_DIVISAO.has(T) || !rank ? '' : ` ${rank}`;
  return `${nome}${div}${lp == null ? '' : ` (${lp} PDL)`}`;
}
// Corta respeitando os limites do Discord (field 1024 / description 4096).
function truncar(txt, max) {
  const s = String(txt || '');
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

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
// Semente do texto de um jogador: muda por dia, período e fila — o mesmo jogador
// nunca lê o mesmo relatório duas vezes seguidas, mas reexecutar hoje é estável.
const sementeTexto = (puuid, periodoJanela, filaChave) =>
  `${puuid}|${new Date().toISOString().slice(0, 10)}|${periodoJanela}|${filaChave}`;

// ---------------------------------------------------------------------------
// Análise de um jogador (objeto pronto pra virar prosa)
// ---------------------------------------------------------------------------
// Sequências (linhas de qSequencias) -> { maiorV, maiorD, atual }.
function resumirSequencias(rows) {
  if (!rows || !rows.length) return null;
  let maiorV = 0, maiorD = 0, atual = null, fimMax = -Infinity;
  for (const r of rows) {
    const tam = Number(r.tam_seq) || 0;
    const venceu = Number(r.win) === 1;
    if (venceu) maiorV = Math.max(maiorV, tam); else maiorD = Math.max(maiorD, tam);
    const fim = Number(r.fim) || 0;
    if (fim > fimMax) { fimMax = fim; atual = { vitoria: venceu, tam }; }
  }
  return { maiorV, maiorD, atual };
}

// Horários (linhas de qHorarios) -> dia da semana e faixa do dia preferidos.
function resumirHorarios(rows) {
  if (!rows || !rows.length) return null;
  const porDia = {}, porFaixa = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r.n) || 0, v = Number(r.v) || 0;
    const dia = Number(r.dia_semana), faixa = Number(r.faixa_dia);
    total += n;
    if (Number.isInteger(dia)) { (porDia[dia] ||= { n: 0, v: 0 }); porDia[dia].n += n; porDia[dia].v += v; }
    if (Number.isInteger(faixa)) { (porFaixa[faixa] ||= { n: 0, v: 0 }); porFaixa[faixa].n += n; porFaixa[faixa].v += v; }
  }
  const topDe = (mapa, rotulos, artigos = null) => {
    const ent = Object.entries(mapa).sort((a, b) => b[1].n - a[1].n)[0];
    if (!ent) return null;
    const i = Number(ent[0]);
    return {
      label: rotulos[i] || '?',
      comArtigo: artigos ? (artigos[i] || rotulos[i] || '?') : (rotulos[i] || '?'),
      n: ent[1].n,
      wr: pct(ent[1].v, ent[1].n)
    };
  };
  return { total, dia: topDe(porDia, DIAS_SEMANA, DIAS_ARTIGO), faixa: topDe(porFaixa, FAIXAS_DIA) };
}

function analisarJogador(agg, rotas, champs, marcos, prev, prevMarcos, metaTable, seqRows, horaRows, filaChave) {
  const jogos = Number(agg.jogos) || 0;
  const vitorias = Number(agg.vitorias) || 0;
  const kda = (Number(agg.k) + Number(agg.a)) / Math.max(1, Number(agg.d));
  const wr = pct(vitorias, jogos);

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
  // Médias por partida (o KDA acima é a razão; aqui é o placar típico).
  const med = {
    k: round(Number(agg.k) / Math.max(1, jogos), 1),
    d: round(Number(agg.d) / Math.max(1, jogos), 1),
    a: round(Number(agg.a) / Math.max(1, jogos), 1)
  };
  const classe = {
    csMin: classificar(met.csMin, bench.csMin),
    visMin: classificar(met.visMin, bench.visMin),
    kp: classificar(met.kp, bench.kp),
    kda: met.kda >= bench.kda ? 'forte' : (met.kda >= bench.kda * 0.75 ? 'mediano' : 'fraco')
  };

  // Janela real da amostra DESTE jogador nesta fila (não a do relatório inteiro).
  const tempoTotal = Number(agg.tempo_total) || 0;
  const janela = {
    primeira: agg.primeira != null ? Number(agg.primeira) : null,
    ultima: agg.ultima != null ? Number(agg.ultima) : null,
    diasAtivos: Number(agg.dias_ativos) || 0,
    tempoTotal,
    durMedia: Number(agg.dur_media) || 0,
    // Dias corridos entre a primeira e a última partida (≠ dias ativos).
    diasCorridos: agg.primeira != null && agg.ultima != null
      ? Math.max(1, Math.round((Number(agg.ultima) - Number(agg.primeira)) / DIA) + 1) : null
  };
  janela.jogosPorDia = janela.diasAtivos ? round(jogos / janela.diasAtivos, 1) : null;

  // Elo da fila analisada (solo usa tier/rank/lp; flex usa flex_*).
  const elo = filaChave === 'flex'
    ? fmtElo(agg.flex_tier, agg.flex_rank, agg.flex_lp)
    : fmtElo(agg.tier, agg.rank, agg.lp);

  // Campeões. `champs` vem por (nome, rota); agrego por nome p/ os tops gerais e
  // mantenho por rota p/ o "melhor champ de cada lane".
  const champsOrd = [...champs].sort((a, b) => b.n - a.n);
  const porNome = {};
  for (const c of champs) {
    const e = (porNome[c.champion_name] ||= { nome: nomeCampeao(c.champion_name), n: 0, v: 0, k: 0, d: 0, a: 0, primeira: null, ultima: null });
    e.n += Number(c.n); e.v += Number(c.v);
    e.k += Number(c.k) || 0; e.d += Number(c.d) || 0; e.a += Number(c.a) || 0;
    if (c.primeira != null) e.primeira = e.primeira == null ? Number(c.primeira) : Math.min(e.primeira, Number(c.primeira));
    if (c.ultima != null) e.ultima = e.ultima == null ? Number(c.ultima) : Math.max(e.ultima, Number(c.ultima));
  }
  const champsNome = Object.values(porNome).map(c => ({
    ...c,
    wr: pct(c.v, c.n),
    derrotas: c.n - c.v,
    kda: round((c.k + c.a) / Math.max(1, c.d), 2)
  }));

  // Top 5 mais jogados (o "top 5 do período" do card) e Top 5 melhor WR
  // (WR exige amostra mínima p/ não premiar um 1-0 de sorte).
  const topPlayed = [...champsNome].sort((a, b) => b.n - a.n || b.wr - a.wr).slice(0, 5);
  const minWr = Math.max(2, Math.round(jogos * 0.05));
  const topWr = [...champsNome].filter(c => c.n >= minWr)
    .sort((a, b) => b.wr - a.wr || b.n - a.n).slice(0, 5);
  // Dentro do top 5 mais jogado: quem mais rende e quem mais dói. Exige amostra —
  // senão um 2-0 de sorte vira "seu melhor campeão é 100%".
  const minTop = Math.max(3, Math.round(jogos * 0.05));
  const topComAmostra = topPlayed.filter(c => c.n >= minTop);
  const melhorTop = [...topComAmostra].sort((a, b) => b.wr - a.wr || b.n - a.n)[0] || null;
  const piorTop = [...topComAmostra].sort((a, b) => a.wr - b.wr || b.n - a.n)[0] || null;

  // Pool: quantos campeões diferentes e o quanto o mais jogado concentra.
  const pool = Number(agg.pool) || champsNome.length;
  const concentracao = jogos ? pct(topPlayed[0]?.n || 0, jogos) : 0;

  // WR por rota + melhor champ de cada rota (melhor WR com amostra, senão o mais jogado).
  const champsPorRota = {};
  for (const c of champs) {
    if (!c.team_position) continue;
    (champsPorRota[c.team_position] ||= []).push({ nome: nomeCampeao(c.champion_name), n: Number(c.n), v: Number(c.v) });
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
  const mainChamp = nomeCampeao((champsRota[0] || champsOrd[0])?.champion_name) || null;
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

  // Tendência vs período anterior.
  const tend = {};
  if (prev && Number(prev.jogos) > 0) {
    const prevWr = pct(Number(prev.vitorias), Number(prev.jogos));
    const prevKda = (Number(prev.k) + Number(prev.a)) / Math.max(1, Number(prev.d));
    tend.wr = { antes: prevWr, agora: wr, delta: wr - prevWr };
    tend.kda = { antes: round(prevKda, 2), agora: met.kda, delta: round(met.kda - prevKda, 2) };
    tend.csMin = { antes: round(prev.cs_min, 1), agora: met.csMin, delta: round(met.csMin - Number(prev.cs_min || 0), 1) };
    tend.jogos = { antes: Number(prev.jogos), agora: jogos, delta: jogos - Number(prev.jogos) };
  }
  if (marcos && prevMarcos && Number(marcos.n) >= 3 && Number(prevMarcos.n) >= 3) {
    tend.ouro10 = { antes: round(prevMarcos.ouro10), agora: round(marcos.ouro10), delta: round(marcos.ouro10 - prevMarcos.ouro10) };
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
      const pool2 = s.length ? s : candidatos;
      sugestaoMeta = pool2[Math.floor(seedRng(agg.puuid + '|meta')() * pool2.length)];
    }
  }

  return {
    puuid: agg.puuid,
    nome: `${agg.game_name}#${agg.tag_line}`,
    gameName: agg.game_name,
    fila: filaChave,
    jogos, vitorias, derrotas: jogos - vitorias, wr,
    met, med, classe, elo,
    rotaPrinc, rotaLabel: ROLE_LABEL[rotaPrinc] || rotaPrinc,
    tend, mainChamp, bestChamps, offRole, sugestaoMeta,
    topPlayed, topWr, melhorTop, piorTop, pool, concentracao, lanes,
    janela,
    seq: resumirSequencias(seqRows),
    horarios: resumirHorarios(horaRows)
  };
}

// ---------------------------------------------------------------------------
// Geração da prosa (banco de frases + semente puuid+data+período+fila)
//
// Regra do banco: cada gancho tem MUITAS variações e quase toda frase é montada
// por composição (abertura × miolo × fecho), pra dois jogadores com números
// parecidos nunca lerem o mesmo texto.
// ---------------------------------------------------------------------------
const NOME_METRICA = {
  csMin: 'farm (CS/min)', visMin: 'visão de mapa', kp: 'participação em abates', kda: 'KDA'
};

function fraseAbertura(rng, a, periodoJanela) {
  if (a.jogos >= 40) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela} — isso já é profissão.`,
    `**${a.jogos} jogos** no período: a fila devia te cobrar aluguel.`,
    `Maratona pesada: **${a.jogos} partidas** nos ${periodoJanela}.`,
    `**${a.jogos} partidas** — volume de quem mora na Fenda.`,
    `Você abriu o cliente **${a.jogos} vezes** e não olhou pra trás.`,
    `Com **${a.jogos} jogos**, você foi um dos motores da tribo no período.`,
    `**${a.jogos} partidas** nos ${periodoJanela}: dedicação em nível industrial.`
  ]);
  if (a.jogos >= 20) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela} — presença de sobra.`,
    `**${a.jogos} jogos** no período: você não deu descanso pra fila.`,
    `Com **${a.jogos} partidas**, você foi um dos pilares de atividade da tribo.`,
    `**${a.jogos} partidas** no retrovisor — maratonista de ranqueada, hein?`,
    `Grind de respeito: **${a.jogos} jogos** nos ${periodoJanela}.`,
    `A fila viu você **${a.jogos} vezes** no período — dedicação de sobra.`,
    `**${a.jogos} jogos** disputados: constância que dá pra pôr no currículo.`,
    `Nos ${periodoJanela} deu **${a.jogos} partidas** — ritmo de quem está atrás de elo.`
  ]);
  if (a.jogos >= 10) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela}.`,
    `**${a.jogos} jogos** no período — um ritmo saudável.`,
    `Você somou **${a.jogos} partidas** nos ${periodoJanela}, presença constante.`,
    `**${a.jogos} jogos** na conta: nem de menos, nem exagero.`,
    `**${a.jogos} partidas** — amostra já bem confiável pra tirar conclusão.`,
    `Deu pra jogar: **${a.jogos} partidas** nos ${periodoJanela}.`
  ]);
  if (a.jogos >= 5) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela}.`,
    `**${a.jogos} jogos** no período — participação modesta, mas participação.`,
    `**${a.jogos} partidas** apenas; dá pra ver a direção, não a estrada toda.`,
    `Você marcou presença em **${a.jogos} jogos** nos ${periodoJanela}.`,
    `**${a.jogos} partidas** na conta — amostra curta, leitura com cautela.`
  ]);
  return pick(rng, [
    `Poucas partidas dessa vez (**${a.jogos}**), então leve os números com um grão de sal.`,
    `Só **${a.jogos} jogo(s)** — amostra pequena, mas dá pra sentir a direção.`,
    `Aparição relâmpago: **${a.jogos} jogo(s)** no período.`,
    `Com apenas **${a.jogos} partida(s)**, é mais um retrato do que um filme.`,
    `**${a.jogos} jogo(s)** — passou pra dar oi na fila e sumiu.`,
    `Amostra mínima (**${a.jogos}**): trate os números como rascunho.`
  ]);
}

function fraseWr(rng, a) {
  const main = a.mainChamp || '—';
  const placar = `${a.vitorias}V-${a.derrotas}D`;
  const em = `${pRota(a.rotaPrinc, 'em')} **${a.rotaLabel}**`;   // "no Topo" / "na Selva"
  const art = `${pRota(a.rotaPrinc, 'artigo')} **${a.rotaLabel}**`;
  if (a.wr >= 60) return pick(rng, [
    `WR de **${a.wr}%** (${placar}) ${em}, com **${main}** na frente — isso é fase de subida.`,
    `Fechou **${a.wr}% de vitórias** (${placar}) puxando ${art} com **${main}**. Números de quem carrega.`,
    `**${a.wr}%** de aproveitamento (${placar}), a maior parte ${em} com **${main}** — dominante.`,
    `Placar de **${placar}** — **${a.wr}% de WR** ${em}, **${main}** liderando a escalação.`
  ]);
  if (a.wr >= 52) return pick(rng, [
    `WR de **${a.wr}%** (${placar}) ${em}, com **${main}** como principal.`,
    `Fechou **${a.wr}% de vitórias** (${placar}) puxando ${art} (**${main}** na linha de frente).`,
    `**${a.wr}%** de aproveitamento (${placar}), a maior parte ${em} com **${main}**.`,
    `Saldo positivo: **${placar}** (**${a.wr}%**), quase tudo ${em} com **${main}**.`,
    `**${a.wr}% de WR** (${placar}) — ${art} é sua casa e **${main}**, sua chave.`
  ]);
  if (a.wr >= 45) return pick(rng, [
    `WR de **${a.wr}%** (${placar}) ${em}, com **${main}** como principal — em cima do muro.`,
    `**${placar}** dá **${a.wr}%**: equilíbrio puro ${em}, com **${main}** no comando.`,
    `**${a.wr}%** de aproveitamento (${placar}) ${em} — nem subiu, nem caiu.`,
    `Fechou em **${a.wr}%** (${placar}) puxando ${art} com **${main}**; a balança está no fio.`
  ]);
  return pick(rng, [
    `WR de **${a.wr}%** (${placar}) ${em}, com **${main}** como principal — período teimoso.`,
    `**${placar}** fecha em **${a.wr}%**: a fila cobrou caro ${em}.`,
    `**${a.wr}%** de aproveitamento (${placar}) — **${main}** e ${art} não seguraram a onda.`,
    `Saldo negativo: **${placar}** (**${a.wr}%**) puxando ${art}.`
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
    'Aqui é jogo de equipe de verdade — o Flex premia quem soma com o time.',
    'Flex tem elo próprio e vida própria: o que funciona aqui nem sempre traduz pra Solo.',
    'No Flex o inimigo costuma vir em bando — quem tem call organizada leva.',
    'Fila Flex: menos ego, mais objetivo. Quem joga junto sobe junto.'
  ]);
  return ' ' + pick(rng, [
    'Na Solo/Duo é você contra o mundo — cada erro é seu, cada carry também.',
    'Solo/Duo não perdoa: aqui o elo mede o quanto você segura o time sozinho.',
    'Na fila solo o mérito é individual — subir aqui é o teste mais puro de skill.',
    'Solo/Duo é a prova de fogo: sem premade pra cobrir, o que sobra é você.',
    'Na Solo/Duo o PDL é honesto: ele mede exatamente o que você entrega sozinho.',
    'Solo/Duo é onde o elo dói e onde ele vale — sem atalho, sem álibi.',
    'Aqui não tem call de Discord pra salvar: Solo/Duo é leitura de jogo e sangue frio.'
  ]);
}

// Quando/como foi o ritmo: primeira e última partida, dias ativos, tempo em jogo.
function fraseQuando(rng, a) {
  const j = a.janela;
  if (!j || j.primeira == null || j.ultima == null) return null;
  const partes = [];
  partes.push(pick(rng, [
    `A jornada começou em **${fmtDataHora(j.primeira)}** e a última partida foi em **${fmtDataHora(j.ultima)}**`,
    `Primeiro jogo em **${fmtDataHora(j.primeira)}**, último em **${fmtDataHora(j.ultima)}**`,
    `Da abertura em **${fmtDataHora(j.primeira)}** até o encerramento em **${fmtDataHora(j.ultima)}**`,
    `A janela vai de **${fmtDataHora(j.primeira)}** a **${fmtDataHora(j.ultima)}**`,
    `Sua temporada nesse recorte abriu em **${fmtDataHora(j.primeira)}** e fechou em **${fmtDataHora(j.ultima)}**`
  ]));
  if (j.diasAtivos > 0) {
    partes.push(pick(rng, [
      `foram **${j.diasAtivos} dia(s) com ranqueada**${j.jogosPorDia ? ` (média de **${j.jogosPorDia} jogo(s)/dia**)` : ''}`,
      `você sentou pra jogar em **${j.diasAtivos} dia(s) diferentes**${j.jogosPorDia ? `, uns **${j.jogosPorDia}** por dia` : ''}`,
      `deu **${j.diasAtivos} dia(s) ativo(s)**${j.jogosPorDia ? ` a **${j.jogosPorDia} partida(s)** cada` : ''}`
    ]));
  }
  if (j.tempoTotal > 0) {
    partes.push(pick(rng, [
      `e **${fmtDuracao(j.tempoTotal)}** dentro da Fenda, com partidas de **${fmtDuracao(j.durMedia)}** em média`,
      `somando **${fmtDuracao(j.tempoTotal)}** de jogo (média de **${fmtDuracao(j.durMedia)}** por partida)`,
      `totalizando **${fmtDuracao(j.tempoTotal)}** em campo — cada jogo durando cerca de **${fmtDuracao(j.durMedia)}**`
    ]));
  }
  let txt = partes.join('; ') + '.';
  const h = a.horarios;
  if (h && h.dia && h.faixa && h.total >= 5) {
    txt += ' ' + pick(rng, [
      `Seu horário nobre é **${h.dia.label} ${h.faixa.label}** — é quando a maior parte das filas acontece.`,
      `O padrão aponta pra **${h.dia.label} ${h.faixa.label}**: é aí que você mais joga (**${h.dia.n}** partidas ${h.dia.comArtigo}).`,
      `Estatisticamente, seu dia de ranqueada é **${h.dia.label}**, geralmente **${h.faixa.label}** (${h.faixa.wr}% de WR nessa faixa).`,
      `Você concentra as filas **${h.faixa.label}**, com pico na **${h.dia.label}**.`
    ]);
  }
  return txt;
}

function frasesFortes(rng, a) {
  const out = [];
  if (a.classe.kp === 'forte') out.push(pick(rng, [
    `sua **participação em abates (${Math.round(a.met.kp * 100)}%)** é de quem aparece nas brigas`,
    `você vive as jogadas do time — **${Math.round(a.met.kp * 100)}% de KP**`,
    `**${Math.round(a.met.kp * 100)}% de KP**: onde a luta acontece, você está lá`,
    `com **${Math.round(a.met.kp * 100)}% de participação**, dificilmente o time briga sem você`,
    `**KP de ${Math.round(a.met.kp * 100)}%** — presença de mapa acima da média da rota`
  ]));
  if (a.classe.csMin === 'forte') out.push(pick(rng, [
    `o **farm está afiado (${a.met.csMin} CS/min)**, acima do padrão da rota`,
    `você não perde onda: **${a.met.csMin} CS/min**`,
    `**${a.met.csMin} CS/min** — a última hitbox é sempre sua`,
    `sua economia é sólida: **${a.met.csMin} CS/min** e **${a.met.gpm} de ouro/min**`,
    `**${a.met.csMin} CS/min** mostra disciplina de lane — item na hora certa`
  ]));
  if (a.classe.visMin === 'forte') out.push(pick(rng, [
    `a **visão de mapa (${a.met.visMin}/min)** está exemplar`,
    `você ilumina o mapa como poucos (**${a.met.visMin} de visão/min**)`,
    `**${a.met.visMin} de visão/min**: o mapa não tem segredo pro seu time`,
    `**visão de ${a.met.visMin}/min** — você joga com o minimapa ligado, e isso aparece`,
    `sentinela é investimento e você entendeu: **${a.met.visMin} de visão/min**`
  ]));
  if (a.classe.kda === 'forte') out.push(pick(rng, [
    `o **KDA ${a.met.kda}** mostra que você troca bem e morre pouco`,
    `**KDA ${a.met.kda}** — consistência de quem sobrevive pra carregar`,
    `**KDA ${a.met.kda}**: você escolhe as brigas e sai vivo delas`,
    `média de **${a.med.k}/${a.med.d}/${a.med.a}** por jogo (**KDA ${a.met.kda}**) é placar de quem decide`,
    `**KDA ${a.met.kda}** com só **${a.med.d} mortes** por partida — cirúrgico`
  ]));
  if (a.met.dmg >= 20000) out.push(pick(rng, [
    `você despeja **${fmtMilhar(a.met.dmg)} de dano** em campeões por jogo`,
    `**${fmtMilhar(a.met.dmg)} de dano médio** — a barra de vida inimiga sente`
  ]));
  return out;
}

function frasesFracas(rng, a) {
  const out = [];
  if (a.classe.csMin === 'fraco') out.push(pick(rng, [
    `o **farm (${a.met.csMin} CS/min)** está abaixo do que a rota pede — é ouro que vira item, e item que vira vitória`,
    `dá pra apertar o **CS/min (hoje ${a.met.csMin})**: cada onda perdida é um item a menos no meio do jogo`,
    `**${a.met.csMin} CS/min** deixa ouro na mesa — 10 minions a mais por jogo já é outra história`,
    `**${a.met.csMin} CS/min**: antes de rotacionar, limpe a onda; ouro parado não ganha jogo`,
    `o **farm (${a.met.csMin}/min)** cobra caro no fim — o item de power spike chega tarde`
  ]));
  if (a.classe.kda === 'fraco') out.push(pick(rng, [
    `o **KDA ${a.met.kda}** conta que você está morrendo demais — segurar essas mortes já empurraria a WR pra cima`,
    `**KDA ${a.met.kda}**: menos mortes arriscadas e o resultado muda sozinho`,
    `**KDA ${a.met.kda}** — cada morte evitada é um objetivo a mais pro time; respeite o mapa`,
    `são **${a.med.d} mortes por partida** (**KDA ${a.met.kda}**) — muita entrega grátis de ouro`,
    `**KDA ${a.met.kda}** é sinal de briga comprada: escolha melhor quando entrar`
  ]));
  if (a.classe.visMin === 'fraco') out.push(pick(rng, [
    `a **visão (${a.met.visMin}/min)** está baixa — mais sentinelas = menos emboscadas e mais objetivos`,
    `invista em **visão (hoje ${a.met.visMin}/min)**: enxergar o mapa evita mortes bobas`,
    `**${a.met.visMin} de visão/min** é pouco — a wardzinha barata salva mais jogo que parece`,
    `**visão de ${a.met.visMin}/min**: comprar sentinela de controle antes do objetivo muda a briga`,
    `com **${a.met.visMin} de visão/min** você joga no escuro — e no escuro o gank sempre chega`
  ]));
  if (a.classe.kp === 'fraco') out.push(pick(rng, [
    `sua **participação (${Math.round(a.met.kp * 100)}%)** está tímida — aparecer mais nas jogadas do time rende`,
    `**KP ${Math.round(a.met.kp * 100)}%**: rotacionar junto do time aumenta seu impacto`,
    `**KP ${Math.round(a.met.kp * 100)}%** — o time briga e você está longe; chegar junto muda o placar`,
    `**${Math.round(a.met.kp * 100)}% de KP** é pouco ${pRota(a.rotaPrinc, 'para')} ${a.rotaLabel}: o jogo acontece onde você não está`,
    `subir a **participação (hoje ${Math.round(a.met.kp * 100)}%)** costuma ser o ajuste mais barato pra WR`
  ]));
  return out;
}

// Sequências (streaks) — dá o "clima" do período e o momento atual.
function fraseSequencias(rng, a) {
  const s = a.seq;
  if (!s || a.jogos < 3) return null;
  const partes = [];
  if (s.maiorV >= 3) partes.push(pick(rng, [
    `o auge foi uma sequência de **${s.maiorV} vitórias seguidas**`,
    `você emendou **${s.maiorV} vitórias em sequência** no melhor momento`,
    `teve uma arrancada de **${s.maiorV} jogos ganhos em fila**`
  ]));
  if (s.maiorD >= 3) partes.push(pick(rng, [
    `e o fundo do poço foi um tilt de **${s.maiorD} derrotas seguidas**`,
    `mas também tomou **${s.maiorD} derrotas em sequência** — hora de ter parado`,
    `e a pior maré foi de **${s.maiorD} jogos perdidos em fila**`
  ]));
  if (s.atual && s.atual.tam >= 2) partes.push(s.atual.vitoria
    ? pick(rng, [
      `no fim da amostra você estava **${s.atual.tam} vitórias em fila** — quente`,
      `e fechou o período embalado, com **${s.atual.tam} vitórias seguidas**`,
      `a última coisa que a fila viu foi você ganhando **${s.atual.tam} vezes seguidas**`
    ])
    : pick(rng, [
      `e o período terminou com **${s.atual.tam} derrotas em fila** — dá um respiro antes da próxima`,
      `a amostra fecha com **${s.atual.tam} derrotas seguidas**; sair do tilt vale mais que a próxima fila`,
      `e a última sequência foi de **${s.atual.tam} derrotas** — reset mental antes de voltar`
    ]));
  if (!partes.length) {
    if (s.maiorV >= 2 || s.maiorD >= 2) return pick(rng, [
      'O período foi de altos e baixos alternados — sem sequência longa pra nenhum dos lados.',
      'Nada de maratona de vitórias nem de tilt gigante: o resultado foi picotado jogo a jogo.',
      'Vitória e derrota se revezaram o tempo todo, sem embalo nem espiral.'
    ]);
    return null;
  }
  const abre = pick(rng, ['Na montanha-russa, ', 'Falando de embalo, ', 'No ritmo do período, ', 'Sobre as sequências: ', 'Na linha do tempo, ']);
  return abre + partes.join('; ') + '.';
}

// Comentário sobre o pool de campeões (usa o top 5 do período).
function fraseCampeoes(rng, a) {
  const top = a.topPlayed || [];
  if (!top.length) return null;
  const partes = [];
  const lista = top.slice(0, 3).map(c => `**${c.nome}** (${c.n}j, ${c.wr}%)`).join(', ');
  partes.push(pick(rng, [
    `Seu trio mais rodado foi ${lista}`,
    `A escalação preferida: ${lista}`,
    `Quem mais apareceu na sua tela: ${lista}`,
    `O pódio de picks ficou com ${lista}`,
    `No banco de campeões, os titulares foram ${lista}`
  ]));
  if (a.melhorTop && a.piorTop && a.melhorTop.nome !== a.piorTop.nome && a.melhorTop.wr - a.piorTop.wr >= 15) {
    partes.push(pick(rng, [
      `dentro do top 5, **${a.melhorTop.nome}** puxa pra cima (**${a.melhorTop.wr}%** em ${a.melhorTop.n}) enquanto **${a.piorTop.nome}** puxa pra baixo (**${a.piorTop.wr}%** em ${a.piorTop.n})`,
      `**${a.melhorTop.nome}** é o que mais rende (**${a.melhorTop.wr}%**) e **${a.piorTop.nome}** o que mais dói (**${a.piorTop.wr}%**)`,
      `a diferença é gritante: **${a.melhorTop.nome}** entrega **${a.melhorTop.wr}%** e **${a.piorTop.nome}**, só **${a.piorTop.wr}%**`
    ]));
  }
  if (a.pool >= 12) partes.push(pick(rng, [
    `no total foram **${a.pool} campeões diferentes** — pool largo demais costuma diluir a maestria`,
    `você rodou **${a.pool} campeões distintos**; afunilar em 3 ou 4 acelera a subida`,
    `com **${a.pool} picks diferentes**, sobra versatilidade e falta repetição`
  ]));
  else if (a.pool <= 3 && a.jogos >= 10) partes.push(pick(rng, [
    `e o pool é enxuto (**${a.pool} campeões**) — ótimo pra maestria, arriscado contra ban`,
    `são só **${a.pool} campeões** no período: especialista assumido (cuidado com o counter-pick)`,
    `**${a.pool} campeões** apenas — foco total, mas um ban certeiro te desmonta`
  ]));
  else if (a.concentracao >= 45 && top[0]) partes.push(pick(rng, [
    `**${top[0].nome}** sozinho é **${a.concentracao}%** das suas filas`,
    `quase metade do período (**${a.concentracao}%**) foi só de **${top[0].nome}**`
  ]));
  return partes.join('; ') + '.';
}

function fraseEvolucao(rng, a) {
  const t = a.tend;
  const partes = [];
  if (t.wr && Math.abs(t.wr.delta) >= 3) {
    partes.push(t.wr.delta > 0
      ? pick(rng, [
        `sua **WR subiu de ${t.wr.antes}% para ${t.wr.agora}%**`,
        `a vitória **cresceu (${t.wr.antes}% → ${t.wr.agora}%)**`,
        `você **destravou a WR (${t.wr.antes}% → ${t.wr.agora}%)**`,
        `a taxa de vitória **ganhou ${Math.abs(t.wr.delta)} pontos (${t.wr.antes}% → ${t.wr.agora}%)**`
      ])
      : pick(rng, [
        `a **WR caiu de ${t.wr.antes}% para ${t.wr.agora}%**`,
        `a vitória **recuou (${t.wr.antes}% → ${t.wr.agora}%)**`,
        `a **WR esfriou (${t.wr.antes}% → ${t.wr.agora}%)**`,
        `a taxa **perdeu ${Math.abs(t.wr.delta)} pontos (${t.wr.antes}% → ${t.wr.agora}%)**`
      ]));
  }
  if (t.kda && Math.abs(t.kda.delta) >= 0.3) {
    partes.push(t.kda.delta > 0
      ? pick(rng, [
        `o **KDA melhorou (${t.kda.antes} → ${t.kda.agora})**`,
        `você está morrendo menos — **KDA ${t.kda.antes} → ${t.kda.agora}**`,
        `o **KDA reagiu (${t.kda.antes} → ${t.kda.agora})**`
      ])
      : pick(rng, [
        `o **KDA piorou (${t.kda.antes} → ${t.kda.agora})**`,
        `o **KDA recuou (${t.kda.antes} → ${t.kda.agora})**`,
        `você está morrendo mais — **KDA ${t.kda.antes} → ${t.kda.agora}**`
      ]));
  }
  if (t.csMin && Math.abs(t.csMin.delta) >= 0.5) {
    partes.push(t.csMin.delta > 0
      ? `o **farm subiu (${t.csMin.antes} → ${t.csMin.agora} CS/min)**`
      : `o **farm caiu (${t.csMin.antes} → ${t.csMin.agora} CS/min)**`);
  }
  if (t.jogos && Math.abs(t.jogos.delta) >= 5) {
    partes.push(t.jogos.delta > 0
      ? `e o volume aumentou (**${t.jogos.antes} → ${t.jogos.agora} jogos**)`
      : `e o volume caiu (**${t.jogos.antes} → ${t.jogos.agora} jogos**)`);
  }
  if (t.ouro10 && Math.abs(t.ouro10.delta) >= 150) {
    partes.push(t.ouro10.delta > 0
      ? `e o **ouro aos 10min** está mais alto (+${t.ouro10.delta}), sinal de early melhor`
      : `e o **ouro aos 10min** caiu (${t.ouro10.delta}), o começo de jogo travou`);
  }
  if (!partes.length) return null;
  const abre = pick(rng, [
    'Comparando com o período anterior, ', 'Na evolução, ', 'Olhando a tendência, ',
    'De lá pra cá, ', 'Na comparação com antes, ', 'Contra o recorte passado, ',
    'Na régua do período anterior, '
  ]);
  return abre + partes.join('; ') + '.';
}

function fraseRecomendacao(rng, a) {
  const partes = [];
  const bom = a.bestChamps[0];
  // Sem artigo antes de nome de campeão: "insista em Seraphine", não "no Seraphine".
  if (bom && bom.n >= 3) {
    partes.push(pick(rng, [
      `com **${bom.nome}** você segura **${bom.wr}%** em ${bom.n} jogos — é sua zona de conforto`,
      `seu melhor pick é **${bom.nome} (${bom.wr}% em ${bom.n})**`,
      `quando bate o desespero, **${bom.nome}** (${bom.wr}% em ${bom.n}) é o pick que raramente falha`,
      `insista em **${bom.nome}**: ${bom.wr}% de vitória em ${bom.n} jogos não é sorte`,
      `**${bom.nome}** é seu cavalo de batalha (${bom.wr}% em ${bom.n}) — banido ele, tenha o plano B pronto`
    ]));
  }
  if (a.piorTop && a.piorTop.n >= 4 && a.piorTop.wr <= 40 && a.piorTop.nome !== bom?.nome) {
    partes.push(pick(rng, [
      `já **${a.piorTop.nome}** cobra caro (${a.piorTop.wr}% em ${a.piorTop.n}) — ou treina no normal, ou tira da rotação`,
      `pense duas vezes antes de pegar **${a.piorTop.nome}** (${a.piorTop.wr}% em ${a.piorTop.n} jogos)`,
      `**${a.piorTop.nome}** está drenando PDL (${a.piorTop.wr}% em ${a.piorTop.n}); vale revisar build/matchup`
    ]));
  }
  if (a.offRole) {
    const off = ROLE_LABEL[a.offRole.rota] || a.offRole.rota;
    const offArt = pRota(a.offRole.rota, 'artigo');
    const offEm = pRota(a.offRole.rota, 'em');
    const minha = `${pRota(a.rotaPrinc, 'em')} **${a.rotaLabel}**`;
    partes.push(pick(rng, [
      `${offEm} **${off}** a coisa cai pra **${a.offRole.wr}%** (${a.offRole.n} jogos) — se a meta é subir, concentre as filas na sua rota principal`,
      `evite forçar **${off}** (só ${a.offRole.wr}% em ${a.offRole.n}); seu rendimento é melhor ${minha}`,
      `${offArt} **${off}** te puxa pra baixo (${a.offRole.wr}% em ${a.offRole.n}) — deixa essa rota pro modo normal`,
      `autofill de **${off}** custa caro pra você: ${a.offRole.wr}% contra ${a.wr}% no geral`
    ]));
  }
  if (a.sugestaoMeta) {
    const minha = `${pRota(a.rotaPrinc, 'em')} **${a.rotaLabel}**`;
    partes.push(pick(rng, [
      `no patch atual, **${a.sugestaoMeta.nome} (tier ${a.sugestaoMeta.tier})** está forte ${minha} e combina com seu perfil — vale testar`,
      `de olho no meta: **${a.sugestaoMeta.nome}** (${a.sugestaoMeta.tier}) é uma boa aposta ${minha} agora`,
      `se quiser um pick novo, **${a.sugestaoMeta.nome}** (${a.sugestaoMeta.tier}) está brilhando ${minha} neste patch`,
      `o meta pede **${a.sugestaoMeta.nome}** (tier ${a.sugestaoMeta.tier}) ${minha} — experimenta em normal antes de levar pra ranqueada`
    ]));
  }
  if (!partes.length) return null;
  // As variações nascem em minúscula (encaixam em qualquer posição) — a junção
  // vira frases de verdade aqui.
  return capitalizarFrases(partes.join('. ').replace(/\.\./g, '.') + '.');
}

// Assinatura motivacional de fechamento (varia por semente; dá personalidade).
function fraseFechamento(rng, a) {
  if (a.wr >= 60) return pick(rng, [
    'Nesse ritmo o problema não é subir, é achar quem te acompanhe. 👑',
    'Fase de smurf: aproveita a janela e sobe enquanto está quente. 🔥',
    'Elo é consequência quando o desempenho está assim. 🚀'
  ]);
  if (a.wr >= 55) return pick(rng, [
    'Segue nesse embalo que o próximo elo é questão de tempo. 🔥',
    'Tá voando — mantém a cabeça fria e continua subindo. 🚀',
    'Fase quente dessas é pra aproveitar: bora de PDL. 📈',
    'Consistência assim vira divisão nova em poucas semanas. 🧭'
  ]);
  if (a.wr >= 48) return pick(rng, [
    'Equilíbrio é base — um ajuste fino e a balança vira pro seu lado. ⚖️',
    'Você está no fio: pequenos detalhes decidem a próxima subida. 🎯',
    'Constância aqui, e o próximo degrau vem naturalmente. 🧗',
    'Falta pouco: escolha um ponto fraco e ataque só ele nas próximas filas. 🛠️'
  ]);
  if (a.wr >= 40) return pick(rng, [
    'Período difícil acontece — foco no que dá pra controlar e a maré volta. 💪',
    'Cabeça erguida: todo mundo tem sequência ruim, o importante é ajustar. 🛠️',
    'Respira, revisa um ponto de cada vez e volta com tudo na próxima. 🌊'
  ]);
  return pick(rng, [
    'Maré brava. Menos filas seguidas, mais revisão de replay — a virada vem. 🧊',
    'Hora de recalibrar: reduz o volume, escolhe 2 campeões e recomeça. 🧱',
    'Foi ruim, e tudo bem. O próximo período começa do zero. 🌅'
  ]);
}

// Prosa de UMA fila do jogador (Solo/Duo e Flex têm cada uma a sua).
export function gerarProsa(a, periodoJanela, filaInfo = null) {
  const filaChave = filaInfo?.chave || a.fila || 'geral';
  const rng = seedRng(sementeTexto(a.puuid, periodoJanela, filaChave));
  const paras = [];

  // 1) Abertura: atividade + WR/rota/main + tempero da fila.
  paras.push(fraseAbertura(rng, a, periodoJanela) + ' ' + fraseWr(rng, a) + fraseFilaFlavor(rng, a, filaInfo));

  // 2) Quando os jogos aconteceram (janela real + ritmo + horário nobre).
  const quando = fraseQuando(rng, a);
  if (quando) paras.push('🕒 ' + quando);

  // 3) Fortes.
  const fortes = frasesFortes(rng, a);
  if (fortes.length) {
    const abre = pick(rng, ['Do lado bom: ', 'Seus trunfos: ', 'O que está funcionando: ', 'No que você brilha: ', 'Crédito onde é devido: ', 'Pontos altos: ']);
    paras.push('✅ ' + abre + fortes.slice(0, 2).join(', e ') + '.');
  }

  // 4) A melhorar.
  const fracas = frasesFracas(rng, a);
  if (fracas.length) {
    const abre = pick(rng, ['Onde dá pra crescer: ', 'Pontos de atenção: ', 'Pra evoluir: ', 'A lição de casa: ', 'O que está custando jogo: ', 'Na régua da rota: ']);
    paras.push('⚠️ ' + abre + fracas.slice(0, 2).join(', e ') + '.');
  } else {
    paras.push('✅ ' + pick(rng, [
      'Sem pontos fracos gritantes nas métricas da rota — bom equilíbrio.',
      'Nenhuma métrica destoando pra baixo: base sólida e consistente.',
      'Fundamentos redondos — nada gritando por conserto por aqui.',
      'Todas as métricas dentro (ou acima) do esperado pra rota. Difícil reclamar.'
    ]));
  }

  // 5) Sequências de vitória/derrota.
  const seq = fraseSequencias(rng, a);
  if (seq) paras.push('🎲 ' + seq);

  // 6) Campeões do período (o top 5 detalhado vai nos campos do embed).
  const champ = fraseCampeoes(rng, a);
  if (champ) paras.push('🐉 ' + champ);

  // 7) Evolução vs. período anterior (só no modo 'janela').
  const evo = fraseEvolucao(rng, a);
  if (evo) paras.push('📈 ' + evo);

  // 8) Recomendação.
  const rec = fraseRecomendacao(rng, a);
  if (rec) paras.push('🎯 ' + rec);

  // 9) Fechamento motivacional.
  paras.push('— ' + fraseFechamento(rng, a));

  return truncar(paras.join('\n\n'), 4000);
}

// Prosa do topo da mensagem: cruza Solo/Duo e Flex do MESMO jogador.
export function gerarProsaGeral(jog, periodoJanela) {
  const rng = seedRng(sementeTexto(jog.puuid, periodoJanela, 'geral'));
  const s = jog.solo, f = jog.flex;
  const total = (s?.jogos || 0) + (f?.jogos || 0);
  const vit = (s?.vitorias || 0) + (f?.vitorias || 0);
  const wr = pct(vit, total);
  const partes = [];

  if (s && f) {
    partes.push(pick(rng, [
      `No período você somou **${total} ranqueadas** nas duas filas (**${s.jogos}** na Solo/Duo e **${f.jogos}** no Flex), fechando em **${wr}% de vitórias** no agregado.`,
      `Foram **${total} jogos** entre Solo/Duo (**${s.jogos}**) e Flex (**${f.jogos}**) — **${vit}V-${total - vit}D**, ou **${wr}%** no total.`,
      `Contando as duas filas, deu **${total} partidas** (**${s.jogos}** solo + **${f.jogos}** flex) e **${wr}% de aproveitamento**.`,
      `Balanço geral: **${total} ranqueadas**, **${vit}V-${total - vit}D**, **${wr}% de WR** somando Solo/Duo e Flex.`
    ]));
    const dif = s.wr - f.wr;
    if (Math.abs(dif) >= 10) {
      const melhor = dif > 0 ? 'Solo/Duo' : 'Flex';
      const pior = dif > 0 ? 'Flex' : 'Solo/Duo';
      partes.push(pick(rng, [
        `A diferença entre as filas é grande: **${Math.abs(dif)} pontos** de WR a mais no **${melhor}** (${Math.max(s.wr, f.wr)}% contra ${Math.min(s.wr, f.wr)}% no ${pior}).`,
        `Você claramente rende mais no **${melhor}** — **${Math.max(s.wr, f.wr)}%** lá contra **${Math.min(s.wr, f.wr)}%** no ${pior}.`,
        `O **${pior}** está puxando sua média pra baixo: **${Math.min(s.wr, f.wr)}%** contra **${Math.max(s.wr, f.wr)}%** no ${melhor}.`
      ]));
    } else {
      partes.push(pick(rng, [
        `O desempenho é parecido nas duas filas (**${s.wr}%** solo × **${f.wr}%** flex) — seu nível não depende de quem está no time.`,
        `Solo/Duo e Flex andam juntas (**${s.wr}%** e **${f.wr}%**): consistência independente do formato.`,
        `Pouca variação entre as filas (**${s.wr}%** × **${f.wr}%**) — o que você entrega é estável.`
      ]));
    }
    if (s.mainChamp && f.mainChamp && s.mainChamp !== f.mainChamp) {
      partes.push(pick(rng, [
        `Curiosidade: na Solo/Duo o carro-chefe é **${s.mainChamp}**, mas no Flex você troca por **${f.mainChamp}**.`,
        `Você muda de personagem conforme a fila — **${s.mainChamp}** na Solo/Duo, **${f.mainChamp}** no Flex.`
      ]));
    }
  } else {
    const u = s || f;
    if (!u) return '';
    const nomeFila = FILAS[u.fila]?.label || 'ranqueada';
    partes.push(pick(rng, [
      `No período você jogou **só ${nomeFila}**: **${u.jogos} partidas**, **${u.vitorias}V-${u.derrotas}D**, **${u.wr}% de WR**.`,
      `Toda a sua atividade ranqueada ficou na **${nomeFila}** — **${u.jogos} jogos** e **${u.wr}% de vitórias**.`,
      `**${u.jogos} partidas**, todas de **${nomeFila}** (**${u.wr}%** de aproveitamento).`
    ]));
    partes.push(pick(rng, [
      `A outra fila ficou zerada — sem dados, sem análise.`,
      `Nada registrado na outra fila neste recorte.`,
      `A fila que sobrou não teve partida no período.`
    ]));
  }
  return truncar(partes.join(' '), 3000);
}

// ---------------------------------------------------------------------------
// Embeds do Discord — UMA MENSAGEM POR JOGADOR: embed de resumo (as duas filas)
// + um embed por fila com prosa e números próprios.
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

const MEDALHAS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

// Campos (fields) do embed de UMA fila: números, top 5 campeões, rotas, janela
// e sequências. É aqui que ficam os dados "duros" que a prosa só comenta.
//
// `nivel` é o orçamento de espaço (ver montarMensagensJogador): 0 = tudo;
// 1 = sem o quadro de rotas; 2 = só o essencial (placar + top 5 + datas). Serve
// pra caber TUDO de um jogador muito ativo numa única mensagem do Discord.
function camposFila(a, nivel = 0) {
  const fields = [];

  fields.push({
    name: '📊 Placar do período',
    value: truncar([
      `**${plural(a.jogos, 'jogo', 'jogos')}** · **${a.vitorias}V-${a.derrotas}D** · **${a.wr}% WR**`,
      `⚔️ KDA **${fmtKda(a.met.kda)}** (${a.med.k} / ${a.med.d} / ${a.med.a} por partida)`,
      `🌾 ${a.met.csMin} CS/min · 👁️ ${a.met.visMin} visão/min · 🤝 ${Math.round(a.met.kp * 100)}% KP`,
      `💰 ${a.met.gpm} ouro/min · 💥 ${fmtMilhar(a.met.dmg)} de dano em campeões`
    ].join('\n'), 1024),
    inline: false
  });

  if (a.topPlayed.length) {
    fields.push({
      name: `🏆 Top ${a.topPlayed.length} campeões (taxa de vitória)`,
      value: truncar(a.topPlayed.map((c, i) =>
        `${MEDALHAS[i] || '▫️'} **${c.nome}** — ${c.n}j · **${c.wr}%** (${c.v}V-${c.derrotas}D) · KDA ${fmtKda(c.kda)}`
      ).join('\n'), 1024),
      inline: false
    });
  }

  if (a.lanes.length && nivel < 1) {
    fields.push({
      name: '🧭 Rotas',
      value: truncar(a.lanes.slice(0, 5).map(l =>
        `${l.label}: **${l.wr}%** em ${l.n}j${l.melhorChamp ? ` · melhor: ${l.melhorChamp.nome} (${l.melhorChamp.wr}%)` : ''}`
      ).join('\n'), 1024),
      inline: false
    });
  }

  const j = a.janela;
  const linhasQuando = [
    `Primeiro: **${fmtDataHora(j.primeira)}**`,
    `Último: **${fmtDataHora(j.ultima)}**`
  ];
  if (j.diasAtivos) linhasQuando.push(`📆 ${j.diasAtivos} dia(s) com jogo${j.jogosPorDia ? ` · ${j.jogosPorDia}/dia` : ''}`);
  if (j.tempoTotal) linhasQuando.push(`⏱️ ${fmtDuracao(j.tempoTotal)} em jogo (média ${fmtDuracao(j.durMedia)})`);
  fields.push({ name: '🗓️ Quando foram os jogos', value: truncar(linhasQuando.join('\n'), 1024), inline: true });

  if (nivel < 2) {
    const extras = [];
    if (a.seq) {
      if (a.seq.maiorV) extras.push(`🔥 Melhor sequência: **${a.seq.maiorV}V**`);
      if (a.seq.maiorD) extras.push(`🧊 Pior sequência: **${a.seq.maiorD}D**`);
      if (a.seq.atual) extras.push(`📍 Terminou com **${a.seq.atual.tam}${a.seq.atual.vitoria ? 'V' : 'D'}** em fila`);
    }
    extras.push(`🎭 ${a.pool} campeão(ões) diferente(s)`);
    if (a.horarios?.dia) extras.push(`🕹️ Joga mais: **${a.horarios.dia.label}${a.horarios.faixa ? ' ' + a.horarios.faixa.label : ''}**`);
    fields.push({ name: '📌 Destaques', value: truncar(extras.join('\n'), 1024), inline: true });
  }

  return fields;
}

// Embed de uma fila (Solo/Duo ou Flex) do jogador: prosa + campos.
function embedFila(filaInfo, a, P, nivel = 0) {
  return {
    title: truncar(`${filaInfo.emoji} Ranked ${filaInfo.label} — ${a.jogos}j · ${a.wr}% WR${a.elo ? ` · ${a.elo}` : ''}`, 256),
    description: gerarProsa(a, P.janela, filaInfo),
    color: corPorWr(a.wr),
    fields: camposFila(a, nivel)
  };
}

// Embed de abertura da mensagem do jogador: identidade + visão cruzada das filas.
function embedResumoJogador(jog, P) {
  const s = jog.solo, f = jog.flex;
  const total = (s?.jogos || 0) + (f?.jogos || 0);
  const vit = (s?.vitorias || 0) + (f?.vitorias || 0);
  const wr = pct(vit, total);

  const elos = [];
  if (s?.elo) elos.push(`${FILAS.solo.emoji} **${s.elo}** (Solo/Duo)`);
  if (f?.elo) elos.push(`${FILAS.flex.emoji} **${f.elo}** (Flex)`);

  const primeira = [s?.janela.primeira, f?.janela.primeira].filter(v => v != null);
  const ultima = [s?.janela.ultima, f?.janela.ultima].filter(v => v != null);
  const tempo = (s?.janela.tempoTotal || 0) + (f?.janela.tempoTotal || 0);

  const escopo = s && f ? 'as duas filas' : `só ${FILAS[(s || f).fila]?.label || 'ranqueada'}`;
  const resumo = [`**${plural(total, 'jogo', 'jogos')}** · **${vit}V-${total - vit}D** · **${wr}% WR** (${escopo})`];
  if (primeira.length && ultima.length) {
    resumo.push(`📆 De **${fmtDataHora(Math.min(...primeira))}** até **${fmtDataHora(Math.max(...ultima))}**`);
  }
  if (tempo) resumo.push(`⏱️ **${fmtDuracao(tempo)}** de jogo no total`);
  if (s) resumo.push(`${FILAS.solo.emoji} Solo/Duo: **${s.jogos}j · ${s.wr}%** · KDA ${s.met.kda}`);
  if (f) resumo.push(`${FILAS.flex.emoji} Flex: **${f.jogos}j · ${f.wr}%** · KDA ${f.met.kda}`);

  return {
    title: truncar(`👤 ${jog.nome}`, 256),
    description: truncar((elos.length ? elos.join(' · ') + '\n\n' : '') + gerarProsaGeral(jog, P.janela), 4000),
    color: corPorWr(wr),
    fields: [{ name: '📌 Resumo do período', value: truncar(resumo.join('\n'), 1024), inline: false }],
    footer: { text: `${P.titulo} · ${P.janela}` }
  };
}

// Cabeçalho (mensagem 1): período, filas cobertas, quantas partidas foram
// avaliadas (por fila) e a data da primeira/última partida da amostra.
function montarHeader(P, resumo, ativos, chaves) {
  const filaLabel = chaves.map(k => FILAS[k].label).join(' + ');
  const partidas = chaves
    .map(k => `${FILAS[k].emoji} ${FILAS[k].label}: **${resumo.porFila[k]?.partidas || 0}**`)
    .join(' · ');
  const total = chaves.reduce((s, k) => s + (resumo.porFila[k]?.partidas || 0), 0);
  const desc = [
    `**Ranked ${filaLabel}** · ${P.janela}`,
    `🎮 Partidas avaliadas — ${partidas} · total **${total}**`,
    `📆 Primeira: **${fmtData(resumo.primeira)}** · Última: **${fmtData(resumo.ultima)}**`,
    `👥 ${ativos} jogador(es) avaliado(s) — cada um recebe a própria mensagem, com Solo/Duo e Flex separadas.`
  ].join('\n');
  return {
    title: `${P.emoji} ${P.titulo}`,
    description: desc,
    color: 0x8b5cf6,
    footer: { text: `Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: TZ })}` },
    timestamp: new Date().toISOString()
  };
}

// Limite do Discord: 6000 caracteres somando TODOS os embeds da mensagem e no
// máximo 10 embeds. Usamos 5500 de folga.
const LIMITE_CHARS = 5500;

// Soma de caracteres que o Discord conta no limite de 6000 por mensagem.
function embedSize(e) {
  let n = (e.title || '').length + (e.description || '').length + (e.footer?.text || '').length;
  for (const f of e.fields || []) n += (f.name || '').length + (f.value || '').length;
  return n;
}

// Quebra a lista de embeds em páginas que cabem no orçamento do Discord.
function paginar(embeds) {
  const paginas = [];
  let atual = [], soma = 0;
  for (const e of embeds) {
    const sz = embedSize(e);
    if (atual.length && (soma + sz > LIMITE_CHARS || atual.length >= 10)) { paginas.push(atual); atual = []; soma = 0; }
    atual.push(e); soma += sz;
  }
  if (atual.length) paginas.push(atual);
  return paginas;
}

// UMA mensagem por jogador. Jogador muito ativo (prosa das duas filas + todos os
// campos) pode estourar os 6000 caracteres — nesse caso o card enxuga os quadros
// acessórios (rotas, depois destaques) para caber; a prosa das duas filas e o top
// 5 nunca são sacrificados. Só se nem assim couber é que vira 2 mensagens.
function montarMensagensJogador(jog, P, userMap, chaves) {
  let paginas = null;
  for (const nivel of [0, 1, 2]) {
    const embeds = [embedResumoJogador(jog, P)];
    for (const k of chaves) if (jog[k]) embeds.push(embedFila(FILAS[k], jog[k], P, nivel));
    paginas = paginar(embeds);
    if (paginas.length === 1) break;
  }

  const m = mencao(jog, userMap);
  return paginas.map((lista, i) => {
    const msg = { username: NOME_BOT, embeds: lista, allowed_mentions: { parse: ['users'] } };
    if (i === 0 && m) msg.content = m;
    return msg;
  });
}

export function montarMensagens(jogadores, periodoKey, userMap, { resumo, ativos, chaves }) {
  const P = PERIODOS[periodoKey] || PERIODOS.semanal;
  const mensagens = [{
    username: NOME_BOT,
    embeds: [montarHeader(P, resumo, ativos, chaves)],
    allowed_mentions: { parse: ['users'] }
  }];
  for (const jog of jogadores) mensagens.push(...montarMensagensJogador(jog, P, userMap, chaves));
  return mensagens;
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
    await sleep(600); // respiro entre mensagens (agora há uma por jogador)
  }
}

// ---------------------------------------------------------------------------
// Coleta + análise para UMA fila (queue_id). Devolve as análises já ordenadas e
// o resumo da amostra (nº de partidas + data da primeira/última).
// ---------------------------------------------------------------------------
async function coletarAnalises({ queryRows, P, puuids, soPrem, meta, agora, queues, filaChave }) {
  const ate = agora;
  const desde = P.modo === 'janela' ? agora - P.ms : null;
  const nLimite = P.modo === 'jogos' ? P.n : null;

  const cte = cteSel({ modo: P.modo, desde, ate, puuids, queues });
  const qA = qAgg(cte, { n: nLimite, somentePremium: soPrem });
  const qR = qRotas(cte, { n: nLimite });
  const qC = qChamps(cte, { n: nLimite });
  const qRes = qResumo(cte, { n: nLimite, somentePremium: soPrem });
  const qS = qSequencias(cte, { n: nLimite });
  const qH = qHorarios(cte, { n: nLimite });

  const promessas = [
    queryRows(qA.sql, qA.params),
    queryRows(qR.sql, qR.params),
    queryRows(qC.sql, qC.params),
    queryRows(qRes.sql, qRes.params).catch(() => []),
    // Extras (sequências e horários): degradam pra vazio se o SQL falhar.
    queryRows(qS.sql, qS.params).catch(() => []),
    queryRows(qH.sql, qH.params).catch(() => [])
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

  const [aggs, rotas, champs, resumoRows, seqs = [], horas = [], aggsPrev = [], marcos = [], marcosPrev = []] =
    await Promise.all(promessas);

  const byPuuid = (arr) => arr.reduce((m, r) => ((m[r.puuid] ||= []).push(r), m), {});
  const rotasBy = byPuuid(rotas);
  const champsBy = byPuuid(champs);
  const seqBy = byPuuid(seqs);
  const horaBy = byPuuid(horas);
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
    .map(a => analisarJogador(
      a, rotasBy[a.puuid] || [], champsBy[a.puuid] || [], marcosBy[a.puuid],
      prevBy[a.puuid], prevMarcosBy[a.puuid], meta,
      seqBy[a.puuid] || [], horaBy[a.puuid] || [], filaChave
    ))
    .sort((x, y) => y.jogos - x.jogos);

  return { analises, resumo };
}

// ---------------------------------------------------------------------------
// ORQUESTRADOR — gera UMA MENSAGEM POR JOGADOR (precedida de um cabeçalho), com
// Solo/Duo e Flex analisadas e narradas separadamente dentro dela.
// `fila`: 'solo' | 'flex' | 'ambas' (default) restringe as filas cobertas.
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
  // jogador: cada um vira UMA mensagem com as duas filas.
  const porFila = {};
  for (const chave of chaves) {
    porFila[chave] = await coletarAnalises({
      queryRows, P, puuids, soPrem, meta, agora, queues: [FILAS[chave].id], filaChave: chave
    });
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
      // Fila principal = a mais jogada (empate/só-solo → solo). Define a cor/ordem.
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
      username: NOME_BOT,
      content: `${P.emoji} **${P.titulo} — Ranked ${filaLabel}**: ninguém da tribo jogou ranqueada nos ${P.janela}. 😴`
    }];
  } else {
    mensagens = montarMensagens(jogadores, periodoKey, userMap, { resumo, ativos, chaves });
  }

  return { ativos, periodo: periodoKey, fila, mensagens };
}
