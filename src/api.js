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

export async function workerRequest(action, payload) {
  const meta = TELEMETRY_META[action] || TELEMETRY_META.default;

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });

  if (!response.ok) {
    throw new Error(normalizeWorkerError(response.status));
  }

  const data = await response.json();

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
