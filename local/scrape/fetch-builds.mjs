// [2/2] Baixa e parseia as builds do lolalytics (SSR — fetch puro, SEM navegador) e
// escreve src/data/meta-builds.json. NÃO consome IA. Roda no seu PC.
//
// Uso (da raiz do repo, depois de gen-targets.mjs):
//   node local/scrape/fetch-builds.mjs --limit 3     -> teste rápido (3 campeões)
//   node local/scrape/fetch-builds.mjs --lane bottom -> só uma rota
//   node local/scrape/fetch-builds.mjs               -> tudo que está em targets.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'local', 'scrape', 'out');
const META_BUILDS = path.join(ROOT, 'src', 'data', 'meta-builds.json');

const args = process.argv.slice(2);
const getArg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const LIMIT = Number(getArg('--limit')) || Infinity;
const LANE = getArg('--lane');
const DELAY = Number(getArg('--delay')) || 1200; // ms entre requisições (educação)

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0 Safari/537.36';

// ---- Data Dragon: itens válidos + set de botas ----
const version = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0];
const itemJson = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`)).json();
const validItem = new Set(Object.keys(itemJson.data));
const bootsSet = new Set();
for (const [id, it] of Object.entries(itemJson.data)) if ((it.tags || []).includes('Boots')) bootsSet.add(id);

// Mapa nome(EN) -> id do Data Dragon, pra resolver os counters (a prosa usa nomes EN).
const champJson = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)).json();
const nameToId = {};
for (const [id, c] of Object.entries(champJson.data)) nameToId[c.name] = id;

const strip = (s) => s
  .replace(/<img[^>]*item64\/(\d+)\.webp[^>]*>/g, ' §ITEM$1§ ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function parseHtml(html) {
  const between = (a, b) => { const i = html.indexOf(a); if (i < 0) return ''; const j = html.indexOf(b, i + 1); return html.slice(i, j < 0 ? html.length : j); };
  const tokIds = (t) => [...t.matchAll(/§ITEM(\d+)§/g)].map((m) => m[1]).filter((id) => validItem.has(id));

  const coreS = strip(between('Core Build', 'LEGEND'));
  const i4 = coreS.indexOf('Item 4');
  const coreHead = i4 >= 0 ? coreS.slice(0, i4) : coreS;
  const coreTail = i4 >= 0 ? coreS.slice(i4) : '';
  const coreAll = [...new Set(tokIds(coreHead))];
  const buildWr = Number((coreHead.match(/(\d+\.\d+)\s*%/) || [])[1]) || null;
  const boots = coreAll.find((id) => bootsSet.has(id)) || null;
  const core = coreAll.filter((id) => id !== boots);

  // Slots finais (Item 4 / 5 / 6). O lolalytics lista até 3 opções POR SLOT, cada uma
  // com winrate e amostra ("§ITEM3031§ 60.11 % 126,934 OR §ITEM3085§ 58.88 % 17,814").
  // Guardar agrupado por slot é o que permite montar builds alternativas coerentes —
  // a lista achatada (`situational`) perde de qual slot cada opção era.
  const slots = [];
  for (const parte of coreTail.split(/Item\s+\d+/).slice(1)) {
    const opcoes = [];
    for (const m of parte.matchAll(/§ITEM(\d+)§[^%]*?(\d+\.\d+)\s*%\s*([\d,]+)/g)) {
      const id = m[1];
      if (bootsSet.has(id) || !validItem.has(id) || opcoes.some((o) => o.id === id)) continue;
      opcoes.push({ id, wr: Number(m[2]), games: Number(m[3].replace(/,/g, '')) || null });
    }
    if (opcoes.length) slots.push(opcoes.slice(0, 3));
  }

  // Lista achatada, na ordem em que aparece — mantida para a ficha continuar
  // funcionando com JSON gerado antes deste campo existir.
  const situational = [];
  const seen = new Set();
  for (const opcoes of slots) {
    for (const o of opcoes) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      situational.push({ id: o.id, wr: o.wr });
    }
  }

  const start = [...new Set(tokIds(strip(between('Starting Items', 'Core Build'))))];

  const prio = strip(between('Skill Priority', 'Summoner Spells'));
  const skillMax = [];
  for (const m of prio.matchAll(/([QWER])\s*Loading/g)) if (!skillMax.includes(m[1])) skillMax.push(m[1]);

  const order = strip(between('Skill Order', 'Primary Runes'));
  const skillLevels = {};
  for (const m of order.matchAll(/([QWER])\s*Loading\.\.\.\s*([\d ]+?)(?=[QWER]\s*Loading|\d+\.\d+\s*%|$)/g)) {
    skillLevels[m[1]] = m[2].trim().split(/\s+/).map(Number).filter((n) => Number.isFinite(n) && n >= 1 && n <= 18);
  }

  return { buildWr, start, core, boots, slots, situational, skillMax, skillLevels };
}

// Counters: extraídos da frase-resumo do lolalytics (SSR). Ex.:
// "X is a strong counter to A, B & C while X is countered most by D, E & F."
// strongAgainst = campeões que ELE vence · counteredBy = quem counteram ELE.
// Resolve nomes EN -> id do Data Dragon (trata "Dr. Mundo", "Wukong", etc.).
function parseCounters(html) {
  const prose = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const toIds = (str) => (str || '')
    .split(/,|&| and /i).map((s) => s.trim()).map((n) => nameToId[n]).filter(Boolean);
  const strong = (prose.match(/strong counter to (.+?) while\b/i) || [])[1];
  // termina a lista de counters no ". The" que inicia a próxima frase (evita cortar "Dr. Mundo")
  const weak = (prose.match(/countered most by (.+?)\.\s+The\b/i) || prose.match(/countered most by (.+?)\./i) || [])[1];
  const strongAgainst = toIds(strong);
  const counteredBy = toIds(weak);
  if (!strongAgainst.length && !counteredBy.length) return null;
  return { strongAgainst, counteredBy };
}

// ---- carrega alvos ----
const { targets } = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'targets.json'), 'utf8'));
let list = LANE ? targets.filter((t) => t.lane === LANE) : targets;
list = list.slice(0, LIMIT);

// ---- mescla no meta-builds.json existente ----
const out = fs.existsSync(META_BUILDS) ? JSON.parse(fs.readFileSync(META_BUILDS, 'utf8')) : { _meta: {}, builds: {} };
out._meta = { patch: version.split('.').slice(0, 2).join('.'), updatedAt: new Date().toISOString().slice(0, 10), fonte: 'lolalytics.com' };

const fetchHtml = async (url) => {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (res.ok) return await res.text();
      if (tentativa === 2) throw new Error(`HTTP ${res.status}`);
    } catch (e) { if (tentativa === 2) throw e; }
    await new Promise((r) => setTimeout(r, 2000));
  }
};

console.log(`vai baixar ${list.length} build(s)…\n`);
let ok = 0, fail = 0;
const fails = [];
for (const t of list) {
  try {
    const html = await fetchHtml(`https://lolalytics.com/lol/${t.slug}/build/?lane=${t.lane}`);
    const b = parseHtml(html);
    b.counters = parseCounters(html);
    if (!b.core.length && b.buildWr == null) { console.log(`FAIL ${t.name}|${t.role} (build vazia)`); fail++; fails.push(`${t.name}|${t.role}`); }
    else {
      out.builds[`${t.name}|${t.role}`] = b;
      const c = b.counters ? `${b.counters.strongAgainst.length}v/${b.counters.counteredBy.length}x` : '—';
      console.log(`OK   ${t.name}|${t.role}  wr:${b.buildWr ?? '—'} core:${b.core.length} sit:${b.situational.length} skill:${b.skillMax.join('')} counters:${c}`);
      ok++;
    }
  } catch (e) {
    console.log(`FAIL ${t.name}|${t.role} (${e.message})`); fail++; fails.push(`${t.name}|${t.role}`);
  }
  await new Promise((r) => setTimeout(r, DELAY));
}

fs.writeFileSync(META_BUILDS, JSON.stringify(out, null, 2) + '\n');
console.log(`\n== fim == OK: ${ok} | FAIL: ${fail} | total no arquivo: ${Object.keys(out.builds).length}`);
if (fails.length) console.log('falhas:', fails.join(', '));
console.log('\nDepois: me mande o src/data/meta-builds.json (ou trecho) pra verificação final.');
