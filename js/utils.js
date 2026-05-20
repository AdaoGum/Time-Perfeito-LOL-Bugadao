export const WORKER_URL = 'https://lol-riotgames-api-bridge.adaojmsantos.workers.dev/';
export const DDRAGON_VERSION = '14.22.1'; 

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

export function calculateKdaRatio(k, d, a) {
  return ((k + a) / Math.max(1, d)).toFixed(2);
}

export function formatDuration(seconds) {
  const m = Math.floor((seconds || 0) / 60);
  const s = (seconds || 0) % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function errorBanner(message, action, slotId = '') {
  if (!message) return '';
  const isRateLimit = message.includes('muitas consultas') || message.includes('expirou');
  const classes = isRateLimit ? 'border-amber-700 bg-amber-950/40 text-amber-300' : 'border-red-800 bg-red-950/40 text-red-300';
  return `
    <div class="mb-4 flex items-start justify-between gap-3 rounded-lg border ${classes} px-4 py-3 text-sm">
      <p>${message}</p>
      <button data-action="${action}" ${slotId ? `data-id="${slotId}"` : ''} class="rounded border border-current px-2 py-0.5 text-xs font-semibold hover:opacity-80" type="button">Fechar</button>
    </div>
  `;
}
