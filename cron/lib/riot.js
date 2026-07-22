// ============================================================================
// CLIENTE DA RIOT API — FONTE ÚNICA para os jobs Node (cron/sync.js, backfill.js).
//
// Concentra o que estava duplicado nos dois: contador de requests da janela, o
// resfriamento preventivo de chave (~90 reqs → pausa 2 min) e o fetch com host
// explícito (regional "americas" OU de plataforma tipo "br1"), tratando 429
// (pausa + reset) e 5xx (backoff/retry ≤3). Cada request é contabilizado no
// contador GLOBAL (api_usage) via registrarUsoGlobal.
//
// A chave vem do ambiente (lida na importação, igual às cópias antigas).
// ============================================================================

import { sleep, registrarUsoGlobal } from './d1.js';

const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Contador da janela de 2 min (compartilhado por todo o processo do job).
let totalRequestsFeitas = 0;

// Resfriamento de chave: pausa preventiva antes de estourar o limite de 100/2min.
// `logger` deixa a mensagem cair no log por-jogador do sync (default: console.log).
export async function respeitarRateLimit(logger = console.log) {
  if (totalRequestsFeitas >= 90) {
    logger('⏳ [ESFRIANDO CHAVE] Quase no limite de 100 reqs. Pausando 2 min...');
    await sleep(125000);
    totalRequestsFeitas = 0;
  }
}

// Fetch genérico à Riot com host explícito. Trata 429 (pausa 2 min + reset) e
// 5xx (backoff/retry). Opções:
//   • logger              -> destino das mensagens de aviso (default console.warn)
//   • source              -> rótulo p/ o contador global ('cron' | 'backfill')
//   • retornarNullEm404   -> devolve null em 404 (partida/timeline sumiu) em vez de lançar
//   • tentativa           -> uso interno do backoff
export async function fetchFromRiotHost(host, endpoint, opts = {}) {
  const { logger = console.warn, source = 'cron', retornarNullEm404 = false, tentativa = 0 } = opts;
  const response = await fetch(`https://${host}.api.riotgames.com${endpoint}`, {
    headers: { 'X-Riot-Token': RIOT_API_KEY }
  });
  totalRequestsFeitas++;
  registrarUsoGlobal(source);

  if (response.status === 429) {
    logger('⚠️ [RIOT LIMIT] Chave esquentou demais! Pausando 2 min para esfriar...');
    await sleep(125000);
    totalRequestsFeitas = 0;
    return fetchFromRiotHost(host, endpoint, opts);
  }
  // Erros transitórios (500, 502, 503, 504): a Riot às vezes soluça. Tenta de novo
  // com backoff em vez de derrubar a rodada — até 3 tentativas.
  if (response.status >= 500 && tentativa < 3) {
    const espera = 2000 * (tentativa + 1);
    logger(`⚠️ [RIOT ${response.status}] Erro transitório. Tentativa ${tentativa + 1}/3 em ${espera / 1000}s...`);
    await sleep(espera);
    return fetchFromRiotHost(host, endpoint, { ...opts, tentativa: tentativa + 1 });
  }
  if (retornarNullEm404 && response.status === 404) return null; // recurso sumiu do lado da Riot
  if (!response.ok) throw new Error(`Erro na Riot API: ${response.status} em ${endpoint}`);
  return response.json();
}
