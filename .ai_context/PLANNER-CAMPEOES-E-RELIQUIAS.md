# PLANNER — Panteão dos Campeões, Relíquias Ancestrais & Meta Tier List

> Expansão massiva do bUGAdão Analytics: módulo de CAMPEÕES (Panteão, Relíquias/Itens,
> Meta & Tier List), busca híbrida global (jogadores + campeões) e reorganização da
> navegação (sidebar em duas seções + destaque da Tribo). Inspiração visual: Mobalytics
> e OP.GG, porém 100% focado em LoL e no tema ancestral do Udyr.

## Estado atual (inventário)

| Peça | Onde | Observação |
|---|---|---|
| Lista de campeões (DDragon) | `store.staticData.championList` | Carregada no boot em `App.vue` (pt_BR, patch ao vivo) |
| Itens (DDragon `item.json`) | `store.staticData.items` | Já carregado no boot — base do catálogo de Relíquias |
| Tier list manual | `src/data/meta-tiers.csv` | `champion,role,tier` + comentário com patch/data; parser em `sinergiaMotor.js` |
| Vetores táticos 8D + roles | `src/data/sinergia-champs.csv` → `CHAMP_TAGS` | engage/poke/frontline/burst/disengage/utility/peel/waveclear + cc/scaling/mechTags/roles |
| Radar 8D pronto | `src/components/RadarChart.vue` | Recebe `axes: [{label, value 0..100}]` |
| Autocomplete de jogadores | `SearchBar.vue` + `fetchPlayerSuggestions` (worker/D1) | Até 5 jogadores; usado na topbar, Home, Tribo, saguão custom |
| Navegação | `App.vue` (`topTabs`/`sidebarTabs`) | Lista plana; sem seções temáticas |

## Decisões de arquitetura

1. **Chave canônica de campeão = nome de exibição pt_BR** (`champ.name`, ex.: "Dr. Mundo"),
   igual aos CSVs existentes. Nas URLs usamos o **id do DDragon** (`champ.id`, ex.: `MonkeyKing`)
   por ser estável e URL-safe.
2. **Builds por ID de item** em `src/data/builds-champs.json`: overrides por campeão +
   conjuntos por arquétipo (fallback automático por tag/damageType). IDs inexistentes no
   patch atual são simplesmente filtrados em runtime (degradação graciosa). O mapa inverso
   (item → campeões) é derivado em runtime — nunca duplicado à mão.
3. **Estatísticas de meta (WR/PR/BR)**: o parser do `meta-tiers.csv` passa a aceitar as
   colunas OPCIONAIS `winrate,pickrate,banrate`. Enquanto o CSV não as tiver, a UI exibe
   fallback neutro ("—" / "Sem dados no patch") sem quebrar. A skill `atualizar-meta`
   poderá preenchê-las no futuro sem mudança de código.
4. **Ficha do campeão (habilidades)**: `champion/<id>.json` do DDragon é buscado sob demanda
   ao abrir a ficha e cacheado em `store.staticData.championDetails[id]` — zero custo extra
   no boot e zero uso da chave da Riot.
5. **Descrições do DDragon** (itens/habilidades) contêm markup próprio (`<stats>`, `<passive>`,
   `<br>`…): sanitizamos para texto com quebras de linha (sem `v-html`) — seguro e limpo.
6. **`SearchBar.vue` ganha a prop `context`**: `'players'` (default, comportamento atual
   intacto para Tribo/saguão/gates), `'champions'` (só campeões) e `'global'` (híbrido
   3+3 adaptativo, máx. 6). Topbar e Home passam a usar `context="global"`.

---

## FASE 1 — Camada de dados

- [x] `src/data/builds-champs.json`: `archetypes` (conjuntos de itens por estilo de jogo)
      + `champions` (overrides por nome de exibição).
- [x] `src/utils/championCatalog.js` (novo motor de catálogo):
      - `rolesOf(champ)` — rotas do campeão (CSV de sinergia → fallback por tags DDragon);
      - `buildFor(champ)` — itens recomendados resolvidos (override → arquétipo), filtrando
        IDs ausentes no `item.json` do patch;
      - `championsForItem(itemId)` — sinergia inversa item → campeões;
      - `metaByRole(role)` — `{S:[],A:[],B:[],C:[],D:[]}` para a Tier List;
      - `metaEntriesOf(champName)` — tier + stats (WR/PR/BR opcionais) por rota;
      - normalização de acentos p/ busca (`normalizeSearch`).
- [x] `sinergiaMotor.js`: `parseMetaCsv` com cabeçalho dinâmico e colunas opcionais
      `winrate,pickrate,banrate` (retrocompatível; testes não importam este módulo).
- [x] `store.js`: cache `staticData.championDetails = {}`.

## FASE 2 — Rotas

- [x] `Router.js`: `/champions/:championId?` (Panteão), `/items/:itemId?` (Relíquias),
      `/meta` (Tier List). Param opcional = deep-link direto para a ficha.

## FASE 3 — `Champions.vue` (Panteão dos Campeões)

- [x] Grade de todos os campeões (ícone + nome + tags) com busca (context `champions`)
      e filtro por rota via abas com ícones `[TODAS][TOP][JUNGLE][MID][ADC][SUP]`.
- [x] Ficha (painel modal) com:
      - splash/loading art, título, lore curta, função (tags traduzidas), tipo de dano,
        partype e dificuldade;
      - habilidades (passiva + Q/W/E/R com ícones e descrição sanitizada) — fetch sob demanda;
      - radar tático 8D (reuso do `RadarChart.vue`, valores ×20);
      - Relíquias recomendadas (grid de itens clicáveis → `/items/:id`);
      - Meta no patch: badge de tier por rota + WR/PR/BR com fallback "—".
- [x] Deep-link `/champions/:championId` abre a ficha direto; fecha → volta p/ `/champions`.

## FASE 4 — `Items.vue` (Relíquias Ancestrais)

- [x] Grade dinâmica dos itens do SR (maps["11"] + purchasable), busca por nome e filtro
      por categoria (Dano, Poder de Habilidade, Defesa, Crítico, Vel. de Ataque, Mana,
      Vampirismo, Suporte & Visão, Botas, Consumíveis) via tags do DDragon.
- [x] Detalhe (modal): descrição sanitizada, ouro total/receita/venda, componentes
      (`from`) e evoluções (`into`) navegáveis, sinergia com campeões (mapa inverso),
      popularidade com fallback neutro.
- [x] Deep-link `/items/:itemId`.

## FASE 5 — `MetaTierList.vue` (META & Tier List)

- [x] Cabeçalho com patch + data do `meta-tiers.csv` e aviso de meta obsoleto (>30 dias).
- [x] Seletor de rota por ícones `[TOP][JUNGLE][MID][ADC][SUP]`.
- [x] Matriz S/A/B/C/D em linhas coloridas com retratos; clique → ficha no Panteão.

## FASE 6 — `SearchBar.vue` híbrido

- [x] Prop `context: 'players' | 'champions' | 'global'` (default `'players'` — nada quebra).
- [x] `global`: até 6 resultados com distribuição adaptativa (ideal 3 campeões + 3
      jogadores; sobra de um lado é preenchida pelo outro).
- [x] Campeão no dropdown: ícone + nome + badge "Campeão" → `/champions/:id`.
      Jogador: ícone + Nick#TAG + elo → fluxo atual de perfil.
- [x] `champions`: apenas campeões (usado dentro do Panteão); Enter escolhe o 1º da lista.

## FASE 7 — `App.vue` (Sidebar + Header)

- [x] Sidebar em duas seções + destaque:
      - **JOGADORES**: ⚔️ Caçadas Passadas (`/profile`), 👁️ Olhar Espiritual (`/ancestralidade`),
        🏆 Caverna dos Monos (`/mastery`);
      - **CAMPEÕES**: ⚡ Meta & Tier List (`/meta`), 🏛️ Panteão (`/champions`),
        🔮 Relíquias (`/items`);
      - **Destaque**: 👥 UGA! BUGA! Tribo Perfeita (`/synergy`).
      Modo minimizado mantém divisores; active-match cobre sub-rotas (/historico, /analise → Caçadas).
- [x] Header: tabs atualizadas incluindo META e PANTEÃO; busca da topbar com `context="global"`.
- [x] Temas de borda/fundo para as rotas novas.

## FASE 8 — `Home.vue`

- [x] 4 caminhos realinhados (mantendo o tema dos espíritos do Udyr + fundos em hover):
      1. Tigre → **Perfil do Jogador** (`/profile`, entra direto se já há jogador);
      2. Urso → **Caverna dos Monos** (`/mastery`);
      3. Fênix → **Campeões & Meta** (`/meta`; prévia = mini tier list);
      4. Tartaruga → **Tribo Perfeita** (`/synergy`).
- [x] Busca central com `context="global"`.

## FASE 9 — Validação

- [x] `npm run build` sem erros.
- [x] `npm test` continua verde (testes não tocam módulos com `?raw`).

## FASE 10 — Runas + 3 opções de build (pós-entrega)

- [x] `builds-champs.json`: `runePages` (12 páginas de perks do runesReforged, IDs reais)
      e `presets` (17 estilos = itens + página de runas). `champions` guarda os itens
      curados da build PRINCIPAL.
- [x] `championCatalog.js`: `classPresetChain` (cadeia ordenada de até 3 presets por
      classe/dano/rota) + `buildsFor` (retorna até 3 builds, cada uma com itens filtrados
      e página de runas). `buildFor` vira compat (1ª opção). `championsForItem` usa a
      união das builds. Runas ficam como IDs; a UI resolve ícones via `store.staticData.runes`.
- [x] `ChampionSheet.vue`: seletor das 3 builds; cada opção mostra RUNAS (árvore primária
      com keystone + 3 escolhas, secundária com 2) e a ordem de ITENS. Degrada graciosamente
      se runas/itens ainda não carregaram.

## FASE 11 — Sidebar "Equipes" (pós-entrega)

- [x] A antiga categoria destacada da Tribo vira a 3ª seção normal `sidebarSections`,
      rotulada **Equipes** (mesmo estilo de Jogadores/Campeões), com Tribo Perfeita
      (`/synergy`) e Partida Customizada (`/saguaoCustom`). Topbar mantém a aba única TRIBO.
- [x] Z-index: sidebar/header (`z-[60]/[61]`) acima do conteúdo e dos modais de página
      (`≤ z-50`); overlay de busca (`z-[90]`) e fichas de detalhe (`z-[80]`) acima da sidebar.
- [x] Topbar: cada aba ganhou prévia em hover (mini mockup + descrição por seção).

## Riscos & mitigação

- **IDs de item mudam por patch** → filtragem runtime contra `item.json` (nunca renderiza id morto).
- **Campeão novo fora dos CSVs** → roles via tags DDragon, radar via fallback neutro do motor,
  meta "Sem dados" — nada quebra (requisito de fallback gracioso).
- **WR/PR/BR ainda sem fonte** → colunas opcionais no CSV + fallback "—" (sem dados inventados).
- **Regressão nos usos atuais do SearchBar** → default `context='players'` preserva 100% do
  comportamento em Tribo/saguão/SearchGate.
