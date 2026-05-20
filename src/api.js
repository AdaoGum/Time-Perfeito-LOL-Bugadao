import { state } from './store.js';
import { WORKER_URL } from './utils.js';

function normalizeWorkerError(status) {
  if (status === 404) return 'Erro: Invocador não encontrado. Verifique a ortografia do nome e a tag.';
  if (status === 429) return 'A plataforma está recebendo muitas consultas simultâneas. Por favor, aguarde.';
  if (status === 401 || status === 403) return 'Erro de Chave: A API Key da Riot expirou no Cloudflare.';
  return 'Falha crítica amigável: não foi possível completar a operação agora.';
}

export async function workerRequest(action, payload) {
  const cost = action === 'profile_overview' ? 24 : (action === 'masteries' ? 2 : 1);
  const now = Date.now();
  for (let i = 0; i < cost; i++) {
    state.telemetry.timestamps.push(now);
  }

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });

  if (!response.ok) {
    throw new Error(normalizeWorkerError(response.status));
  }
  return response.json();
}
