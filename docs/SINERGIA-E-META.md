# Lógica de Sinergia da Tribo — Guia para IA

Este documento explica, para outra IA (ou desenvolvedor), como funciona a recomendação de campeões do módulo **Tribo**, qual arquivo alimenta a camada de "meta", e como pesquisar corretamente na internet para preencher esse arquivo. O processo de busca está automatizado no slash command **`/atualizar-meta`** (`.claude/commands/atualizar-meta.md`) — basta rodá-lo no Claude Code.

---

## 1. Visão geral: o que o sistema faz

O módulo Tribo recebe de 1 a 5 jogadores e recomenda quais campeões cada um deve jogar, montando um time coerente. Dois problemas distintos:

- **Recomendação individual** — dado o histórico de um jogador (maestria, partidas recentes, winrate, rota), sugerir campeões: tanto os de conforto quanto novos campeões do mesmo estilo que estão fortes no patch.
- **Montagem de time** — escolher a combinação de 5 campeões que forma a composição mais consistente (sinergias entre eles + coerência de arquétipo), e não apenas 5 campeões individualmente bons.

A recomendação combina **quatro sinais**, cada um normalizado para o intervalo 0–1 antes de ser ponderado:

```
scoreFinal = W_PROF·proficiencia + W_META·metaScore + W_TIME·fitDeTime + W_ROTA·roleFit

Pesos padrão (SCORE_WEIGHTS em src/utils/sinergiaMotor.js):
W_PROF = 0.40   (proficiência do jogador no campeão)
W_META = 0.20   (força do campeão no patch atual)
W_TIME = 0.30   (contribuição para a sinergia/arquétipo do time)
W_ROTA = 0.10   (encaixe do campeão na rota do slot)
```

Princípio central: **os sinais somam, nunca se multiplicam.** Assim o meta pondera mas nunca domina — um campeão fora do meta que o jogador domina continua competitivo. Qualquer dado ausente (sem maestria, sem partidas, campeão fora do meta) degrada para um valor **neutro (0.5)**, nunca para zero e nunca causa erro.

---

## 2. Os quatro sinais em detalhe

### 2.1 Proficiência (peso 0.40) — `src/utils/proficiencia.js`
Quão bem o jogador domina aquele campeão. Composta de:
- **Winrate com suavização bayesiana**: `(vitorias + K·0.5) / (jogos + K)` com `K = 8`. Evita que 1 jogo/1 vitória vire 100%.
- **Recência**: decaimento exponencial `exp(-diasDesdeUltimoJogo / 60)` usando `lastPlayTime` da maestria ou a partida mais recente.
- **Maestria normalizada**: `clamp(log10(pontos + 1) / 6, 0, 1)` (~1M pontos ≈ 1.0).
- **Desempenho**: KDA e CS/min das partidas, normalizados.

### 2.2 Meta (peso 0.20) — `src/data/meta-tiers.csv` (foco deste documento)
Quão forte o campeão está no patch atual, na rota do slot. Vem de um CSV estático (ver seção 4). Conversão tier→score: `S=1.0, A=0.8, B=0.6, C=0.4, D=0.25`. Campeão/rota ausente = 0.5 neutro. Meta com mais de 30 dias sofre decaimento de confiança (o score é puxado em direção a 0.5) e a UI mostra um aviso.

### 2.3 Fit de time (peso 0.30) — `src/utils/sinergiaMotor.js`
Quanto o campeão melhora a composição como um todo. Dois mecanismos:

- **Arquétipos de composição**: o time é avaliado contra 5 arquétipos canônicos (ENGAGE, POKE, PROTECT, PICK, SPLITPUSH), cada um com requisitos mínimos de atributos. A contribuição do candidato = ganho de aderência ao melhor arquétipo quando ele entra no time.
- **Sinergia de pares por tags de mecânica**: cada campeão tem `mechTags` (ex.: `fornece_knockup`, `hypercarry`, `enchanter`). Pares complementares geram bônus (ex.: `fornece_knockup` + `aproveita_knockup` → Malphite + Yasuo). Isso é sinergia real de dupla, não só cobertura de atributos.

Também entram ajustes de balanceamento AD/AP e de curva de scaling (early/late).

### 2.4 Role fit (peso 0.10)
Encaixe do campeão na rota do slot (TOP/JUNGLE/MID/ADC/SUP), derivado das tags de rota do campeão na planilha de sinergia.

---

## 3. Os dois documentos de dados

| Arquivo | O que contém | Como é atualizado |
|---|---|---|
| `src/data/sinergia-champs.csv` | Perfil tático de cada campeão: 8 dimensões (engage, poke, disengage, etc.), damageType, rotas, `cc`, `scaling`, `mechTags`. | Manual, raramente muda (só quando entra campeão novo ou rework). |
| `src/data/meta-tiers.csv` | Tier list do patch atual: para cada campeão+rota, um tier S/A/B/C/D. | **Manual, a cada patch (~2 semanas)**, via pesquisa na internet. É o foco deste guia. |

Ambos são importados no código com `?raw` e parseados por funções dedicadas (`parseSynergyCsv` e `parseMetaCsv`).

---

## 4. Como preencher `meta-tiers.csv` corretamente

### 4.1 Formato exato (contrato fixo)
A primeira linha é um comentário com metadados; o cabeçalho vem em seguida; cada linha é um par campeão+rota+tier.

```
# patch: 26.15 | atualizado: 2026-08-04 | fonte: mobatrainer.com
champion,role,tier,winrate,pickrate,banrate
Quinn,TOP,S,53.4,0.9,0.9
Malphite,TOP,A,50.7,6.4,16.8
Ahri,MID,S,51.3,9.3,2.8
Nunu & Willump,JUNGLE,B,50.6,1.8,0.5
Kai'Sa,ADC,C,49.7,21.2,3.3
Senna,SUP,A,50.9,6.2,5.8
```

Regras estritas do parser:
- A linha `# patch: X | atualizado: YYYY-MM-DD | fonte: …` é obrigatória e lida pela UI. A data deve estar em `YYYY-MM-DD`.
- As colunas `winrate,pickrate,banrate` são **opcionais** (o formato antigo `champion,role,tier` continua válido): o `parseMetaCsv` lê o cabeçalho dinamicamente e coluna ausente/vazia vira `undefined`, que a UI mostra como "—". Números percentuais **sem** o `%`. Não achou o dado? Deixe vazio — não invente.
- Linhas iniciadas por `#` são ignoradas como dados (mas a de patch/data é parseada).
- `champion`: nome em inglês **idêntico ao Data Dragon da Riot**. Casos que costumam quebrar: `Kai'Sa`, `Vel'Koz`, `Cho'Gath`, `Kha'Zix`, `Rek'Sai`, `K'Sante`, `Bel'Veth`, `Nunu & Willump`, `Dr. Mundo`, `Wukong` (não "MonkeyKing"), `Renata Glasc`, `Jarvan IV`, `Twisted Fate`, `Master Yi`, `Miss Fortune`, `Tahm Kench`, `Aurelion Sol`, `Lee Sin`, `Xin Zhao`. Apóstrofos e espaços importam.
- `role`: exatamente um de `TOP`, `JUNGLE`, `MID`, `ADC`, `SUP`.
- `tier`: exatamente um de `S`, `A`, `B`, `C`, `D`.
- Um campeão pode aparecer em várias rotas → uma linha por rota (ex.: Senna em ADC e SUP = duas linhas).
- Nada de markdown, aspas ou texto fora do CSV dentro do arquivo.

### 4.2 De onde tirar os dados (fontes)
Sites que agregam winrate/pickrate de partidas ranqueadas reais por patch: **u.gg, op.gg, lolalytics, Mobalytics, METAsrc, Blitz.gg, SeeMeta**. Preferir os que declaram o patch atual e o volume de partidas analisadas.

**Realidade do scraping (importante):** na prática a maioria desses sites bloqueia leitura automática (u.gg, op.gg, METAsrc, Blitz.gg costumam retornar 403/paywall). O ideal de "consenso multi-fonte" quase nunca é alcançável — normalmente sobra **uma** fonte que abre inteira. Fonte que abriu de forma confiável por WebFetch: **mobatrainer.com/lol/tier-list/{rota}** (S+/S/A/B/C/D por rota). Quando só uma fonte abrir, tudo bem — mas isso deve ser **registrado no cabeçalho do CSV (`| fonte:`) e no relatório**. Não invente um consenso que não foi lido.

### 4.3 Mapeamentos e normalizações necessários
- **Rotas**: as fontes usam nomes variados. Mapear `BOTTOM` / `Bot` → `ADC`; `UTILITY` / `Support` → `SUP`; `MIDDLE` / `Mid` → `MID`; `Top` → `TOP`; `Jungle` / `JG` → `JUNGLE`.
- **Tiers**: muitas fontes usam `S+`. Como o sistema só aceita S/A/B/C/D, **mapear `S+ → S`**. Se uma fonte usar tiers numéricos ou "God/Tier 1", converter para a escala S–D pela posição relativa.
- **Campeões muito novos** (lançados no patch): costumam ter winrate inflado por amostra pequena e viés de one-tricks. Ou omitir, ou rebaixar um tier em relação ao que a fonte crua indica. Registrar a decisão.

### 4.4 Erros comuns a evitar
- Nome fora do padrão Data Dragon → a linha é descartada silenciosamente pelo parser (o campeão fica sem meta, cai para 0.5). Conferir nomes com apóstrofo/espaço.
- Esquecer a linha de `# patch:` ou usar formato de data diferente de `YYYY-MM-DD` → a UI não consegue detectar se o meta está desatualizado.
- Deixar tier em minúsculo, ou usar `S+`/`F`/`God` → linha inválida.
- Misturar dados de filas diferentes (ARAM, Flex) → usar **somente Ranked Solo Queue**.

### 4.5 Fluxo de atualização (resumo operacional)
Automatizado no slash command **`/atualizar-meta`** (Claude Code). Ele executa:
1. `npm run meta:archive` — arquiva o `meta-tiers.csv` atual em `src/data/meta-history/meta-tiers-<patch>-<data>.csv` (versionamento; não perde o histórico).
2. Descobre o patch vigente (WebSearch) e lê as tier lists das fontes que abrirem.
3. Valida os nomes contra a lista canônica do `sinergia-champs.csv` (descarta o que o app não conhece).
4. Normaliza (S+→S, rotas, dedupe) e escreve o novo `src/data/meta-tiers.csv` com o cabeçalho `# patch: ... | atualizado: YYYY-MM-DD | fonte: ...`.
5. Relata patch/data, fontes que abriram/falharam e nomes descartados.
6. **Commit + deploy fica com você** (revisar antes). A UI passa a exibir o novo patch e reativa o peso pleno do meta.

Também dá pra rodar `npm run meta:archive` manualmente antes de editar o CSV na mão.

---

## 5. Onde cada peça vive no código (referência rápida)

- `src/data/meta-tiers.csv` — o arquivo alvo deste guia (meta ativo do patch).
- `src/data/meta-history/` — cópias congeladas de cada patch passado (`meta-tiers-<patch>-<data>.csv`) + README. Nada no app importa daqui; é só histórico/consulta.
- `.claude/commands/atualizar-meta.md` — slash command `/atualizar-meta` que refaz a busca e regrava o meta.
- `scripts/archive-meta.js` — arquivador chamado por `npm run meta:archive`.
- `src/utils/sinergiaMotor.js` — `parseMetaCsv`, `metaScore`, `metaTierOf`, `metaIsStale`, `SCORE_WEIGHTS`, arquétipos, sinergia de pares.
- `src/utils/proficiencia.js` — cálculo de proficiência por campeão.
- `src/data/sinergia-champs.csv` — perfil tático + `mechTags` dos campeões.
- `src/components/Tribo.vue` — orquestra a coleta, chama o motor, monta o time e renderiza a UI.
