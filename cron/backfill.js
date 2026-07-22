// ============================================================================
// BACKFILL CENTRADO NA PARTIDA — recupera as estatísticas + marcos que se perderam
// quando duas ou mais contas do banco jogaram a MESMA partida.
//
// Contexto do bug (já corrigido em cron/sync.js): a dedup antiga olhava a tabela
// global `partidas`; a primeira conta a processar uma partida "carimbava" ela e as
// demais a pulavam para sempre, ficando sem linha em estatisticas_jogador_partida.
//
// Este script conserta o histórico já existente SEM a ineficiência do trator
// (que baixa jogador-por-jogador). Aqui:
//   1) Descobre, por puuid, quais partidas faltam (lista de IDs da Riot − o que já
//      existe em estatisticas_jogador_partida daquele puuid).
//   2) Tira a UNIÃO dessas partidas -> cada match_id único é baixado UMA só vez.
//   3) Para cada partida: grava metadados (partidas), e para CADA jogador registrado
//      que jogou nela grava estatísticas (37 col) + marcos (52 col via timeline).
//
// Rodar aqui no VS:  node --env-file=local/.env cron/backfill.js
// ============================================================================

import {
  SQL_PARTIDAS, valoresPartida, montarTeams,
  SQL_ESTATISTICAS, valoresEstatisticas,
  SQL_MARCOS, extrairMarcos, MARCOS_MINUTOS
} from '../shared/match-extract.js';

import { queryD1 } from './lib/d1.js';
import { fetchFromRiotHost, respeitarRateLimit } from './lib/riot.js';

const REGION_ROUTE = 'americas';
const LIMITE_PARTIDAS = 1000; // backfill mira o histórico fundo: até as 1000 últimas por jogador
const PAGINA_IDS = 100;

// 🎯 VETOR DE ALVOS — quem o backfill vai preencher.
//   • Vetor VAZIO (default) -> processa SÓ jogadores premium (paridade com cron/sync.js).
//   • Com puuids            -> processa SÓ esses (escape hatch manual, ignora premium).
// A env PUUIDS (separada por vírgula) tem prioridade sobre o vetor abaixo. Para um
// backfill pontual, preencha o vetor OU passe PUUIDS="puuid1,puuid2" na linha de comando.
const PUUIDS_ALVO = (
  process.env.PUUIDS
    ? process.env.PUUIDS.split(',').map((s) => s.trim()).filter(Boolean)
    : [
        // cole aqui puuids para um backfill filtrado, ex.:
        // '9t-kjlDiabw7Br6dj5pq4H7ulYloLp5DBVJAAydDdIjBxBp3oNXXG2Y-igp9j7XEGjGBTFuQPcxTfQ',
      ]
);

// ----------------------------------------------------------------------------
// Infra: D1 e Riot vêm da lib compartilhada (cron/lib). O fetch do backfill
// resfria a chave antes de cada request e devolve null em 404 (partida/timeline
// que sumiu do lado da Riot) em vez de derrubar a rodada.
// ----------------------------------------------------------------------------
const fetchFromRiot = async (endpoint) => {
  await respeitarRateLimit();
  return fetchFromRiotHost(REGION_ROUTE, endpoint, { source: 'backfill', retornarNullEm404: true });
};

// Lista todos os match_ids buscáveis de um puuid (todas as filas), paginando.
async function listarIdsRiot(puuid) {
  const ids = [];
  for (let start = 0; start < LIMITE_PARTIDAS; start += PAGINA_IDS) {
    const count = Math.min(PAGINA_IDS, LIMITE_PARTIDAS - start);
    const pagina = await fetchFromRiot(`/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${start}&count=${count}`);
    if (!pagina || pagina.length === 0) break;
    ids.push(...pagina);
    if (pagina.length < count) break;
  }
  return ids;
}

// match_ids que ESTE puuid já tem em estatisticas_jogador_partida (dentre os candidatos).
async function jaTemEstatisticas(puuid, candidatos) {
  const existentes = new Set();
  for (let i = 0; i < candidatos.length; i += 50) {
    const chunk = candidatos.slice(i, i + 50);
    const ph = chunk.map(() => '?').join(',');
    const res = await queryD1(
      `SELECT match_id FROM estatisticas_jogador_partida WHERE puuid = ? AND match_id IN (${ph})`,
      [puuid, ...chunk]
    );
    (res.results || []).forEach((row) => existentes.add(row.match_id));
  }
  return existentes;
}

// ----------------------------------------------------------------------------
// FASE 1 — Descoberta: quem falta em qual partida.
// ----------------------------------------------------------------------------
async function descobrirLacunas(jogadores) {
  const neededByMatch = new Map(); // match_id -> Set(puuid) que precisa dele
  const puuidToNome = new Map(jogadores.map((j) => [j.puuid, `${j.game_name}#${j.tag_line}`]));

  for (const jogador of jogadores) {
    const nome = puuidToNome.get(jogador.puuid);
    console.log(`\n🔎 [DESCOBERTA] ${nome}: listando partidas na Riot...`);
    const riotIds = await listarIdsRiot(jogador.puuid);
    const jaTem = await jaTemEstatisticas(jogador.puuid, riotIds);
    let faltam = 0;
    for (const id of riotIds) {
      if (jaTem.has(id)) continue;
      faltam++;
      if (!neededByMatch.has(id)) neededByMatch.set(id, new Set());
      neededByMatch.get(id).add(jogador.puuid);
    }
    console.log(`   Riot: ${riotIds.length} | já no D1: ${jaTem.size} | faltando: ${faltam}`);
  }
  return { neededByMatch, puuidToNome };
}

// ----------------------------------------------------------------------------
// FASE 2 — Preenchimento: uma partida por vez, todos os jogadores que faltam nela.
// ----------------------------------------------------------------------------
async function preencherPartida(matchId, puuidsNecessarios, contadores) {
  const matchData = await fetchFromRiot(`/lol/match/v5/matches/${matchId}`);
  if (!matchData || !matchData.info) {
    console.log(`   ⚠️ ${matchId}: detalhe indisponível na Riot (pulado).`);
    return;
  }
  const info = matchData.info;

  // Metadados globais (FK exige a partida antes das estatísticas).
  await queryD1(SQL_PARTIDAS, valoresPartida(matchId, info, montarTeams(info)));

  // Só os jogadores registrados que realmente jogaram esta partida E ainda faltam.
  const alvos = info.participants.filter((p) => puuidsNecessarios.has(p.puuid));
  if (alvos.length === 0) {
    console.log(`   ⚠️ ${matchId}: nenhum jogador-alvo encontrado nos participantes (pulado).`);
    return;
  }

  // Estatísticas de fim de jogo (uma linha por jogador-alvo).
  for (const participant of alvos) {
    await queryD1(SQL_ESTATISTICAS, valoresEstatisticas(participant.puuid, matchId, info, participant));
    contadores.estat++;
  }

  // Marcos: uma única timeline serve para TODOS os jogadores-alvo da partida.
  const timeline = await fetchFromRiot(`/lol/match/v5/matches/${matchId}/timeline`);
  if (timeline) {
    const linhas = [];
    for (const participant of alvos) {
      linhas.push(...extrairMarcos(participant.puuid, matchId, timeline));
    }
    // D1 tem teto de parâmetros por statement; marcos tem 52 colunas -> 1 linha por call,
    // mas disparadas em paralelo (D1 não é rate-limited como a Riot) para não serializar.
    await Promise.all(linhas.map((l) => queryD1(SQL_MARCOS, l)));
    contadores.marcos += linhas.length;
  }

  const nomes = alvos.map((p) => p.championName).join(', ');
  console.log(`   💾 ${matchId} | ${alvos.length} jogador(es): ${nomes}`);
}

// ----------------------------------------------------------------------------
// Orquestração
// ----------------------------------------------------------------------------
(async () => {
  if (!process.env.RIOT_API_KEY || !process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN || !process.env.D1_DATABASE_ID) {
    console.error('❌ Faltam variáveis de ambiente (RIOT_API_KEY / CLOUDFLARE_* / D1_DATABASE_ID).');
    process.exit(1);
  }

  console.log('=========================================================');
  console.log('🩹 BACKFILL CENTRADO NA PARTIDA (estatísticas + marcos)');
  console.log('=========================================================');

  const jogadoresRes = await queryD1('SELECT puuid, game_name, tag_line, has_premium FROM jogadores');
  let jogadores = jogadoresRes.results || [];

  // 🎯 Filtro do vetor de alvos: preenchido = só esses puuids (escape hatch manual,
  //    ignora o premium). Vetor vazio = processa SÓ jogadores premium.
  if (PUUIDS_ALVO.length) {
    const alvo = new Set(PUUIDS_ALVO);
    jogadores = jogadores.filter((j) => alvo.has(j.puuid));
    console.log(`🎯 [FILTRO] ${jogadores.length} de ${PUUIDS_ALVO.length} puuid(s) alvo encontrados no banco.`);
  } else {
    const antes = jogadores.length;
    jogadores = jogadores.filter((j) => Number(j.has_premium) === 1);
    console.log(`⭐ [PREMIUM] ${jogadores.length}/${antes} jogador(es) premium (vetor vazio → só premium).`);
  }

  const { neededByMatch } = await descobrirLacunas(jogadores);
  const matchIds = [...neededByMatch.keys()];
  console.log(`\n🎯 [PLANO] ${matchIds.length} partidas ÚNICAS a baixar (cada uma 1 só vez).`);

  if (matchIds.length === 0) {
    console.log('✨ Nada a preencher — o histórico já está completo.');
    return;
  }

  const contadores = { estat: 0, marcos: 0 };
  let feitas = 0;
  for (const matchId of matchIds) {
    try {
      await preencherPartida(matchId, neededByMatch.get(matchId), contadores);
    } catch (e) {
      console.error(`   ❌ Erro em ${matchId}: ${e.message}`);
    }
    feitas++;
    if (feitas % 25 === 0) console.log(`   … ${feitas}/${matchIds.length} partidas processadas`);
  }

  console.log('\n=========================================================');
  console.log(`✅ [FIM] ${feitas}/${matchIds.length} partidas | ${contadores.estat} estatísticas | ${contadores.marcos} marcos gravados.`);
  console.log('=========================================================');
})().catch((e) => {
  console.error('❌ [FALHA CRÍTICA]', e.message);
  process.exit(1);
});
