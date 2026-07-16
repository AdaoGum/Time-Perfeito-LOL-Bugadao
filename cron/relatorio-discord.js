// ============================================================================
// RELATÓRIO DA TRIBO NO DISCORD — job agendado (GitHub Actions) / rodável local.
//
// Lê as partidas já salvas no D1 (o cron/sync.js popula antes), monta o relatório
// pelo motor compartilhado (cron/lib/relatorio-engine.js) e posta num webhook.
//
// PERIODO = dia | semana | mes  (default: dia)
//
// Local:  PERIODO=semana node --env-file=local/.env cron/relatorio-discord.js
// Actions: envs vêm dos secrets (ver .github/workflows/relatorio-discord.yaml)
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarRelatorio, postarDiscord } from './lib/relatorio-engine.js';

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const PERIODO = (process.env.PERIODO || 'dia').toLowerCase();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// D1 via REST (mesmo padrão do cron/sync.js), com retry em erro transitório.
async function queryD1(sql, params = [], tentativa = 0) {
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
    if (tentativa < 3) { await sleep(1500 * (tentativa + 1)); return queryD1(sql, params, tentativa + 1); }
    throw netErr;
  }
  if (!response.ok || !data.success) {
    if (response.status >= 500 && tentativa < 3) { await sleep(1500 * (tentativa + 1)); return queryD1(sql, params, tentativa + 1); }
    throw new Error(`Erro no D1: ${JSON.stringify(data.errors)}`);
  }
  return data.result[0].results || [];
}

// Lê o meta-tiers.csv do projeto (pra recomendação cruzada com o patch).
function lerMetaCsv() {
  try {
    return fs.readFileSync(path.resolve(__dirname, '../src/data/meta-tiers.csv'), 'utf8');
  } catch (e) {
    console.warn('⚠️  meta-tiers.csv não lido — recomendações usarão só o histórico.');
    return null;
  }
}

// DISCORD_USER_MAP opcional: JSON { "NomeInvocador"|"puuid": "idDiscord" }.
function lerUserMap() {
  if (!process.env.DISCORD_USER_MAP) return null;
  try { return JSON.parse(process.env.DISCORD_USER_MAP); }
  catch { console.warn('⚠️  DISCORD_USER_MAP não é JSON válido — ignorado.'); return null; }
}

(async () => {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !D1_DATABASE_ID) {
    console.error('❌ Faltam CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / D1_DATABASE_ID.');
    process.exit(1);
  }
  const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  if (!DISCORD_WEBHOOK && !DRY_RUN) {
    console.error('❌ Falta DISCORD_WEBHOOK (ou rode com DRY_RUN=1 para só imprimir).');
    process.exit(1);
  }

  console.log('=========================================================');
  console.log(`📜 [CRONISTA] Relatório "${PERIODO}" da tribo`);
  console.log('=========================================================');

  // PUUIDS opcional (separada por vírgula): relatório só desses jogadores.
  // Usado pelo botão do app (dispatch do workflow com jogadores selecionados).
  const puuids = process.env.PUUIDS
    ? process.env.PUUIDS.split(',').map(s => s.trim()).filter(Boolean)
    : null;
  if (puuids) console.log(`🎯 Filtrado para ${puuids.length} jogador(es) selecionado(s).`);

  const { mensagens, ativos } = await gerarRelatorio({
    queryRows: queryD1,
    periodo: PERIODO,
    puuids,
    metaCsv: lerMetaCsv(),
    userMap: lerUserMap()
  });

  console.log(`📋 ${ativos} jogador(es) ativo(s) no período. ${mensagens.length} mensagem(ns).`);

  if (DRY_RUN) {
    console.log('\n🧪 [DRY_RUN] Não vou postar; mostrando o conteúdo gerado:\n');
    mensagens.forEach((msg, i) => {
      console.log(`\n──────── MENSAGEM ${i + 1}/${mensagens.length} ────────`);
      if (msg.content) console.log(msg.content);
      (msg.embeds || []).forEach(e => {
        console.log(`\n### ${e.title}`);
        if (e.description) console.log(e.description);
        if (e.fields) console.log('   ' + e.fields.map(f => `${f.name}: ${f.value}`).join(' | '));
      });
    });
    console.log('\n✅ [DRY_RUN] Fim (nada foi enviado).');
    return;
  }

  await postarDiscord(DISCORD_WEBHOOK, mensagens);
  console.log('✅ Relatório postado no Discord.');
})().catch((e) => {
  console.error('❌ [FALHA]', e.message);
  process.exit(1);
});
