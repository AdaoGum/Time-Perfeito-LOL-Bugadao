export const WORKER_URL = 'https://lol-riotgames-api-bridge.adaojmsantos.workers.dev/';

// Versão do Data Dragon usada em TODAS as URLs de assets (campeões, itens, ícones…).
// É um `let` exportado de propósito: `resolveDDragonVersion()` (chamado no boot)
// substitui este valor pelo patch ao vivo da Riot, e como imports ESM são "live
// bindings", todos os consumidores (`import { DDRAGON_VERSION }`) passam a ver o
// patch novo sem precisar reimportar. O valor abaixo é só o FALLBACK caso a Riot
// esteja fora do ar — assim assets de patches antigos continuam resolvendo.
export let DDRAGON_VERSION = '15.10.1';

// Cacheia a promessa para garantir UMA única chamada a versions.json por sessão,
// mesmo que main.js e App.vue peçam a resolução em paralelo.
let _ddragonVersionPromise = null;

// Descobre o patch mais recente do Data Dragon e atualiza DDRAGON_VERSION.
// Best-effort: em falha/timeout mantém o fallback e nunca lança (não pode travar o boot).
export function resolveDDragonVersion() {
  if (_ddragonVersionPromise) return _ddragonVersionPromise;
  _ddragonVersionPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const versions = await res.json();
        if (Array.isArray(versions) && typeof versions[0] === 'string' && versions[0]) {
          DDRAGON_VERSION = versions[0];
        }
      }
    } catch (e) { /* mantém o fallback */ }
    return DDRAGON_VERSION;
  })();
  return _ddragonVersionPromise;
}

export const TAB_IDS = {
  home: 'aba-home',
  perfil: 'aba-perfil',
  maestria: 'aba-maestria',
  sinergia: 'aba-sinergia'
};

const CHAMPION_KEY_OVERRIDES = {
  "Wukong": "MonkeyKing", "Cho'Gath": "Chogath", "Dr. Mundo": "DrMundo", "Nunu & Willump": "Nunu",
  "K'Sante": "KSante", "Kai'Sa": "Kaisa", "Kha'Zix": "Khazix", "Bel'Veth": "Belveth",
  "Rek'Sai": "RekSai", "Vel'Koz": "Velkoz", "LeBlanc": "Leblanc"
};

export function getChampionIdFromName(name) {
  return CHAMPION_KEY_OVERRIDES[name] || name?.replace(/[\s'.]/g, '') || '';
}

export function championImage(name) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${encodeURIComponent(getChampionIdFromName(name))}.png`;
}

export function profileIconImage(id) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${id}.png`;
}

export function itemImage(itemId) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`;
}

export function summonerSpellImage(full) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${full}`;
}

// Ícone de habilidade ativa do campeão (Q/W/E/R). `full` = spell.image.full.
export function championSpellImage(full) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${full}`;
}

// Ícone da passiva do campeão. `full` = passive.image.full.
export function championPassiveImage(full) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/passive/${full}`;
}

// Splash art / loading art NÃO usam a versão do patch na URL (caminho fixo).
export function championSplashImage(name, skin = 0) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(getChampionIdFromName(name))}_${skin}.jpg`;
}

export function championLoadingImage(name, skin = 0) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${encodeURIComponent(getChampionIdFromName(name))}_${skin}.jpg`;
}

// Ficha completa de um campeão (champion/<id>.json do Data Dragon), com cache em
// memória por (versão + id). Best-effort: em falha lança para o chamador tratar.
const _championDetailCache = new Map();
export async function fetchChampionDetail(name) {
  const id = getChampionIdFromName(name);
  const cacheKey = `${DDRAGON_VERSION}:${id}`;
  if (_championDetailCache.has(cacheKey)) return _championDetailCache.get(cacheKey);
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/pt_BR/champion/${id}.json`);
  if (!res.ok) throw new Error('Não foi possível carregar a ficha do campeão.');
  const json = await res.json();
  const detail = json?.data?.[id] || null;
  if (!detail) throw new Error('Ficha do campeão indisponível neste patch.');
  _championDetailCache.set(cacheKey, detail);
  return detail;
}

// Ícones de runa usam o caminho "icon" do runesReforged.json, sem versão na URL
export function runeImage(icon) {
  return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`;
}

// Ícones OFICIAIS de rota/posição do LoL (Community Dragon) — os mesmos usados
// no seletor de posição do cliente. Aceita as chaves do app (TOP/JUNGLE/MID/ADC/SUP)
// e também os nomes de posição do match-history (MIDDLE/BOTTOM/UTILITY).
const ROLE_POSITION_KEY = {
  TOP: 'top', JUNGLE: 'jungle', JG: 'jungle',
  MID: 'middle', MIDDLE: 'middle',
  ADC: 'bottom', BOT: 'bottom', BOTTOM: 'bottom',
  SUP: 'utility', SUPPORT: 'utility', UTILITY: 'utility',
  FILL: 'fill', AUTOFILL: 'fill'
};
export function roleIconImage(roleKey) {
  const pos = ROLE_POSITION_KEY[String(roleKey || '').toUpperCase()] || 'fill';
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${pos}.png`;
}

export function calculateKdaRatio(k, d, a) {
  return ((k + a) / Math.max(1, d)).toFixed(2);
}

export function formatDuration(seconds) {
  const m = Math.floor((seconds || 0) / 60);
  const s = (seconds || 0) % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

// Morph shared-element (FLIP): clona visualmente `sourceEl` e o anima da posição
// dele até a posição de `targetEl` (translate + scale). Usado para a busca da Home
// "subir" para a topbar ao pesquisar. `targetEl` pode estar invisível (opacity-0),
// desde que ocupe layout (não pode ser display:none) para ter rect mensurável.
export function flipMorph(sourceEl, targetEl, { duration = 450 } = {}) {
  if (!sourceEl || !targetEl) return Promise.resolve();
  const from = sourceEl.getBoundingClientRect();
  const to = targetEl.getBoundingClientRect();
  if (!from.width || !to.width) return Promise.resolve();

  const clone = sourceEl.cloneNode(true);
  clone.style.cssText = [
    'position:fixed',
    `left:${from.left}px`,
    `top:${from.top}px`,
    `width:${from.width}px`,
    `height:${from.height}px`,
    'margin:0',
    'z-index:80',
    'pointer-events:none',
    'transform-origin:top left',
    `transition:transform ${duration}ms cubic-bezier(0.4,0,0.2,1),opacity ${duration}ms ease`
  ].join(';');
  document.body.appendChild(clone);

  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const sx = to.width / from.width;
  const sy = to.height / from.height;

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        clone.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
        clone.style.opacity = '0.9';
      });
    });
    setTimeout(() => {
      clone.remove();
      resolve();
    }, duration + 40);
  });
}
