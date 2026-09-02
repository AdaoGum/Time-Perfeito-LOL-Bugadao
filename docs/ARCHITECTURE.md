# Arquitetura do Sistema — Time Perfeito LOL

> Documento de referência para humanos **e IAs** entenderem o sistema **como um
> todo**: peças, fluxo de dados, responsabilidades e onde cada coisa mora.
> Para o schema do banco em detalhe, veja [DATABASE.md](./DATABASE.md); para os pesos
> do motor de sinergia e o contrato do `meta-tiers.csv`, [SINERGIA-E-META.md](./SINERGIA-E-META.md).

---

## 1. O que é

Aplicação web para um grupo de jogadores de League of Legends. Tem **dois grandes
mundos**, que usam planos de dados diferentes:

**Mundo JOGADORES** (depende do Worker + D1 + Riot):
1. **Perfil / histórico** — busca e exibe estatísticas ranqueadas, últimas
   partidas (KDA, itens, dano) e maestrias de um jogador.
2. **Planejador de Sinergia (Tribo)** — um motor que ranqueia composições de time com
   base na proficiência real dos jogadores nos campeões + meta + encaixe tático; e um
   lobby **Customizado 5x5** que balanceia times.
3. **Coleta contínua** — um job noturno ("trator") que ingere o histórico de
   partidas dos jogadores monitorados num banco próprio (Cloudflare D1), incluindo
   *snapshots* da timeline ("Marcos Temporais") para gráficos de evolução.

**Mundo CAMPEÕES** (100% client-side — Data Dragon + arquivos estáticos do repo):
4. **Panteão** (fichas de campeão: habilidades, radar tático, até 3 builds com runas+itens,
   meta por rota, lore, galeria de skins), **Relíquias** (catálogo de itens + sinergia
   inversa) e **Meta & Tier List** (S/A/B/C/D por rota, com WR/PR/BR). **Não toca o Worker
   nem gasta a chave da Riot** — motor em `src/utils/championCatalog.js`.

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
│  com o worker através de shared/match-extract.js.                    │
└─────────────────────────────────────────────────────────────────────┘
```

> **Fonte única de extração:** a lógica de extrair/gravar partidas vive num único
> módulo — `shared/match-extract.js` — **importado** por `worker.js`, `cron/sync.js`
> e `cron/backfill.js`. O bundle do Cloudflare (Wrangler/esbuild) resolve esse import
> relativo normalmente, então **não há mais cópia duplicada**: coluna nova entra num
> lugar só. (Antes o worker mantinha uma cópia manual — essa dívida foi paga.)

> **Dois planos de dados:** o diagrama acima é o plano **JOGADORES** (Worker→D1→Riot).
> O plano **CAMPEÕES** (Panteão/Relíquias/Meta) é **client-side puro**: lê o **Data
> Dragon** da Riot (via `fetch` no boot + `fetchChampionDetail` sob demanda) e três
> arquivos estáticos do repo — `data/meta-tiers.csv`, `data/sinergia-champs.csv`,
> `data/builds-champs.json` — cruzados em `utils/championCatalog.js`. Não passa pelo
> Worker nem pelo D1 e **não gasta o orçamento da chave**. Degradação graciosa é regra:
> dado ausente vira fallback neutro/"—" (nunca crash).

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
partidas/jogador). Roda com `node --env-file=local/.env cron/backfill.js`. **Sem alvo
explícito (vetor vazio / sem `PUUIDS`) processa SÓ premium** — paridade com `cron/sync.js`.

> **Fonte única também na infra dos jobs:** `queryD1` (com retry) e o cliente da Riot
> (`fetchFromRiotHost`/`respeitarRateLimit`) vivem em `cron/lib/d1.js` e `cron/lib/riot.js`,
> importados por `sync.js`, `backfill.js` e `relatorio-discord.js` — antes cada um tinha a
> sua cópia (a do backfill era a única **sem** retry no D1). Mudança de infra num lugar só.

---

## 4. Mapa de arquivos

### Front-end (`src/`)
| Arquivo | Papel |
|---|---|
| `main.js` | Inicializa o app Vue, monta o router e estilos globais. |
| `App.vue` | Layout global: topbar (com prévias por aba), **sidebar em seções** (Jogadores/Campeões/Equipes, com **títulos clicáveis → hubs**), botão especial **Ancestralidade** no rodapé, **Monitor da API** minimizável (`ui.telemetryLevel`), overlay de busca, tooltip. Hospeda a **instância ÚNICA do `ChampionSheet`** (async; fecha ao trocar de tela; `expand` → `/ficha/:championId`). Carrega o Data Dragon no boot (champion/item/summoner/runes), passando o `champion.json` pelo `canonicalChampionList`. |
| `Router.js` | Rotas: `/`, `/jogadores`, `/campeoes` (hubs), `/historico`, `/analise`, `/profile[/:g/:t/:view?]`, `/mastery[/:g/:t]`, `/synergy`, `/saguaoCustom`, `/ancestralidade`, `/meta`, `/champions/:championId?`, `/items/:itemId?`, **`/ficha/:championId`** (ficha em tela cheia, componente carregado sob demanda). `scrollBehavior` não rola quando só muda o param da mesma rota (abrir/fechar modal). |
| `store.js` | Estado global reativo: `searchProfile` (+ `brief` = veio do `profile_brief`, sem histórico), `masteryDashboard` (+ `loading`/`puuid`), `telemetry`, `ui` (sidebarCollapsed, `telemetryLevel`), **`championSheet`** (`champ` = ficha aberta, `origem` = tela para onde o Voltar da tela cheia leva) com os helpers **`abrirFicha`/`fecharFicha`**, **`staticData`** (`championList`, `items`, `runes`, `summonerSpells`, `championDetails`). |
| `api.js` | Cliente do worker (`workerRequest`), normalização de perfil, telemetria de rate limit, `fetchPlayerSuggestions`. |
| `utils.js` | `WORKER_URL`, versão do Data Dragon, helpers de imagem (campeão/ícone/item/**splash**/**loading**/**runa**), `getChampionIdFromName` (nome→id do DDragon, com overrides — inclui os rótulos pt_BR divergentes Bardo/Nunu e Willump/Renata Glasc), **`canonicalChampionList`** (tira as cópias `Jade_*` que o patch 16.15 publica), `roleIconImage` (ícones **oficiais** de rota), `fetchChampionDetail` (ficha sob demanda, com cache). |
| `utils/championCatalog.js` | **Módulo Campeões — parte LEVE:** `rolesOf` (identidade — alimenta a escolha de preset) vs **`rolesWithMeta`** (identidade + rotas do meta — é o que a UI mostra), `championByName` (nome→campeão, memoizado), `normalizeSearch`, `metaTiersByRole` (aceita `ALL`), `metaEntriesOf`, `metaInfo`, `TIER_STYLES`, `ROLES`, `sanitizeDDragonText`. Importado pela **SearchBar**, que carrega no boot — por isso não pode encostar nos JSON de build. |
| `utils/championBuilds.js` | **Módulo Campeões — parte PESADA:** `buildsFor` (presets com runas+itens), **`metaBuildVariants`** (até 3 builds reais a partir de `meta-builds.json.slots`), `metaBuildFor`, `countersEntriesOf`, `championsForItem`. Único dono de `builds-champs.json` + `meta-builds.json`; só a ficha do campeão e o `ItemDetail` importam, e ambos são sob demanda. A separação é o que mantém os ~200 KB de build fora do chunk inicial. |
| `utils/proficiencia.js` | Proficiência real do jogador no campeão (winrate bayesiano, recência, maestria, KDA/CS). |
| `utils/tilt3d.js` | `useTilt3d({ gesto })`: inclinação 3D seguindo o ponteiro, no **hover** ou por **arrasto** (gira só pressionado; `arrastou` separa giro de clique). Substitui o `hover-3d` do daisyUI, que exige zonas sobrepostas e proíbe conteúdo clicável. |
| `utils/sinergiaMotor.js` | Motor de sinergia v2 (score de time, arquétipos, pares) + `parseMetaCsv` (lê o meta com colunas opcionais `winrate,pickrate,banrate`). |
| `data/meta-tiers.csv` | Tier list manual: `champion,role,tier` + `winrate,pickrate,banrate` (opcionais). Pondera o meta e alimenta a Tier List/ficha. |
| `data/sinergia-champs.csv` | Vetores táticos por campeão (8 dimensões + cc/scaling/mechTags/roles). |
| `data/builds-champs.json` | Builds CURADAS do módulo Campeões: `presets` (itens+runas por estilo), `runePages` (IDs de perk), `champions` (itens da build principal). **Única fonte de runas.** |
| `data/meta-builds.json` | Builds REAIS por `Campeão|ROTA` raspadas do lolalytics (`/atualizar-builds`): `buildWr`, `start`, `core`, `boots`, **`slots`** (Item 4/5/6 com até 3 opções, cada uma com WR e amostra), `situational`, `skillMax`, `skillLevels`, `counters`. |
| `components/` (Campeões) | **`ChampionCard`** (card ÚNICO de campeão — Panteão, Meta, Caverna, cards de partida e o card de skin da ficha; `w-full` 308×560, quem usa define a largura; props `winrate`/`frameClass`/`skinNum`/`label`/`tilt`/`showRoles`/`popover` e slots `overlay`/`footer`), **`ChampionSheet`** (ficha ÚNICA do sistema, `mode='modal'` no host do App.vue ou `mode='pagina'` na tela cheia; galeria de skins, build do meta e link 3D do Khada) + `ChampionPage` (rota `/ficha/:championId`, com o botão Voltar para a tela de origem), `Champions`, `Items` + `ItemDetail`, `MetaTierList` (quadro de ranks lado a lado), `ModuleHub` (hubs). |
| `components/` (Jogador/Tribo) | `Home`, `Profile`, `Mastery`, `Tribo`, `saguaoCustom`, `Ancestralidade`, e auxiliares (`SearchBar` com busca híbrida, `SearchGate`, `RadarChart`, `PlayerAnalysis`, `KpiCard`, `CustomSlotCard`, `FilaSelecao`, `AsyncState`). |

### Back-end e coleta
| Arquivo | Papel |
|---|---|
| `worker.js` | Cloudflare Worker: proxy da Riot, cache-first no D1, rotas por `action`. |
| `wrangler.toml` | Config do deploy do Worker (nome, `account_id`, binding D1). |
| `cron/sync.js` | Trator noturno: ingestão + extração das partidas inéditas. |
| `cron/backfill.js` | Recuperação de histórico faltante (centrado na partida). |
| `cron/relatorio-discord.js` | Relatório analítico da Tribo postado no Discord (webhook). |
| `shared/match-extract.js` | Lógica **única** de SQL/extração de partidas — importada pelo worker E pelo coletor (sem duplicação). |
| `cron/lib/d1.js` | Cliente **único** do D1 (REST) p/ os jobs Node: `queryD1` (com retry/backoff), `queryD1Rows`, `registrarUsoGlobal`. |
| `cron/lib/riot.js` | Cliente **único** da Riot p/ os jobs Node: `fetchFromRiotHost` (429/5xx/backoff) + `respeitarRateLimit` (contador da janela). |
| `cron/lib/relatorio-engine.js` | Camada de **embed do Discord** do relatório: monta os cards e posta no webhook. Analisa cada fila (Solo/Duo e Flex) em consultas separadas por `queue_id` e entrega **um card por jogador** — um teaser com uma linha de KPIs por fila e o **link para `/relatorios`**, que é onde o relatório completo vive. Re-exporta as duas camadas abaixo. |
| `shared/relatorio-metricas.js` | **Números** do relatório: SQL agregado sobre o D1 (janela livre `[desde, ate)`) + `analisarJogador`. Importado pelo coletor **e pelo Worker** (rotas `premium_players` / `relatorio_premium` da tela `/relatorios`). Também mora aqui a definição dos períodos — inclusive os dois **ancorados** dos posts agendados (`semana-util` / `fim-de-semana`), que `resolverJanela()` transforma em recorte concreto no instante em que o job roda. |
| `shared/relatorio-prosa.js` | **Texto** do relatório: o banco de frases da NLG "IA sem IA" (`gerarProsa`, JS puro). Importado pelo coletor **e pelo front** — na tela `/relatorios` a narração é montada no browser, a partir dos números que o Worker devolveu. |
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
| `admin_all_history` | Dashboard "Ancestralidade": junta `jogadores` + `estatisticas_jogador_partida`. **Exige `password`**; página de até 20 000 linhas (as mais recentes). Cursor opcional `before` (um `game_creation`) pagina as **mais antigas** → o front "carrega mais" além do teto | `{ success, history[], truncated, limit, nextCursor }` |
| `admin_players_list` | Aba "Jogadores": cadastro de `jogadores` (1 linha/jogador, inclui `has_premium`). **Exige `password`** | `{ success, players[] }` |
| `admin_set_premium` | Marca/desmarca premium. Body `{ puuid, premium, password }` | `{ success, puuid, has_premium }` |

> 🔒 **Painel admin (fail closed):** as três rotas `admin_*` validam `password`
> contra o secret `env.ADMIN_PASSWORD` **no servidor** — sem fallback embutido.
> Se o secret não estiver configurado no Worker, elas respondem **503**. A validação
> antiga era no cliente (comparava `=== 'ugabuga'` no front) e as rotas de leitura
> não checavam nada; ambos foram corrigidos.

Erros são normalizados pelo front (`api.js:normalizeWorkerError`): 404 (invocador não
encontrado), 429 (muitas consultas), 401/403 (chave/senha), 503 (admin sem senha configurada).

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
- **Coletor:** `cron/sync.js` roda no **GitHub Actions** (`riot-sync.yaml`, 04:00 e 17:30
  BRT todo dia, mais 07:00 BRT em segunda e sexta — os dias em que o relatório do Discord
  sai às 09:00) ou fora do edge (VM/PC/cron) lendo `local/.env`.
- **Assets (Data Dragon):** o patch é resolvido em runtime no boot do front
  (`resolveDDragonVersion()` em `src/utils.js`), com `DDRAGON_VERSION` só como fallback.

Ver mais em [DATABASE.md](./DATABASE.md) (migrations/backfill) e no README.
