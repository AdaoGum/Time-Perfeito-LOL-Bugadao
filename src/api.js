import { state } from './store.js';
import { WORKER_URL } from './utils.js';

const TELEMETRY_META = {
  profile_overview: { cost: 24, group: 'full-profile' },
  profile_brief: { cost: 4, group: 'light-profile' },
  masteries: { cost: 2, group: 'masteries' },
  default: { cost: 1, group: 'other' }
};

function normalizeWorkerError(status) {
  if (status === 404) return 'Erro: Invocador não encontrado. Verifique a ortografia do nome e a tag.';
  if (status === 429) return 'A plataforma está recebendo muitas consultas simultâneas. Por favor, aguarde.';
  if (status === 401 || status === 403) return 'Erro de Chave: A API Key da Riot expirou no Cloudflare.';
  return 'Falha crítica amigável: não foi possível completar a operação agora.';
}

// Aplica no store o contador GLOBAL reportado pelo worker (o mesmo p/ todos).
// `resetMs` (quanto falta p/ o reset) vira um instante absoluto p/ contagem regressiva suave.
function applyGlobalRate(rate) {
  if (!rate || !Number.isFinite(rate.used)) return;
  const g = state.telemetry.global;
  g.used = rate.used;
  g.limit = Number.isFinite(rate.limit) ? rate.limit : g.limit;
  g.available = Number.isFinite(rate.available) ? rate.available : Math.max(0, g.limit - g.used);
  if (Number.isFinite(rate.windowMs)) g.windowMs = rate.windowMs;
  if (Number.isFinite(rate.resetMs)) g.resetAt = Date.now() + rate.resetMs;
  g.loaded = true;
}

// Consulta leve do contador global (não gasta a chave da Riot). Usada em polling.
export async function fetchRateStatus() {
  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rate_status' })
    });
    if (!response.ok) return;
    applyGlobalRate(await response.json());
  } catch (e) { /* silencioso: telemetria é best-effort */ }
}

// True quando o orçamento global já estourou (usado p/ bloquear buscas no front).
// Só bloqueia se já temos um valor carregado; caso contrário deixa o worker decidir.
export function isRateBlocked() {
  const g = state.telemetry.global;
  return g.loaded && g.available <= 0;
}

export async function workerRequest(action, payload) {
  const meta = TELEMETRY_META[action] || TELEMETRY_META.default;

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });

  if (!response.ok) {
    // Tenta extrair a mensagem/contador que o worker mandou (ex.: bloqueio 429 global).
    let body = null;
    try { body = await response.json(); } catch (e) { /* corpo não-JSON */ }
    if (body?.rate) applyGlobalRate(body.rate);
    throw new Error(body?.error || normalizeWorkerError(response.status));
  }

  const data = await response.json();

  // Atualiza o contador global compartilhado com o que o worker acabou de reportar.
  if (data?.rate) applyGlobalRate(data.rate);

  // Contabiliza APENAS as chamadas reais à API da Riot que o worker informou.
  // Quando os dados vêm do banco (cache D1), apiCalls é baixo/zero e não gasta o orçamento.
  // Fallback para o custo estimado quando o worker não reportar (compatibilidade).
  const apiCalls = Number.isFinite(data?.apiCalls) ? data.apiCalls : meta.cost;
  if (apiCalls > 0) {
    const now = Date.now();
    for (let i = 0; i < apiCalls; i++) {
      state.telemetry.timestamps.push(now);
    }
    state.telemetry.events.push({
      at: now,
      action,
      group: meta.group,
      cost: apiCalls
    });
  }

  return data;
}

// ----------------------------------------------------------------------
// Normalização/persistência do perfil — compartilhada entre o SearchBar
// e o carregamento automático por URL (refresh em /profile/:gameName/:tagLine)
// ----------------------------------------------------------------------
export function normalizeProfileData(data, gameName, tagLine) {
  return {
    ...data,
    gameName: data?.gameName || gameName,
    tagLine: data?.tagLine || tagLine,
    profileIconId: data?.profileIconId || 29,
    summonerLevel: data?.summonerLevel || 0,
    statsSolo: {
      wins: Number(data?.statsSolo?.wins || 0),
      losses: Number(data?.statsSolo?.losses || 0),
      winRate: Number(data?.statsSolo?.winRate || 0),
      tier: data?.statsSolo?.tier || 'UNRANKED',
      rank: data?.statsSolo?.rank || '',
      lp: Number(data?.statsSolo?.lp || 0)
    },
    statsFlex: {
      wins: Number(data?.statsFlex?.wins || 0),
      losses: Number(data?.statsFlex?.losses || 0),
      winRate: Number(data?.statsFlex?.winRate || 0),
      tier: data?.statsFlex?.tier || 'UNRANKED',
      rank: data?.statsFlex?.rank || '',
      lp: Number(data?.statsFlex?.lp || 0)
    },
    matches: Array.isArray(data?.matches) ? data.matches : [],
    proficiencyMatches: Array.isArray(data?.proficiencyMatches) ? data.proficiencyMatches : [],
    companions: {
      solo: Array.isArray(data?.companions?.solo) ? data.companions.solo : [],
      flex: Array.isArray(data?.companions?.flex) ? data.companions.flex : []
    }
  };
}

export function applyProfileToStore(normalizedData, rawData = {}) {
  state.searchProfile.puuid = normalizedData.puuid || null;
  state.searchProfile.gameName = normalizedData.gameName;
  state.searchProfile.tagLine = normalizedData.tagLine;
  state.searchProfile.profileIconId = normalizedData.profileIconId;
  state.searchProfile.summonerLevel = normalizedData.summonerLevel;
  state.searchProfile.statsSolo = normalizedData.statsSolo;
  state.searchProfile.statsFlex = normalizedData.statsFlex;
  state.searchProfile.stats = {
    wins: Number(rawData?.stats?.wins || 0),
    losses: Number(rawData?.stats?.losses || 0),
    winRate: Number(rawData?.stats?.winRate || 0),
    tier: rawData?.stats?.tier || 'UNRANKED',
    rank: rawData?.stats?.rank || '',
    lp: Number(rawData?.stats?.lp || 0)
  };
  state.searchProfile.matches = normalizedData.matches;
  state.searchProfile.proficiencyMatches = normalizedData.proficiencyMatches;
  state.searchProfile.companions = normalizedData.companions;
  state.searchProfile.error = null;
}

// `refresh=true` força a rebusca na Riot (usado quando o perfil detectou partida
// nova); senão o worker serve as maestrias do cache D1 sem gastar a chave.
export function loadMasteriesInBackground(puuid, gameName, tagLine, refresh = false) {
  return workerRequest('masteries', { puuid, gameName, tagLine, refresh })
    .then((masteryData) => {
      const fromStaticChamp = (entry) => {
        if (!entry) return { championName: 'Aatrox', championLevel: 1, championPoints: 0, lastPlayTime: 0 };
        const fromStatic = state.staticData.championList.find((champ) => Number(champ.key) === Number(entry.championId));
        return {
          championName: entry.championName || fromStatic?.name || 'Aatrox',
          championLevel: Number(entry.championLevel || 1),
          championPoints: Number(entry.championPoints || 0),
          lastPlayTime: Number(entry.lastPlayTime || 0)
        };
      };
      state.masteryDashboard.allMasteries = (masteryData.masteries || []).map(fromStaticChamp);
    })
    .catch((mErr) => {
      console.warn('Erro nas maestrias em background:', mErr);
    });
}

// Busca o perfil completo e já o coloca no store global (com loading/erro).
// Usada pelo refresh por URL e por qualquer fluxo que precise recarregar o jogador atual.
export async function loadProfileIntoStore(gameName, tagLine, { loadMasteries = true } = {}) {
  state.searchProfile.loading = true;
  state.searchProfile.error = null;
  try {
    const data = await workerRequest('profile_overview', { gameName, tagLine });
    const normalized = normalizeProfileData(data, gameName, tagLine);
    applyProfileToStore(normalized, data);
    if (loadMasteries && normalized.puuid) {
      loadMasteriesInBackground(normalized.puuid, gameName, tagLine, data?.hadNewGames === true);
    }
    return normalized;
  } catch (error) {
    state.searchProfile.error = error.message;
    throw error;
  } finally {
    state.searchProfile.loading = false;
  }
}
