-- ---------------------------------------------------------------------------
-- Contador GLOBAL de chamadas à API da Riot (janela deslizante compartilhada).
--
-- A chave da Riot é UMA só, usada por todos: buscas de usuários no site (worker.js)
-- + coleta noturna (cron/sync.js) + backfill (cron/backfill.js). Este registro
-- torna o orçamento de rate limit (100 chamadas / 2 min) visível e exato para
-- TODOS os usuários, e permite bloquear buscas quando o orçamento estoura.
--
-- Cada linha agrega as chamadas reais de UMA operação (um request do worker, ou
-- uma chamada do cron). Linhas antigas são podadas periodicamente pelo worker.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_usage (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,   -- epoch em ms do momento das chamadas
  count  INTEGER NOT NULL,   -- quantas chamadas reais à Riot este registro representa
  source TEXT,               -- 'worker' | 'cron' | 'backfill'
  action TEXT                -- rota/etapa que gerou as chamadas (diagnóstico)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_ts ON api_usage (ts);
