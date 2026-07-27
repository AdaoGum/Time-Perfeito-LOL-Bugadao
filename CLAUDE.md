# CLAUDE.md — Resumo do sistema (para IAs)

> Onboarding rápido para agentes/IAs entenderem o **bUGAdão Analytics (Time Perfeito
> LoL)** de ponta a ponta. É o mapa mental; os detalhes profundos ficam em
> [`README.md`](README.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) e
> [`docs/DATABASE.md`](docs/DATABASE.md). Se algo aqui divergir do código, **o código
> vence** — verifique antes de recomendar.

## O que é

Web app (SPA Vue 3) para um grupo de jogadores de League of Legends, com **dois grandes
mundos**:

1. **JOGADORES** — perfil, histórico de partidas, estatísticas, maestrias e um
   **Planejador de Sinergia** (Tribo). Dados vêm de um pipeline próprio:
   `Front → Cloudflare Worker → D1 (cache-first) → Riot API`, alimentado por um coletor
   noturno (Node). **Toda a parte de jogador depende do Worker/D1.**
2. **CAMPEÕES** — Panteão (fichas de campeão), Relíquias (itens), Meta & Tier List.
   **100% client-side**: consome o **Data Dragon** da Riot + arquivos estáticos do repo
   (`meta-tiers.csv`, `sinergia-champs.csv`, `builds-champs.json`). **Não toca no Worker
   nem gasta a chave da Riot.**

Um terceiro pilar é a **Tribo/Equipes** (montagem de composições e lobbies custom 5x5),
que cruza jogadores (D1) com o motor de sinergia (estático).

## Stack

Vue 3 (`<script setup>`) + `vue-router` + Vite + Tailwind v4 · Cloudflare Worker (proxy
da Riot) · Cloudflare D1 (SQLite) · Node (coletor noturno) · Riot API + Data Dragon.
Front hospedado no **GitHub Pages** (SPA: `postbuild` copia `index.html`→`404.html`).

## Comandos

```bash
npm run dev        # dev server (Vite)
npm run build      # build de produção (valida imports; roda antes de finalizar)
npm test           # node --test em src/utils/__tests__/*.test.js (27 testes)
npm run meta:archive   # arquiva o meta-tiers.csv atual em src/data/meta-history/
```
Sempre rode `npm run build` **e** `npm test` antes de dar por concluída uma mudança.

## Mapa de rotas (front)

| Rota | Tela | Observação |
|---|---|---|
| `/` | Home | 4 portais (espíritos do Udyr) + busca híbrida |
| `/jogadores` | ModuleHub (players) | Hub da categoria (título clicável da sidebar) |
| `/campeoes` | ModuleHub (champions) | Hub da categoria |
| `/historico[/:g/:t]` | Profile (histórico) | "Caçadas Passadas" |
| `/analise[/:g/:t]` | Profile (estatísticas) | "Olhar Espiritual" |
| `/profile[/:g/:t/:view?]` | Profile | Seletor Histórico↔Estatísticas |
| `/mastery` | Mastery | "Caverna dos Monos" |
| `/synergy` | Tribo | "Tribo Perfeita" (planejador de sinergia) |
| `/saguaoCustom` | saguaoCustom | "Customizada 5x5" (lobby custom) |
| `/ancestralidade` | Ancestralidade | Painel D1 (admin, exige senha no Worker) |
| `/meta` | MetaTierList | Tier list S/A/B/C/D por rota + WR |
| `/champions/:championId?` | Champions | Panteão; param opcional = deep-link da ficha |
| `/items/:itemId?` | Items | Relíquias; param opcional = deep-link do detalhe |

`Router.js` tem um `scrollBehavior` que **não rola** quando só muda o param da mesma
rota (abrir/fechar modal de ficha/item) — evita o "pulo" da tela de fundo.

## Onde as coisas moram (front `src/`)

- **`App.vue`** — layout global: topbar (com prévias por aba), **sidebar em seções**
  (Jogadores / Campeões / Equipes, com **títulos clicáveis → hubs**), botão especial
  laranja **Ancestralidade** no rodapé, e o **Monitor da API** minimizável
  (`ui.telemetryLevel` = tiny|mini|full). Z-index: sidebar/topbar acima do conteúdo;
  overlay de busca e fichas de detalhe acima da sidebar.
- **`store.js`** — estado reativo: `searchProfile`, `masteryDashboard`, `telemetry`,
  `ui` (sidebarCollapsed, telemetryLevel), e **`staticData`** (`championList`, `items`,
  `runes`, `summonerSpells`, `championDetails` — cache das fichas). O Data Dragon é
  carregado no boot em `App.vue`.
- **`api.js`** — cliente do Worker (`workerRequest`), normalização de perfil, telemetria
  de rate limit, `fetchPlayerSuggestions` (autocomplete de jogadores).
- **`utils.js`** — `WORKER_URL`, versão do Data Dragon (`resolveDDragonVersion`), e
  helpers de imagem: `championImage`, `itemImage`, `runeImage`, `championSplashImage`,
  `championLoadingImage`, `championSpellImage`, `championPassiveImage`,
  **`roleIconImage`** (ícones OFICIAIS de rota via Community Dragon — não FontAwesome),
  `fetchChampionDetail` (ficha do campeão sob demanda, com cache).
- **`utils/championCatalog.js`** — motor do módulo Campeões: `rolesOf`, `buildsFor`
  (até 3 builds por campeão, cada uma com runas+itens), `championsForItem` (sinergia
  inversa), `metaTiersByRole`, `metaEntriesOf`, `TIER_STYLES`, `ROLES`, `sanitizeDDragonText`.
- **`utils/sinergiaMotor.js`** — motor de sinergia v2 + `parseMetaCsv` (lê o meta com
  colunas opcionais `winrate,pickrate,banrate`).
- **`utils/proficiencia.js`** — proficiência real do jogador no campeão.
- **`data/`** — `meta-tiers.csv` (tier + WR/PR/BR), `sinergia-champs.csv` (vetores 8D),
  **`builds-champs.json`** (presets de build + páginas de runas + overrides por campeão),
  `meta-history/` (arquivos versionados do meta).
- **Componentes de Campeões:** `Champions.vue` + `ChampionSheet.vue` (ficha com modal
  **expansível** e **galeria de skins**), `Items.vue` + `ItemDetail.vue`,
  `MetaTierList.vue`, `ModuleHub.vue` (hubs).
- **Componentes de Jogador/Tribo:** `Home`, `Profile`, `Mastery`, `Tribo`, `saguaoCustom`,
  `Ancestralidade`, `SearchBar`, `SearchGate`, `PlayerAnalysis`, `RadarChart`, `KpiCard`,
  `CustomSlotCard`, `FilaSelecao`, `AsyncState`.

## Convenções que importam (não quebre)

- **Nome canônico de campeão = nome de exibição pt_BR** (`champ.name`, ex.: "Dr. Mundo",
  "Cho'Gath") — é a chave dos CSVs e do `builds-champs.json`. Nas **URLs** usa-se o **id
  do Data Dragon** (`champ.id`, ex.: `MonkeyKing`) via `getChampionIdFromName`.
- **Degradação graciosa é regra:** dado ausente (campeão novo, item fora do patch, meta
  sem WR) vira fallback neutro/"—", **nunca** crash. IDs de item mortos são filtrados em
  runtime contra o `item.json` do patch.
- **`SearchBar` tem prop `context`:** `players` (default, comportamento histórico intacto),
  `champions` (só campeões), `global` (híbrido: até 6, ideal 3 campeões + 3 jogadores).
  Ao mexer, **preserve o default `players`** — Tribo/saguão/gates dependem dele.
- **Ícones de rota** sempre via `roleIconImage(role)` (imagem oficial), não FontAwesome.
- **Meta-tiers.csv:** 1ª linha `# patch: X | atualizado: YYYY-MM-DD | fonte: …`; 2ª linha
  o cabeçalho. Formato atual: `champion,role,tier,winrate,pickrate,banrate` (as 3 stats
  são opcionais/retrocompatíveis). Atualização pelo slash command **`/atualizar-meta`**
  (arquiva o atual, raspa o mobatrainer por rota, valida nomes contra `sinergia-champs.csv`,
  reescreve). Meta > 30 dias = a UI avisa "desatualizado" e o peso do meta cai 50%.
- **Builds (`builds-champs.json`)** são **curadas/heurísticas**, não winrate ao vivo:
  `presets` (itens + página de runas por estilo) + `champions` (itens da build principal
  por campeão). `championCatalog.classPresetChain` escolhe até 3 presets por classe/dano/rota.

## Limites honestos (diga isto ao usuário quando perguntarem)

- **Não temos winrate por build nem lista de counters** — a API da Riot não expõe
  estatística agregada de campeão; WR/PR/BR por campeão/rota só existem se preenchidos no
  `meta-tiers.csv` (via `/atualizar-meta`, fonte externa mobatrainer). Não invente números.
- O módulo **Campeões é estático**: reflete o que está nos arquivos do repo + Data Dragon.

## Backend (resumo — detalhes no README/ARCHITECTURE)

- **`worker.js`** (Cloudflare): proxy da Riot, cache-first no D1, rotas por `action`
  (`profile_overview`, `fetch_recent_matches`, `profile_brief`, `masteries`,
  `player_suggest`, `rate_status`, `admin_*`). Esconde `RIOT_API_KEY`; `admin_*` exigem
  `ADMIN_PASSWORD` (fail-closed → 503 sem secret).
- **`shared/match-extract.js`** — lógica ÚNICA de extração/SQL de partidas, importada
  pelo worker e pelo coletor (sem duplicação).
- **`cron/`** — coletor noturno (`sync.js`, `backfill.js`), relatório do Discord
  (`relatorio-discord.js`), infra compartilhada em `cron/lib/`.
- **`docs/DATABASE.md`** — schema do D1 (jogadores, partidas, estatisticas_*, maestrias,
  lp_historico).

## Ao mexer no repo

- Commit/deploy **só quando o usuário pedir**. Front → GitHub Pages (precisa `404.html`).
  Worker é deploy **separado** (Wrangler) — não é publicado junto com o front.
- Rode `npm run build` + `npm test` antes de concluir.
