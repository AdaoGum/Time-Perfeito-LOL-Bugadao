// [1/3] Gera a lista de alvos (campeão×rota) a partir do meta-tiers.csv.
// Uso (rode da raiz do repo):  node local/scrape/gen-targets.mjs S A B
// Sem argumentos = todas as tiers (S A B C D).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'local', 'scrape', 'out');

const TIERS = new Set((process.argv.slice(2).length ? process.argv.slice(2) : ['S', 'A', 'B', 'C', 'D']).map((t) => t.toUpperCase()));
const LANE_MAP = { TOP: 'top', JUNGLE: 'jungle', MID: 'middle', ADC: 'bottom', SUP: 'support' };

// lolalytics usa o id do Data Dragon em minúsculo, com algumas exceções:
const SLUG_OVERRIDE = { MonkeyKing: 'wukong' };

const version = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0];
const champ = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)).json();

// O champion.json do patch 16.15 traz 60 CÓPIAS dos campeões (ids `Jade_*`, com
// `key` = 60000 + a original) e o MESMO nome de exibição. Como `Jade_Ahri` vem depois
// de `Ahri` na iteração, o mapa ingênuo ficava com a cópia e o slug saía `jade_ahri`
// — que não existe no lolalytics (foram as 29 falhas do run de 2026-08-04).
// Regra: por nome, fica a entrada de MENOR key (a original é sempre a mais antiga).
// Mesma regra de `canonicalChampionList` em src/utils.js.
const nameToId = {};
const keyDoNome = {};
for (const [id, c] of Object.entries(champ.data)) {
  const key = Number(c.key);
  if (nameToId[c.name] === undefined || key < keyDoNome[c.name]) {
    nameToId[c.name] = id;
    keyDoNome[c.name] = key;
  }
}

const csv = fs.readFileSync(path.join(ROOT, 'src', 'data', 'meta-tiers.csv'), 'utf8').replace(/\r/g, '');
const rows = csv.split('\n').filter((l) => l && !l.startsWith('#')).slice(1);

const targets = [];
const missing = [];
for (const row of rows) {
  const [name, role, tier] = row.split(',');
  if (!TIERS.has((tier || '').toUpperCase())) continue;
  const id = nameToId[name];
  if (!id) { missing.push(name); continue; }
  const slug = SLUG_OVERRIDE[id] || id.toLowerCase();
  targets.push({ name, role, tier, slug, lane: LANE_MAP[role] || 'bottom' });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'targets.json'), JSON.stringify({ version, targets }, null, 2));
console.log(`versão DDragon: ${version}`);
console.log(`alvos: ${targets.length} | tiers: ${[...TIERS].join(',')}`);
if (missing.length) console.log('sem slug no DDragon (adicione em SLUG_OVERRIDE se for real):', [...new Set(missing)].join(', '));
