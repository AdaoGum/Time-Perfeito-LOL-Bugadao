---
description: Roda o pipeline local de builds (lolalytics) e verifica o meta-builds.json gerado
argument-hint: "[tiers opcionais, ex: S A B | ou --lane bottom]"
allowed-tools: Bash(node:*), Read
---

Atualize `src/data/meta-builds.json` (build + WR + situacionais + skill order por
campeão×rota) rodando o pipeline LOCAL de scrape. O fetch roda no PC do usuário via Node
(NÃO use WebFetch — isso gasta o diário à toa). Você só orquestra, lê o resumo e verifica.

Contexto: os scripts vivem em `local/scrape/` (gitignored). Detalhes em
`local/scrape/README.md`. A fonte é o lolalytics (SSR; ID do item vem na URL da imagem).

## Passo 1 — Gerar alvos
Rode `node local/scrape/gen-targets.mjs $ARGUMENTS`.
- Sem `$ARGUMENTS` = todas as tiers (S→D = 273 combos).
- Com tiers (ex.: `S A B`) = só essas.
Confirme no output quantos alvos foram gerados.

## Passo 2 — Baixar e parsear (pode demorar ~6 min)
Rode com timeout longo e **redirecione o output verboso pra um log**, lendo só o fim
(pra NÃO inflar o contexto com 273 linhas):
`node local/scrape/fetch-builds.mjs > local/scrape/out/run.log 2>&1`
(use timeout de 600000 ms). Se o usuário passou `--lane`, repasse ao fetch-builds.
Depois leia só o resumo: `tail -n 8 local/scrape/out/run.log`.
Se aparecerem muitos `FAIL HTTP 429/403`, avise que o lolalytics limitou e sugira
re-rodar com `--delay 2500` ou por lane.

## Passo 3 — Verificar
Rode `node local/scrape/verify.mjs` e leia o relatório (é conciso).
Confirme: entradas == esperadas, 0 IDs de Arena, 0 sem core/skillMax/skillLevels, e a
linha `builds por entrada` (quantas entradas rendem 1, 2 ou 3 caminhos de finalização).

## Passo 4 — Relatar
Resuma pro usuário:
- total OK/FAIL e cobertura (entradas vs tier list);
- itens com `buildWr` ausente (—) e os com `buildWr > 65%` (low-sample da aba "Highest
  Win Build" — não são WR real; avise);
- quantas entradas ficaram sem `slots` (essas mostram só a build única na ficha);
- NÃO commite nem faça deploy — deixe pro usuário revisar.
