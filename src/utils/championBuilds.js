/**
 * Builds de campeão — a fatia PESADA do catálogo.
 *
 * Vive separada de `championCatalog.js` por causa do bundle, não por gosto: este
 * módulo importa `meta-builds.json` (a build real por campeão×rota, raspada do
 * lolalytics) e `builds-champs.json`, e juntos eles são a maior massa de dados
 * do front. O catálogo é usado pela SearchBar, que é EAGER (mora no App.vue) —
 * então tudo que ele importa cai no chunk inicial. Com os dois arquivos lá
 * dentro, quem só abria a Home baixava o meta inteiro sem precisar.
 *
 * Quem consome isto aqui — a ficha do campeão e o detalhe do item — já é
 * carregado sob demanda, então os JSON viajam junto com a tela que os usa.
 *
 * ⚠️ Não importe este módulo de nada que seja carregado no boot (App.vue,
 * SearchBar, store, api): isso desfaz o split sem quebrar nada e sem avisar.
 */

import buildsData from '../data/builds-champs.json';
import metaBuildsData from '../data/meta-builds.json';
import { getChampionMetrics } from './sinergiaMotor.js';
import { ROLES, rolesOf } from './championCatalog.js';

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
