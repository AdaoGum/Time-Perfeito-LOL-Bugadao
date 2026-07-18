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

### 3.1 Usuário busca um perfil (tempo real — "busca barata")
1. `SearchBar.vue` → `api.js:loadProfileIntoStore()` → `workerRequest('profile_overview')`.
2. Worker resolve a identidade: **do D1** quando o jogador é conhecido (0 chamadas);
   1ª visita resolve `puuid` (account-v1) + plataforma (active-shards) + elo/ícone.
3. **Nada de download em massa:** o worker verifica os IDs ranqueados recentes
   (2 chamadas) e devolve `pendingCount` (quantos ainda não estão no banco).
   Partidas e base analítica vêm **só do D1**. Exceção: jogador **novo** ganha o
   auto-download das 10 últimas (histórico já nasce preenchido, ~26 chamadas).
4. `api.js` normaliza (`normalizeProfileData`) e joga no `store.js` (`state.searchProfile`),
   incluindo `hasPremium` e `pendingCount`.
5. O front (`Profile.vue`) divide o perfil em **Histórico** e **Estatísticas** (rotas
   `/profile/:g/:t/historico|estatisticas`, alternador no canto). Um banner mostra o
   `pendingCount` e o botão **"Buscar últimos 10 jogos"** → `fetch_recent_matches`
   (baixa, grava e devolve o estado novo). Estatísticas sem base ficam em **hiato**
   com CTA que busca os 10 e monta na hora.
6. As maestrias carregam em **background** (`loadMasteriesInBackground`).
7. A telemetria de rate limit soma `apiCalls` numa janela deslizante — leituras do
   D1 custam ~0 e não gastam o orçamento da chave.
8. **Premium primeiro:** premium (`has_premium=1`) é sincronizado toda madrugada e
   chega "tudo montado"; os demais operam sob demanda (10 jogos por clique).

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
7. **Maestrias:** antes das partidas, 1 chamada a champion-mastery-v4 (host de
   plataforma em `jogadores.platform_host`) grava/atualiza a tabela `maestrias`
   em lotes multi-VALUES — paridade de colunas com o upsert do worker.

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
| `wrangler.toml` | Config do deploy do Worker (nome, `account_id`, binding D1). |
| `cron/sync.js` | Trator noturno: ingestão + extração das partidas inéditas. |
| `cron/backfill.js` | Recuperação de histórico faltante (centrado na partida). |
| `cron/relatorio-discord.js` | Relatório analítico da Tribo postado no Discord (webhook). |
| `cron/lib/match-extract.js` | Lógica compartilhada de SQL/extração (paridade com o worker). |
| `cron/lib/relatorio-engine.js` | Motor de NLG "IA sem IA" do relatório (JS puro). |
| `migrations/*.sql` | Migrations do D1 (analíticas, `api_usage`, cache de perfil, `has_premium`). |
| `local/.env` | Segredos locais do coletor (fora do git). |

---

## 5. Rotas do Worker (contrato da API)

Requisição: `POST WORKER_URL` com JSON `{ action, gameName?, tagLine?, puuid? }`
(também aceita `GET` com querystring). CORS restrito às origens permitidas.

| `action` | Faz | Resposta (resumo) |
|---|---|---|
| `profile_overview` (aliases: `visão_geral_do_perfil`) | **Busca barata**: perfil + partidas do D1; verifica IDs recentes (2 chamadas) e conta o que falta. NÃO baixa partidas de jogador conhecido; jogador **novo** ganha auto-download das 10 últimas | `{ puuid, gameName, tagLine, statsSolo, statsFlex, matches[], proficiencyMatches[], companions{}, hasPremium, pendingCount, hadNewGames, apiCalls, rate }` |
| `fetch_recent_matches` | Botão "buscar últimos 10": baixa as até 10 ranqueadas mais recentes fora do D1 (detalhe + timeline), grava tudo e atualiza o elo. Custo máx. ~24 chamadas | `{ matches[], proficiencyMatches[], companions{}, statsSolo, statsFlex, fetched, pendingCount, hasPremium, apiCalls, rate }` |
| `profile_brief` | Perfil leve (sem histórico de partidas) | Igual ao overview, sem `matches` |
| `masteries` | Maestrias do jogador (persiste no D1 em background) | `{ masteries[], apiCalls }` |
| `player_suggest` | Autocomplete: até 5 jogadores do D1 que casam com `q` (só lê o D1) | `{ suggestions[] }` |
| `rate_status` | Status do orçamento global de rate limit (só lê o D1, polling do front) | `{ used, limit, available, resetMs, windowMs }` |
| `admin_all_history` | Dashboard "Ancestralidade": junta `jogadores` + `estatisticas_jogador_partida` | Linhas agregadas do D1 |
| `admin_players_list` | Aba "Jogadores": cadastro de `jogadores` (1 linha/jogador, inclui `has_premium`) | `{ success, players[] }` |
| `admin_set_premium` | Marca/desmarca premium. Body `{ puuid, premium, password }`; senha = `env.ADMIN_PASSWORD` (fallback `ugabuga`) | `{ success, puuid, has_premium }` |

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
  GitHub Pages) e publicado no **GitHub Pages** (workflow `deploy.yml`; domínio via `CNAME`).
- **Worker:** `worker.js` é implantado **separadamente** no Cloudflare via **Wrangler**
  (`wrangler.toml`, `npm run deploy:worker`) — automatizado pelo workflow
  `deploy-worker.yaml` a cada mudança no worker. Binding `DB` → D1 e secret `RIOT_API_KEY`.
- **Coletor:** `cron/sync.js` roda no **GitHub Actions** (`riot-sync.yaml`, 05:00 e 17:00
  BRT) ou fora do edge (VM/PC/cron) lendo `local/.env`.
- **Assets (Data Dragon):** o patch é resolvido em runtime no boot do front
  (`resolveDDragonVersion()` em `src/utils.js`), com `DDRAGON_VERSION` só como fallback.

Ver mais em [DATABASE.md](./DATABASE.md) (migrations/backfill) e no README.
