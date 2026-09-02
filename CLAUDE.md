# CLAUDE.md — Resumo do sistema (para IAs)

> Onboarding rápido para agentes/IAs entenderem o **bUGAdão Analytics (Time Perfeito
> LoL)** de ponta a ponta. É o mapa mental; os detalhes profundos ficam em
> [`README.md`](README.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
> [`docs/DATABASE.md`](docs/DATABASE.md) e [`docs/SINERGIA-E-META.md`](docs/SINERGIA-E-META.md)
> (pesos do motor de sinergia + contrato do `meta-tiers.csv`). Se algo aqui divergir do
> código, **o código vence** — verifique antes de recomendar.

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
npm test           # node --test em src/utils/__tests__/*.test.js (43 testes)
npm run meta:archive   # arquiva o meta-tiers.csv atual em src/data/meta-history/
```
Slash commands: **`/atualizar-meta`** (tier list) e **`/atualizar-builds`** (builds do
lolalytics — roda `local/scrape/`, ~6 min de rede local, zero IA).
Sempre rode `npm run build` **e** `npm test` antes de dar por concluída uma mudança.

O usuário tem um **`Atualizar-Meta.exe`** em **`local/atualizador/`** (junto do fonte
`AtualizarMeta.cs`; a pasta inteira é gitignored — e é o ÚNICO executável: a cópia que
ficava na raiz saiu) que roda sozinho os passos MECÂNICOS: `archive-meta` → `gen-targets` →
`fetch-builds` → `verify`. Quando ele disser "rodei o Atualizar-Meta", os passos 1–3 do
`/atualizar-builds` **já estão feitos** — comece pela verificação/relatório (leia
`local/scrape/out/run.log` e rode `verify.mjs` se precisar), sem re-raspar.

## Mapa de rotas (front)

| Rota | Tela | Observação |
|---|---|---|
| `/` | Home | 4 portais (espíritos do Udyr). **Sem busca** — ela vive na topbar |
| `/jogadores` | ModuleHub (`pilar="jogador"`) | Hub do pilar (título clicável da sidebar / 1º nível da topbar) |
| `/campeoes` | ModuleHub (`pilar="campeoes"`) | Hub do pilar |
| `/historico[/:g/:t]` | Profile (histórico) | "Caçadas Passadas" |
| `/analise[/:g/:t]` | Profile (estatísticas) | "Olhar Espiritual" |
| `/profile[/:g/:t/:view?]` | Profile | Seletor dos 4 caminhos do jogador |
| `/mastery[/:g/:t]` | Mastery | "Caverna dos Monos" — 3ª aba do JOGADOR (busca aqui NÃO sai da tela) |
| `/synergy` | Tribo | "Tribo Perfeita" (planejador de sinergia) |
| `/saguaoCustom` | saguaoCustom | "Customizada 5x5" (lobby custom) |
| `/relatorios[/:g/:t]` | RelatoriosPremium | Relatórios Premium; com o jogador na URL = tela cheia (4ª aba do jogador) |
| `/ancestralidade` | Ancestralidade | Painel D1 (admin, exige senha no Worker) |
| `/meta` | MetaTierList | Tier list S/A/B/C/D por rota + WR. É o PILAR 2 inteiro (hub e página) |
| `/champions/:championId?` | Champions | Panteão; param opcional = deep-link da ficha (modal) |
| `/ficha/:championId` | ChampionPage | Ficha em TELA CHEIA; substitui a tela anterior (botão Voltar) |
| `/items/:itemId?` | Items | Relíquias; param opcional = deep-link do detalhe |

`Router.js` tem um `scrollBehavior` que **não rola** quando só muda o param da mesma
rota (abrir/fechar modal de ficha/item, abrir/fechar um Relatório Premium) — evita o
"pulo" da tela de fundo.

**Só a Home é eager.** Toda outra rota entra por `() => import(...)`, com o chunk
próprio. O que isso tira do bundle inicial não é o componente, é a CAUDA DE DADOS
dele (o Panteão/Meta puxam `meta-builds.json`). Rota nova nasce lazy — voltar a
`import X from './components/X.vue'` no topo do `Router.js` devolve a tela e a
cauda dela para o chunk inicial sem quebrar nada e sem ninguém perceber.

## Onde as coisas moram (front `src/`)

- **`navegacao.js`** — a **fonte ÚNICA** da árvore de telas: os 4 PILARES e as
  PÁGINAS de cada um, com rota, `match`, ícone, descrição e as classes de cor das
  quatro superfícies. Quem lê: `Home.vue`, a topbar e a sidebar do `App.vue` e o
  `ModuleHub.vue`. Ver Convenções — mover tela de lugar é mexer AQUI, e só aqui.
- **`App.vue`** — layout global: topbar de **DUAS LINHAS** (1ª: marca + busca sempre
  visível + os 4 espíritos; 2ª, só dentro de um pilar: as páginas dele + MENU),
  **sidebar com uma seção por pilar** (títulos clicáveis → hubs), botão especial
  laranja **Ancestralidade** no rodapé, e o **Monitor da API** minimizável
  (`ui.telemetryLevel` = tiny|mini|full). Z-index: sidebar/topbar acima do conteúdo;
  overlay de busca e fichas de detalhe acima da sidebar.
- **`TopbarItem.vue`** — um botão da topbar + a prévia de hover (mini mockup por
  `preview`). É componente porque as DUAS linhas usam o mesmo botão: inline no
  `App.vue` seriam ~70 linhas escritas duas vezes.
- **`store.js`** — estado reativo: `searchProfile`, `masteryDashboard`, `telemetry`,
  `ui` (sidebarCollapsed, telemetryLevel), **`championSheet`** (`champ` = ficha aberta;
  `origem` = para onde o Voltar da tela cheia leva) com os helpers **`abrirFicha(champ)`
  / `fecharFicha()`**, e **`staticData`** (`championList`, `items`, `runes`,
  `summonerSpells`, `championDetails` — cache das fichas). O Data Dragon é carregado no
  boot em `App.vue`.
  - `searchProfile.brief` = o perfil veio do `profile_brief` (leve, **sem** partidas /
    proficiência / companheiros). O `Profile.vue` vê essa flag e recarrega o overview
    completo — senão mostraria histórico vazio.
  - `masteryDashboard` tem `loading` e `puuid` (trocar de jogador limpa a lista antiga).
- **`api.js`** — cliente do Worker (`workerRequest`), normalização de perfil, telemetria
  de rate limit, `fetchPlayerSuggestions` (autocomplete de jogadores).
  `loadProfileIntoStore(gameName, tagLine, { action })` aceita `profile_overview`
  (completo) ou `profile_brief` (leve).
- **`utils.js`** — `WORKER_URL`, versão do Data Dragon (`resolveDDragonVersion`), e
  helpers de imagem: `championImage`, `itemImage`, `runeImage`, `championSplashImage`,
  `championLoadingImage`, `championSpellImage`, `championPassiveImage`,
  **`roleIconImage`** (ícones OFICIAIS de rota via Community Dragon — não FontAwesome),
  `fetchChampionDetail` (ficha do campeão sob demanda, com cache), e
  **`canonicalChampionList`** (o `champion.json` do patch 16.15 traz 60 CÓPIAS dos
  campeões — ids `Jade_*`, `key` = 60000 + a original; sem o filtro o Panteão duplica
  card, `championByName` pode cair na cópia e o link 3D do Khada quebra).
- **`utils/championCatalog.js`** — parte LEVE do módulo Campeões: `rolesOf`,
  **`rolesWithMeta`**, `championByName`, `normalizeSearch`, `metaTiersByRole`,
  `metaEntriesOf`, `metaInfo`, `TIER_STYLES`, `ROLES`, `sanitizeDDragonText`.
- **`utils/championBuilds.js`** — parte PESADA, separada só por causa do bundle:
  `buildsFor` (até 3 presets com runas+itens), **`metaBuildVariants`**, `metaBuildFor`,
  `countersEntriesOf`, `championsForItem` (sinergia inversa). É quem importa
  `meta-builds.json` + `builds-champs.json`. **Não importe daqui em nada que carregue
  no boot** (App.vue, SearchBar, store, api): o catálogo leve é usado pela SearchBar,
  que é eager, então qualquer ponte entre os dois devolve os 33k linhas de JSON para o
  chunk inicial — sem quebrar nada e sem avisar. Só a ficha e o detalhe de item usam.
- **`utils/sinergiaMotor.js`** — motor de sinergia v2 + `parseMetaCsv` (lê o meta com
  colunas opcionais `winrate,pickrate,banrate`).
- **`utils/proficiencia.js`** — proficiência real do jogador no campeão.
- **`utils/tilt3d.js`** — `useTilt3d({ gesto })`: inclinação 3D seguindo o ponteiro, no
  **hover** (default, usado no card de skin da ficha) ou por **arrasto** (só gira com o
  ponteiro pressionado, "segurando" — usado na arte ampliada e no pódio da Caverna).
  Equivalente ao `hover-3d` do daisyUI, sem a dependência — ver Convenções.
- **`data/`** — `meta-tiers.csv` (tier + WR/PR/BR), `sinergia-champs.csv` (vetores 8D),
  **`builds-champs.json`** (presets de build + páginas de runas + overrides por campeão),
  **`meta-builds.json`** (build REAL por campeão×rota, do lolalytics),
  `meta-history/` (arquivos versionados do meta).
- **Componentes de Campeões:** `Champions.vue`, **`ChampionSheet.vue`** (ficha ÚNICA,
  `mode='modal'` ou `'pagina'`, com **galeria de skins**), `ChampionPage.vue` (tela cheia
  `/ficha/:championId`), `Items.vue` + `ItemDetail.vue`, `MetaTierList.vue`,
  `ModuleHub.vue` (hubs), e o **`ChampionCard.vue`**.
- **Componentes de Jogador/Tribo:** `Home`, `Profile`, `Mastery`, `Tribo`, `saguaoCustom`,
  `Ancestralidade`, `SearchBar`, `SearchGate`, `PlayerAnalysis`, `RadarChart`, `KpiCard`,
  `CustomSlotCard`, `FilaSelecao`, `AsyncState`, **`AbasJogador`** (a barra de abas do
  canto — ver Convenções) e **`ModuleHub`** (o hub de um pilar, montado do
  `navegacao.js`).
- **Relatórios Premium:** `RelatoriosPremium.vue` (a rota — grid de cards **e** host da
  tela cheia) + `RelatorioJogador.vue` (a tela cheia, `defineAsyncComponent`).
  A tela cheia tem 4 gráficos além do dia a dia: evolução (WR acumulada + KDA),
  radar contra o `BENCH` da rota, rosca de rotas e mapa de calor dia×faixa. Todos
  saem de dados que o Worker JÁ manda — nenhum custa requisição a mais. "Campeões do
  período" usa o **`ChampionCard`** (o mesmo dos cards de partida), no tamanho compacto
  canônico; por isso a seção é de largura inteira e não meia coluna.

## Convenções que importam (não quebre)

- **Nome canônico de campeão = nome de exibição pt_BR** (`champ.name`, ex.: "Dr. Mundo",
  "Cho'Gath") — é a chave dos CSVs e do `builds-champs.json`. Nas **URLs** usa-se o **id
  do Data Dragon** (`champ.id`, ex.: `MonkeyKing`) via `getChampionIdFromName`.
  Nome → objeto do campeão é **sempre** `championByName(store.staticData.championList, nome)`
  (índice memoizado, com fallback `{ name }`). Dois nomes dos nossos CSVs divergem do
  rótulo pt_BR e têm apelido lá dentro: `Bard`→`Bardo`, `Nunu & Willump`→`Nunu e Willump`.
  As URLs de ARTE são montadas a partir do nome, então rótulo pt_BR que não vira o id só
  tirando espaço/pontuação precisa entrar em `CHAMPION_KEY_OVERRIDES` (`Bardo`→`Bard`,
  `Nunu e Willump`→`Nunu`, `Renata Glasc`→`Renata`) — senão a arte dá 404 em toda tela.
- **Numeração de patch: são DOIS sistemas, e nenhum está errado.** O Data Dragon usa a
  versão dele (`16.15.1`); o patch do JOGO é `26.15` (defasagem de 10). Por isso
  `meta-tiers.csv` diz `26.15` e `meta-builds.json._meta.patch` (gerado do DDragon) diz
  `16.15`. **Não "corrija" um pelo outro.**
- **`rolesOf` vs `rolesWithMeta`** — não são intercambiáveis:
  - `rolesOf(champ)` = **identidade** do campeão (planilha de sinergia → tags DDragon).
    É o que alimenta `classPresetChain` (escolha do preset de build por classe). Somar
    rota de nicho aqui troca a build padrão do campeão.
  - `rolesWithMeta(champ)` = identidade **+ rotas onde ele aparece no meta do patch**.
    É o que a UI usa (ícones do card, chips da ficha, rotas com build). 42 das 273
    entradas do meta estão numa rota fora da planilha (Anivia TOP, Nasus JUNGLE…);
    sem a união o campeão aparece na coluna do meio com o ícone de topo e a build
    daquela rota fica inalcançável.
- **`ChampionCard.vue` é o ÚNICO card de campeão** (Panteão, Meta, Caverna dos Monos,
  cards de partida do Histórico e o card de skin da ficha). Ele é `w-full` com proporção
  fixa 308×560 — **quem usa define a largura**. Tamanho compacto canônico: `w-28 sm:w-32`.
  Encaixes por tela sem duplicar o componente: props `winrate`, `frameClass` (troca a
  moldura), `skinNum` (arte de outra skin), `label` (nome exibido), `tilt`
  (`'hover'`|`'arrasto'` — giro 3D), `showRoles`, `popover`, e slots `overlay` (sobre a
  arte) e `footer` (abaixo dela). A arte é `draggable="false"`: sem isso o drag nativo da
  imagem CANCELA o ponteiro e o `tilt="arrasto"` simplesmente não gira.
- **A ficha de campeão é UMA só no sistema.** Nenhuma tela monta `ChampionSheet`: o card
  emite `open` → **`abrirFicha(champ)`** (store) e o host único do `App.vue` renderiza a
  ficha (carregada sob demanda, chunk à parte). Trocar de tela fecha a ficha (watcher do
  `route.matched[0].path`, que ignora o deep-link `/champions/:id` por ser o mesmo
  registro de rota). **Não volte a instanciar a ficha por tela** — era 4 cópias do mesmo
  bloco de HTML/render function.
- **Expandir a ficha é NAVEGAR, não crescer.** O botão de expandir do modal grava a tela
  atual em `championSheet.origem` e vai para **`/ficha/:championId`** (`ChampionPage` →
  `ChampionSheet mode="pagina"`), que SUBSTITUI a tela anterior e volta para ela pelo
  botão "Voltar para …". Nada de `position: fixed` calculando a largura da sidebar.
- **Nada de daisyUI.** O `hover-3d` dele exige 8 divs de zona sobre o conteúdo e a doc
  proíbe conteúdo clicável dentro — nossos cards são `<button>` com clique e popover.
  Use `useTilt3d()` (`utils/tilt3d.js`), que faz o mesmo com eventos de ponteiro, é
  contínuo em vez de quantizado em 8 direções e respeita `prefers-reduced-motion`.
  O card de skin da ficha usa o hover (gira sozinho); a **arte ampliada** e o **pódio da
  Caverna** usam **`gesto: 'arrasto'`** (gira só com o ponteiro pressionado). Elemento com
  `'arrasto'` que também tem clique precisa checar `arrastou` antes de agir — senão girar
  dispara o clique ao soltar (o `ChampionCard` já faz isso).
- **Relatório Premium não tem tabela própria — e isso é de propósito.** Os "dados
  puros" já são `estatisticas_jogador_partida` + `partidas`; o motor agrega sobre a
  janela pedida na hora da consulta. É o que permite o filtro de datas ser LIVRE:
  snapshot semanal/mensal gravado não responderia "01/08 a 17/08". Se um dia ficar
  lento, o caminho é uma tabela de rollup DIÁRIO escrita pelo cron — medindo antes.
  As rotas `premium_players` e `relatorio_premium` do worker **não gastam a chave da
  Riot** (devolvem `apiCalls: 0`) e **não pedem senha**: "premium" ali significa só
  *quem tem relatório* (`has_premium = 1` é quem o cron sincroniza), não área restrita.
- **A data final do filtro é INCLUSIVA para o usuário.** Todo o SQL do relatório usa
  recorte semiaberto `[desde, ate)`, então `diaParaEpoch(iso, true)` empurra a data
  final para o início do dia seguinte — sem isso o último dia escolhido ficaria fora.
  E as duas pontas são fechadas no fuso de **Brasília** (`T00:00:00-03:00`), igual ao
  `'-3 hours'` que o SQL usa em `dias_ativos` e na série diária. `toISOString()` ali
  erraria o dia depois das 21h.
- **A árvore de navegação mora em `src/navegacao.js`, e SÓ lá.** Os 4 pilares
  (Jogador · Meta · Campeões · Equipes) e as páginas de cada um alimentam a Home, a
  topbar, a sidebar e o `ModuleHub` de uma vez. Antes a mesma árvore existia copiada
  nesses quatro lugares: mover uma tela de seção exigia lembrar dos quatro, e esquecer
  um fazia o sistema dizer duas coisas diferentes sobre onde a tela mora. **Tela nova,
  ou tela que muda de pilar, se resolve editando esse arquivo** — nenhuma das quatro
  superfícies precisa saber. Cada nó carrega as classes de cor das quatro (é verboso de
  propósito: é o que faz a Caverna ser âmbar em todo lugar). O Tailwind v4 varre `.js`,
  então as classes escritas lá GERAM CSS normalmente — não mova para variável montada
  em runtime, aí ele deixa de ver.
- **A topbar tem DUAS LINHAS, uma EMBAIXO da outra — não lado a lado.** A de cima
  (marca + busca + TEMPLO e os 4 espíritos) está **sempre** lá e não se transforma: o
  pilar da rota fica aceso nela e os outros três seguem a um clique. A de baixo só
  existe dentro de um pilar e traz as páginas dele. Quem manda nela é a ROTA
  (`pilarNaTopbar = pilarDaRota(route.path)`), então chegar em `/meta` pela sidebar, por
  um link ou por F5 abre a mesma linha que chegar pela topbar — não há estado de "nível
  selecionado" para desencontrar. O **MENU** da linha de baixo abre o **hub** do pilar
  (a tela que lista todas as opções dele) e some quando você já está nele — no Meta, que
  é pilar de página única, ele nunca aparece.
- **A altura do header é MEDIDA, não chutada.** Ela muda quando a 2ª linha aparece, e a
  sidebar (`top`) e o `main` (`padding-top`) se apoiam nela — um `top-16` fixo erra 40px
  com a linha aberta, e erra de novo se a nav quebrar linha numa tela estreita. Um
  `ResizeObserver` no `<header>` alimenta `alturaHeader`; `topoAbaixoDoHeader` e
  `paddingDoMain` (com 32px de respiro) saem daí. Pelo mesmo motivo a `<aside>` usa
  `transition-[width,transform]` e **não** `transition-all`: com `all`, o `top` também
  animava e a sidebar chegava 300ms atrasada toda vez que o header crescia.
- **A busca da topbar está SEMPRE disponível**, em toda rota. Ela sumia na Home, que
  tinha a sua própria caixa central e um morph (FLIP) que a fazia "subir" até a topbar
  ao pesquisar. A Home perdeu a caixa (os portais ficaram maiores no lugar dela), então
  o morph e o `flipMorph` saíram junto: existe UM lugar de buscar, e ele não se move.
- **As quatro telas do jogador são ABAS de um lugar só, e a barra é UMA.**
  `AbasJogador.vue` (Histórico / Estatísticas / Maestrias / Relatório + a seta do
  seletor) é montada pelo `Profile.vue`, pelo `Mastery.vue` E pelo `RelatorioJogador.vue`
  — as mesmas quatro opções, na mesma ordem, do seletor de `/profile`. Cada aba é uma
  ROTA de verdade (`/historico`, `/analise`, `/mastery`, `/relatorios`), então o link
  continua compartilhável e o F5 cai onde estava — não é estado interno de tela nenhuma.
  A aba de Relatório só liga com `premium` (no perfil e na Caverna vem de
  `store.searchProfile.hasPremium`; na tela de relatório é sempre true, porque a lista só
  traz premium); sem isso ela aparece APAGADA com o motivo no `title`, e no seletor o
  cartão ganha um selo de cadeado — em vez de sumir sem explicação. Tela nova do jogador
  entra na barra, senão vira beco: foi por isso que a Caverna ganhou a barra quando a
  maestria deixou de ser portal próprio.
- **O post do Discord é um TEASER, não o relatório.** Desde set/2026 é um card curto
  por jogador (nome, poucos KPIs por fila, @menção e o **link** para `/relatorios`),
  em vez das duas mensagens gordas com prosa e cinco quadros. O detalhe mora no site.
  `SITE_URL` (env, default `https://ugabugatimeperfeito.bugadao.com`) monta o link,
  e `PRESET_DO_PERIODO` traduz o período do post no preset da tela.
- **Os dois posts agendados têm janela ANCORADA, e elas ENCAIXAM.** São 09:00 BRT de
  **segunda** (`fim-de-semana`: desde a última sexta 09:00) e de **sexta** (`semana-util`:
  desde a última segunda 09:00). Não é "últimos N dias": numa segunda, "últimos 3 dias"
  pegaria a sexta inteira — inclusive o que o post da sexta de manhã já tinha contado.
  Com a âncora, a janela de uma termina exatamente onde a da outra começa: nada fica
  de fora, nada conta duas vezes. A hora do corte é `HORA_CORTE` em
  `shared/relatorio-metricas.js` e **precisa bater com o cron** do
  `.github/workflows/relatorio-discord.yaml` — mexer só num dos dois abre (ou repete) uma
  manhã de partidas. Esses períodos também usam `desloc: 7 dias`, então "contra o período
  anterior" é a MESMA janela da semana passada, e o link do card vai como intervalo livre
  (`preset=outro&de&ate`), o único filtro da tela capaz de dizer "de sexta a segunda".
- **Post individual = alvo de UM jogador.** O campo "Jogador (Nome#Tag)" do Run workflow
  (env `JOGADOR`, ex-`PUUIDS`) manda; vazio = a rodada normal da tribo. Quando o seletor
  resolve para **um** jogador, o post perde o cabeçalho da tribo e o card se apresenta
  ("Relatório individual"). Quem decide é o TAMANHO do alvo, não o formato digitado —
  um prefixo (`UGA`) que pega cinco pessoas segue sendo post de grupo.
- **NUNCA `INSERT OR REPLACE` em `partidas` ou `estatisticas_jogador_partida`.**
  REPLACE é DELETE + INSERT, o D1 roda com `PRAGMA foreign_keys = 1` e existe a cadeia
  `partidas → estatisticas_jogador_partida → estatisticas_jogador_marcos`, toda
  ON DELETE CASCADE. Como uma partida é COMPARTILHADA pela tribo, o REPLACE apagava
  as estatísticas de quem já tinha sido coletado — sobrava só o último da rodada
  (98,6% das partidas com 1 jogador só). Use upsert (`ON CONFLICT ... DO UPDATE`).
  Travado por `src/utils/__tests__/ingestao-cascade.test.js`.
- **Imagem no repo é WebP, no tamanho em que aparece.** Os brasões de elo
  (`src/assets/rank-emblem/`) são exibidos a 64/80px e os fundos da Home ocupam a
  tela; tudo isso já foi convertido — o `public/` inteiro saiu de 62 MB para 2,9 MB,
  e o `dist/` de 67 MB para ~4 MB. Ao adicionar arte nova, converta antes de
  commitar: PNG de 1000px para um ícone de 80px é peso que todo visitante baixa.
  Atenção ao `public/`: ele vai **inteiro e verbatim** para o site publicado — o
  que for largado ali fica acessível na URL, e o Vite não avisa nem otimiza.
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
  por campeão). `championBuilds.classPresetChain` escolhe até 3 presets por classe/dano/rota.
  **Só daqui saem as RUNAS** — o scrape do lolalytics não captura runa.
- **Builds do meta (`meta-builds.json`)** são dados REAIS, raspados do lolalytics por
  campeão×rota (`/atualizar-builds`, pipeline local em `local/scrape/`, ~6 min):
  `buildWr`, `start`, `core`, `boots`, **`slots`**, `situational`, `skillMax`,
  `skillLevels`, `counters`. O campo **`slots`** é o Item 4/5/6 agrupado, com até 3
  opções por slot (id + winrate + amostra) — é dele que `metaBuildVariants()` monta as
  **até 3 builds** da ficha: a 1ª pega a opção mais jogada de cada slot, a 2ª a seguinte.
  A função pula item repetido (o mesmo item costuma ser opção de dois slots) e, se um
  slot ficar sem opção livre, ele **some** em vez de duplicar.
  Sem `slots` (JSON antigo) a ficha cai na lista achatada de `situational`.

## Limites honestos (diga isto ao usuário quando perguntarem)

- **A API da Riot não expõe estatística agregada de campeão.** Todo WR/PR/BR, tier,
  build e counter vem de **fonte externa raspada** (mobatrainer no `meta-tiers.csv`,
  lolalytics no `meta-builds.json`). Não invente números; se o campo está vazio, é "—".
- **Winrate por build existe, mas por ITEM, não pela build inteira** — cada opção de
  slot tem seu WR e sua amostra. Não some nem faça média para inventar um "WR da build".
  E `buildWr` é a aba "Highest Win Build" do lolalytics: infla em amostra baixa (há ~10
  entradas acima de 65%). Sempre mostre a amostra junto.
- **Runas por build são heurísticas** — pareamos a build *i* com o preset curado *i*.
  O rótulo na ficha diz "da build N"; não venda isso como dado do lolalytics.
- **Modelos 3D dos campeões não dá para embutir.** Verificado: o Community Dragon serve
  a malha (`.skn`) e as texturas, mas **404 no esqueleto (`.skl`) e nos clipes (`.anm`)** —
  sem eles não há nem pose, quanto mais animação. Converter exigiria extrair os WADs de
  uma instalação local (lol2gltf/LeagueConvert) e o peso não cabe no GitHub Pages. A ficha
  resolve com um link para o **Khada** (`modelviewer.lol/model-viewer?id=<skinId>`, onde
  `skinId = champ.key × 1000 + skin.num`). Ele não tem API nem iframe — só link.
- O módulo **Campeões é estático**: reflete o que está nos arquivos do repo + Data Dragon.

## Backend (resumo — detalhes no README/ARCHITECTURE)

- **`worker.js`** (Cloudflare): proxy da Riot, cache-first no D1, rotas por `action`
  (`profile_overview`, `fetch_recent_matches`, `profile_brief`, `masteries`,
  `player_suggest`, `rate_status`, `admin_*`). Esconde `RIOT_API_KEY`; `admin_*` exigem
  `ADMIN_PASSWORD` (fail-closed → 503 sem secret).
- **`shared/match-extract.js`** — lógica ÚNICA de extração/SQL de partidas, importada
  pelo worker e pelo coletor (sem duplicação).
- **`shared/relatorio-metricas.js`** — SQL agregado + `analisarJogador` do relatório.
  Importado pelo coletor E pelo worker. **`shared/relatorio-prosa.js`** — o banco de
  frases (`gerarProsa`); importado pelo coletor E pelo FRONT.
- **`cron/`** — coletor noturno (`sync.js`, `backfill.js`), relatório do Discord
  (`relatorio-discord.js`), infra compartilhada em `cron/lib/`.
  `cron/lib/relatorio-engine.js` hoje é **só a camada de embed do Discord**: as duas
  camadas de baixo moram em `shared/` (ver acima) e ele as re-exporta, então quem já
  importava dele não precisou mudar nada.
- **`docs/DATABASE.md`** — schema do D1 (jogadores, partidas, estatisticas_*, maestrias,
  lp_historico).

## Ao mexer no repo

- Commit/deploy **só quando o usuário pedir**. Front → GitHub Pages (precisa `404.html`).
  Worker é deploy **separado** (Wrangler) — não é publicado junto com o front.
- Rode `npm run build` + `npm test` antes de concluir.
