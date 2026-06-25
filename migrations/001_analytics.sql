-- ============================================================================
-- Migração 001 — Dados analíticos do jogador (Cloudflare D1 / SQLite)
-- ============================================================================
-- Como aplicar (Wrangler):
--   wrangler d1 execute <NOME_DO_BANCO> --remote --file=./migrations/001_analytics.sql
-- (use --local para testar localmente antes do --remote)
--
-- Observações:
--  * SQLite/D1 não suporta "ADD COLUMN IF NOT EXISTS". Se uma coluna já existir,
--    o comando correspondente vai falhar — basta ignorar/rodar só os que faltam.
--    (O worker já é tolerante a isso no ensureSchema com try/catch.)
--  * Estas colunas só passam a ser preenchidas DEPOIS que o worker/cron começar
--    a gravá-las. Para preencher o histórico, rode o job da madrugada que
--    recoleta as partidas (ele reescreve via INSERT OR IGNORE / UPDATE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Métricas por partida do jogador (estatisticas_jogador_partida)
--    Vêm direto do match-v5 (participant / participant.challenges).
-- ---------------------------------------------------------------------------

-- Visão: participant.visionScore
ALTER TABLE estatisticas_jogador_partida ADD COLUMN vision_score INTEGER;

-- Sentinelas de controle compradas: participant.visionWardsBoughtInGame
ALTER TABLE estatisticas_jogador_partida ADD COLUMN control_wards INTEGER;

-- Abates solo: participant.challenges.soloKills
ALTER TABLE estatisticas_jogador_partida ADD COLUMN solo_kills INTEGER;

-- Dano causado a campeões: participant.totalDamageDealtToChampions
ALTER TABLE estatisticas_jogador_partida ADD COLUMN damage_champions INTEGER;

-- Ouro por minuto: participant.challenges.goldPerMinute
ALTER TABLE estatisticas_jogador_partida ADD COLUMN gold_per_min REAL;

-- Participação em abates (KP): participant.challenges.killParticipation (0..1)
ALTER TABLE estatisticas_jogador_partida ADD COLUMN kill_participation REAL;

-- Feitiços de invocador (para exibir os ícones, como no op.gg)
ALTER TABLE estatisticas_jogador_partida ADD COLUMN summoner1_id INTEGER;
ALTER TABLE estatisticas_jogador_partida ADD COLUMN summoner2_id INTEGER;

-- Runa principal (keystone): participant.perks.styles[0].selections[0].perk
ALTER TABLE estatisticas_jogador_partida ADD COLUMN perk_keystone INTEGER;
-- Árvore secundária: participant.perks.styles[1].style
ALTER TABLE estatisticas_jogador_partida ADD COLUMN perk_secondary_style INTEGER;

-- ---------------------------------------------------------------------------
-- 2) Histórico de elo/LP por snapshot (para o gráfico "LP Progress")
--    A Riot NÃO devolve LP histórico — então gravamos um snapshot a cada
--    sincronização (cron da madrugada) e plotamos a evolução.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lp_historico (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  puuid       TEXT NOT NULL,
  queue_type  TEXT NOT NULL,           -- 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR'
  tier        TEXT,
  rank        TEXT,
  lp          INTEGER,
  wins        INTEGER,
  losses      INTEGER,
  snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para buscar a evolução de um jogador por fila, em ordem cronológica
CREATE INDEX IF NOT EXISTS idx_lp_hist_puuid_queue
  ON lp_historico (puuid, queue_type, snapshot_at);

-- Evita gravar 2 snapshots idênticos no mesmo dia (opcional, ajuste se quiser):
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_lp_hist_unico
--   ON lp_historico (puuid, queue_type, date(snapshot_at), lp);

-- ---------------------------------------------------------------------------
-- 3) Índices úteis para as consultas analíticas já existentes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ejp_puuid_created
  ON estatisticas_jogador_partida (puuid, game_creation DESC);
