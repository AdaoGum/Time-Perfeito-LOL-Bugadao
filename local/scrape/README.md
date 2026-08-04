# local/scrape — gerador de builds (roda no SEU PC, sem gastar IA, sem navegador)

Gera `src/data/meta-builds.json` (build + WR + situacionais + skill order por campeão×rota)
raspando o lolalytics. **Já está calibrado e testado.**

Os scripts são versionados (um clone novo consegue regenerar o dado); a saída de
execução (`out/`: `targets.json`, `run.log`, sondas) fica fora do git.

O lolalytics entrega os dados no HTML (SSR) e o ID do item vem na própria imagem, então
basta um `fetch()` — **não precisa de Playwright** (se instalou, pode `npm uninstall playwright`).

> **Rode os comandos a partir da raiz do repositório.** Precisa de **Node 18+** (fetch nativo).

---

## Pipeline (2 passos)

### 1. Gerar a lista de alvos (escolha as tiers)
```bash
node local/scrape/gen-targets.mjs S A B      # ~174 combos · ou "S A" · sem args = tudo (273)
```
→ cria `local/scrape/out/targets.json`.

### 2. Baixar e parsear tudo → meta-builds.json
```bash
node local/scrape/fetch-builds.mjs --limit 3     # teste rápido (3 campeões)
node local/scrape/fetch-builds.mjs --lane bottom # só uma rota (top|jungle|middle|bottom|support)
node local/scrape/fetch-builds.mjs               # tudo (mescla — rotas acumulam)
```
Imprime `OK`/`FAIL` por campeão e escreve/mescla em `src/data/meta-builds.json`.
Full run ≈ 273 × 1,2s ≈ **~6 min** (só rede local, zero IA).

### 3. Verificação (aí sim me chama — barato)
Me manda o `src/data/meta-builds.json` (ou um trecho). Eu confiro IDs, WRs plausíveis e
cobertura vs `meta-tiers.csv`.

---

## Schema gerado (por chave `Campeão|ROTA`)

```json
"Mordekaiser|TOP": {
  "buildWr": 56.38,                    // WR do core build
  "start": ["1056","2003"],            // itens iniciais (IDs Data Dragon)
  "core": ["3116","4633"],             // core (sem as botas)
  "boots": "3111",                     // botas (detectadas pela tag Boots)
  "slots": [                           // Item 4, 5 e 6 — até 3 opções POR SLOT
    [{"id":"3152","wr":59.86,"games":126934}, {"id":"3157","wr":58.1,"games":17814}],
    [ ... ],
    [ ... ]
  ],
  "situational": [{"id":"3152","wr":59.86}, ...],  // mesma coisa, achatado (retrocompat.)
  "skillMax": ["Q","E","W"],           // prioridade de max
  "skillLevels": {"Q":[1,4,5,7,9],"W":[3,14,15],"E":[2,8,10,12,13],"R":[6,11]},
  "counters": {                        // da frase-resumo do lolalytics (ids DDragon)
    "strongAgainst": ["Illaoi","TahmKench","Malphite"],  // campeões que ELE vence
    "counteredBy":   ["Singed","Olaf","Vayne"]           // quem counteram ELE
  }
}
```
IDs de item já são de Summoner's Rift (vêm do `item64/<id>.webp` do lolalytics) e são
filtrados contra o `item.json` do patch — não precisa converter nome→ID.

`slots` é o que gera as **até 3 builds** da ficha: `championCatalog.metaBuildVariants()`
monta a Build 1 com a opção mais jogada de cada slot, a Build 2 com a seguinte, etc.
(pulando repetição — o mesmo item costuma aparecer como opção de dois slots).

---

## Flags

- `--limit N` — só os N primeiros alvos (teste).
- `--lane <top|jungle|middle|bottom|support>` — só uma rota.
- `--delay <ms>` — intervalo entre requisições (padrão 1200). Aumente se tomar bloqueio.

---

## Se algo falhar

- **Muitos `FAIL (HTTP 429/403)`** → o lolalytics está limitando. Aumente `--delay 2500`
  e rode por rota (`--lane`) em vez de tudo de uma vez.
- **`FAIL (build vazia)`** para um campeão → ele quase não é jogado naquela rota (sem dados),
  ou o layout mudou. Se for layout, me avise que recalibro o parser (`parseHtml` em
  `fetch-builds.mjs`).
- **Champion sem slug** (aviso no passo 1) → adicione em `SLUG_OVERRIDE` no `gen-targets.mjs`
  (Wukong já está lá).
- **lolalytics mudar de estrutura** → é 1 recalibração pontual do `parseHtml`, não recorrente.

---

## Custo de IA

- Passos 1 e 2 rodam 100% no seu PC — **zero** consumo de IA, sejam 44 ou 273 campeões.
- Sobra só a verificação final (poucos %).
- Ressalva: dado do lolalytics é deles ("não pode ser usado por terceiros"). Uso local
  gerando arquivo estático = ok; **não** embutir raspagem no app publicado.
