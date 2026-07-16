// ============================================================================
// ARQUIVADOR DO META — congela o meta-tiers.csv atual antes de sobrescrever.
//
// Fluxo de atualização do meta (ver local/othersprompts/LOGICA-sinergia-e-meta.md):
//   1) node scripts/archive-meta.js   (arquiva o patch atual em meta-history/)
//   2) sobrescrever src/data/meta-tiers.csv com o CSV do patch novo
//   3) commit + deploy
//
// Lê o cabeçalho "# patch: X | atualizado: YYYY-MM-DD" do arquivo ativo e copia
// para src/data/meta-history/meta-tiers-<patch>-<data>.csv. Idempotente: se a
// cópia daquele patch+data já existir, não faz nada (não duplica histórico).
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ATIVO = resolve(ROOT, 'src/data/meta-tiers.csv');
const HIST_DIR = resolve(ROOT, 'src/data/meta-history');

function lerCabecalho(csv) {
  const comentario = csv.split('\n').find((l) => l.trim().startsWith('#')) || '';
  const patch = (comentario.match(/patch:\s*([^|]+)/i)?.[1] || '').trim();
  const data = (comentario.match(/atualizado:\s*([0-9-]+)/i)?.[1] || '').trim();
  return { patch, data };
}

function main() {
  if (!existsSync(ATIVO)) {
    console.error(`[archive-meta] não encontrei o arquivo ativo: ${ATIVO}`);
    process.exit(1);
  }

  const csv = readFileSync(ATIVO, 'utf8');
  const { patch, data } = lerCabecalho(csv);

  if (!patch || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    console.error(
      '[archive-meta] cabeçalho inválido. Esperado a 1ª linha no formato:\n' +
        '  # patch: 26.12 | atualizado: 2026-06-11\n' +
        `  patch lido: "${patch}" | data lida: "${data}"`
    );
    process.exit(1);
  }

  if (!existsSync(HIST_DIR)) mkdirSync(HIST_DIR, { recursive: true });

  const alvo = resolve(HIST_DIR, `meta-tiers-${patch}-${data}.csv`);
  if (existsSync(alvo)) {
    console.log(`[archive-meta] já arquivado, nada a fazer: ${alvo}`);
    return;
  }

  writeFileSync(alvo, csv);
  console.log(`[archive-meta] arquivado patch ${patch} (${data}) -> ${alvo}`);
  console.log('[archive-meta] agora pode sobrescrever src/data/meta-tiers.csv com o patch novo.');
}

main();
