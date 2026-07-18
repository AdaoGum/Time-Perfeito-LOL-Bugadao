-- ============================================================================
-- 006 — Colunas de milestone na tabela `maestrias`.
--
-- O worker grava/lê estas 3 colunas desde a rota `masteries`, mas elas nunca
-- existiram no banco: o INSERT falhava silenciosamente (try/catch) e o cache de
-- maestrias ficou vazio para sempre. Esta migration conserta o schema; o
-- `ensureSchema` do worker também tenta estes ALTERs (auto-cura em produção).
--
-- Aplicar:  wrangler d1 execute ugabuga-db --remote --file=./migrations/006_maestrias.sql
-- (SQLite/D1 não tem "ADD COLUMN IF NOT EXISTS": se alguma coluna já existir,
--  o comando falha nela — rode só as que faltam.)
-- ============================================================================

ALTER TABLE maestrias ADD COLUMN season_milestone INTEGER;
ALTER TABLE maestrias ADD COLUMN milestone_grades TEXT;
ALTER TABLE maestrias ADD COLUMN mark_required_next_level INTEGER;
