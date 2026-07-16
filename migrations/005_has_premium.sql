-- 005_has_premium.sql
-- Adiciona a flag `has_premium` em `jogadores`.
--
-- Papel: só jogadores premium são processados pelos jobs de madrugada
-- (cron/sync.js) e pelo backfill (cron/backfill.js). Um jogador recém-buscado
-- pelo site é salvo com has_premium = 0 (não-premium) e precisa ser promovido
-- manualmente na aba "Jogadores" da Ancestralidade.
--
-- Observação: SQLite/D1 não tem "ADD COLUMN IF NOT EXISTS" nem permite escolher a
-- posição física da coluna (ela é anexada ao fim da tabela). Logicamente ela
-- pertence logo após `tag_line`. Se a coluna já existir, este comando falha —
-- ignore o erro. O worker também garante a coluna via ensureSchema (ALTER
-- idempotente), então em geral basta redeployar o worker.
--
-- Aplicar no D1 remoto:
--   wrangler d1 execute <BANCO> --remote --file=./migrations/005_has_premium.sql

ALTER TABLE jogadores ADD COLUMN has_premium INTEGER NOT NULL DEFAULT 0;
