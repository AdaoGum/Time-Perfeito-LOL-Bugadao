# Banco de Dados — Cloudflare D1 (SQLite)

> Documento de referência para humanos **e IAs** entenderem o schema do banco
> usado pelo projeto *Time Perfeito LOL*. Descreve as tabelas, colunas,
> chaves, relacionamentos e a origem dos dados (API da Riot).
>
> **Motor:** Cloudflare D1 (SQLite).
> **Fontes que escrevem no banco:** `worker.js` (edge, sob demanda) e
> `cron/sync.js` (job da madrugada / backfill). Os `INSERT` são **duplicados**
> nos dois — mantenha-os em paridade ao alterar o schema.

---

## Visão geral (mapa mental)

O `puuid` (identificador único do jogador na Riot) é o **eixo central** do banco.
Quase tudo se conecta por ele.

```
                         jogadores (1)
                         puuid (PK)
                            │
        ┌───────────────────┼───────────────────────┬──────────────────┐
        │ puuid              │ puuid                 │ puuid            │ puuid
        ▼                    ▼                       ▼                  ▼
 estatisticas_        estatisticas_            maestrias         lp_historico
 jogador_partida      jogador_marcos           (puuid,           (histórico de
 (puuid, match_id)    (puuid, match_id,        champion_id)      elo/LP por
        │              minuto)                                    snapshot)
        │ match_id           │ match_id
        └──────────┬─────────┘
                   ▼
              partidas (1)
              match_id (PK)
```

- **`jogadores`** — cadastro/estado atual de cada jogador (elo, ícone, nível).
- **`partidas`** — metadados globais de cada partida (1 linha por partida).
- **`estatisticas_jogador_partida`** — 1 linha por (jogador × partida): o placar
  final. É a tabela mais consultada.
- **`estatisticas_jogador_marcos`** — snapshots da *timeline* em minutos-chave
  (0, 5, 10, 15, 25) por (jogador × partida × minuto).
- **`maestrias`** — nível/pontos de maestria por (jogador × campeão).
- **`lp_historico`** — série temporal de elo/LP (a Riot não devolve histórico de
  LP, então gravamos um snapshot a cada sincronização).
- **`sqlite_sequence`** — tabela interna do SQLite (contadores de `AUTOINCREMENT`);
  não é do domínio, não mexer.

---

## Tabelas

### `jogadores`
Cadastro e estado ranqueado **atual** de cada jogador. Atualizada via `UPSERT`
(`ON CONFLICT(puuid) DO UPDATE`). Origem: account-v1, summoner-v4 e league-v4.

| Coluna | Tipo | Descrição |
|---|---|---|
| `puuid` | TEXT **PK** | ID único do jogador na Riot. |
| `game_name` | TEXT | Nome de jogo (parte antes do `#`). |
| `tag_line` | TEXT | Tag (parte depois do `#`). |
| `has_premium` | INTEGER | Flag premium (`0`/`1`, default `0`). Só premium roda nos jobs de madrugada (`cron/sync.js`) e no backfill. Novo jogador buscado nasce `0`; promoção manual na aba "Jogadores" da Ancestralidade (rota `admin_set_premium`). Ver `migrations/005_has_premium.sql`. *(SQLite anexa a coluna ao fim da tabela; logicamente ela vem logo após `tag_line`.)* |
| `tier` | TEXT | Elo Solo/Duo (ex.: `GOLD`, `DIAMOND`). |
| `rank` | TEXT | Divisão Solo/Duo (`I`..`IV`). |
| `lp` | INTEGER | League Points Solo/Duo. |
| `win_rate` | REAL | % de vitórias Solo/Duo. |
| `flex_tier` | TEXT | Elo na fila Flex. |
| `flex_rank` | TEXT | Divisão na fila Flex. |
| `flex_lp` | INTEGER | LP na fila Flex. |
| `flex_win_rate` | REAL | % de vitórias na fila Flex. |
| `profile_icon_id` | INTEGER | ID do ícone de perfil. |
| `summoner_level` | INTEGER | Nível de invocador. |
| `ultima_atualizacao` | TIMESTAMP | Última sincronização (`CURRENT_TIMESTAMP`). |

---

### `partidas`
Metadados globais de cada partida — **1 linha por partida**, compartilhada por
todos os jogadores dela. Gravada com `INSERT OR REPLACE`. Origem: match-v5
(`match.info`).

| Coluna | Tipo | Descrição |
|---|---|---|
| `match_id` | TEXT **PK** | ID da partida (ex.: `BR1_1234567890`). |
| `game_duration` | INTEGER | Duração em segundos. |
| `game_creation` | INTEGER | Timestamp de criação (epoch ms). |
| `queue_id` | INTEGER | Tipo de fila (420 = Solo/Duo, 440 = Flex, etc.). |
| `game_version` | TEXT | Versão/patch do jogo. |
| `game_mode` | TEXT | Modo (`CLASSIC`, `ARAM`, …). |
| `bans` | TEXT (JSON) | Banimentos por time: `[{teamId, bans[]}]`. |
| `team_objectives` | TEXT (JSON) | Objetivos por time: `[{teamId, objectives{}}]`. |
| `participants` | TEXT (JSON) | Lista dos participantes/times da partida. |

---

### `estatisticas_jogador_partida`
Placar **final** de cada jogador em cada partida — **1 linha por (puuid, match_id)**.
É a tabela central das estatísticas. Gravada com `INSERT OR REPLACE` (37 colunas).
Origem: match-v5 `participant` e `participant.challenges`.

**Chave primária composta:** `(puuid, match_id)`.

| Coluna | Tipo | Origem / descrição |
|---|---|---|
| `puuid` | TEXT | Jogador (→ `jogadores.puuid`). |
| `match_id` | TEXT | Partida (→ `partidas.match_id`). |
| `champion_id` | INTEGER | `participant.championId`. |
| `champion_name` | TEXT | `participant.championName`. |
| `team_position` | TEXT | Rota: `TOP`/`JUNGLE`/`MIDDLE`/`BOTTOM`/`UTILITY`. |
| `win` | INTEGER | 1 vitória / 0 derrota. |
| `kills` | INTEGER | Abates. |
| `deaths` | INTEGER | Mortes. |
| `assists` | INTEGER | Assistências. |
| `solo_kills` | INTEGER | `challenges.soloKills`. |
| `double_kills` | INTEGER | Abates duplos. |
| `triple_kills` | INTEGER | Abates triplos. |
| `quadra_kills` | INTEGER | Abates quádruplos. |
| `penta_kills` | INTEGER | Pentakills. |
| `gold_earned` | INTEGER | Ouro total ganho. |
| `gold_per_min` | REAL | `challenges.goldPerMinute`. |
| `items` | TEXT (JSON) | `[item0..item5]`. |
| `cs` | INTEGER | Creep score (`totalMinionsKilled` + `neutralMinionsKilled`). |
| `damage_champions` | INTEGER | `totalDamageDealtToChampions`. |
| `physical_damage` | INTEGER | Dano físico a campeões. |
| `magic_damage` | INTEGER | Dano mágico a campeões. |
| `true_damage` | INTEGER | Dano verdadeiro a campeões. |
| `damage_taken` | INTEGER | `totalDamageTaken`. |
| `damage_mitigated` | INTEGER | `damageSelfMitigated`. |
| `total_heal_teammates` | INTEGER | `totalHealsOnTeammates`. |
| `damage_shielded_teammates` | INTEGER | `totalDamageShieldedOnTeammates`. |
| `kill_participation` | REAL | `challenges.killParticipation` (0..1). |
| `total_time_spent_dead` | INTEGER | Tempo morto (s). |
| `vision_score` | INTEGER | `visionScore`. |
| `control_wards` | INTEGER | `visionWardsBoughtInGame`. |
| `wards_placed` | INTEGER | Sentinelas colocadas. |
| `wards_killed` | INTEGER | Sentinelas destruídas. |
| `summoner1_id` | INTEGER | Feitiço de invocador 1 (ícone). |
| `summoner2_id` | INTEGER | Feitiço de invocador 2 (ícone). |
| `perk_keystone` | INTEGER | Runa principal: `perks.styles[0].selections[0].perk`. |
| `perk_secondary_style` | INTEGER | Árvore secundária: `perks.styles[1].style`. |
| `challenges` | TEXT (JSON) | Objeto `challenges` completo (bruto). |

Índice: `idx_ejp_puuid_created` em `(puuid, game_creation DESC)`.

---

### `estatisticas_jogador_marcos`
Snapshots da **timeline** (match-v5 timeline) nos minutos-chave `MARCOS_MINUTOS =
[0, 5, 10, 15, 25]`. **1 linha por (puuid, match_id, minuto)** — 52 colunas.
Usada para gráficos de evolução dentro da partida. O JSON pesado da timeline é
descartado após extrair estes campos.

**Chave primária composta:** `(puuid, match_id, minuto)`.

Colunas (na ordem do `INSERT`):

- Identidade: `puuid`, `match_id`, `minuto`
- Progressão: `level`, `xp`, `current_gold`, `total_gold`
- Atributos (`championStats`): `attack_damage`, `ability_power`, `armor`,
  `magic_resist`, `attack_speed`, `ability_haste`, `cooldown_reduction`,
  `movement_speed`, `health`, `health_max`, `health_regen`, `power`, `power_max`,
  `power_regen`, `lifesteal`, `omnivamp`, `physical_vamp`, `spell_vamp`,
  `armor_pen`, `armor_pen_percent`, `bonus_armor_pen_percent`, `magic_pen`,
  `magic_pen_percent`, `bonus_magic_pen_percent`, `cc_reduction`
- Dano (`damageStats`): `total_damage_done`, `total_damage_done_to_champions`,
  `magic_damage_done`, `magic_damage_done_to_champions`, `magic_damage_taken`,
  `physical_damage_done`, `physical_damage_done_to_champions`,
  `physical_damage_taken`, `true_damage_done`, `true_damage_done_to_champions`,
  `true_damage_taken`
- Posição no mapa: `position_x`, `position_y`
- Estado no minuto: `items` (JSON da mochila reconstruída por eventos),
  `skills_upgraded` (JSON de slots de skill), `kills_no_minuto`,
  `deaths_no_minuto`, `assists_no_minuto`, `wards_colocadas`, `wards_destruidas`

> As contagens `*_no_minuto` e de wards são **acumuladas** por eventos da timeline
> até aquele frame (`CHAMPION_KILL`, `WARD_PLACED`, `WARD_KILL`, etc.). A mochila
> (`items`) é reconstruída processando `ITEM_PURCHASED/SOLD/DESTROYED/UNDO`.

---

### `maestrias`
Maestria por (jogador × campeão) — **1 linha por (puuid, champion_id)**. Criada e
mantida pelo `worker.js` (`ensureSchema`). Origem: champion-mastery-v4.

**Chave primária composta:** `(puuid, champion_id)`.

| Coluna | Tipo | Descrição |
|---|---|---|
| `puuid` | TEXT | Jogador (→ `jogadores.puuid`). |
| `champion_id` | INTEGER | Campeão. |
| `champion_level` | INTEGER | Nível de maestria. |
| `champion_points` | INTEGER | Pontos de maestria. |
| `last_play_time` | INTEGER | Última vez que jogou o campeão (epoch ms). |
| `season_milestone` | INTEGER | `championSeasonMilestone` (marco da temporada). |
| `milestone_grades` | TEXT (JSON) | `milestoneGrades` serializado. |
| `mark_required_next_level` | INTEGER | `markRequiredForNextLevel`. |
| `atualizado` | TIMESTAMP | `CURRENT_TIMESTAMP`. |

> ⚠️ O `ensureSchema` (worker) cria `maestrias` só com as 6 primeiras colunas; as três
> de milestone (`season_milestone`, `milestone_grades`, `mark_required_next_level`)
> foram adicionadas por `ALTER TABLE` direto no D1 e são usadas no `UPSERT` da rota
> `masteries`. Ao recriar o banco do zero, adicione-as manualmente.

---

### `lp_historico`
Série temporal de elo/LP. A Riot **não** devolve LP histórico, então gravamos um
snapshot a cada sincronização (cron da madrugada) para plotar o "LP Progress".
Definida em `migrations/001_analytics.sql`.

**Chave primária:** `id` (`AUTOINCREMENT`).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | INTEGER **PK** AUTOINCREMENT | Sequencial. |
| `puuid` | TEXT NOT NULL | Jogador (→ `jogadores.puuid`). |
| `queue_type` | TEXT NOT NULL | `RANKED_SOLO_5x5` ou `RANKED_FLEX_SR`. |
| `tier` | TEXT | Elo no momento do snapshot. |
| `rank` | TEXT | Divisão no momento do snapshot. |
| `lp` | INTEGER | LP no momento do snapshot. |
| `wins` | INTEGER | Vitórias acumuladas na fila. |
| `losses` | INTEGER | Derrotas acumuladas na fila. |
| `snapshot_at` | TIMESTAMP | `CURRENT_TIMESTAMP`. |

Índice: `idx_lp_hist_puuid_queue` em `(puuid, queue_type, snapshot_at)` — para ler
a evolução de um jogador por fila em ordem cronológica.

---

### `sqlite_sequence` (interna)
Criada automaticamente pelo SQLite por causa do `AUTOINCREMENT` de `lp_historico`.
Colunas `name`, `seq`. **Não é do domínio da aplicação — não editar.**

---

## Relacionamentos (chaves lógicas)

O D1/SQLite aqui não declara `FOREIGN KEY` explícitas, mas as relações lógicas são:

| De | Coluna | Para | Coluna |
|---|---|---|---|
| `estatisticas_jogador_partida` | `puuid` | `jogadores` | `puuid` |
| `estatisticas_jogador_partida` | `match_id` | `partidas` | `match_id` |
| `estatisticas_jogador_marcos` | `puuid` | `jogadores` | `puuid` |
| `estatisticas_jogador_marcos` | `match_id` | `partidas` | `match_id` |
| `maestrias` | `puuid` | `jogadores` | `puuid` |
| `lp_historico` | `puuid` | `jogadores` | `puuid` |

`estatisticas_jogador_partida` e `estatisticas_jogador_marcos` se relacionam entre
si por `(puuid, match_id)` — o placar final e os snapshots da mesma participação.

---

## Notas para quem for alterar o schema

- **Duplicação intencional:** os `INSERT` existem em `worker.js` **e** em
  `cron/sync.js` (via `cron/lib/match-extract.js`). Ao adicionar/remover coluna,
  atualize os dois lados e mantenha a ordem das colunas idêntica ao `VALUES (?, …)`.
- **Migrations:** SQLite/D1 não suporta `ADD COLUMN IF NOT EXISTS`. Rodar
  `wrangler d1 execute <BANCO> --remote --file=./migrations/001_analytics.sql`;
  colunas já existentes fazem o comando falhar — ignore/rode só o que falta.
- **Backfill:** colunas novas só são preenchidas depois que worker/cron começam a
  gravá-las. Para preencher histórico, rode o job de recoleta (`BACKFILL=1 node
  cron/sync.js`), que reescreve via `INSERT OR REPLACE`/`OR IGNORE`.
- **Idempotência:** `partidas`, `estatisticas_*` usam `INSERT OR REPLACE`;
  `jogadores` usa `UPSERT`; `maestrias` é criada com `CREATE TABLE IF NOT EXISTS`
  no `ensureSchema`.
