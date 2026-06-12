/**
 * Motor de Sinergia v2 (Tribo). Determinístico, score normalizado 0–1.
 *
 *   scoreIndividual = W_PROF·proficiencia + W_META·metaScore + W_ROTA·roleFit
 *   scoreDeTime     = Σ scoreIndividual + W_TIME·(aderenciaArquetipo + sinergiaDePares + balanceamento)
 *
 * - proficiencia: força real do jogador no campeão (utils/proficiencia.js).
 * - metaScore: tier list manual (data/meta-tiers.csv); ausência = 0.5 neutro;
 *   meta > 30 dias decai 50% rumo ao neutro.
 * - vetores táticos de 8 dimensões + cc/scaling/mechTags (data/sinergia-champs.csv).
 * - arquétipos (ENGAGE/POKE/PROTECT/PICK/SPLITPUSH) e pares sinérgicos.
 * A composição é resolvida por OTIMIZAÇÃO GLOBAL (produto cartesiano dos top K
 * por slot), não mais por preenchimento guloso. Dados ausentes degradam para
 * neutro, nunca para zero ou crash.
 */

import synergyCsvRaw from '../data/sinergia-champs.csv?raw';
import metaCsvRaw from '../data/meta-tiers.csv?raw';

/**
 * Pesos centrais do score final (motor v2). Tudo normalizado 0–1 ANTES de pesar:
 *   scoreFinal = W_PROF·proficiencia + W_META·metaScore + W_TIME·fitDeTime + W_ROTA·roleFit
 * O meta PONDERA, nunca domina: campeão fora do meta com proficiência alta segue competitivo.
 */
export const SCORE_WEIGHTS = {
  W_PROF: 0.40,
  W_META: 0.20,
  W_TIME: 0.30,
  W_ROTA: 0.10
};

// ----------------------------------------------------------------------
// META PONDERADA (lê meta-tiers.csv manual; ver Anexo A do planner p/ atualizar)
// ----------------------------------------------------------------------
const META_TIER_VALUES = { S: 1.0, A: 0.8, B: 0.6, C: 0.4, D: 0.25 };
const META_NEUTRO = 0.5;
const META_STALE_DIAS = 30;

/**
 * Parser do CSV de meta no estilo do parseSynergyCsv.
 * - 1ª linha de comentário carrega patch e data: "# patch: X | atualizado: YYYY-MM-DD".
 * - table: chave `champion|ROLE` -> { tier, score }.
 * Retorna { patch, updatedAt, table }.
 */
function parseMetaCsv(csvText) {
  const text = String(csvText || '').replace(/\r/g, '');
  const allLines = text.split('\n');

  let patch = '?';
  let updatedAt = '';
  const comentario = allLines.find((line) => line.trim().startsWith('#'));
  if (comentario) {
    const mPatch = comentario.match(/patch:\s*([^|]+)/i);
    const mData = comentario.match(/atualizado:\s*([0-9-]+)/i);
    if (mPatch) patch = mPatch[1].trim();
    if (mData) updatedAt = mData[1].trim();
  }

  const rows = allLines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const table = {};
  // pula o cabeçalho (champion,role,tier) se presente
  const dataRows = rows.length && rows[0].toLowerCase().startsWith('champion,') ? rows.slice(1) : rows;
  for (const row of dataRows) {
    const cells = row.split(',').map((part) => part.trim());
    const champion = cells[0];
    const role = String(cells[1] || '').toUpperCase();
    const tier = String(cells[2] || '').toUpperCase();
    if (!champion || !role || META_TIER_VALUES[tier] === undefined) continue;
    table[`${champion}|${role}`] = { tier, score: META_TIER_VALUES[tier] };
  }

  return { patch, updatedAt, table };
}

export const META_DATA = parseMetaCsv(metaCsvRaw);

/** Meta com mais de 30 dias (ou data inválida) perde confiança. */
export function metaIsStale(metaData = META_DATA, agora = Date.now()) {
  const updatedAt = Date.parse(metaData?.updatedAt || '');
  if (!Number.isFinite(updatedAt)) return true;
  return (agora - updatedAt) / 86400000 > META_STALE_DIAS;
}

/** Tier bruto (S/A/B/C/D) do campeão na rota, ou null se ausente. */
export function metaTierOf(champion, role, metaData = META_DATA) {
  const entry = metaData?.table?.[`${champion}|${String(role || '').toUpperCase()}`];
  return entry ? entry.tier : null;
}

const META_TIER_ORDEM = { S: 5, A: 4, B: 3, C: 2, D: 1 };

/**
 * Top campeões do meta (melhor tier por campeão), excluindo nomes informados.
 * Quando `role` é informado, considera apenas o tier daquela rota.
 * Retorna [{ name, tier, role }] ordenado por tier desc.
 */
export function topMetaChampions(excludeNames = [], limit = 5, role = null, metaData = META_DATA) {
  const exclude = new Set(excludeNames);
  const roleFiltro = role ? String(role).toUpperCase() : null;
  const melhorPorChamp = {};
  for (const [chave, entry] of Object.entries(metaData?.table || {})) {
    const sep = chave.lastIndexOf('|');
    const champ = chave.slice(0, sep);
    const roleDaChave = chave.slice(sep + 1);
    if (exclude.has(champ)) continue;
    if (roleFiltro && roleDaChave !== roleFiltro) continue;
    const val = META_TIER_ORDEM[entry.tier] || 0;
    if (!melhorPorChamp[champ] || val > melhorPorChamp[champ].val) {
      melhorPorChamp[champ] = { tier: entry.tier, role: roleDaChave, val };
    }
  }
  return Object.entries(melhorPorChamp)
    .sort((a, b) => b[1].val - a[1].val || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, d]) => ({ name, tier: d.tier, role: d.role }));
}

/**
 * Score de meta 0–1. Ausência de dado NÃO é punição: retorna 0.5 (neutro).
 * Meta desatualizado (>30 dias) decai 50% em direção ao neutro.
 */
export function metaScore(champion, role, metaData = META_DATA, agora = Date.now()) {
  const entry = metaData?.table?.[`${champion}|${String(role || '').toUpperCase()}`];
  let score = entry ? entry.score : META_NEUTRO;
  if (metaIsStale(metaData, agora)) {
    score = META_NEUTRO + (score - META_NEUTRO) * 0.5;
  }
  return score;
}

const DEFAULT_CHAMP_TAGS = {
  Teste: { engage: 0, poke: 0, frontline: 0, burst: 0, disengage: 0, utility: 0, peel: 0, waveclear: 0, damageType: 'AP' },
};

export const FALLBACK_TAGS = {
  engage: 2,
  poke: 2,
  frontline: 2,
  burst: 2,
  disengage: 2,
  utility: 2,
  peel: 2,
  waveclear: 2,
  cc: 2,
  scaling: 3,
  mechTags: [],
  damageType: 'AD',
  roles: []
};

const DIMENSIONS = ['engage', 'poke', 'frontline', 'burst', 'disengage', 'utility', 'peel', 'waveclear'];

const TAG_VECTOR_DELTA = {
  Tank: { frontline: 2, engage: 1, peel: 1, disengage: 1 },
  Fighter: { frontline: 1, engage: 1, burst: 1, waveclear: 1 },
  Mage: { poke: 2, burst: 2, waveclear: 1, utility: 1 },
  Assassin: { burst: 2, engage: 1, disengage: 1 },
  Marksman: { poke: 1, burst: 1, waveclear: 1 },
  Support: { utility: 2, peel: 2, disengage: 1 }
};

const ROLE_PREFERRED_TAGS = {
  TOP: ['Tank', 'Fighter'],
  JUNGLE: ['Fighter', 'Assassin', 'Tank'],
  MID: ['Mage', 'Assassin'],
  ADC: ['Marksman'],
  SUP: ['Support', 'Tank']
};

function normalizeDamageType(value) {
  const normalized = String(value || 'AD').trim().toUpperCase();
  if (normalized === 'AP' || normalized === 'MIXED') return normalized;
  return 'AD';
}

function toMetric(value, fallback = 0) {
  const parsed = Number(String(value || '').trim().replace(',', '.'));
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, 0, 5);
}

function normalizeRoles(value) {
  return String(value || '')
    .split(';')
    .map((role) => role.trim().toUpperCase())
    .filter(Boolean)
    .filter((role, index, list) => list.indexOf(role) === index);
}

function normalizeMechTags(value) {
  return String(value || '')
    .split(';')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index);
}

function parseSynergyCsv(csvText) {
  const text = String(csvText || '').replace(/\r/g, '');
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  if (!rows.length) return {};

  const headers = rows[0].split(',').map((part) => part.trim());
  const required = ['champion', 'damageType', ...DIMENSIONS];
  const hasRequired = required.every((key) => headers.includes(key));
  if (!hasRequired) return {};

  const table = {};
  for (const row of rows.slice(1)) {
    const cells = row.split(',').map((part) => part.trim());
    if (!cells.length) continue;

    const record = {};
    for (let i = 0; i < headers.length; i += 1) {
      record[headers[i]] = cells[i] || '';
    }

    const champion = String(record.champion || '').trim();
    if (!champion) continue;

    table[champion] = {
      damageType: normalizeDamageType(record.damageType),
      engage: toMetric(record.engage, 2),
      poke: toMetric(record.poke, 2),
      frontline: toMetric(record.frontline, 2),
      burst: toMetric(record.burst, 2),
      disengage: toMetric(record.disengage, 2),
      utility: toMetric(record.utility, 2),
      peel: toMetric(record.peel, 2),
      waveclear: toMetric(record.waveclear, 2),
      // Novas colunas (FASE 3): defaults cc=2, scaling=3, mechTags=[]
      cc: 'cc' in record ? toMetric(record.cc, 2) : 2,
      scaling: 'scaling' in record ? clamp(Number(record.scaling) || 3, 1, 5) : 3,
      mechTags: normalizeMechTags(record.mechTags),
      roles: normalizeRoles(record.roles)
    };
  }

  return table;
}

function loadChampionTagsFromSpreadsheet() {
  try {
    const parsed = parseSynergyCsv(synergyCsvRaw);
    if (Object.keys(parsed).length > 0) {
      return parsed;
    }
  } catch (error) {
    console.warn('Falha ao carregar planilha de sinergia, usando fallback interno:', error?.message || error);
  }

  return { ...DEFAULT_CHAMP_TAGS };
}

export const CHAMP_TAGS = loadChampionTagsFromSpreadsheet();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function fallbackFromTags(championTags = []) {
  const vector = { ...FALLBACK_TAGS, mechTags: [] };

  for (const tag of championTags) {
    const delta = TAG_VECTOR_DELTA[tag];
    if (!delta) continue;
    for (const key of Object.keys(delta)) {
      vector[key] = clamp((vector[key] || 0) + delta[key], 0, 5);
    }
  }

  const hasAPTag = championTags.includes('Mage') || championTags.includes('Support');
  const hasADTag = championTags.includes('Marksman') || championTags.includes('Fighter') || championTags.includes('Assassin');
  if (hasAPTag && hasADTag) vector.damageType = 'MIXED';
  else if (hasAPTag) vector.damageType = 'AP';
  else vector.damageType = 'AD';

  return vector;
}

// Cache de métricas (perf da otimização global): campeões da planilha são
// determinísticos por nome — ca-se o objeto (somente leitura por convenção).
const _metricsCache = new Map();

export function getChampionMetrics(championName, championTags = []) {
  const cached = _metricsCache.get(championName);
  if (cached) return cached;

  const metricsFromSheet = CHAMP_TAGS[championName];
  if (metricsFromSheet) {
    const result = {
      ...metricsFromSheet,
      roles: Array.isArray(metricsFromSheet.roles) ? [...metricsFromSheet.roles] : [],
      mechTags: Array.isArray(metricsFromSheet.mechTags) ? [...metricsFromSheet.mechTags] : []
    };
    _metricsCache.set(championName, result);
    return result;
  }
  // Fora da planilha: fallback dependente das tags — não cacheamos.
  return fallbackFromTags(championTags);
}

export function roleFitScore(slotRole, candidateTags = []) {
  const preferred = ROLE_PREFERRED_TAGS[slotRole] || [];
  if (!preferred.length) return 0.5;
  if (candidateTags.some((tag) => preferred.includes(tag))) return 1;
  return 0.45;
}

// roleFitScore devolve 0.45–1; re-escalamos para 0–1 para entrar no score ponderado.
function roleFitNormalizado(slotRole, tags) {
  return clamp((roleFitScore(slotRole, tags) - 0.45) / 0.55, 0, 1);
}

// ----------------------------------------------------------------------
// SINERGIA DE PARES (FASE 3.2)
// ----------------------------------------------------------------------
const PARES_SINERGICOS = [
  ['fornece_knockup', 'aproveita_knockup', 1.0],
  ['hypercarry', 'enchanter', 0.9],
  ['hypercarry', 'peel_forte', 0.6],
  ['buffa_ataque', 'aproveita_buff_ataque', 0.8],
  ['setup_area', 'dano_area', 0.8],
  ['engage_global', 'followup_engage', 0.6],
  ['pick_cc', 'burst_assassino', 0.7]
];
const TETO_PARES = 4.0;

function nomesDoTime(time) {
  return (time || [])
    .map((c) => (typeof c === 'string' ? c : c?.name))
    .filter(Boolean);
}

/**
 * Soma bônus de pares complementares entre campeões DISTINTOS.
 * Cap de 1 ocorrência por dupla de tags por par de campeões.
 * Retorna { score (0–1, teto 4.0), pares: [{a, b, tag, bonus}] }.
 */
export function sinergiaDePares(time) {
  const nomes = nomesDoTime(time);
  const tagsPorChamp = nomes.map((n) => ({ name: n, tags: new Set(getChampionMetrics(n).mechTags || []) }));

  const pares = [];
  let soma = 0;
  const vistos = new Set();

  for (const [tagA, tagB, bonus] of PARES_SINERGICOS) {
    for (let i = 0; i < tagsPorChamp.length; i += 1) {
      for (let j = 0; j < tagsPorChamp.length; j += 1) {
        if (i === j) continue;
        if (!tagsPorChamp[i].tags.has(tagA) || !tagsPorChamp[j].tags.has(tagB)) continue;
        const chave = `${i}-${j}-${tagA}-${tagB}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        soma += bonus;
        pares.push({ a: tagsPorChamp[i].name, b: tagsPorChamp[j].name, tag: `${tagA}→${tagB}`, bonus });
      }
    }
  }

  return { score: clamp(soma / TETO_PARES, 0, 1), pares };
}

// ----------------------------------------------------------------------
// ARQUÉTIPOS (FASE 3.3)
// ----------------------------------------------------------------------
const ARQUETIPOS = {
  ENGAGE:    { requisitos: { engage: 14, frontline: 10, cc: 8 }, bonusTags: ['setup_area', 'dano_area'] },
  POKE:      { requisitos: { poke: 14, disengage: 10, waveclear: 10 } },
  PROTECT:   { requisitos: { peel: 12, utility: 10 }, exigeTag: 'hypercarry' },
  PICK:      { requisitos: { burst: 14, cc: 8 }, bonusTags: ['pick_cc', 'burst_assassino'] },
  SPLITPUSH: { requisitos: { waveclear: 12 }, exigeTag: 'splitpush', requisitosSecundarios: { disengage: 8 } }
};

const DIMS_COM_CC = [...DIMENSIONS, 'cc'];

function somaDimensoesTime(nomes) {
  const soma = {};
  for (const d of DIMS_COM_CC) soma[d] = 0;
  const tagsPresentes = new Set();
  for (const n of nomes) {
    const m = getChampionMetrics(n);
    for (const d of DIMS_COM_CC) soma[d] += Number(m[d] || 0);
    for (const t of m.mechTags || []) tagsPresentes.add(t);
  }
  return { soma, tagsPresentes };
}

function aderenciaDeUmArquetipo(def, soma, tagsPresentes) {
  const reqs = Object.entries(def.requisitos || {});
  let acc = 0;
  for (const [dim, req] of reqs) acc += Math.min(1, (soma[dim] || 0) / req);
  let aderencia = reqs.length ? acc / reqs.length : 0;

  if (def.requisitosSecundarios) {
    const r2 = Object.entries(def.requisitosSecundarios);
    let acc2 = 0;
    for (const [dim, req] of r2) acc2 += Math.min(1, (soma[dim] || 0) / req);
    aderencia = aderencia * 0.8 + (r2.length ? acc2 / r2.length : 0) * 0.2;
  }
  if (def.bonusTags) {
    const presentes = def.bonusTags.filter((t) => tagsPresentes.has(t)).length;
    if (presentes) aderencia += Math.min(0.1, 0.05 * presentes);
  }
  if (def.exigeTag && !tagsPresentes.has(def.exigeTag)) aderencia -= 0.3;
  return clamp(aderencia, 0, 1);
}

/** Retorna { melhor, aderencia, ranking } para o time informado. */
export function aderenciaArquetipo(time) {
  const nomes = nomesDoTime(time);
  const { soma, tagsPresentes } = somaDimensoesTime(nomes);

  const ranking = Object.entries(ARQUETIPOS)
    .map(([nome, def]) => ({ arquetipo: nome, aderencia: round2(aderenciaDeUmArquetipo(def, soma, tagsPresentes)) }))
    .sort((a, b) => b.aderencia - a.aderencia);

  const melhor = ranking[0] || { arquetipo: 'ENGAGE', aderencia: 0 };
  return { melhor: melhor.arquetipo, aderencia: melhor.aderencia, ranking };
}

// Ajustes de balanceamento (damageType saturado; curva de scaling incoerente).
function balanceamentoTime(nomes) {
  let adj = 0;
  const counts = { AD: 0, AP: 0, MIXED: 0 };
  let somaScaling = 0;
  let n = 0;
  let temSplit = false;
  let temPoke = false;

  for (const name of nomes) {
    const m = getChampionMetrics(name);
    counts[m.damageType] = (counts[m.damageType] || 0) + 1;
    somaScaling += Number(m.scaling || 3);
    n += 1;
    if ((m.mechTags || []).includes('splitpush')) temSplit = true;
    if (Number(m.poke || 0) >= 4) temPoke = true;
  }

  if (counts.AD >= 4 || counts.AP >= 4) adj -= 0.05;   // 4+ do mesmo damageType
  if (n) {
    const media = somaScaling / n;
    if ((media < 2 || media > 4) && !temSplit && !temPoke) adj -= 0.05; // curva incoerente
  }
  return adj;
}

/**
 * fitDeTime(candidato, timeAtual) — substitui o fit tático (FASE 3.4).
 * = ganho de aderência do melhor arquétipo (com − sem, reescalado 0–1)
 *   + 0.5 * ganho de sinergia de pares + ajustes de balanceamento. Clamp 0–1.
 */
export function fitDeTime(candidato, timeAtual) {
  const nomes = nomesDoTime(timeAtual);
  const nome = typeof candidato === 'string' ? candidato : candidato?.name;
  const comNome = [...nomes, nome].filter(Boolean);

  const ganhoArq = aderenciaArquetipo(comNome).aderencia - aderenciaArquetipo(nomes).aderencia;
  const ganhoPares = sinergiaDePares(comNome).score - sinergiaDePares(nomes).score;
  const balance = balanceamentoTime(comNome);

  // 0.5 neutro; ganho de arquétipo (peso 2) e de pares (peso 0.5) deslocam a partir daí
  return clamp(0.5 + ganhoArq * 2 + 0.5 * ganhoPares + balance, 0, 1);
}

// ----------------------------------------------------------------------
// OTIMIZAÇÃO GLOBAL (FASE 4) — score individual e componente de time
// ----------------------------------------------------------------------

/** Score individual do candidato (SEM fitDeTime): W_PROF·prof + W_META·meta + W_ROTA·roleFit. */
export function scoreIndividual(candidate, slotRole) {
  const { W_PROF, W_META, W_ROTA } = SCORE_WEIGHTS;
  const prof = clamp(Number(candidate?.proficiencia ?? 0.35), 0, 1);
  const meta = metaScore(candidate?.name, slotRole);
  const roleFit = roleFitNormalizado(slotRole, candidate?.tags || []);
  return round2(W_PROF * prof + W_META * meta + W_ROTA * roleFit);
}

/**
 * Avaliação completa do time numa passada só (perf da otimização global):
 * computa arquétipo + pares + balanceamento uma única vez.
 * Retorna { arquetipo, aderencia, ranking, pares, componente }.
 */
export function avaliarTime(time) {
  const nomes = nomesDoTime(time);
  const arq = aderenciaArquetipo(nomes);
  const pares = sinergiaDePares(nomes);
  const componente = arq.aderencia + pares.score + balanceamentoTime(nomes);
  return { arquetipo: arq.melhor, aderencia: arq.aderencia, ranking: arq.ranking, pares: pares.pares, componente };
}

/**
 * Similaridade de estilo 0–1: cosseno entre o vetor 8D do candidato e a média
 * ponderada (por proficiência) dos vetores dos top campeões do jogador.
 * topChamps: [{ name, proficiencia }].
 */
export function similaridadeDeEstilo(championName, topChamps = []) {
  const media = {};
  for (const d of DIMENSIONS) media[d] = 0;
  let somaPeso = 0;
  for (const tc of topChamps) {
    const w = Number(tc?.proficiencia ?? 0.5);
    const m = getChampionMetrics(tc?.name);
    for (const d of DIMENSIONS) media[d] += w * Number(m[d] || 0);
    somaPeso += w;
  }
  if (somaPeso > 0) for (const d of DIMENSIONS) media[d] /= somaPeso;

  const mv = getChampionMetrics(championName);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const d of DIMENSIONS) {
    dot += Number(mv[d] || 0) * media[d];
    na += Number(mv[d] || 0) ** 2;
    nb += media[d] ** 2;
  }
  if (na === 0 || nb === 0) return 0;
  return clamp(dot / (Math.sqrt(na) * Math.sqrt(nb)), 0, 1);
}

/** Score do time 0–100 baseado na aderência do melhor arquétipo. */
export function scoreToPercent(time) {
  return Math.round(aderenciaArquetipo(time).aderencia * 100);
}
