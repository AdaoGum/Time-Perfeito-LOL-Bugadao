/**
 * Catálogo de Campeões & Relíquias (Panteão / Itens / Meta).
 *
 * Cruza três fontes, sempre com degradação graciosa:
 *  - sinergia-champs.csv (via sinergiaMotor): vetores 8D, damageType, roles;
 *  - meta-tiers.csv (via sinergiaMotor): tier S–D por rota + WR/PR/BR opcionais;
 *  - builds-champs.json: relíquias recomendadas (override por campeão → arquétipo).
 * IDs de item que não existirem no item.json do patch atual são filtrados —
 * campeão/item sem dado exibe fallback neutro, nunca quebra.
 */

import buildsData from '../data/builds-champs.json';
import metaBuildsData from '../data/meta-builds.json';
import { CHAMP_TAGS, META_DATA, getChampionMetrics } from './sinergiaMotor.js';

// Rotas oficiais do app (mesma grafia dos CSVs) com rótulo e ícone FontAwesome.
export const ROLES = [
  { key: 'TOP', label: 'Topo', icon: 'fa-shield-halved' },
  { key: 'JUNGLE', label: 'Selva', icon: 'fa-tree' },
  { key: 'MID', label: 'Meio', icon: 'fa-wand-sparkles' },
  { key: 'ADC', label: 'Atirador', icon: 'fa-crosshairs' },
  { key: 'SUP', label: 'Suporte', icon: 'fa-hand-holding-medical' }
];

export const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];

// Classes literais por tier (Tailwind precisa "ver" as strings completas).
// Compartilhado entre Panteão, Tier List e badges avulsos.
export const TIER_STYLES = {
  S: { badge: 'border-rose-500/70 bg-rose-500/15 text-rose-300', row: 'border-rose-500/40 bg-rose-950/20', dot: 'bg-rose-400' },
  A: { badge: 'border-amber-500/70 bg-amber-500/15 text-amber-300', row: 'border-amber-500/40 bg-amber-950/20', dot: 'bg-amber-400' },
  B: { badge: 'border-sky-500/70 bg-sky-500/15 text-sky-300', row: 'border-sky-500/40 bg-sky-950/20', dot: 'bg-sky-400' },
  C: { badge: 'border-emerald-500/70 bg-emerald-500/15 text-emerald-300', row: 'border-emerald-500/40 bg-emerald-950/20', dot: 'bg-emerald-400' },
  D: { badge: 'border-slate-500/70 bg-slate-500/15 text-slate-300', row: 'border-slate-600/40 bg-slate-900/40', dot: 'bg-slate-400' }
};

// Tradução das tags de classe do Data Dragon.
export const TAG_LABELS = {
  Fighter: 'Lutador',
  Tank: 'Tanque',
  Mage: 'Mago',
  Assassin: 'Assassino',
  Marksman: 'Atirador',
  Support: 'Suporte'
};

export const DAMAGE_LABELS = {
  AD: 'Físico (AD)',
  AP: 'Mágico (AP)',
  MIXED: 'Misto (AD+AP)'
};

// Dimensões táticas exibidas no radar da ficha (escala CSV 0–5 → 0–100 na UI).
export const TACTICAL_DIMENSIONS = [
  { key: 'engage', label: 'Engage' },
  { key: 'poke', label: 'Poke' },
  { key: 'frontline', label: 'Frontline' },
  { key: 'burst', label: 'Burst' },
  { key: 'disengage', label: 'Disengage' },
  { key: 'utility', label: 'Utilidade' },
  { key: 'peel', label: 'Peel' },
  { key: 'waveclear', label: 'Waveclear' }
];

// Busca sem acento/caixa (para casar "Chogath" com "Cho'Gath" etc.).
export function normalizeSearch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Nome de exibição (pt_BR) → campeão do Data Dragon. Usado por toda tela que só tem
// o NOME do campeão (meta, maestrias, histórico) e precisa do objeto para o
// ChampionCard/ChampionSheet. O índice é memoizado pela própria lista: enquanto o
// `championList` do store for o mesmo array, não remonta o mapa.
// Campeão desconhecido (fora do patch) devolve `{ name }` — os componentes trabalham
// só com o nome e degradam sem quebrar.
// Nossos CSVs guardam dois nomes que não batem com o rótulo pt_BR do Data Dragon.
// Sem o apelido eles caem no fallback `{ name }` e perdem tags/título/key (a arte
// continua certa, porque o ID vem do CHAMPION_KEY_OVERRIDES em utils.js).
const APELIDOS_DDRAGON = {
  Bard: 'Bardo',
  'Nunu & Willump': 'Nunu e Willump'
};

let _byNameList = null;
let _byNameMap = null;
export function championByName(championList, name) {
  if (_byNameList !== championList) {
    _byNameList = championList || [];
    _byNameMap = {};
    for (const champ of _byNameList) _byNameMap[champ.name] = champ;
  }
  return _byNameMap[name] || _byNameMap[APELIDOS_DDRAGON[name]] || { name };
}

// Tags DDragon → rotas prováveis (fallback p/ campeão fora da planilha de sinergia).
const TAG_TO_ROLES = {
  Marksman: ['ADC'],
  Support: ['SUP'],
  Mage: ['MID'],
  Assassin: ['MID', 'JUNGLE'],
  Fighter: ['TOP', 'JUNGLE'],
  Tank: ['TOP', 'SUP']
};

/**
 * Rotas do campeão: planilha de sinergia primeiro; senão deriva das tags DDragon.
 * `champ` = objeto do championList do Data Dragon ({ name, tags, ... }).
 */
export function rolesOf(champ) {
  const fromSheet = CHAMP_TAGS[champ?.name]?.roles;
  if (Array.isArray(fromSheet) && fromSheet.length) return fromSheet;
  const derived = [];
  for (const tag of champ?.tags || []) {
    for (const role of TAG_TO_ROLES[tag] || []) {
      if (!derived.includes(role)) derived.push(role);
    }
  }
  return derived.length ? derived : ['MID'];
}

// ----------------------------------------------------------------------
// BUILDS RECOMENDADAS (builds-champs.json): até 3 opções, cada uma com runas + itens
// ----------------------------------------------------------------------

/**
 * Rotas do campeão INCLUINDO as que ele ocupa no meta do patch.
 *
 * `rolesOf` responde "quais são as rotas DELE" (identidade, da planilha de sinergia);
 * o `meta-tiers.csv` traz também as rotas fora do padrão que o patch mostra — Riven no
 * meio, Naafiri na selva, Veigar de atirador. As duas listas divergem em 43 das 273
 * entradas do meta, quase todas com pickrate baixo (mediana 1%).
 *
 * Onde a tela fala do META (ícones do card, rotas com build na ficha), o certo é a
 * UNIÃO: senão o campeão aparece na coluna do meio com o ícone de topo, e a build
 * daquela rota — que existe no meta-builds.json — fica inalcançável.
 *
 * NÃO substitui o `rolesOf` porque ele também escolhe o preset de build por classe
 * (`classPresetChain`): somar uma rota de 0,6% de pickrate ali trocaria a build padrão
 * do campeão. A rota principal vem primeiro; as do meta entram depois.
 */
export function rolesWithMeta(champ) {
  const todas = [];
  for (const r of rolesOf(champ)) if (!todas.includes(r)) todas.push(r);
  for (const e of metaEntriesOf(champ?.name)) if (!todas.includes(e.role)) todas.push(e.role);
  return todas;
}

/**
 * Cadeia ORDENADA de presets (até 3) por classe/dano/rota. O 1º é o melhor encaixe;
 * os seguintes são alternativas de estilo. Sempre tenta devolver 3 opções.
 */
function classPresetChain(champ) {
  const tags = champ?.tags || [];
  const metrics = getChampionMetrics(champ?.name, tags);
  const damageType = metrics?.damageType || 'AD';
  const roles = rolesOf(champ);
  const primary = tags[0] || 'Fighter';
  const onlySup = roles.length > 0 && roles.every((r) => r === 'SUP');

  if (primary === 'Marksman') return ['MARKSMAN_CRIT', 'MARKSMAN_ONHIT', 'MARKSMAN_LETHALITY'];
  if (primary === 'Assassin') {
    if (damageType === 'AP') return ['ASSASSIN_AP', 'MAGE_BURST', 'MAGE_BATTLE'];
    return ['ASSASSIN_LETHALITY', 'ASSASSIN_BRUISER', 'FIGHTER_AD'];
  }
  if (primary === 'Mage') {
    if (onlySup) return ['SUPPORT_MAGE', 'MAGE_BURST', 'SUPPORT_ENCHANTER'];
    if (Number(metrics?.scaling || 3) >= 4) return ['MAGE_SCALING', 'MAGE_BURST', 'MAGE_BATTLE'];
    return ['MAGE_BURST', 'MAGE_BATTLE', 'MAGE_SCALING'];
  }
  if (primary === 'Tank') {
    if (roles.includes('SUP')) return ['SUPPORT_TANK', 'TANK_ENGAGE', 'TANK'];
    return ['TANK', 'TANK_ENGAGE', 'BRUISER_TANK'];
  }
  if (primary === 'Support') {
    const enchanter = Number(metrics?.peel || 0) >= 3 || Number(metrics?.utility || 0) >= 3;
    if (damageType === 'AP' && enchanter) return ['SUPPORT_ENCHANTER', 'SUPPORT_MAGE', 'SUPPORT_TANK'];
    return ['SUPPORT_TANK', 'TANK_ENGAGE', 'SUPPORT_ENCHANTER'];
  }
  // Fighter e afins
  if (damageType === 'AP') return ['MAGE_BATTLE', 'FIGHTER_DIVE', 'MAGE_BURST'];
  if (Number(metrics?.engage || 0) >= 4) return ['FIGHTER_DIVE', 'FIGHTER_AD', 'BRUISER_TANK'];
  return ['FIGHTER_AD', 'FIGHTER_DIVE', 'BRUISER_TANK'];
}

/** Resolve a página de runas (IDs de perk) de um preset, ou null se ausente. */
function runePageOf(presetKey) {
  const preset = buildsData.presets?.[presetKey];
  const page = preset && buildsData.runePages?.[preset.runePage];
  return page || null;
}

/**
 * Até 3 builds recomendadas do campeão. A 1ª usa os itens curados de `champions`
 * (se houver) com a página de runas do melhor preset; as demais vêm dos presets
 * alternativos. Itens ausentes no item.json do patch são filtrados.
 * Retorna [{ key, label, items: [idStr], runes }] — `runes` = página de perks (IDs).
 * `itemsMap` = store.staticData.items (vazio no boot → items: []).
 */
export function buildsFor(champ, itemsMap = {}) {
  const chain = classPresetChain(champ);
  const override = buildsData.champions?.[champ?.name];
  const builds = [];

  chain.forEach((presetKey, idx) => {
    if (builds.length >= 3) return;
    const preset = buildsData.presets?.[presetKey];
    if (!preset) return;
    const useOverride = idx === 0 && Array.isArray(override) && override.length > 0;
    const rawIds = useOverride ? override : preset.items || [];
    const items = rawIds.map((id) => String(id)).filter((id) => Boolean(itemsMap?.[id]));
    builds.push({
      key: presetKey,
      label: useOverride ? 'Build Principal' : preset.label,
      items,
      runes: runePageOf(presetKey)
    });
  });

  return builds;
}

/** Build principal (compat): a 1ª opção de buildsFor, ou um objeto vazio seguro. */
export function buildFor(champ, itemsMap = {}) {
  return buildsFor(champ, itemsMap)[0] || { key: null, label: '', items: [], runes: null };
}

// Mapa inverso item → campeões (calculado uma vez por patch/lista carregada).
let _inverseCache = null;
let _inverseKey = '';

/**
 * Campeões que constroem o item (sinergia inversa). Derivado em runtime da UNIÃO
 * dos itens de todas as builds de TODOS os campeões — nunca mantido à mão.
 */
export function championsForItem(itemId, championList = [], itemsMap = {}) {
  const key = `${championList.length}:${Object.keys(itemsMap).length}`;
  if (!_inverseCache || _inverseKey !== key) {
    _inverseCache = {};
    _inverseKey = key;
    for (const champ of championList) {
      const vistos = new Set();
      for (const build of buildsFor(champ, itemsMap)) {
        for (const id of build.items) {
          if (vistos.has(id)) continue;
          vistos.add(id);
          (_inverseCache[id] = _inverseCache[id] || []).push(champ);
        }
      }
    }
  }
  return _inverseCache[String(itemId)] || [];
}

// ----------------------------------------------------------------------
// META (meta-tiers.csv já parseado pelo sinergiaMotor)
// ----------------------------------------------------------------------

/** Info do patch da tier list manual: { patch, updatedAt }. */
export function metaInfo() {
  return { patch: META_DATA?.patch || '?', updatedAt: META_DATA?.updatedAt || '' };
}

/**
 * Entradas de meta do campeão em todas as rotas onde ele aparece no CSV:
 * [{ role, tier, winrate?, pickrate?, banrate? }] (vazio = sem dados no patch).
 */
export function metaEntriesOf(champName) {
  const entries = [];
  for (const { key } of ROLES) {
    const entry = META_DATA?.table?.[`${champName}|${key}`];
    if (entry) entries.push({ role: key, ...entry });
  }
  return entries;
}

// ----------------------------------------------------------------------
// META-BUILDS (meta-builds.json: build+WR, situacionais, skill order, counters)
// ----------------------------------------------------------------------

/** Entrada raspada do meta (build/skill/counters) do campeão na rota, ou null. */
export function metaBuildFor(champName, role) {
  return metaBuildsData?.builds?.[`${champName}|${String(role || '').toUpperCase()}`] || null;
}

/**
 * Variações da build do meta (até 3) para um campeão×rota.
 *
 * O lolalytics lista, para cada slot final (Item 4/5/6), até 3 opções com winrate e
 * amostra. O scraper guarda isso em `slots`; aqui montamos as builds "em coluna":
 * a 1ª pega a opção mais jogada de cada slot, a 2ª pega a segunda, e assim por diante.
 * Slot com menos opções repete a última — a build alternativa nunca fica com buraco.
 *
 * Sem `slots` (JSON de antes do re-scrape) devolve [] e a ficha mostra a build única.
 */
export function metaBuildVariants(champName, role) {
  const build = metaBuildFor(champName, role);
  const slots = Array.isArray(build?.slots) ? build.slots.filter((s) => s?.length) : [];
  if (!slots.length) return [];

  // Itens que já estão na base: um slot final nunca pode repetir core/botas.
  const base = new Set([...(build.core || []), build.boots].filter(Boolean));
  const total = Math.min(3, Math.max(...slots.map((s) => s.length)));
  const variantes = [];

  for (let i = 0; i < total; i++) {
    const usados = new Set(base);
    let exata = true;
    const items = slots.map((opcoes) => {
      const preferida = opcoes[Math.min(i, opcoes.length - 1)];
      if (opcoes.length <= i) exata = false;
      // O mesmo item costuma aparecer como opção de dois slots (ex.: Item 5 e Item 6).
      // Se já foi escolhido nesta build, cai para a melhor opção ainda livre do slot;
      // se o slot inteiro já foi consumido, o slot SOME — ninguém compra o mesmo item
      // duas vezes, então uma finalização mais curta é mais honesta que repetir.
      if (!usados.has(preferida.id)) {
        usados.add(preferida.id);
        return preferida;
      }
      exata = false;
      const livre = opcoes.find((o) => !usados.has(o.id));
      if (livre) usados.add(livre.id);
      return livre || null;
    }).filter(Boolean);

    // Duas posições podem convergir para a mesma build depois do desempate — mostra uma só.
    const assinatura = items.map((o) => o.id).join('-');
    if (variantes.some((v) => v.items.map((o) => o.id).join('-') === assinatura)) continue;
    variantes.push({ index: variantes.length, exata, items });
  }
  return variantes;
}

/**
 * Counters por rota onde há dado: [{ role, strongAgainst: [ids], counteredBy: [ids] }].
 * IDs são do Data Dragon (ex.: "TahmKench"); o consumidor resolve para o campeão.
 * Vazio quando o campeão não tem counters no meta-builds atual.
 */
export function countersEntriesOf(champName) {
  const out = [];
  for (const { key } of ROLES) {
    const c = metaBuildsData?.builds?.[`${champName}|${key}`]?.counters;
    if (c && ((c.strongAgainst?.length || 0) + (c.counteredBy?.length || 0) > 0)) {
      out.push({ role: key, strongAgainst: c.strongAgainst || [], counteredBy: c.counteredBy || [] });
    }
  }
  return out;
}

/**
 * Tier list de uma rota: { S: [...], A: [...], ... } onde cada item é
 * { name, winrate?, pickrate?, banrate? }. Ordenado por nome dentro de cada tier.
 */
// `role` = 'TOP'|'JUNGLE'|'MID'|'ADC'|'SUP' ou 'ALL' (todas as rotas juntas).
// Em 'ALL' cada campeão aparece UMA vez, no seu MELHOR tier entre as rotas que joga
// (empate = maior winrate) — senão o mesmo campeão apareceria em vários tiers.
export function metaTiersByRole(role) {
  const wanted = String(role || '').toUpperCase();
  const todas = wanted === 'ALL';
  const grouped = {};
  for (const tier of TIER_ORDER) grouped[tier] = [];
  const melhorPorCampeao = {};

  for (const [key, entry] of Object.entries(META_DATA?.table || {})) {
    const sep = key.lastIndexOf('|');
    const roleKey = key.slice(sep + 1);
    const name = key.slice(0, sep);
    if (!todas && roleKey !== wanted) continue;
    if (!grouped[entry.tier]) continue;

    const registro = { name, winrate: entry.winrate, pickrate: entry.pickrate, banrate: entry.banrate };
    if (!todas) {
      grouped[entry.tier].push(registro);
      continue;
    }
    const atual = melhorPorCampeao[name];
    const novoIdx = TIER_ORDER.indexOf(entry.tier);
    const atualIdx = atual ? TIER_ORDER.indexOf(atual.tier) : Infinity;
    if (novoIdx < atualIdx || (novoIdx === atualIdx && (entry.winrate || 0) > (atual.winrate || 0))) {
      melhorPorCampeao[name] = { ...registro, tier: entry.tier };
    }
  }

  if (todas) for (const c of Object.values(melhorPorCampeao)) grouped[c.tier].push(c);
  for (const tier of TIER_ORDER) grouped[tier].sort((a, b) => a.name.localeCompare(b.name));
  return grouped;
}

/** Formata percentual opcional: 52.3 → "52.3%"; ausente → "—". */
export function formatPct(value) {
  return Number.isFinite(value) ? `${value}%` : '—';
}

// ----------------------------------------------------------------------
// DESCRIÇÕES DO DATA DRAGON (itens/habilidades usam markup próprio)
// ----------------------------------------------------------------------

/**
 * Converte o rich-text do DDragon em texto plano com quebras de linha
 * (sem v-html — seguro por construção). <br>/<li> viram '\n'; tags somem.
 */
export function sanitizeDDragonText(html) {
  return String(html || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
