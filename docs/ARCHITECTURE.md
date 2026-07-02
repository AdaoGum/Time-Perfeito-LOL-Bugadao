# Arquitetura do Sistema — Time Perfeito LOL

> Documento de referência para humanos **e IAs** entenderem o sistema **como um
> todo**: peças, fluxo de dados, responsabilidades e onde cada coisa mora.
> Para o schema do banco em detalhe, veja [DATABASE.md](./DATABASE.md).

---

## 1. O que é

Aplicação web para um grupo de jogadores de League of Legends. Faz três coisas:

1. **Perfil / histórico** — busca e exibe estatísticas ranqueadas, últimas
   partidas (KDA, itens, dano) e maestrias de um jogador.
2. **Planejador de Sinergia** — um motor que ranqueia composições de time com base
   na proficiência real dos jogadores nos campeões + meta + encaixe tático.
3. **Coleta contínua** — um job noturno ("trator") que ingere o histórico de
   partidas dos jogadores monitorados num banco próprio (Cloudflare D1), incluindo
   *snapshots* da timeline ("Marcos Temporais") para gráficos de evolução.

---

## 2. Peças (as 3 camadas)

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONT-END  (Vue 3 + Vite + Tailwind v4)                             │
│  Hospedado no GitHub Pages (domínio: ugabugatimeperfeito.bugadao.com)│
│  src/  →  App.vue, Router.js, store.js, api.js, components/          │
└───────────────┬─────────────────────────────────────────────────────┘
                │  POST { action, ...payload }   (fetch → WORKER_URL)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACK-END / PROXY  (Cloudflare Worker — worker.js)                   │
│  • Esconde a RIOT_API_KEY e resolve CORS                             │
│  • Roteia por "action": profile_overview | profile_brief |          │
│    masteries | admin_all_history                                    │
│  • Cache-first: lê do D1; só chama a Riot quando falta dado          │
│  • Reporta apiCalls (para o front controlar rate limit)             │
└──────┬──────────────────────────────────────┬───────────────────────┘
       │ leitura/escrita                        │ chamadas quando necessário
       ▼                                        ▼
┌───────────────────────────┐        ┌─────────────────────────────────┐
│  BANCO  Cloudflare D1      │        │  Riot Games API + Data Dragon    │
│  (SQLite) — ver DATABASE.md│        │  (account/summoner/league/       │
│  jogadores, partidas,      │        │   match-v5/mastery)              │
│  estatisticas_*, maestrias,│        └─────────────────────────────────┘
│  lp_historico              │                     ▲
└───────────────────────────┘                     │ ingestão em massa
                ▲                                  │
                │ escreve (mesmos INSERT)          │
┌───────────────┴──────────────────────────────────────────────────────┐
│  COLETOR NOTURNO  (Node — cron/sync.js, cron/backfill.js)            │
│  Roda FORA do edge (VM/PC/cron). Fala com a Riot e grava no D1 via   │
│  API HTTP do Cloudflare (queryD1). Compartilha a lógica de extração  │
│  com o worker através de cron/lib/match-extract.js.                  │
└─────────────────────────────────────────────────────────────────────┘
```

> **Regra de ouro da paridade:** a lógica de extrair/gravar partidas existe em
> **dois lugares** — `worker.js` (embutida, pois o bundle do Cloudflare não importa
> de `cron/`) e `cron/lib/match-extract.js` (usada por `sync.js` e `backfill.js`).
> Os `INSERT`/colunas precisam ser mantidos **idênticos** nos dois. Ver DATABASE.md.

---

## 3. Fluxo de dados

### 3.1 Usuário busca um perfil (tempo real)
1. `SearchBar.vue` → `api.js:loadProfileIntoStore()` → `workerRequest('profile_overview')`.
2. Worker recebe a `action`, resolve `puuid` (account-v1) e monta o perfil.
3. **Cache-first:** o worker tenta servir do D1; só bate na Riot para o que falta,
   e devolve `apiCalls` (nº de chamadas reais feitas).
4. `api.js` normaliza (`normalizeProfileData`) e joga no `store.js` (`state.searchProfile`).
5. As maestrias carregam em **background** (`loadMasteriesInBackground`).
6. A telemetria de rate limit soma `apiCalls` numa janela deslizante — leituras do
   D1 custam ~0 e não gastam o orçamento da chave.

### 3.2 Coleta noturna (o "trator" — `cron/sync.js`)
1. Lê `SELECT ... FROM jogadores` e ordena com o **núcleo do time primeiro**
   (`PUUIDS_PRIORITARIOS`).
2. Por jogador: baixa as últimas ~200 partidas (paginando 100/vez).
3. Descobre as **inéditas** comparando com `estatisticas_jogador_partida` **daquele
   puuid** (não com a tabela global `partidas` — senão partidas jogadas por 2+
   membros do time seriam puladas para os demais).
4. Para cada inédita faz a **chamada dupla** à Riot (resumo + timeline):
   grava `partidas` (metadados) + `estatisticas_jogador_partida` (37 col) e extrai
   os **Marcos Temporais** (`estatisticas_jogador_marcos`, 52 col) nos minutos
   `[0,5,10,15,25]`. A timeline bruta é **descartada** após a extração.
5. `BACKFILL=1` reprocessa **todas** as baixadas (reescreve via `INSERT OR REPLACE`)
   — usado para preencher colunas novas no histórico.
6. Controle de rate limit próprio: pausa ~2 min ao se aproximar de 100 req/2min e
   trata 429 e 5xx (backoff/retry).

### 3.3 Backfill centrado na partida (`cron/backfill.js`)
Conserta o histórico do bug antigo de dedup: descobre partidas faltantes por puuid,
tira a **união** (baixa cada `match_id` só 1 vez) e grava estatísticas + marcos para
**todos** os membros registrados que jogaram aquela partida. Mira fundo (até 1000
partidas/jogador). Roda com `node --env-file=local/.env cron/backfill.js`.

---

## 4. Mapa de arquivos

### Front-end (`src/`)
| Arquivo | Papel |
|---|---|
| `main.js` | Inicializa o app Vue, monta o router e estilos globais. |
| `App.vue` | Componente raiz: cabeçalho, telemetria de API, overlay, tooltip. |
| `Router.js` | Rotas: `/`, `/profile[/:gameName/:tagLine]`, `/mastery`, `/synergy`, `/saguaoCustom`, `/ancestralidade`. |
| `store.js` | Estado global reativo (`reactive()`): `searchProfile`, `masteryDashboard`, `staticData`, `telemetry`. |
| `api.js` | Cliente do worker (`workerRequest`), normalização de perfil e telemetria de rate limit. |
| `utils.js` | `WORKER_URL`, versão do Data Dragon, helpers de imagem (campeão/ícone/item). |
| `utils/proficiencia.js` | Proficiência real do jogador no campeão (winrate bayesiano, recência, maestria, KDA/CS). |
| `utils/sinergiaMotor.js` | Motor de sinergia v2 (score de time, arquétipos, pares). |
| `data/meta-tiers.csv` | Tier list manual (S/A/B/C/D) que pondera o meta. |
| `data/sinergia-champs.csv` | Vetores táticos por campeão (8 dimensões + cc/scaling/mechTags). |
| `components/` | Telas: `Home`, `Profile`, `Mastery`, `Tribo` (sinergia), `saguaoCustom`, `Ancestralidade`, e auxiliares (`SearchBar`, `RadarChart`, `PlayerAnalysis`, …). |

### Back-end e coleta
| Arquivo | Papel |
|---|---|
| `worker.js` | Cloudflare Worker: proxy da Riot, cache-first no D1, rotas por `action`. |
| `cron/sync.js` | Trator noturno: ingestão + extração das partidas inéditas. |
| `cron/backfill.js` | Recuperação de histórico faltante (centrado na partida). |
| `cron/lib/match-extract.js` | Lógica compartilhada de SQL/extração (paridade com o worker). |
| `migrations/001_analytics.sql` | Migração D1: `lp_historico` + colunas analíticas + índices. |
| `local/.env` | Segredos locais do coletor (fora do git). |

---

## 5. Rotas do Worker (contrato da API)

Requisição: `POST WORKER_URL` com JSON `{ action, gameName?, tagLine?, puuid? }`
(também aceita `GET` com querystring). CORS restrito às origens permitidas.

| `action` | Faz | Resposta (resumo) |
|---|---|---|
| `profile_overview` (aliases: `visão_geral_do_perfil`) | Perfil completo + últimas partidas | `{ puuid, gameName, tagLine, statsSolo, statsFlex, matches[], proficiencyMatches[], companions{}, apiCalls }` |
| `profile_brief` | Perfil leve (sem histórico de partidas) | Igual, sem `matches` |
| `masteries` | Maestrias do jogador (persiste no D1 em background) | `{ masteries[], apiCalls }` |
| `admin_all_history` | Dashboard "Ancestralidade": junta `jogadores` + `estatisticas_jogador_partida` | Linhas agregadas do D1 |

Erros são normalizados pelo front (`api.js:normalizeWorkerError`): 404 (invocador não
encontrado), 429 (muitas consultas), 401/403 (chave expirada).

---

## 6. Motor de Sinergia v2 (resumo)

Cada candidato recebe um score **normalizado 0–1**:

```
scoreIndividual = 0.40·proficiência + 0.20·metaScore + 0.10·roleFit
scoreDeTime     = Σ scoreIndividual + 0.30·(aderênciaArquétipo + sinergiaDePares + balanceamento)
```

- **Proficiência** (`utils/proficiencia.js`): winrate bayesiano + recência + maestria + KDA/CS.
- **Meta** (`data/meta-tiers.csv`): S/A/B/C/D → 1.0/0.8/0.6/0.4/0.25; fora do CSV = 0.5.
  O meta **pondera, nunca domina**; se o CSV passar de 30 dias, seu peso cai pela metade.
- **Tático** (`data/sinergia-champs.csv`): 8 dimensões + `cc`/`scaling`/`mechTags`;
  arquétipos (ENGAGE/POKE/PROTECT/PICK/SPLITPUSH) e pares sinérgicos.
- Resolvido por **otimização global** (produto cartesiano dos top 8 por slot).
- Dados ausentes degradam para **neutro** — nunca quebram o cálculo.

---

## 7. Deploy (resumo)

- **Front-end:** build com `npm run build` (gera `dist/`, com `404.html` p/ SPA no
  GitHub Pages) e publicado no **GitHub Pages** (domínio via `CNAME`).
- **Worker:** `worker.js` é implantado **separadamente** no Cloudflare (com o binding
  `DB` → D1 e o secret `RIOT_API_KEY`).
- **Coletor:** `cron/sync.js` roda fora do edge (VM/PC/cron) lendo `local/.env`.

Ver mais em [DATABASE.md](./DATABASE.md) (migrations/backfill) e no README.
