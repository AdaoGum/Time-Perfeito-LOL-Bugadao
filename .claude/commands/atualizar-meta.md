---
description: Pesquisa o tier list do patch atual de LoL e atualiza src/data/meta-tiers.csv, preservando o histórico
argument-hint: "[patch opcional, ex: 26.15]"
allowed-tools: Bash(npm run meta:archive), Bash(node:*), Read, Write, Edit, WebSearch, WebFetch, Grep
---

Atualize o meta de League of Legends do projeto (`src/data/meta-tiers.csv`) seguindo
EXATAMENTE este processo. Não pule etapas e seja transparente sobre o que conseguiu ou
não conseguiu abrir na web.

Contexto: o motor de sinergia (`src/utils/sinergiaMotor.js`) importa `meta-tiers.csv`
estaticamente e converte tier→score (S=1.0 A=0.8 B=0.6 C=0.4 D=0.25; ausência = 0.5
neutro). Meta com +30 dias decai a confiança. Detalhes em
[`docs/SINERGIA-E-META.md`](../../docs/SINERGIA-E-META.md).

## Passo 1 — Arquivar o meta atual (versionamento)
Rode `npm run meta:archive`. Isso congela o `meta-tiers.csv` vigente em
`src/data/meta-history/meta-tiers-<patch>-<data>.csv` antes de qualquer alteração.
NUNCA sobrescreva o arquivo ativo sem arquivar antes.

## Passo 2 — Descobrir o patch vigente
Se o usuário passou um patch em `$ARGUMENTS`, use-o. Senão, faça um `WebSearch`
("League of Legends current patch tier list solo queue") e determine o número do patch
mais recente e a data de hoje.

## Passo 3 — Buscar as tier lists (aceite a realidade do scraping)
A maioria dos agregadores bloqueia fetch (u.gg, op.gg, metasrc, blitz.gg costumam dar
403/paywall). NÃO invente um "consenso" que você não conseguiu ler. Ordem de tentativa,
por rota (TOP, JUNGLE, MID, ADC, SUP):

1. **Primária (costuma abrir por WebFetch):** `https://www.mobatrainer.com/lol/tier-list/{top|jungle|mid|adc|support}`
   — traz S+/S/A/B/C/D por rota do patch atual.
2. **Fallbacks:** tente blogs/agregadores de texto que abram (sheepesports, jeu.video,
   immortalboost, seemeta). Use o que renderizar por completo.

Registre QUAIS URLs abriram de fato. Se só uma fonte abrir, tudo bem — é single-source,
mas você DEVE dizer isso no relatório final.

## Passo 4 — Validar nomes contra o app (crítico)
Só valem campeões que o app conhece. Extraia a lista canônica:
`node -e "process.stdout.write(require('fs').readFileSync('src/data/sinergia-champs.csv','utf8'))"`
e pegue a coluna `champion` (ignore linhas `#` e o cabeçalho). Qualquer nome da web que
NÃO estiver nessa lista deve ser DESCARTADO (é ruído de fetch, ex. "Locke"/"Zaahen", ou
campeão novo ainda sem perfil tático). Liste os descartados no relatório — os que forem
campeões reais e novos são candidatos a adicionar ao `sinergia-champs.csv` depois.

## Passo 5 — Normalizar e escrever (agora com WR/PR/BR)
- Tiers: `S+ → S`. Só S/A/B/C/D (maiúsculo).
- Rotas: `BOTTOM/Bot → ADC`, `UTILITY/Support → SUP`, `MIDDLE/Mid → MID`, `Top → TOP`,
  `Jungle/JG → JUNGLE`.
- Somente Ranked Solo Queue (ignore ARAM/Flex).
- Uma linha por campeão+rota; campeão forte em 2 rotas = 2 linhas.
- Ordene por rota (TOP, JUNGLE, MID, ADC, SUP) e, dentro da rota, por tier (S→D).
- **Estatísticas (novo):** quando a fonte trouxer, capture **Win Rate, Pick Rate e
  Ban Rate** por campeão+rota e escreva como 3 colunas extras `winrate,pickrate,banrate`
  (números percentuais SEM o `%`, ex.: `52.3`). Não achou o dado? Deixe a célula VAZIA
  (não invente). O parser (`sinergiaMotor.parseMetaCsv`) lê o cabeçalho dinamicamente:
  colunas ausentes/vazias viram `undefined` e a UI mostra "—".
- Escreva em `src/data/meta-tiers.csv`. Primeira linha OBRIGATÓRIA:
  `# patch: <patch> | atualizado: <YYYY-MM-DD> | fonte: <dominio(s)>`
  Segunda linha (cabeçalho): `champion,role,tier,winrate,pickrate,banrate`
  (mantém retrocompatibilidade — o formato antigo `champion,role,tier` ainda é aceito).
- Sem markdown, aspas ou texto fora do CSV.

Exemplo de linhas:
```
champion,role,tier,winrate,pickrate,banrate
Mordekaiser,TOP,S,52.66,9.76,11.96
Ahri,MID,A,51.2,7.1,3.4
Aatrox,TOP,B,49.8,,
```

## Passo 6 — Build principal do patch (novo, opcional mas recomendado)
Para os campeões de tier **S e A** (foco no que importa), capture a **build principal
do meta** (itens mirados) e as runas, e atualize `src/data/builds-champs.json`:
- O mapa `champions` guarda, por nome de exibição (igual ao CSV), um array de **IDs de
  item** do Data Dragon que vira a "Build Principal" na ficha do campeão.
- Para converter NOME do item → ID, baixe o `item.json` do patch e monte o mapa nome→id:
  `node -e "fetch('https://ddragon.leagueoflegends.com/cdn/'+process.argv[1]+'/data/pt_BR/item.json').then(r=>r.json()).then(j=>{const m={};for(const[id,it]of Object.entries(j.data))m[it.name.toLowerCase()]=id;process.stdout.write(JSON.stringify(m))})" <PATCH>`
  (descubra `<PATCH>` do Data Dragon em `versions.json`).
- Escreva 6 IDs por build (mítico/core → botas → situacionais). IDs que não existirem
  no patch são filtrados em runtime (não quebram). Se não conseguir a build de um campeão,
  NÃO mexa na entrada dele (mantém a curada).
- As runas continuam vindo dos presets por classe (`championCatalog.classPresetChain`);
  não é preciso escrevê-las à mão salvo pedido explícito.

## Passo 7 — Verificar
Rode um check rápido em Bash/node: confirme que o cabeçalho do CSV parseia `patch` e
`data`, que não há tier fora de S/A/B/C/D, e que `builds-champs.json` continua sendo
JSON válido (`node -e "JSON.parse(require('fs').readFileSync('src/data/builds-champs.json','utf8'))"`).

## Passo 8 — Relatar (transparência obrigatória)
Ao final, escreva:
- patch e data usados;
- quais URLs abriram de fato e quais falharam (403/paywall);
- se foi single-source ou multi-fonte;
- se capturou WR/PR/BR (de quais fontes) ou se ficou só o tier;
- quantas builds de campeões S/A você atualizou;
- nomes descartados na validação (e quais são campeões novos a adicionar depois);
- lembrete: fazer commit + deploy (front no GitHub Pages) para publicar.

NÃO faça commit nem deploy automaticamente — deixe para o usuário revisar.
