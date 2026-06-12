/**
 * Proficiência real do jogador por campeão (FASE 1 do motor de sinergia v2).
 *
 * calcularProficiencia({ masteries, partidas }) -> mapa championName -> {
 *   proficiencia, jogos, winrateAjustado, recencia, desempenho, maestriaNorm, rotasJogadas
 * }
 *
 * Fórmulas (tudo 0–1):
 *   winrateAjustado = (vitorias + K*0.5) / (jogos + K)         // K = 8 (suavização bayesiana)
 *   recencia        = exp(-diasDesdeUltimoJogo / 60)           // lastPlayTime da maestria OU game_creation mais recente
 *   maestriaNorm    = clamp(log10(pontos + 1) / 6, 0, 1)       // 1M pontos ≈ 1.0
 *   desempenho      = clamp(((kda-2)/4)*0.6 + ((csMin-4)/5)*0.4, 0, 1)  // csMin só p/ rotas de farm
 *   proficiencia    = 0.35*winrateAjustado + 0.25*maestriaNorm + 0.25*recencia + 0.15*desempenho
 *
 * Dados ausentes degradam para neutro (0.5), nunca para zero ou crash.
 */

const K_SUAVIZACAO = 8;
const DIA_MS = 86400000;

export const ROTAS_FARM = ['TOP', 'JUNGLE', 'MID', 'ADC'];

const ROTA_MAP = {
  TOP: 'TOP',
  JUNGLE: 'JUNGLE',
  MIDDLE: 'MID',
  MID: 'MID',
  BOTTOM: 'ADC',
  ADC: 'ADC',
  UTILITY: 'SUP',
  SUP: 'SUP',
  SUPPORT: 'SUP'
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizarRota(teamPosition) {
  return ROTA_MAP[String(teamPosition || '').trim().toUpperCase()] || '';
}

function agruparPartidasPorCampeao(partidas) {
  const grupos = {};
  for (const partida of partidas || []) {
    const nome = partida?.championName;
    if (!nome) continue;

    if (!grupos[nome]) {
      grupos[nome] = {
        jogos: 0, vitorias: 0,
        kills: 0, deaths: 0, assists: 0,
        cs: 0, duracaoSeg: 0,
        ultimoJogo: 0,
        rotasJogadas: {}
      };
    }

    const g = grupos[nome];
    g.jogos += 1;
    if (partida.win) g.vitorias += 1;
    g.kills += Number(partida.kills || 0);
    g.deaths += Number(partida.deaths || 0);
    g.assists += Number(partida.assists || 0);
    g.cs += Number(partida.cs || 0);
    g.duracaoSeg += Number(partida.gameDuration || 0);
    g.ultimoJogo = Math.max(g.ultimoJogo, Number(partida.gameCreation || 0));

    const rota = normalizarRota(partida.teamPosition);
    if (rota) g.rotasJogadas[rota] = (g.rotasJogadas[rota] || 0) + 1;
  }
  return grupos;
}

function rotaPrincipalDoGrupo(rotasJogadas) {
  let melhor = '';
  let max = 0;
  for (const [rota, count] of Object.entries(rotasJogadas || {})) {
    if (count > max) { max = count; melhor = rota; }
  }
  return melhor;
}

function calcularDesempenho(grupo) {
  if (!grupo || !grupo.jogos) return 0.5; // sem partidas -> neutro

  const kda = (grupo.kills + grupo.assists) / Math.max(1, grupo.deaths);
  const compKda = (kda - 2) / 4;

  const rota = rotaPrincipalDoGrupo(grupo.rotasJogadas);
  const ehRotaDeFarm = ROTAS_FARM.includes(rota);

  if (!ehRotaDeFarm) {
    // SUP / rota desconhecida: csMin não se aplica, só KDA
    return clamp(compKda, 0, 1);
  }

  const minutos = grupo.duracaoSeg > 0 ? grupo.duracaoSeg / 60 : 0;
  const csMin = minutos > 0 ? grupo.cs / minutos : 0;
  const compCs = (csMin - 4) / 5;

  return clamp(compKda * 0.6 + compCs * 0.4, 0, 1);
}

export function calcularProficiencia(jogador, options = {}) {
  const agora = Number(options.agora || Date.now());
  const masteries = jogador?.masteries || [];
  const partidas = jogador?.partidas || [];

  const grupos = agruparPartidasPorCampeao(partidas);

  const maestriaPorCampeao = {};
  for (const entry of masteries) {
    const nome = entry?.championName;
    if (!nome) continue;
    maestriaPorCampeao[nome] = {
      pontos: Number(entry.championPoints || 0),
      lastPlayTime: Number(entry.lastPlayTime || 0)
    };
  }

  const nomes = new Set([...Object.keys(grupos), ...Object.keys(maestriaPorCampeao)]);
  const resultado = {};

  for (const nome of nomes) {
    const grupo = grupos[nome] || null;
    const maestria = maestriaPorCampeao[nome] || { pontos: 0, lastPlayTime: 0 };

    const jogos = grupo?.jogos || 0;
    const vitorias = grupo?.vitorias || 0;

    // Campeão com maestria mas 0 partidas recentes: winrate neutro 0.5
    const winrateAjustado = jogos > 0
      ? (vitorias + K_SUAVIZACAO * 0.5) / (jogos + K_SUAVIZACAO)
      : 0.5;

    const ultimoTs = Math.max(maestria.lastPlayTime, grupo?.ultimoJogo || 0);
    const diasDesdeUltimoJogo = ultimoTs > 0 ? Math.max(0, (agora - ultimoTs) / DIA_MS) : Infinity;
    const recencia = Number.isFinite(diasDesdeUltimoJogo) ? Math.exp(-diasDesdeUltimoJogo / 60) : 0;

    const maestriaNorm = clamp(Math.log10(maestria.pontos + 1) / 6, 0, 1);
    const desempenho = calcularDesempenho(grupo);

    const proficiencia = clamp(
      0.35 * winrateAjustado + 0.25 * maestriaNorm + 0.25 * recencia + 0.15 * desempenho,
      0, 1
    );

    resultado[nome] = {
      proficiencia,
      jogos,
      winrateAjustado,
      recencia,
      desempenho,
      maestriaNorm,
      rotasJogadas: { ...(grupo?.rotasJogadas || {}) }
    };
  }

  return resultado;
}

/**
 * Agrega rotasJogadas de todos os campeões e retorna as rotas mais jogadas:
 * [{ rota: 'JUNGLE', jogos: 12, pct: 60 }, ...] ordenado desc.
 */
export function rotasPrincipais(proficienciaMap) {
  const agregado = {};
  let total = 0;

  for (const dados of Object.values(proficienciaMap || {})) {
    for (const [rota, count] of Object.entries(dados?.rotasJogadas || {})) {
      agregado[rota] = (agregado[rota] || 0) + count;
      total += count;
    }
  }

  if (!total) return [];

  return Object.entries(agregado)
    .map(([rota, jogos]) => ({ rota, jogos, pct: Math.round((jogos / total) * 100) }))
    .sort((a, b) => b.jogos - a.jogos);
}
