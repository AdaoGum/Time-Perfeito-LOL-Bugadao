// ============================================================================
// CLIENTE D1 (API HTTP do Cloudflare) — FONTE ÚNICA para os jobs Node.
// Importado por cron/sync.js, cron/backfill.js e cron/relatorio-discord.js.
//
// Antes cada um tinha a sua cópia de `queryD1` — e a do backfill era a única SEM
// retry, ficando frágil a soluços transitórios do D1. Agora todos herdam o mesmo
// cliente com backoff. As credenciais vêm do ambiente (local/.env ou secrets do
// GitHub Actions); são lidas na importação, igual às cópias antigas.
// ============================================================================

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Códigos internos transitórios do D1 (o Cloudflare "soluça" e pede retry):
//   7500 = internal error | 7502 = network/overloaded. Retentamos com backoff em
//   vez de perder a gravação da partida (paridade com o retry de 5xx da Riot).
const D1_CODIGOS_TRANSITORIOS = new Set([7500, 7502]);

function erroD1EhTransitorio(status, data) {
  if (status >= 500) return true;
  const erros = (data && data.errors) || [];
  return erros.some((e) => D1_CODIGOS_TRANSITORIOS.has(e && e.code));
}

// Executa um statement no D1 via REST, com retry/backoff em erro transitório
// (falha de rede, 5xx ou código interno 7500/7502). Devolve `data.result[0]`
// inteiro (com `.results`, `.meta`, etc.) — igual às cópias antigas de sync/backfill.
export async function queryD1(sql, params = [], tentativa = 0) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  let response, data;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    data = await response.json();
  } catch (netErr) {
    // Falha de rede (conexão caiu, DNS, etc.) — também é transitória.
    if (tentativa < 4) {
      const espera = 1500 * (tentativa + 1);
      console.warn(`⚠️ [D1 REDE] ${netErr.message}. Tentativa ${tentativa + 1}/4 em ${espera / 1000}s...`);
      await sleep(espera);
      return queryD1(sql, params, tentativa + 1);
    }
    throw netErr;
  }

  if (!response.ok || !data.success) {
    if (erroD1EhTransitorio(response.status, data) && tentativa < 4) {
      const espera = 1500 * (tentativa + 1);
      console.warn(`⚠️ [D1 ${response.status}] Erro transitório ${JSON.stringify(data.errors)}. Tentativa ${tentativa + 1}/4 em ${espera / 1000}s...`);
      await sleep(espera);
      return queryD1(sql, params, tentativa + 1);
    }
    throw new Error(`Erro no D1: ${JSON.stringify(data.errors)}`);
  }
  return data.result[0];
}

// Conveniência: devolve direto o array de linhas (`data.result[0].results`).
// É o formato que o motor do relatório (cron/lib/relatorio-engine.js) espera.
export async function queryD1Rows(sql, params = []) {
  const res = await queryD1(sql, params);
  return res.results || [];
}

// Contador GLOBAL compartilhado (mesma tabela api_usage lida pelo worker/front).
// Best-effort e SEM await: nunca deve atrasar nem derrubar a coleta.
export function registrarUsoGlobal(source) {
  queryD1('INSERT INTO api_usage (ts, count, source, action) VALUES (?, ?, ?, ?)', [Date.now(), 1, source, 'riot_fetch'])
    .catch(() => {});
}
