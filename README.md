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
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (sistema como um todo) ·
> [`docs/DATABASE.md`](docs/DATABASE.md) (schema do banco).

---

## 🚀 Funcionalidades

- **Perfil / Histórico:** estatísticas ranqueadas (Solo/Duo e Flex), taxa de vitória
  e as últimas partidas com KDA, itens, dano e duração.
- **Maestrias:** Top campeões em lista progressiva + grade densa interativa.
- **Planejador de Sinergia:** simulador de composições (Solo/Duo ou Flex) que trava
  campeões pela maestria/proficiência real e avalia o time (dano, CC, frontline, ritmo).
- **Coleta contínua:** job noturno que ingere o histórico e extrai *snapshots* da
  timeline nos minutos-chave (Marcos Temporais) para gráficos de evolução.
- **Telemetria de API:** widget que monitora o rate limit da Riot (janela deslizante)
  contando **só** as chamadas reais — leituras do cache D1 não gastam o orçamento.

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

> ⚠️ **Paridade:** a lógica de extrair/gravar partidas vive em `worker.js` **e** em
> `cron/lib/match-extract.js`. Ao mudar colunas/INSERT, atualize os **dois**.
> Detalhes completos em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

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

> O front consome o Worker de produção definido em `WORKER_URL` ([`src/utils.js`](src/utils.js)).
> Para apontar para outro Worker, altere essa constante.

---

## 🔒 Back-end: Cloudflare Worker

O front nunca fala direto com a Riot (protege a chave e evita CORS). O `worker.js`
é o proxy. Para implantar sua própria instância:

1. Crie um Worker na Cloudflare e um banco **D1**, com o binding `DB` apontando para ele.
2. Configure o secret `RIOT_API_KEY` no painel do Worker.
3. Rode as migrations do banco (ver abaixo).
4. Publique `worker.js` e aponte `WORKER_URL` em [`src/utils.js`](src/utils.js) para a URL gerada.

### Rotas (contrato)

`POST WORKER_URL` com JSON `{ action, gameName?, tagLine?, puuid? }`:

| `action` | Retorno |
|---|---|
| `profile_overview` | Perfil completo + últimas partidas |
| `profile_brief` | Perfil leve (sem histórico) |
| `masteries` | Maestrias (também persistidas no D1) |
| `admin_all_history` | Dashboard "Ancestralidade" (agregação do D1) |
| `admin_players_list` / `admin_set_premium` | Aba "Jogadores": lista e marca premium |

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
node --env-file=local/.env cron/sync.js

# Backfill: reprocessa TODO o histórico baixado (preenche colunas novas)
BACKFILL=1 node --env-file=local/.env cron/sync.js

# Backfill centrado na partida: recupera partidas faltantes (até 1000/jogador)
node --env-file=local/.env cron/backfill.js
```

- Núcleo do time (`PUUIDS_PRIORITARIOS` em `cron/sync.js`) roda primeiro.
- Para rodar filtrado por jogadores específicos: `PUUIDS="puuid1,puuid2" node ... cron/sync.js`.
- O coletor tem controle de rate limit próprio (pausa ~2 min perto de 100 req/2min;
  trata 429 e 5xx com backoff).

---

## 📜 Relatório da Tribo no Discord

Job que lê o D1 e posta um relatório analítico por jogador (pontos fortes/fracos,
evolução vs. período anterior, recomendações de champ/rota cruzadas com o meta) num
canal do Discord via **webhook**. Texto gerado por regras (NLG "IA sem IA"), sem LLM.

Cobre **só jogadores premium** (`has_premium = 1`), igual ao sync/backfill. Uma lista
explícita de `PUUIDS` (run manual) é escape hatch e ignora o filtro premium.

- Motor: [`cron/lib/relatorio-engine.js`](cron/lib/relatorio-engine.js) (JS puro).
- Job: [`cron/relatorio-discord.js`](cron/relatorio-discord.js).
- Agendamento: [`.github/workflows/relatorio-discord.yaml`](.github/workflows/relatorio-discord.yaml)
  — diário (18:30 BRT), semanal (segunda) e mensal (dia 1). Só Ranked (Solo/Flex).
  O sync roda 05:00 e 17:00 BRT.
- **Janela de análise (`PERIODO`):** `dia` = últimos 7 dias · `semana`/`mes` = últimos 30 dias
  · `50` = últimas 50 partidas por jogador · `geral` = todo o histórico. (`50`/`geral` não
  têm tendência, por não serem recorte de tempo.)
- **Seletor (`PUUIDS`):** vazio = **só premium** · lista de puuids = exatamente esses ·
  **prefixo de nick** (ex.: `UGA`) = todos cujo game_name começa com isso (ignora premium).
- Cada card traz a prosa + **Top 5 WR**, **Top 5 mais jogados** e **WR por rota com o melhor
  champ de cada rota**.
  Disparo manual: GitHub → Actions → "Relatorio Tribo Discord" → Run workflow.

```bash
# Testar local sem postar (imprime o relatório):
DRY_RUN=1 PERIODO=semana node --env-file=local/.env cron/relatorio-discord.js

# Postar de verdade (precisa DISCORD_WEBHOOK no local/.env):
PERIODO=semana node --env-file=local/.env cron/relatorio-discord.js

# Alvo específico (puuids OU prefixo de nick) e outras janelas:
PUUIDS="UGA" PERIODO=50 node --env-file=local/.env cron/relatorio-discord.js   # todos "UGA", últimas 50
PERIODO=geral node --env-file=local/.env cron/relatorio-discord.js             # premium, todo o histórico
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

### Atualizar o meta (tier list)

1. Abra o Claude (web, com busca) e cole o prompt de `.github/prompts/PLANNER-FINAL-sinergia-v2.md` (Anexo A).
2. Salve a resposta como `src/data/meta-tiers.csv` (substituindo o anterior).
3. Confira a 1ª linha: `# patch: X | atualizado: YYYY-MM-DD`.
4. Commit + deploy. A UI exibe o novo patch automaticamente.

Se o CSV passar de 30 dias, a UI avisa "meta desatualizado" e o peso do meta cai pela metade.

---

## 📁 Estrutura do projeto

```
src/               Front-end Vue (App, Router, store, api, components, utils, data)
worker.js          Cloudflare Worker (proxy Riot + cache-first no D1)
cron/              Coletor Node (sync.js, backfill.js, lib/match-extract.js)
migrations/        Migrations do D1 (SQL)
docs/              ARCHITECTURE.md + DATABASE.md (referência para devs e IAs)
public/ dist/      Assets estáticos e build
```

---

## 📝 Licença

Uso pessoal e educacional, seguindo as diretrizes do **Riot Games Developer Portal**.
Não é endossado pela Riot Games.
