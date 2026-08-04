// [3/3] Verificação do meta-builds.json gerado. NÃO consome IA (roda local).
// Uso: node local/scrape/verify.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const mb = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'meta-builds.json'), 'utf8'));
const csv = fs.readFileSync(path.join(ROOT, 'src', 'data', 'meta-tiers.csv'), 'utf8').replace(/\r/g, '');

// chaves esperadas (campeão|rota) da tier list
const expected = new Set();
for (const row of csv.split('\n').filter((l) => l && !l.startsWith('#')).slice(1)) {
  const [name, role] = row.split(',');
  if (name && role) expected.add(`${name}|${role.toUpperCase()}`);
}

const builds = mb.builds || {};
const keys = Object.keys(builds);
const arena = [], nullWr = [], highWr = [], noCore = [], noSkillMax = [], noSkillLvl = [], noSit = [], noCounters = [];
const noSlots = [];
const variantes = { 1: 0, 2: 0, 3: 0 };

for (const [k, b] of Object.entries(builds)) {
  const allIds = [...(b.core || []), ...(b.start || []), b.boots, ...((b.situational || []).map((s) => s.id))].filter(Boolean);
  // Slots agrupados (Item 4/5/6) = matéria-prima das builds alternativas da ficha.
  const slots = Array.isArray(b.slots) ? b.slots.filter((s) => s?.length) : [];
  if (!slots.length) noSlots.push(k);
  else variantes[Math.min(3, Math.max(...slots.map((s) => s.length)))]++;
  if (allIds.some((id) => /^22\d{4}$/.test(String(id)))) arena.push(k);
  if (b.buildWr == null) nullWr.push(k);
  else if (b.buildWr > 65) highWr.push(`${k}=${b.buildWr}`);
  if (!b.core || !b.core.length) noCore.push(k);
  if (!b.skillMax || !b.skillMax.length) noSkillMax.push(k);
  if (!b.skillLevels || !Object.keys(b.skillLevels).length) noSkillLvl.push(k);
  if (!b.situational || !b.situational.length) noSit.push(k);
  const c = b.counters;
  if (!c || ((c.strongAgainst?.length || 0) + (c.counteredBy?.length || 0) === 0)) noCounters.push(k);
}

const faltando = [...expected].filter((k) => !builds[k]);
const extra = keys.filter((k) => !expected.has(k));

const line = (label, arr) => console.log(`${label}: ${arr.length}${arr.length ? ' -> ' + arr.slice(0, 20).join(', ') + (arr.length > 20 ? ' …' : '') : ''}`);

console.log(`_meta: ${JSON.stringify(mb._meta)}`);
console.log(`entradas: ${keys.length} | esperadas (tier list): ${expected.size}`);
line('FALTANDO (na tier list, sem build)', faltando);
line('EXTRA (build sem linha na tier list)', extra);
line('IDs de Arena (22xxxx) — DEVE ser 0', arena);
line('sem core — DEVE ser 0', noCore);
line('sem skillMax', noSkillMax);
line('sem skillLevels', noSkillLvl);
line('sem situacionais', noSit);
line('sem slots (build alternativa indisponível)', noSlots);
console.log(`builds por entrada: 1 -> ${variantes[1]} | 2 -> ${variantes[2]} | 3 -> ${variantes[3]}`);
line('sem counters', noCounters);
line('buildWr ausente (—)', nullWr);
line('buildWr > 65% (suspeito/low-sample)', highWr);
