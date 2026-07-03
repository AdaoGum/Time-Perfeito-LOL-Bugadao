-- ============================================================================
-- Migração 004 — Cache do perfil em `jogadores` (Cloudflare D1 / SQLite)
-- ============================================================================
-- Objetivo: permitir que o worker remonte o perfil de um jogador conhecido SEM
-- gastar a chave da Riot quando não há partida ranqueada nova. Para isso ele
-- precisa ter salvo localmente:
--   • platform_host — a plataforma (br1, na1, …) para pular o active-shards.
--   • solo/flex wins/losses — o front exibe "V/D" por fila; hoje só guardávamos
--     a win_rate, insuficiente para reconstruir a tela sem chamar league-v4.
--
-- Sem estas colunas a busca gasta 8 chamadas por perfil; com elas, cai para 2
-- (só as duas verificações de IDs solo/flex) quando o jogador não tem jogo novo.
--
-- Como aplicar (Wrangler):
--   wrangler d1 execute <NOME_DO_BANCO> --remote --file=./migrations/004_profile_cache.sql
--
-- Observação: SQLite/D1 não suporta "ADD COLUMN IF NOT EXISTS". Se alguma coluna
-- já existir, o comando correspondente falha — basta ignorar/rodar só os que
-- faltam. (O worker já é tolerante a isso no ensureSchema, com try/catch.)
-- ============================================================================

ALTER TABLE jogadores ADD COLUMN platform_host TEXT;
ALTER TABLE jogadores ADD COLUMN solo_wins INTEGER;
ALTER TABLE jogadores ADD COLUMN solo_losses INTEGER;
ALTER TABLE jogadores ADD COLUMN flex_wins INTEGER;
ALTER TABLE jogadores ADD COLUMN flex_losses INTEGER;
