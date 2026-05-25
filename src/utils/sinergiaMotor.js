/**
 * Tactical synergy engine used by Tribo auto-composition.
 * It is deterministic and focuses on filling empty slots only.
 */

import synergyCsvRaw from '../data/sinergia-champs.csv?raw';

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
  const vector = { ...FALLBACK_TAGS };

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

export function getChampionMetrics(championName, championTags = []) {
  const metricsFromSheet = CHAMP_TAGS[championName];
  if (metricsFromSheet) {
    return {
      ...metricsFromSheet,
      roles: Array.isArray(metricsFromSheet.roles) ? [...metricsFromSheet.roles] : []
    };
  }
  return fallbackFromTags(championTags);
}

export function roleFitScore(slotRole, candidateTags = []) {
  const preferred = ROLE_PREFERRED_TAGS[slotRole] || [];
  if (!preferred.length) return 0.5;
  if (candidateTags.some((tag) => preferred.includes(tag))) return 1;
  return 0.45;
}

function masteryBonus(masteryPoints = 0) {
  if (!masteryPoints) return 0;
  return round2(Math.log10(Number(masteryPoints) + 1) * 2);
}

function diversityBonus(metrics, snapshotAtual, target) {
  let bonus = 0;
  for (const dim of DIMENSIONS) {
    const deficit = Math.max(0, target[dim] - snapshotAtual[dim]);
    if (deficit >= 2 && metrics[dim] >= 3) bonus += 0.9;
  }
  return round2(bonus);
}

function redundancyPenalty(metrics, snapshotAtual, target) {
  let penalty = 0;
  for (const dim of DIMENSIONS) {
    if (snapshotAtual[dim] > target[dim] * 1.2 && metrics[dim] >= 3) penalty += 0.8;
  }
  return round2(penalty);
}

function hardConflictPenalty(metrics, snapshotAtual, target) {
  let penalty = 0;
  if (snapshotAtual.frontline < Math.max(1, target.frontline - 2) && metrics.frontline <= 1) penalty += 1.4;
  if (snapshotAtual.engage < Math.max(1, target.engage - 2) && metrics.engage <= 1) penalty += 1.1;
  return round2(penalty);
}

function tacticalDot(metrics, needVector) {
  let score = 0;
  for (const dim of DIMENSIONS) {
    score += (metrics[dim] || 0) * (needVector[dim] || 0);
  }
  return score;
}

function buildTarget(activeSlotCount = 5) {
  const scale = clamp(activeSlotCount / 5, 0.4, 1);
  const full = {
    engage: 12,
    poke: 10,
    frontline: 10,
    burst: 10,
    disengage: 8,
    utility: 8,
    peel: 8,
    waveclear: 8
  };

  const target = {};
  for (const dim of DIMENSIONS) {
    target[dim] = Math.max(1, Math.round(full[dim] * scale));
  }
  return target;
}

export function calcularNecessidadeDoTime(campeoesTrancados, options = {}) {
  const activeSlotCount = Number(options.activeSlotCount || 5);
  const getTagsByChampion = options.getTagsByChampion || (() => []);

  const snapshotAtual = {
    engage: 0,
    poke: 0,
    frontline: 0,
    burst: 0,
    disengage: 0,
    utility: 0,
    peel: 0,
    waveclear: 0,
    AD: 0,
    AP: 0,
    MIXED: 0
  };

  for (const name of campeoesTrancados || []) {
    if (!name) continue;
    const metrics = getChampionMetrics(name, getTagsByChampion(name));
    for (const dim of DIMENSIONS) {
      snapshotAtual[dim] += Number(metrics[dim] || 0);
    }

    if (metrics.damageType === 'AD') snapshotAtual.AD += 1;
    else if (metrics.damageType === 'AP') snapshotAtual.AP += 1;
    else snapshotAtual.MIXED += 1;
  }

  const target = buildTarget(activeSlotCount);
  const vetorNecessidade = {};
  for (const dim of DIMENSIONS) {
    vetorNecessidade[dim] = clamp(target[dim] - snapshotAtual[dim], 1, 15);
  }

  const adCount = snapshotAtual.AD + snapshotAtual.MIXED * 0.5;
  const apCount = snapshotAtual.AP + snapshotAtual.MIXED * 0.5;

  vetorNecessidade.precisaAD = adCount === 0 ? 5 : adCount > apCount + 1 ? 1 : 3;
  vetorNecessidade.precisaAP = apCount === 0 ? 5 : apCount > adCount + 1 ? 1 : 3;

  return { snapshotAtual, vetorNecessidade, target };
}

export function encontrarMelhorPick(context) {
  const {
    vetorNecessidade,
    snapshotAtual,
    target,
    poolCampeoesCandidatos,
    slotRole,
    pickedChampions = []
  } = context;

  const used = new Set(pickedChampions);
  let best = null;

  const weights = {
    alpha: 1.0,
    beta: 0.55,
    gamma: 0.35,
    delta: 0.25,
    epsilon: 0.3,
    lambda: 0.4,
    mu: 0.6
  };

  for (const candidate of poolCampeoesCandidatos || []) {
    const name = candidate?.name;
    if (!name || used.has(name)) continue;

    const tags = candidate?.tags || [];
    const metrics = candidate?.metrics || getChampionMetrics(name, tags);

    const tacticalScore = tacticalDot(metrics, vetorNecessidade);
    const roleScore = roleFitScore(slotRole, tags) * 10;
    const masteryScore = masteryBonus(candidate?.masteryPoints || 0);
    const diversity = diversityBonus(metrics, snapshotAtual, target);
    const redundancy = redundancyPenalty(metrics, snapshotAtual, target);
    const conflict = hardConflictPenalty(metrics, snapshotAtual, target);

    let damageBalanceFactor = 1;
    if (metrics.damageType === 'AD') damageBalanceFactor *= vetorNecessidade.precisaAD / 3;
    else if (metrics.damageType === 'AP') damageBalanceFactor *= vetorNecessidade.precisaAP / 3;
    else damageBalanceFactor *= ((vetorNecessidade.precisaAD + vetorNecessidade.precisaAP) / 2) / 3;

    const raw =
      weights.alpha * tacticalScore +
      weights.beta * roleScore +
      weights.gamma * masteryScore +
      weights.delta * diversity -
      weights.lambda * redundancy -
      weights.mu * conflict;

    const finalScore = round2(raw * damageBalanceFactor + weights.epsilon * 2);

    const candidateResult = {
      name,
      score: finalScore,
      breakdown: {
        tacticalScore: round2(tacticalScore),
        roleScore: round2(roleScore),
        masteryScore,
        diversity,
        redundancy,
        conflict,
        damageBalanceFactor: round2(damageBalanceFactor)
      },
      primaryNeed: [...DIMENSIONS].sort((a, b) => vetorNecessidade[b] - vetorNecessidade[a])[0] || 'engage',
      usedFallback: Boolean(candidate?.usedFallback)
    };

    if (!best) {
      best = candidateResult;
      continue;
    }

    if (candidateResult.score > best.score) {
      best = candidateResult;
      continue;
    }

    if (candidateResult.score === best.score) {
      const pointsA = Number(candidate?.masteryPoints || 0);
      const pointsB = Number((poolCampeoesCandidatos.find((it) => it.name === best.name) || {}).masteryPoints || 0);
      if (pointsA > pointsB || (pointsA === pointsB && name.localeCompare(best.name) < 0)) {
        best = candidateResult;
      }
    }
  }

  return best;
}

export function scoreToPercent(snapshotAtual, target) {
  const ratios = DIMENSIONS.map((dim) => {
    const required = Math.max(1, Number(target[dim] || 1));
    const current = Number(snapshotAtual[dim] || 0);
    return Math.min(1, current / required);
  });

  const avg = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  return Math.max(0, Math.min(100, Math.round(avg * 100)));
}
