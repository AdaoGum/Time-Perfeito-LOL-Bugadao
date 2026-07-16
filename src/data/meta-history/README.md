# Histórico de meta (tier lists por patch)

Cada arquivo aqui é uma **cópia congelada** do `src/data/meta-tiers.csv` de um patch
passado, nomeada como `meta-tiers-<patch>-<data>.csv`
(ex.: `meta-tiers-26.12-2026-06-11.csv`).

O arquivo **ativo** (o que o build importa em
[`sinergiaMotor.js`](../../utils/sinergiaMotor.js)) continua sendo
`src/data/meta-tiers.csv`. Estes aqui são só arquivo morto/consulta — nada no app
os importa.

## Como atualizar o meta preservando o histórico

```bash
# 1. congela o patch atual nesta pasta (lê o cabeçalho "# patch: ... | atualizado: ...")
npm run meta:archive

# 2. sobrescreva src/data/meta-tiers.csv com o CSV do patch novo
#    (ver local/othersprompts/PROMPT-busca-meta.md e LOGICA-sinergia-e-meta.md)

# 3. commit + deploy
```

O `meta:archive` é **idempotente**: se já existir a cópia daquele patch+data, não
faz nada. Rode-o *antes* de sobrescrever o arquivo ativo — depois de sobrescrever,
ele arquivaria o patch novo, não o antigo.
