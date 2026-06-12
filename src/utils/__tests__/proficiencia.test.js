import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProficiencia, rotasPrincipais, normalizarRota } from '../proficiencia.js';

const AGORA = Date.parse('2026-06-11T00:00:00Z');
const DIA_MS = 86400000;

function partida(overrides = {}) {
  return {
    championName: 'Udyr',
    win: true,
    kills: 5, deaths: 3, assists: 7,
    teamPosition: 'JUNGLE',
    queueId: 420,
    gameCreation: AGORA - DIA_MS, // ontem
    cs: 180,
    gameDuration: 1800, // 30 min
    ...overrides
  };
}

test('winrate de 1 jogo / 1 vitória é suavizado (~0.56), nunca 1.0', () => {
  const prof = calcularProficiencia({ masteries: [], partidas: [partida()] }, { agora: AGORA });
  const wr = prof.Udyr.winrateAjustado;
  assert.ok(wr > 0.55 && wr < 0.57, `esperado ~0.56, veio ${wr}`);
  assert.notEqual(wr, 1.0);
});

test('campeão só com maestria usa winrate neutro 0.5 e desempenho neutro', () => {
  const prof = calcularProficiencia({
    masteries: [{ championName: 'Ahri', championPoints: 100000, lastPlayTime: AGORA - 10 * DIA_MS }],
    partidas: []
  }, { agora: AGORA });

  assert.equal(prof.Ahri.jogos, 0);
  assert.equal(prof.Ahri.winrateAjustado, 0.5);
  assert.equal(prof.Ahri.desempenho, 0.5);
  assert.ok(prof.Ahri.recencia > 0, 'recencia deve vir do lastPlayTime da maestria');
});

test('maestriaNorm: 1M pontos ≈ 1.0', () => {
  const prof = calcularProficiencia({
    masteries: [{ championName: 'Udyr', championPoints: 1000000, lastPlayTime: AGORA }],
    partidas: []
  }, { agora: AGORA });
  assert.ok(prof.Udyr.maestriaNorm >= 0.99, `esperado ~1.0, veio ${prof.Udyr.maestriaNorm}`);
});

test('recencia decai com o tempo: hoje ~1.0, 60 dias ~0.37', () => {
  const hoje = calcularProficiencia({
    masteries: [{ championName: 'A', championPoints: 1, lastPlayTime: AGORA }],
    partidas: []
  }, { agora: AGORA });
  const antigo = calcularProficiencia({
    masteries: [{ championName: 'A', championPoints: 1, lastPlayTime: AGORA - 60 * DIA_MS }],
    partidas: []
  }, { agora: AGORA });

  assert.ok(hoje.A.recencia > 0.99);
  assert.ok(Math.abs(antigo.A.recencia - Math.exp(-1)) < 0.01);
});

test('maestria alta mas lastPlayTime antigo => recencia baixa e proficiencia puxada pra baixo', () => {
  const prof = calcularProficiencia({
    masteries: [{ championName: 'Fizz', championPoints: 900000, lastPlayTime: AGORA - 240 * DIA_MS }],
    partidas: []
  }, { agora: AGORA });

  // 240 dias => exp(-4) ~ 0.018
  assert.ok(prof.Fizz.recencia < 0.05, `recencia deveria ser baixa, veio ${prof.Fizz.recencia}`);
  assert.ok(prof.Fizz.maestriaNorm > 0.98, 'maestriaNorm continua alta');
  // recencia tem peso 0.25; sem recência a proficiencia não satura
  assert.ok(prof.Fizz.proficiencia < 0.7, `proficiencia deveria ser puxada pra baixo, veio ${prof.Fizz.proficiencia}`);
});

test('rotasJogadas mapeia UTILITY->SUP, MIDDLE->MID, BOTTOM->ADC', () => {
  assert.equal(normalizarRota('UTILITY'), 'SUP');
  assert.equal(normalizarRota('MIDDLE'), 'MID');
  assert.equal(normalizarRota('BOTTOM'), 'ADC');

  const prof = calcularProficiencia({
    masteries: [],
    partidas: [
      partida({ teamPosition: 'UTILITY', championName: 'Lulu' }),
      partida({ teamPosition: 'UTILITY', championName: 'Lulu' })
    ]
  }, { agora: AGORA });
  assert.deepEqual(prof.Lulu.rotasJogadas, { SUP: 2 });
});

test('proficiencia fica em 0–1 e cresce com mais sinais positivos', () => {
  const fraco = calcularProficiencia({
    masteries: [{ championName: 'X', championPoints: 10, lastPlayTime: AGORA - 300 * DIA_MS }],
    partidas: []
  }, { agora: AGORA });

  const forte = calcularProficiencia({
    masteries: [{ championName: 'X', championPoints: 800000, lastPlayTime: AGORA }],
    partidas: Array.from({ length: 12 }, () => partida({ championName: 'X', win: true }))
  }, { agora: AGORA });

  assert.ok(fraco.X.proficiencia >= 0 && fraco.X.proficiencia <= 1);
  assert.ok(forte.X.proficiencia >= 0 && forte.X.proficiencia <= 1);
  assert.ok(forte.X.proficiencia > fraco.X.proficiencia);
});

test('rotasPrincipais agrega e ordena por jogos', () => {
  const prof = calcularProficiencia({
    masteries: [],
    partidas: [
      partida({ championName: 'Udyr', teamPosition: 'JUNGLE' }),
      partida({ championName: 'Udyr', teamPosition: 'JUNGLE' }),
      partida({ championName: 'Volibear', teamPosition: 'JUNGLE' }),
      partida({ championName: 'Garen', teamPosition: 'TOP' })
    ]
  }, { agora: AGORA });

  const rotas = rotasPrincipais(prof);
  assert.equal(rotas[0].rota, 'JUNGLE');
  assert.equal(rotas[0].jogos, 3);
  assert.equal(rotas[0].pct, 75);
  assert.equal(rotas[1].rota, 'TOP');
});

test('desempenho de SUP ignora csMin (usa só KDA)', () => {
  // KDA alto (10) mas cs 0: para SUP não pode ser punido pelo cs
  const prof = calcularProficiencia({
    masteries: [],
    partidas: [partida({ championName: 'Lulu', teamPosition: 'UTILITY', kills: 2, deaths: 1, assists: 8, cs: 0 })]
  }, { agora: AGORA });
  assert.ok(prof.Lulu.desempenho === 1, `KDA 10 em SUP deve saturar desempenho, veio ${prof.Lulu.desempenho}`);
});
