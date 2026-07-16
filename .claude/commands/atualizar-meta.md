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
`local/othersprompts/LOGICA-sinergia-e-meta.md`.

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

## Passo 5 — Normalizar e escrever
- Tiers: `S+ → S`. Só S/A/B/C/D (maiúsculo).
- Rotas: `BOTTOM/Bot → ADC`, `UTILITY/Support → SUP`, `MIDDLE/Mid → MID`, `Top → TOP`,
  `Jungle/JG → JUNGLE`.
- Somente Ranked Solo Queue (ignore ARAM/Flex).
- Uma linha por campeão+rota; campeão forte em 2 rotas = 2 linhas.
- Ordene por rota (TOP, JUNGLE, MID, ADC, SUP) e, dentro da rota, por tier (S→D).
- Escreva em `src/data/meta-tiers.csv`. Primeira linha OBRIGATÓRIA:
  `# patch: <patch> | atualizado: <YYYY-MM-DD> | fonte: <dominio(s)>`
  (o parser lê patch e data; `| fonte:` é extra e seguro). Segunda linha: `champion,role,tier`.
- Sem markdown, aspas ou texto fora do CSV.

## Passo 6 — Verificar
Rode um check rápido em Bash/node: confirme que o cabeçalho parseia `patch` e `data`,
e que não há linha inválida (tier fora de S/A/B/C/D). Ex.: contar linhas válidas.

## Passo 7 — Relatar (transparência obrigatória)
Ao final, escreva:
- patch e data usados;
- quais URLs abriram de fato e quais falharam (403/paywall);
- se foi single-source ou multi-fonte;
- nomes descartados na validação (e quais são campeões novos a adicionar depois);
- lembrete: fazer commit + deploy (front no GitHub Pages) para publicar.

NÃO faça commit nem deploy automaticamente — deixe para o usuário revisar.
