// Sonda pontual (1 página, cacheada em out/) para responder: o lolalytics expõe MAIS DE
// UMA build por campeão×rota? Não escreve em meta-builds.json — só inspeciona.
// Uso: node local/scrape/probe-builds.mjs [slug] [lane]
import fs from 'node:fs';
import path from 'node:path';

const slug = process.argv[2] || 'jinx';
const lane = process.argv[3] || 'bottom';
const url = `https://lolalytics.com/lol/${slug}/build/?lane=${lane}`;
const cache = path.join('local/scrape/out', `probe-${slug}-${lane}.html`);

let html;
if (fs.existsSync(cache)) {
  html = fs.readFileSync(cache, 'utf8');
  console.log(`(cache) ${cache} — ${(html.length / 1024).toFixed(0)} KB\n`);
} else {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'en-US,en' } });
  html = await res.text();
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, html);
  console.log(`GET ${url} -> ${res.status} — ${(html.length / 1024).toFixed(0)} KB\n`);
}

const strip = (s) => s
  .replace(/<img[^>]*item64\/(\d+)\.webp[^>]*>/g, ' §ITEM$1§ ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Dump do texto ao redor de cada marcador de "variante de build"
for (const marcador of ['Most Common', 'Highest Win', 'Item Sets']) {
  console.log(`\n=============== ${marcador} ===============`);
  let from = 0;
  for (let n = 0; n < 2; n++) {
    const i = html.indexOf(marcador, from);
    if (i < 0) break;
    from = i + 1;
    console.log(`\n[ocorrência ${n + 1} @ ${i}]`);
    console.log(strip(html.slice(Math.max(0, i - 300), i + 1400)).slice(0, 1500));
  }
}
