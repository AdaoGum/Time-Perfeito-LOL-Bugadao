// ============================================================================
// MÉTRICAS DO RELATÓRIO DA TRIBO — SQL + análise. JS puro, portável.
//
// Camada de DADOS do relatório: monta as consultas agregadas do D1 e transforma
// as linhas num objeto de análise por (jogador × fila). NÃO gera texto e NÃO
// conhece Discord — quem narra é `shared/relatorio-prosa.js` (roda no browser) e
// quem monta embed é `cron/lib/relatorio-engine.js`.
//
// Três consumidores, um só arquivo: o coletor (Node), o Worker (edge) e — via
// prosa — o front. Por isso nada de `fs`/`process`/Vite aqui dentro.
//
// Contrato de query injetada:
//   queryRows(sql, params) -> Promise<Array<Object>>  (linhas do D1)
//     • Node/cron:  async (sql,p) => (await queryD1(sql,p)).results
//     • Worker:     async (sql,p) => (await env.DB.prepare(sql).bind(...p).all()).results
//
// Correção de schema: game_creation/game_duration/queue_id ficam em `partidas`.
// ============================================================================

export const QUEUES_RANKED = [420, 440];
// Filas ranqueadas. Cada uma é coletada, analisada, narrada e ENTREGUE em
// separado (elos, metas e companhia diferentes): uma mensagem para cada.
// A ordem daqui é a ordem das mensagens — Solo/Duo antes do Flex.
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
export const DIA = 86400000;

// Hora (de Brasília) em que os relatórios AGENDADOS são postados — e, por isso
// mesmo, o ponto de corte das janelas deles. Mexer aqui muda o recorte; mexer no
// cron do `.github/workflows/relatorio-discord.yaml` muda a hora do post. Os
// dois precisam andar juntos, senão sobra ou falta um pedaço de dia na janela.
export const HORA_CORTE = 9;

// Períodos. `modo`: 'janela' (recorte por tempo, com tendência vs. período anterior),
// 'jogos' (últimas N partidas por jogador) ou 'tudo' (todo o histórico do alvo).
// `emoji`/`titulo` alimentam o cabeçalho; `janela` é a descrição humana da amostra.
//
// Janela por `ms` (últimos N dias) x janela por `ancora` (desde o corte anterior):
// os dois relatórios agendados são ancorados de propósito. "Últimos 3 dias" numa
// segunda pegaria a sexta inteira — inclusive o que o post da sexta de manhã já
// tinha contado. Ancorando em (dia da semana + HORA_CORTE), a janela da sexta
// termina exatamente onde a da segunda começa: nada fica de fora, nada conta duas
// vezes. `desloc` manda a comparação "período anterior" pular uma SEMANA inteira,
// porque a referência justa desta sexta é a sexta passada, não a terça.
export const PERIODOS = {
  semanal: { modo: 'janela', ms: 7 * DIA,  emoji: '📅', titulo: 'Relatório Semanal',          janela: 'últimos 7 dias' },
  mensal:  { modo: 'janela', ms: 30 * DIA, emoji: '🗓️', titulo: 'Relatório Mensal',           janela: 'últimos 30 dias' },
  // Sexta de manhã: o que a tribo jogou na semana útil (desde segunda de manhã).
  'semana-util': {
    modo: 'janela', ancora: { dia: 1, hora: HORA_CORTE }, desloc: 7 * DIA,
    emoji: '📅', titulo: 'Relatório da Semana', janela: 'dias desde segunda-feira'
  },
  // Segunda de manhã: sexta à noite + sábado + domingo (desde sexta de manhã).
  'fim-de-semana': {
    modo: 'janela', ancora: { dia: 5, hora: HORA_CORTE }, desloc: 7 * DIA,
    emoji: '🎲', titulo: 'Relatório do Fim de Semana', janela: 'dias desde sexta-feira'
  },
  '50':    { modo: 'jogos',  n: 50,        emoji: '🎯', titulo: 'Relatório — 50 jogos',       janela: 'últimos 50 jogos' },
  todos:   { modo: 'tudo',                 emoji: '📚', titulo: 'Relatório — Todos os Jogos',  janela: 'todo o histórico' }
};

// Brasília é UTC-3 fixo desde 2019 (o SQL daqui já assume isso no '-3 hours').
const OFFSET_BRT = 3 * 3600000;

// O último instante em que bateu {diaSemana} às {hora} de Brasília, olhando de
// `agora` para trás. Se hoje É o dia e a hora ainda não chegou, volta uma semana.
// Deslocar o epoch em -3h faz os getters UTC do Date lerem o relógio de Brasília
// sem depender de Intl nem do fuso da máquina que roda o job.
export function corteAnterior(agora, diaSemana, hora) {
  const brt = Number(agora) - OFFSET_BRT;
  const d = new Date(brt);
  const alvoHoje = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + hora * 3600000;
  let recuo = (d.getUTCDay() - diaSemana + 7) % 7;
  if (recuo === 0 && alvoHoje >= brt) recuo = 7;
  return alvoHoje - recuo * DIA + OFFSET_BRT;
}

// Período (chave) -> a janela CONCRETA do instante em que o job rodou. Períodos de
// "últimos N dias" passam direto; os ancorados ganham aqui o `ms` do recorte real,
// que é o que `coletarAnalises` consome. Rodar 20 minutos atrasado só alarga a
// janela nesses 20 minutos — o começo dela continua preso ao corte anterior.
export function resolverJanela(periodo, agora = Date.now()) {
  const P = PERIODOS[normalizarPeriodo(periodo)];
  if (!P.ancora) return P;
  const desde = corteAnterior(agora, P.ancora.dia, P.ancora.hora);
  const ms = Math.max(3600000, agora - desde);
  return { ...P, ms, desde: agora - ms, ate: agora, dias: Math.max(1, Math.round(ms / DIA)) };
}

// Nomes antigos ainda aceitos (workflow/env/atalhos antigos) → mapeiam pros novos.
const ALIAS_PERIODO = { dia: 'semanal', semana: 'mensal', mes: 'mensal', geral: 'todos' };
export function normalizarPeriodo(p) {
  const k = String(p || '').toLowerCase().trim();
  return PERIODOS[k] ? k : (ALIAS_PERIODO[k] || 'semanal');
}

// Benchmarks por rota (mira). Abaixo do 1º = "a melhorar"; acima do 2º = "forte".
// csMin null = métrica irrelevante para a rota (ex.: suporte).
export const BENCH = {
  TOP:     { csMin: [6, 8],     visMin: [0.4, 0.7], kp: [0.40, 0.55], kda: 2.0 },
  JUNGLE:  { csMin: [4.5, 6.5], visMin: [0.7, 1.1], kp: [0.55, 0.70], kda: 2.5 },
  MIDDLE:  { csMin: [6, 8],     visMin: [0.5, 0.8], kp: [0.50, 0.65], kda: 2.5 },
  BOTTOM:  { csMin: [7, 9],     visMin: [0.4, 0.7], kp: [0.50, 0.65], kda: 2.5 },
  UTILITY: { csMin: null,       visMin: [1.2, 2.0], kp: [0.55, 0.72], kda: 2.5 }
};

// team_position (Riot) -> rótulo humano e -> role do meta-tiers.csv.
export const ROLE_LABEL = { TOP: 'Topo', JUNGLE: 'Selva', MIDDLE: 'Meio', BOTTOM: 'Atirador', UTILITY: 'Suporte' };
const ROLE_META  = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };
// "a Selva" é o único rótulo feminino — sem isto a prosa diz "no Selva".
const ROLE_FEMININO = new Set(['JUNGLE']);
const PREPOSICOES = { em: ['no', 'na'], de: ['do', 'da'], para: ['pro', 'pra'], artigo: ['o', 'a'] };
// pRota('JUNGLE', 'em') -> 'na'   |   pRota('TOP', 'para') -> 'pro'
export function pRota(rotaKey, tipo = 'em') {
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
export function cteSel({ modo, desde, ate, puuids, queues = QUEUES_RANKED }) {
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
export const round = (n, c = 0) => { const f = 10 ** c; return Math.round((Number(n) || 0) * f) / f; };
export const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);
export const TZ = 'America/Sao_Paulo';

// game_creation (epoch ms) -> data curta pt-BR (fuso de Brasília).
export function fmtData(ms) {
  if (ms == null) return '—';
  return new Date(Number(ms)).toLocaleDateString('pt-BR', { timeZone: TZ });
}
// ... e a versão com hora ("01/07 às 21:38") — usada na janela de cada jogador.
export function fmtDataHora(ms) {
  if (ms == null) return '—';
  return new Date(Number(ms))
    .toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .replace(', ', ' às ');
}
// Segundos -> "18h 42min" / "34min".
export function fmtDuracao(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}
// 18432 -> "18,4k" (dano médio cabe melhor assim no embed).
export function fmtMilhar(n) {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : String(Math.round(v));
}
export const plural = (n, sing, plur) => `${n} ${Number(n) === 1 ? sing : plur}`;
// KDA sempre com 2 casas nos campos tabulares (3 vira "3.00", alinha a lista).
export const fmtKda = (n) => (Number(n) || 0).toFixed(2);
// Capitaliza a 1ª letra de cada frase, pulando marcação markdown (`**Vi** …`).
export function capitalizarFrases(txt) {
  return String(txt || '').replace(/(^|[.!?]\s+)([*_`]*)([a-zà-ÿ])/g,
    (_, antes, marca, letra) => antes + marca + letra.toUpperCase());
}
export function fmtElo(tier, rank, lp) {
  if (!tier) return null;
  const T = String(tier).toUpperCase();
  const nome = TIER_LABEL[T] || tier;
  const div = TIER_SEM_DIVISAO.has(T) || !rank ? '' : ` ${rank}`;
  return `${nome}${div}${lp == null ? '' : ` (${lp} PDL)`}`;
}
// Corta respeitando os limites do Discord (field 1024 / description 4096).
export function truncar(txt, max) {
  const s = String(txt || '');
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

export function classificar(valor, faixa) {
  if (!faixa) return 'na';
  if (valor < faixa[0]) return 'fraco';
  if (valor > faixa[1]) return 'forte';
  return 'mediano';
}

// RNG determinístico com semente (mulberry32 sobre hash da string).
export function seedRng(str) {
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
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
// Semente do texto de um jogador: muda por dia, período e fila — o mesmo jogador
// nunca lê o mesmo relatório duas vezes seguidas, mas reexecutar hoje é estável.
// O "dia" é o de BRASÍLIA, igual ao resto do relatório: com `toISOString()` (UTC)
// a virada acontecia às 21h, e quem abrisse a tela às 22h já lia o texto de
// "amanhã" — enquanto os números continuavam os de hoje.
const diaBrasilia = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
export const sementeTexto = (puuid, periodoJanela, filaChave) =>
  `${puuid}|${diaBrasilia()}|${periodoJanela}|${filaChave}`;

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

// Sugestão do meta: campeão S/A na rota principal que o jogador ainda não spamma.
// Extraída da análise porque roda nos DOIS lados: no cron (que lê o CSV do disco)
// e no front (que já tem o meta-tiers.csv carregado para o Panteão e a Tier List).
// `jogados` = chaves normalizadas dos campeões do recorte; `metaTable` = a tabela
// de `parseMetaTiers`. Sem tabela, devolve null e a prosa simplesmente pula a dica.
export function sugerirDoMeta(rotaPrinc, jogados, puuid, metaTable) {
  if (!metaTable) return null;
  const roleMeta = ROLE_META[rotaPrinc];
  const usados = new Set(jogados || []);
  const candidatos = Object.entries(metaTable)
    .filter(([chave, v]) => chave.endsWith(`|${roleMeta}`) && (v.tier === 'S' || v.tier === 'A'))
    .filter(([chave]) => !usados.has(chave.split('|')[0]))
    .map(([, v]) => v);
  if (!candidatos.length) return null;
  // Pseudo-aleatório estável entre os candidatos, priorizando S.
  const s = candidatos.filter(c => c.tier === 'S');
  const pool = s.length ? s : candidatos;
  return pool[Math.floor(seedRng(puuid + '|meta')() * pool.length)];
}

export function analisarJogador(agg, rotas, champs, marcos, prev, prevMarcos, metaTable, seqRows, horaRows, filaChave) {
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

  // Chaves normalizadas de tudo que ele jogou no recorte. Vai no JSON porque o
  // Worker NÃO lê o meta-tiers.csv (é um arquivo do repo, não do banco) — quem
  // tem o CSV em mãos é o front, que chama `sugerirDoMeta` com esta lista.
  const jogados = [...new Set(champsOrd.map(c => champKey(c.champion_name)))];
  const sugestaoMeta = sugerirDoMeta(rotaPrinc, jogados, agg.puuid, metaTable);

  return {
    puuid: agg.puuid,
    nome: `${agg.game_name}#${agg.tag_line}`,
    gameName: agg.game_name,
    // Nome e tag SEPARADOS: o link do card do Discord monta a rota
    // /relatorios/:gameName/:tagLine, que precisa dos dois em separado.
    tagLine: agg.tag_line,
    fila: filaChave,
    jogos, vitorias, derrotas: jogos - vitorias, wr,
    met, med, classe, elo,
    rotaPrinc, rotaLabel: ROLE_LABEL[rotaPrinc] || rotaPrinc,
    tend, mainChamp, bestChamps, offRole, sugestaoMeta, jogados,
    topPlayed, topWr, melhorTop, piorTop, pool, concentracao, lanes,
    janela,
    seq: resumirSequencias(seqRows),
    horarios: resumirHorarios(horaRows),
    // Grade crua dia-da-semana × faixa-do-dia (0..6 × 0..3). O `horarios` acima é
    // só o pico; isto é a matriz inteira, que vira mapa de calor na tela. Sai de
    // graça — a consulta já roda para o resumo.
    horariosGrade: (horaRows || []).map((r) => ({
      dia: Number(r.dia_semana), faixa: Number(r.faixa_dia), n: Number(r.n) || 0, v: Number(r.v) || 0
    }))
  };
}

// ---------------------------------------------------------------------------
// Coleta + análise para UMA fila (queue_id). Devolve as análises já ordenadas e
// o resumo da amostra (nº de partidas + data da primeira/última).
// ---------------------------------------------------------------------------
export async function coletarAnalises({ queryRows, P, puuids, soPrem, meta, agora, queues, filaChave }) {
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
    // Quanto o "período anterior" recua. Padrão: o próprio tamanho da janela — a
    // fatia imediatamente antes. Os relatórios ancorados pedem `desloc` de uma
    // SEMANA: a janela comparável desta sexta é a da sexta passada (mesmos dias
    // da semana), não os quatro dias que terminaram na segunda.
    const desloc = P.desloc || P.ms;
    const antesDesde = desde - desloc;
    const antesAte = ate - desloc;
    const ctePrev = cteSel({ modo: 'janela', desde: antesDesde, ate: antesAte, puuids, queues });
    const qAP = qAgg(ctePrev, { somentePremium: soPrem });
    const qM = sqlMarcos10(desde, ate, puuids, queues);
    const qMP = sqlMarcos10(antesDesde, antesAte, puuids, queues);
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
// INTERVALO LIVRE (data inicial / data final) — usado pela tela de Relatórios
// Premium. Em vez de um período fixo de PERIODOS, monta um "P" sintético com a
// duração exata do recorte: `coletarAnalises` recebe `agora = ate` e calcula
// `desde = ate - ms`, ou seja, exatamente o intervalo pedido. De brinde, a
// tendência ("período anterior") vira a janela de MESMO tamanho logo antes.
// ---------------------------------------------------------------------------
export function periodoIntervalo(desde, ate, agora = Date.now()) {
  const ini = Number(desde);
  const fim = Number(ate);
  const ms = Math.max(DIA, fim - ini);   // piso de 1 dia: janela vazia quebraria a tendência
  const dias = Math.max(1, Math.round(ms / DIA));
  // `janela` é encaixada DEPOIS de "nos" pelo banco de frases ("... ranqueadas nos
  // ${janela}"), então precisa ser uma expressão de período no masculino plural —
  // um par de datas cru viraria "partidas nos 17/07/2026 a 11/08/2026".
  // `fim` é exclusivo (início do dia seguinte); -1ms devolve o último dia real.
  const janela = fim >= agora && dias > 1
    ? `últimos ${dias} dias`
    : `dias ${fmtData(ini)}${dias > 1 ? ` a ${fmtData(fim - 1)}` : ''}`;
  return {
    modo: 'janela',
    ms,
    dias,
    emoji: '🗓️',
    titulo: 'Relatório por período',
    janela,
    desde: ini,
    ate: fim
  };
}

// `YYYY-MM-DD` (o que o <input type="date"> entrega) -> epoch ms no fuso de
// Brasília. `fimDoDia` empurra para o INÍCIO DO DIA SEGUINTE, porque todo o SQL
// daqui usa recorte semiaberto [desde, ate) — sem isso o último dia escolhido
// pelo usuário ficaria de fora do relatório.
export function diaParaEpoch(iso, fimDoDia = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return null;
  const base = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00-03:00`);
  if (!Number.isFinite(base)) return null;
  return fimDoDia ? base + DIA : base;
}

// Série DIÁRIA do recorte (1 linha por dia com jogo) — alimenta o gráfico de
// evolução e a contagem "N jogos no período" da tela. O dia é fechado no fuso
// de Brasília, igual ao `dias_ativos` do agregado.
export function qSerieDiaria(cte) {
  return {
    sql: `${cte.sql}
      SELECT date(s.gc/1000, ${TZ_SQL}) dia, COUNT(*) jogos, SUM(s.win) vitorias,
             SUM(s.kills) k, SUM(s.deaths) d, SUM(s.assists) a,
             AVG(s.cs * 60.0 / NULLIF(s.gd,0)) cs_min
      FROM sel s GROUP BY dia ORDER BY dia`,
    params: [...cte.params]
  };
}

// ---------------------------------------------------------------------------
// LISTA DE JOGADORES PREMIUM (o grid de cards da tela). Três consultas leves —
// nenhuma toca a API da Riot.
// ---------------------------------------------------------------------------
// 1) Cadastro: quem é premium (has_premium = 1).
export const SQL_PREMIUM_JOGADORES = `
  SELECT puuid, game_name, tag_line, profile_icon_id, summoner_level,
         tier, rank, lp, win_rate, flex_tier, flex_rank, flex_lp, flex_win_rate,
         ultima_atualizacao
  FROM jogadores WHERE has_premium = 1
  ORDER BY game_name COLLATE NOCASE ASC`;

// 2) Atividade recente por (jogador × fila) nos últimos 30 dias — os contadores
// dos chips de preset (7 / 15 / 30 dias) aparecem no card ANTES de o usuário
// escolher o período, sem uma segunda ida ao servidor.
export function sqlPremiumAtividade(d7, d15, d30) {
  return {
    sql: `
      SELECT e.puuid, p.queue_id,
             COUNT(*) j30, SUM(e.win) v30,
             SUM(CASE WHEN p.game_creation >= ? THEN 1 ELSE 0 END) j7,
             SUM(CASE WHEN p.game_creation >= ? THEN e.win ELSE 0 END) v7,
             SUM(CASE WHEN p.game_creation >= ? THEN 1 ELSE 0 END) j15,
             SUM(CASE WHEN p.game_creation >= ? THEN e.win ELSE 0 END) v15
      FROM estatisticas_jogador_partida e
      JOIN partidas p ON p.match_id = e.match_id
      JOIN jogadores j ON j.puuid = e.puuid
      WHERE j.has_premium = 1 AND p.queue_id IN (${QUEUES_RANKED.join(',')})
        AND p.game_creation >= ?
      GROUP BY e.puuid, p.queue_id`,
    params: [d7, d7, d15, d15, d30]
  };
}

// 3) Histórico total por (jogador × fila): quantas partidas existem no banco e
// quando foi a primeira/última. É o que diz ao usuário até onde o filtro de
// datas pode ir — e o card mostra "sem partidas" em vez de um zero sem contexto.
export const SQL_PREMIUM_HISTORICO = `
  SELECT e.puuid, p.queue_id, COUNT(*) total,
         MIN(p.game_creation) primeira, MAX(p.game_creation) ultima
  FROM estatisticas_jogador_partida e
  JOIN partidas p ON p.match_id = e.match_id
  JOIN jogadores j ON j.puuid = e.puuid
  WHERE j.has_premium = 1 AND p.queue_id IN (${QUEUES_RANKED.join(',')})
    AND p.game_creation > 0
  GROUP BY e.puuid, p.queue_id`;
