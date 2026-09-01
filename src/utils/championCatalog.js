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

// Sem `builds-champs.json` / `meta-builds.json` de propósito: eles são a maior
// massa de dados do front e moram em `championBuilds.js`, que só as telas de
// build carregam. Este módulo é importado pela SearchBar (eager), então tudo que
// entrar aqui entra no chunk inicial — ver o cabeçalho de championBuilds.js.
import { CHAMP_TAGS, META_DATA } from './sinergiaMotor.js';

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
