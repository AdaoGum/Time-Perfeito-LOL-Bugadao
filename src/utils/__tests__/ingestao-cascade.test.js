// Regressão do bug que apagava as partidas da tribo (set/2026).
//
// Uma partida é COMPARTILHADA: quando 4 membros jogam o mesmo Flex, os 4 syncs
// gravam a MESMA linha em `partidas`. Com `INSERT OR REPLACE` isso era um
// DELETE + INSERT, e o D1 roda com PRAGMA foreign_keys = 1, então a cascata
//
//   partidas -> estatisticas_jogador_partida -> estatisticas_jogador_marcos
//
// apagava tudo que os jogadores anteriores já tinham coletado. Sobrava só o
// ÚLTIMO da rodada — 98,6% das partidas do banco tinham 1 jogador só.
//
// O teste roda o schema DE VERDADE (mesmas PKs e FKs de produção, montado a
// partir das próprias constantes de INSERT) num SQLite em memória. Se alguém
// voltar a usar REPLACE em `partidas` ou em `estatisticas_jogador_partida`,
// estes testes quebram.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SQL_PARTIDAS, SQL_ESTATISTICAS, SQL_MARCOS } from '../../../shared/match-extract.js';

// Lista de colunas da cláusula INSERT — mantém o schema do teste colado no real.
function colunasDe(sql) {
  const m = sql.match(/INTO\s+\w+\s*\(([^)]+)\)/);
  return m[1].split(',').map((c) => c.trim());
}
const COLS_PARTIDAS = colunasDe(SQL_PARTIDAS);
const COLS_STATS = colunasDe(SQL_ESTATISTICAS);
const COLS_MARCOS = colunasDe(SQL_MARCOS);

// Schema espelhando produção: as PKs compostas e as duas FKs ON DELETE CASCADE.
function bancoDeTeste() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');   // igual ao D1 (PRAGMA foreign_keys = 1)
  const semPk = (cols, pk) => cols.filter((c) => !pk.includes(c)).map((c) => `${c} TEXT`).join(', ');
  db.exec(`
    CREATE TABLE partidas (
      match_id TEXT PRIMARY KEY, ${semPk(COLS_PARTIDAS, ['match_id'])}
    );
    CREATE TABLE estatisticas_jogador_partida (
      puuid TEXT NOT NULL, match_id TEXT NOT NULL, ${semPk(COLS_STATS, ['puuid', 'match_id'])},
      PRIMARY KEY (puuid, match_id),
      FOREIGN KEY (match_id) REFERENCES partidas(match_id) ON DELETE CASCADE
    );
    CREATE TABLE estatisticas_jogador_marcos (
      puuid TEXT NOT NULL, match_id TEXT NOT NULL, minuto INTEGER NOT NULL,
      ${semPk(COLS_MARCOS, ['puuid', 'match_id', 'minuto'])},
      PRIMARY KEY (puuid, match_id, minuto),
      FOREIGN KEY (puuid, match_id) REFERENCES estatisticas_jogador_partida(puuid, match_id) ON DELETE CASCADE
    );`);
  return db;
}

const MATCH = 'BR1_3278383469';
const vPartida = (id) => COLS_PARTIDAS.map((c) => (c === 'match_id' ? id : 'x'));
const vStats = (puuid, id) => COLS_STATS.map((c) => (c === 'puuid' ? puuid : c === 'match_id' ? id : 'x'));
const vMarcos = (puuid, id, min) =>
  COLS_MARCOS.map((c) => (c === 'puuid' ? puuid : c === 'match_id' ? id : c === 'minuto' ? min : 'x'));

// Uma passada do coletor por UM jogador, na ordem exata de cron/sync.js:
// metadados da partida -> estatísticas -> marcos.
function sincronizarJogador(db, puuid, { comMarcos = true } = {}) {
  db.prepare(SQL_PARTIDAS).run(...vPartida(MATCH));
  db.prepare(SQL_ESTATISTICAS).run(...vStats(puuid, MATCH));
  if (comMarcos) for (const min of [0, 5, 10, 15, 25]) db.prepare(SQL_MARCOS).run(...vMarcos(puuid, MATCH, min));
}

const donos = (db) =>
  db.prepare('SELECT puuid FROM estatisticas_jogador_partida WHERE match_id = ? ORDER BY puuid').all(MATCH).map((r) => r.puuid);
const nMarcos = (db, puuid) =>
  db.prepare('SELECT COUNT(*) n FROM estatisticas_jogador_marcos WHERE puuid = ? AND match_id = ?').get(puuid, MATCH).n;

// ---------------------------------------------------------------------------

test('a partida compartilhada preserva TODOS os jogadores da tribo', () => {
  const db = bancoDeTeste();
  // O Flex de 31/08 que expôs o bug: 4 premium na mesma partida.
  for (const p of ['bUGA_dao', 'UGA_LoboX9', 'UGA_Tdetdah', 'UGA_Sonserina']) sincronizarJogador(db, p);
  assert.deepEqual(donos(db), ['UGA_LoboX9', 'UGA_Sonserina', 'UGA_Tdetdah', 'bUGA_dao'],
    'gravar um jogador não pode apagar os anteriores da mesma partida');
});

test('os marcos de cada jogador sobrevivem à coleta dos outros', () => {
  const db = bancoDeTeste();
  sincronizarJogador(db, 'jogador_A');
  sincronizarJogador(db, 'jogador_B');
  assert.equal(nMarcos(db, 'jogador_A'), 5, 'os marcos do A não podem cascatear quando o B é coletado');
  assert.equal(nMarcos(db, 'jogador_B'), 5);
});

test('re-sincronizar o mesmo jogador ATUALIZA a linha, não duplica', () => {
  const db = bancoDeTeste();
  sincronizarJogador(db, 'jogador_A');
  sincronizarJogador(db, 'jogador_A');   // rodada seguinte / BACKFILL=1
  assert.deepEqual(donos(db), ['jogador_A']);
  assert.equal(nMarcos(db, 'jogador_A'), 5, 'marcos não podem duplicar nem sumir no reprocessamento');
});

test('o worker sem timeline não apaga os marcos que o coletor já juntou', () => {
  const db = bancoDeTeste();
  sincronizarJogador(db, 'jogador_A');                       // cron: coletou tudo
  sincronizarJogador(db, 'jogador_A', { comMarcos: false }); // worker: timeline falhou
  assert.equal(nMarcos(db, 'jogador_A'), 5,
    'regravar só as estatísticas não pode levar os marcos junto');
});

test('a atualização de metadados da partida realmente acontece', () => {
  const db = bancoDeTeste();
  sincronizarJogador(db, 'jogador_A');
  // Upsert precisa ATUALIZAR (não virar no-op): o 2º sync traz dados novos.
  const vals = vPartida(MATCH).map((v, i) => (COLS_PARTIDAS[i] === 'game_version' ? '26.16' : v));
  db.prepare(SQL_PARTIDAS).run(...vals);
  assert.equal(db.prepare('SELECT game_version v FROM partidas WHERE match_id = ?').get(MATCH).v, '26.16');
  assert.deepEqual(donos(db), ['jogador_A'], 'e mesmo atualizando, não derruba as estatísticas');
});

test('nenhum INSERT usa OR REPLACE em tabela com dependente em cascata', () => {
  // Guarda direto: REPLACE é DELETE + INSERT e dispara as FKs ON DELETE CASCADE.
  for (const [nome, sql] of [['SQL_PARTIDAS', SQL_PARTIDAS], ['SQL_ESTATISTICAS', SQL_ESTATISTICAS]]) {
    assert.ok(!/INSERT\s+OR\s+REPLACE/i.test(sql), `${nome} precisa ser upsert (ON CONFLICT), não INSERT OR REPLACE`);
    assert.match(sql, /ON CONFLICT\s*\([^)]+\)\s*DO UPDATE/i, `${nome} precisa do ON CONFLICT ... DO UPDATE`);
  }
  // `estatisticas_jogador_marcos` é folha (ninguém depende dela): REPLACE é seguro.
  assert.match(SQL_MARCOS, /INSERT\s+OR\s+REPLACE/i);
});
