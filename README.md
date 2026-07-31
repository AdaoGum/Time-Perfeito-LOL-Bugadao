# Time Perfeito LOL 🐒

Aplicação web para um grupo de jogadores de **League of Legends**: busca de perfis,
histórico detalhado de partidas, análise de maestrias e um **Planejador de Sinergia**
que ranqueia composições de time pela proficiência real de cada jogador.

Diferente de um tracker comum, o projeto mantém um **banco de dados próprio**
(Cloudflare D1) alimentado por um coletor noturno — o que permite gráficos de
evolução (LP e "Marcos Temporais" da timeline) e recomendações táticas baseadas em
dados históricos, sem estourar o rate limit da API da Riot.

- **App:** https://ugabugatimeperfeito.bugadao.com
- **Stack:** Vue 3 + Vite + Tailwind v4 (front) · Cloudflare Worker (proxy) · Cloudflare D1 (banco) · Node (coletor)

> 📚 **Documentação para IAs e devs:**
> [`CLAUDE.md`](CLAUDE.md) (resumo do sistema p/ IAs) ·
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (sistema como um todo) ·
> [`docs/DATABASE.md`](docs/DATABASE.md) (schema do banco).

O app tem **dois grandes mundos**: **Jogadores** (perfil/histórico/maestrias/tribo,
que dependem do Worker+D1) e **Campeões** (Panteão/Relíquias/Meta, **100% client-side**
sobre o Data Dragon + arquivos estáticos do repo — sem tocar no Worker nem gastar a chave).

---

## 🚀 Funcionalidades

### 👑 Jogadores
- **Perfil / Histórico:** estatísticas ranqueadas (Solo/Duo e Flex), taxa de vitória
  e as últimas partidas com KDA, itens, dano e duração. O perfil se divide em duas
  páginas — **Histórico** ("Caçadas Passadas") e **Estatísticas** ("Olhar Espiritual") —
  com alternador no canto; um banner mostra quantos jogos ainda não foram buscados e um
  botão baixa os **últimos 10**. Jogadores **premium** chegam "tudo montado" (sincronizados
  de madrugada); os demais trabalham sob demanda com o que há no banco + 10 jogos por clique.
- **Maestrias ("Caverna dos Monos"):** pódio dos 5 mais dominados com molduras de metal
  (ouro, prata, bronze, ferro, madeira), depois #6–#20 e o resto — todos no mesmo card de
  campeão do Panteão/Meta, com nível e pontos. A busca aqui usa o perfil **leve**
  (`profile_brief`): sem histórico, sem proficiência, sem companheiros — só identidade +
  maestrias, que é tudo que a tela precisa.
- **Ancestralidade:** painel de consulta avançada ao D1 (admin, exige senha no Worker).

### 🐉 Campeões
- **Panteão ("/champions"):** catálogo de todos os campeões com filtro por rota; ficha
  (modal) com habilidades, **radar tático 8D**, **build do meta** (iniciais → núcleo →
  finalização, em **até 3 caminhos** com winrate e amostra por item), runas, ordem de
  skills, counters, meta por rota (tier + WR/PR/BR) e **lore**. A ficha tem um botão
  **Expandir** que a leva a ocupar a área entre a sidebar e a topbar, com a arte da skin
  ao fundo (duplo clique abre inteira), um card do campeão à direita com navegação de
  skins e link para o **modelo 3D** (Khada), e a **galeria de skins**.
- **Relíquias ("/items"):** arsenal de itens do Rift com busca, filtro por categoria,
  descrição/atributos, ouro (receita/venda), componentes/evoluções navegáveis e
  **sinergia inversa** (campeões que constroem o item).
- **Meta & Tier List ("/meta"):** quadro com os ranks **lado a lado** — S, A e B abertos,
  C e D minimizados em espinhas (clicar abre e fecha o aberto mais distante). Seletor de
  rota com ícones oficiais e a opção **Todas** (cada campeão no seu melhor tier). Clique
  num campeão abre a ficha ali mesmo.

### 🐢 Equipes
- **Tribo Perfeita ("/synergy"):** simulador de composições (Solo/Duo ou Flex) que trava
  campeões pela maestria/proficiência real e avalia o time (dano, CC, frontline, ritmo).
- **Customizada 5x5 ("/saguaoCustom"):** lobby custom com balanceamento de times.

### 🔎 Transversal
- **Busca híbrida:** o `SearchBar` aceita jogador (`Nome#TAG`) **e** campeão no mesmo
  campo (prop `context`: players/champions/global — global mostra até 6, ideal 3+3).
- **Navegação temática:** sidebar em seções com **títulos clicáveis** (hubs de Jogadores
  e Campeões), prévias nas abas da topbar, e Home com 4 portais (espíritos do Udyr).
- **Coleta contínua:** job noturno que ingere o histórico e extrai *snapshots* da
  timeline nos minutos-chave (Marcos Temporais) para gráficos de evolução.
- **Monitor de API:** widget minimizável que monitora o rate limit da Riot (janela
  deslizante) contando **só** as chamadas reais — leituras do cache D1 não gastam o orçamento.

---

## 🏗️ Arquitetura (visão rápida)

```
Front (Vue/GitHub Pages) ──POST {action}──► Worker (Cloudflare) ──► D1 (cache-first)
                                                     │                 ▲
                                                     └──► Riot API      │ grava
                                                                        │
                        Coletor noturno (Node: cron/sync.js) ──────────┘
```

- **Front-end** (`src/`): SPA Vue com `vue-router`; estado global em `store.js`;
  todas as chamadas passam por `api.js` → `WORKER_URL`.
- **Worker** (`worker.js`): esconde a `RIOT_API_KEY`, resolve CORS e serve
  **cache-first** do D1, chamando a Riot só quando falta dado.
- **Banco** (Cloudflare D1 / SQLite): `jogadores`, `partidas`,
  `estatisticas_jogador_partida`, `estatisticas_jogador_marcos`, `maestrias`,
  `lp_historico`. Detalhes em [`docs/DATABASE.md`](docs/DATABASE.md).
- **Coletor** (`cron/`): roda fora do edge e grava no D1 via API HTTP do Cloudflare.

> ✅ **Fonte única:** a lógica de extrair/gravar partidas vive num só módulo
> [`shared/match-extract.js`](shared/match-extract.js), **importado** pelo `worker.js`,
> `cron/sync.js` e `cron/backfill.js` (o bundle do Worker resolve via esbuild). Coluna
> nova entra num lugar só. Detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | Vue 3 (Composition API, `<script setup>`), `vue-router` |
| Build / Estilo | Vite, Tailwind CSS v4 |
| Back-end / Proxy | Cloudflare Workers |
| Banco | Cloudflare D1 (SQLite) |
| Coletor | Node.js (`--env-file`) + API HTTP do Cloudflare D1 |
| Dados | Riot Games API + Data Dragon (assets) |

---

## ⚙️ Rodando o front-end localmente

```bash
npm install
npm run dev       # http://localhost:5173
```

Outros scripts (`package.json`):

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite). |
| `npm run build` | Build de produção em `dist/`. |
| `npm run postbuild` | Copia `dist/index.html` → `dist/404.html` (SPA no GitHub Pages). |
| `npm run preview` | Serve o build localmente. |
| `npm test` | Testes de `src/utils/__tests__/*.test.js` (`node --test`). |
| `npm run meta:archive` | Arquiva o `meta-tiers.csv` atual em `src/data/meta-history/`. |
| `npm run deploy:worker` | Publica o `worker.js` na Cloudflare via Wrangler. |
| `npm run deploy:worker:dry` | Valida o bundle do Worker **sem** publicar (dry-run). |

> O front consome o Worker de produção definido em `WORKER_URL` ([`src/utils.js`](src/utils.js)).
> Para apontar para outro Worker, altere essa constante.
>
> **Assets (Data Dragon):** a versão do patch é resolvida **automaticamente** no boot
> (`resolveDDragonVersion()` em [`src/utils.js`](src/utils.js) lê o `versions.json` da Riot).
> Assim ícones de campeões/itens novos nunca ficam quebrados. A constante
> `DDRAGON_VERSION` é apenas o *fallback* caso o CDN da Riot esteja fora do ar.

---

## 🔒 Back-end: Cloudflare Worker

O front nunca fala direto com a Riot (protege a chave e evita CORS). O `worker.js`
é o proxy. Para implantar sua própria instância:

1. Crie um Worker na Cloudflare e um banco **D1**, com o binding `DB` apontando para ele.
2. Configure o secret `RIOT_API_KEY` no painel do Worker. Configure também
   `ADMIN_PASSWORD` — **obrigatório** para o painel Ancestralidade: sem ele, as
   rotas `admin_*` respondem 503 (não há mais senha embutida no código).
3. Rode as migrations do banco (ver abaixo).
4. Ajuste `name`/`account_id`/`database_id` em [`wrangler.toml`](wrangler.toml) e aponte
   `WORKER_URL` em [`src/utils.js`](src/utils.js) para a URL gerada.

### Deploy do Worker (Wrangler)

O deploy é feito por **Wrangler** (config em [`wrangler.toml`](wrangler.toml)), não mais
por copiar-colar no dashboard:

```bash
npm run deploy:worker:dry   # valida o bundle sem publicar
npm run deploy:worker        # publica na Cloudflare (sempre vai pra produção)
```

Além disso, o workflow [`.github/workflows/deploy-worker.yaml`](.github/workflows/deploy-worker.yaml)
**publica automaticamente** sempre que `worker.js` ou `wrangler.toml` mudam na `main`
(precisa do secret `CLOUDFLARE_API_TOKEN` com permissão *Workers Scripts: Edit*). Os
secrets do Worker (`RIOT_API_KEY`, `ADMIN_PASSWORD`) persistem entre deploys.

### Rotas (contrato)

`POST WORKER_URL` com JSON `{ action, gameName?, tagLine?, puuid?, q?, refresh? }`
(também aceita `GET` com querystring):

| `action` | Retorno |
|---|---|
| `profile_overview` | Perfil + partidas **do D1** (busca barata: não baixa nada de jogador conhecido). Devolve `pendingCount` (jogos ranqueados ainda não buscados) e `hasPremium`. Jogador **novo** ganha auto-download das 10 últimas. |
| `fetch_recent_matches` | Botão "buscar últimos 10": baixa as até 10 ranqueadas mais recentes fora do D1 (detalhe + timeline), atualiza o elo e devolve o estado novo (máx. ~24 chamadas). |
| `profile_brief` | Perfil leve (sem histórico) |
| `masteries` | Maestrias (também persistidas no D1) |
| `player_suggest` | Autocomplete: até 5 jogadores do D1 que casam com `q` (0 chamadas à Riot) |
| `rate_status` | Status do orçamento global de rate limit (só lê o D1) |
| `admin_all_history` | Dashboard "Ancestralidade" (agregação do D1). **Exige `password`**; página de até 20 000 partidas (as mais recentes). Cursor opcional `before` (`game_creation`) traz as **mais antigas** (`nextCursor`) → botão "carregar mais" no front |
| `admin_players_list` / `admin_set_premium` | Aba "Jogadores": lista e marca premium. **Exigem `password`** |

> 🔒 As rotas `admin_*` validam a senha **no servidor** contra o secret
> `ADMIN_PASSWORD` do Worker — sem fallback embutido. Se o secret não estiver
> configurado, respondem **503** (nada de painel aberto por padrão).

---

## 🗄️ Banco de dados (Cloudflare D1)

Schema completo, colunas e relacionamentos em [`docs/DATABASE.md`](docs/DATABASE.md).

**Aplicar migrations:**

```bash
wrangler d1 execute <NOME_DO_BANCO> --remote --file=./migrations/001_analytics.sql
# use --local para testar antes
```

> SQLite/D1 não suporta `ADD COLUMN IF NOT EXISTS`: colunas já existentes fazem o
> comando falhar — ignore/rode só o que falta.

---

## 🌙 Coletor noturno (ingestão de partidas)

Roda **fora** do Cloudflare (VM/PC/cron) e grava no D1 via API HTTP do Cloudflare.
Segredos ficam em `local/.env` (fora do git): `RIOT_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_API_TOKEN`, `D1_DATABASE_ID`.

```bash
# Trator noturno: baixa as últimas ~200 partidas de cada jogador e grava só as inéditas
# (também busca as MAESTRIAS de cada jogador e grava na tabela `maestrias`)
node --env-file=local/.env cron/sync.js

# Backfill: reprocessa TODO o histórico baixado (preenche colunas novas)
BACKFILL=1 node --env-file=local/.env cron/sync.js

# Backfill centrado na partida: recupera partidas faltantes (até 1000/jogador)
node --env-file=local/.env cron/backfill.js
```

- Núcleo do time (`PUUIDS_PRIORITARIOS` em `cron/sync.js`) roda primeiro.
- Sem `PUUIDS` explícito, tanto o `sync.js` quanto o `backfill.js` processam **só premium**.
- Para rodar filtrado por jogadores específicos: `PUUIDS="puuid1,puuid2" node ... cron/sync.js`.
- O coletor tem controle de rate limit próprio (pausa ~2 min perto de 100 req/2min;
  trata 429 e 5xx com backoff). A infra de D1/Riot dos jobs é **compartilhada** em
  `cron/lib/d1.js` e `cron/lib/riot.js` (importada por `sync.js`, `backfill.js` e `relatorio-discord.js`).

---

## 📜 Relatório da Tribo no Discord

Job que lê o D1 e posta um relatório analítico por jogador (pontos fortes/fracos,
evolução vs. período anterior, recomendações de champ/rota cruzadas com o meta) num
canal do Discord via **webhook**. Texto gerado por regras (NLG "IA sem IA"), sem LLM.

**Dois relatórios separados:** por padrão o job gera **um relatório para Ranked
Solo/Duo e outro para Flex** — cada um com seu cabeçalho, cor e prosa própria (o mesmo
jogador ganha texto diferente em cada fila, porque a semente da prosa inclui a fila).

Cobre **só jogadores premium** (`has_premium = 1`), igual ao sync/backfill. Uma lista
explícita de `PUUIDS` (run manual) é escape hatch e ignora o filtro premium.

- Motor: [`cron/lib/relatorio-engine.js`](cron/lib/relatorio-engine.js) (JS puro).
- Job: [`cron/relatorio-discord.js`](cron/relatorio-discord.js).
- Agendamento: [`.github/workflows/relatorio-discord.yaml`](.github/workflows/relatorio-discord.yaml)
  — **semanal todo dia às 19:00 BRT** (últimos 7 dias) e **mensal toda sexta às 19:00 BRT**
  (últimos 30 dias). Só Ranked (Solo + Flex). O sync roda 04:00 e 17:30 BRT.
- **Janela de análise (`PERIODO`):** `semanal` = últimos 7 dias · `mensal` = últimos 30 dias
  · `50` = últimas 50 partidas por jogador · `todos` = todo o histórico. (`50`/`todos` não
  têm tendência, por não serem recorte de tempo.) Os nomes antigos (`dia`/`semana`/`mes`/`geral`)
  ainda funcionam como aliases.
- **Fila (`FILA`):** `ambas` (default) reporta Solo/Duo **e** Flex no **mesmo card** de cada
  jogador · `solo` = só Ranked Solo/Duo · `flex` = só Ranked Flex.
- **Seletor (`PUUIDS`):** vazio = **só premium** · lista de puuids = exatamente esses ·
  **`Nome#Tag`** (ex.: `UGA Fulano#2109`) = match **exato** por nome+tag (imune a nick
  duplicado) · **prefixo de nick** (ex.: `UGA`) = todos cujo game_name começa com isso.
  Tudo ignora o filtro premium; dá para misturar `Nome#Tag` e prefixos na mesma lista.
- **Cabeçalho** (repetido no topo de cada mensagem): período, filas cobertas, **nº de partidas
  avaliadas por fila** e a **data da primeira/última partida** da amostra.
- Cada card traz a prosa (da fila mais jogada) + um bloco por fila com **Top 3 WR**, **mais
  jogados** e **WR por rota**.
  Disparo manual: GitHub → Actions → "Relatorio Tribo Discord" → Run workflow.

```bash
# Testar local sem postar (imprime o relatório):
DRY_RUN=1 PERIODO=mensal node --env-file=local/.env cron/relatorio-discord.js

# Postar de verdade (precisa DISCORD_WEBHOOK no local/.env):
PERIODO=semanal node --env-file=local/.env cron/relatorio-discord.js

# Alvo específico (puuids OU prefixo de nick) e outras janelas:
PUUIDS="UGA" PERIODO=50 node --env-file=local/.env cron/relatorio-discord.js   # todos "UGA", últimas 50
PERIODO=todos node --env-file=local/.env cron/relatorio-discord.js             # premium, todo o histórico

# Só uma fila (Solo OU Flex):
DRY_RUN=1 FILA=solo PERIODO=mensal node --env-file=local/.env cron/relatorio-discord.js   # só Solo/Duo
FILA=flex PERIODO=semanal node --env-file=local/.env cron/relatorio-discord.js            # posta só Flex
```

**Secrets (GitHub → Settings → Secrets → Actions → Repository secrets):**
`DISCORD_WEBHOOK` (obrigatório), `DISCORD_USER_MAP` (opcional, JSON
`{"NomeInvocador":"idDiscord"}` p/ @menção). Nada de worker/Cloudflare envolvido —
o relatório roda só no GitHub Actions.

---

## 🧠 Motor de Sinergia v2

O Planejador ranqueia cada candidato com score **normalizado 0–1**:

```
scoreIndividual = 0.40·proficiência + 0.20·metaScore + 0.10·roleFit
scoreDeTime     = Σ scoreIndividual + 0.30·(aderênciaArquétipo + sinergiaDePares + balanceamento)
```

- **Proficiência** ([`src/utils/proficiencia.js`](src/utils/proficiencia.js)): winrate
  bayesiano, recência (último jogo), maestria e desempenho (KDA/CS/min).
- **Meta** ([`src/data/meta-tiers.csv`](src/data/meta-tiers.csv)): S/A/B/C/D →
  1.0/0.8/0.6/0.4/0.25; fora do CSV = 0.5 (neutro). O meta **pondera, nunca domina**.
- **Vetores táticos** ([`src/data/sinergia-champs.csv`](src/data/sinergia-champs.csv)):
  8 dimensões + `cc`/`scaling`/`mechTags`; arquétipos (ENGAGE/POKE/PROTECT/PICK/
  SPLITPUSH) e pares sinérgicos.
- Composição resolvida por **otimização global** (produto cartesiano dos top 8 por slot).
- Dados ausentes degradam para **neutro** — nunca quebram.

### Atualizar o meta (tier list + WR/PR/BR)

Use o slash command **`/atualizar-meta`** (definido em
[`.claude/commands/atualizar-meta.md`](.claude/commands/atualizar-meta.md)). Ele:

1. Arquiva o `meta-tiers.csv` vigente (`npm run meta:archive` → `src/data/meta-history/`).
2. Descobre o patch atual e raspa as tier lists por rota (fonte primária: mobatrainer).
3. Valida os nomes contra `sinergia-champs.csv` (descarta ruído/campeão sem perfil).
4. Reescreve o CSV. **Formato atual (6 colunas):**
   `champion,role,tier,winrate,pickrate,banrate` — as 3 estatísticas são **opcionais**
   (célula vazia = sem dado; a UI mostra "—") e **retrocompatíveis** com o formato antigo
   de 3 colunas. A 1ª linha é sempre `# patch: X | atualizado: YYYY-MM-DD | fonte: …`.
5. Commit + deploy (você revisa). A UI exibe o novo patch e o WR na Tier List/ficha.

Se o CSV passar de 30 dias, a UI avisa "meta desatualizado" e o peso do meta cai pela metade.

> ⚠️ **Os dois rótulos de patch são diferentes e ambos estão certos.** O Data Dragon usa
> a numeração dele (`16.14.1`); o patch do **jogo** é `26.14` (defasagem de 10). Por isso
> `meta-tiers.csv` diz `26.14` e `meta-builds.json._meta.patch` diz `16.14`. Não "corrija"
> um pelo outro.

### Atualizar as builds do meta (itens reais + WR + skill order)

Use o slash command **`/atualizar-builds`**. Ele roda o pipeline **local** em
`local/scrape/` (gitignored) — só `fetch()` em Node, sem navegador, sem IA, ~6 min para
os 273 combos campeão×rota:

1. `gen-targets.mjs` — monta os alvos a partir do `meta-tiers.csv`.
2. `fetch-builds.mjs` — raspa o lolalytics e escreve `src/data/meta-builds.json`.
3. `verify.mjs` — confere cobertura, IDs de Arena, campos vazios e quantas entradas
   renderam 1, 2 ou 3 caminhos de finalização.

O JSON guarda, por chave `Campeão|ROTA`: `buildWr`, `start`, `core`, `boots`, **`slots`**,
`situational`, `skillMax`, `skillLevels` e `counters`. O campo **`slots`** é o Item 4/5/6
**agrupado**, com até 3 opções por slot (id + winrate + amostra) — é dele que
`metaBuildVariants()` monta as **até 3 builds** da ficha: a Build 1 pega a opção mais
jogada de cada slot, a Build 2 a seguinte, e assim por diante.

> ⚠️ **Nada disso vem da API da Riot** (ela não expõe estatística agregada de campeão).
> Tier/WR/PR/BR vêm do mobatrainer via `/atualizar-meta`; itens, skill order e counters
> vêm do lolalytics via `/atualizar-builds`. As **runas** continuam saindo do
> `builds-champs.json` (curadas) — o scrape não captura runa, então o vínculo
> "runa ↔ build" é heurístico. O `buildWr` é a aba "Highest Win Build" e **infla em
> amostra baixa**: sempre mostre a amostra junto do winrate.

---

## 🐉 Módulo Campeões (client-side)

O Panteão, as Relíquias e o Meta rodam **inteiramente no navegador**, sobre o Data Dragon
+ arquivos estáticos do repo — sem Worker, sem D1, sem gastar a chave da Riot.

- **Motor:** [`src/utils/championCatalog.js`](src/utils/championCatalog.js) — cruza
  `sinergia-champs.csv` (rotas/tags), `meta-tiers.csv` (tier + WR/PR/BR) e
  [`builds-champs.json`](src/data/builds-champs.json) (builds). Expõe `rolesOf`,
  `buildsFor` (até 3 builds com runas+itens), `championsForItem` (sinergia inversa),
  `metaTiersByRole`, `metaEntriesOf`.
- **Builds:** `builds-champs.json` tem `presets` (itens + página de runas por estilo),
  `runePages` (IDs de perk do runesReforged) e `champions` (itens da build principal por
  campeão). `classPresetChain` escolhe até 3 presets por classe/dano/rota.
- **Fichas sob demanda:** `fetchChampionDetail` (em `utils.js`) busca `champion/<id>.json`
  do Data Dragon ao abrir a ficha (habilidades, lore, **skins**) e cacheia por versão.
- **Ícones de rota:** `roleIconImage` usa os ícones **oficiais** de posição (Community
  Dragon), não FontAwesome, em todo o projeto.

---

## 📁 Estrutura do projeto

```
CLAUDE.md            Resumo do sistema para IAs (onboarding rápido)
src/                 Front-end Vue
  App.vue            Layout global: topbar (com prévias), sidebar em seções, monitor de API
  Router.js          Rotas (jogador, campeões, hubs, tribo)
  store.js           Estado reativo (searchProfile, staticData, telemetry, ui)
  api.js             Cliente do Worker + telemetria de rate limit
  utils.js           WORKER_URL, Data Dragon, helpers de imagem (incl. roleIconImage oficial)
  utils/championCatalog.js   Motor do módulo Campeões (rotas, builds, meta, sinergia inversa)
  utils/sinergiaMotor.js     Motor de sinergia v2 + parser do meta (com WR/PR/BR)
  utils/proficiencia.js      Proficiência do jogador no campeão
  components/        Telas e auxiliares (ver abaixo)
  data/              meta-tiers.csv, sinergia-champs.csv, builds-champs.json, meta-history/
worker.js            Cloudflare Worker (proxy Riot + cache-first no D1)
wrangler.toml        Config do deploy do Worker (Wrangler)
shared/              Lógica única de extração de partidas (worker + coletor)
cron/                Coletor Node (sync.js, backfill.js, relatorio-discord.js, lib/)
migrations/          Migrations do D1 (SQL)
scripts/             Utilitários Node (archive-meta.js)
.claude/commands/    Slash commands do projeto (atualizar-meta.md)
docs/                ARCHITECTURE.md + DATABASE.md (referência para devs e IAs)
.github/workflows/   Automação (Pages, sync, relatório, deploy do Worker)
public/ dist/        Assets estáticos e build
```

**Componentes (`src/components/`):**
- **Campeões:** `Champions.vue` + `ChampionSheet.vue` (ficha com modal expansível +
  galeria de skins), `Items.vue` + `ItemDetail.vue`, `MetaTierList.vue`, `ModuleHub.vue` (hubs).
- **Jogador/Tribo:** `Home.vue`, `Profile.vue`, `Mastery.vue`, `Tribo.vue`,
  `saguaoCustom.vue`, `Ancestralidade.vue`.
- **Auxiliares:** `SearchBar.vue` (busca híbrida), `SearchGate.vue`, `PlayerAnalysis.vue`,
  `RadarChart.vue`, `KpiCard.vue`, `CustomSlotCard.vue`, `FilaSelecao.vue`, `AsyncState.vue`.

---

## 🤖 Automação (GitHub Actions)

| Workflow | Quando roda | O que faz |
|---|---|---|
| [`deploy.yml`](.github/workflows/deploy.yml) | push na `main` / manual | Build do Vue e publish no **GitHub Pages**. |
| [`deploy-worker.yaml`](.github/workflows/deploy-worker.yaml) | mudança em `worker.js`/`wrangler.toml` / manual | Publica o **Worker** na Cloudflare (Wrangler). |
| [`riot-sync.yaml`](.github/workflows/riot-sync.yaml) | 04:00 e 17:30 BRT / manual | Roda o **coletor** (`cron/sync.js`) e sobe os logs como artefato. |
| [`relatorio-discord.yaml`](.github/workflows/relatorio-discord.yaml) | 19:00 BRT diário (semanal) + sexta (mensal) / manual | Posta o **relatório da Tribo** no Discord. |

> Secrets usados: `RIOT_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
> `D1_DATABASE_ID`, `DISCORD_WEBHOOK` (e `DISCORD_USER_MAP` opcional).

---

## 📝 Licença

Uso pessoal e educacional, seguindo as diretrizes do **Riot Games Developer Portal**.
Não é endossado pela Riot Games.
