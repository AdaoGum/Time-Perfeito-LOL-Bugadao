// ============================================================================
// RELATÓRIO DA TRIBO NO DISCORD — camada de APRESENTAÇÃO (embeds + webhook).
//
// O motor foi partido em três, porque agora tem TRÊS consumidores e cada um usa
// uma fatia diferente:
//
//   shared/relatorio-metricas.js  SQL + análise (números)   → cron, Worker
//   shared/relatorio-prosa.js     banco de frases (texto)   → cron, front
//   este arquivo                  embeds do Discord          → cron
//
// A tela "Relatórios Premium" do site consome as duas primeiras direto (o Worker
// devolve os números; o browser monta o texto), sem passar por aqui. Este arquivo
// segue sendo o ponto de entrada do job agendado — e RE-EXPORTA o que as camadas
// de baixo publicam, então `cron/relatorio-discord.js` e os testes continuam
// importando tudo de um lugar só.
//
// FORMATO (vale para TODOS os períodos — semanal/mensal/50/todos):
//   1 mensagem de cabeçalho + UM CARD POR JOGADOR. O post é um TEASER: nome,
//   uma linha de KPIs por fila jogada, a @menção e o LINK para /relatorios — que
//   é onde a prosa e os gráficos passaram a viver. As filas seguem coletadas por
//   queue_id em consultas separadas e NUNCA se misturam num mesmo número; o que
//   mudou é só o tamanho do que vai para o Discord. Fila sem partida no período
//   não vira linha.
//
//   Até ago/2026 eram DUAS mensagens por jogador, cada uma com a prosa inteira e
//   cinco quadros de números. Esse detalhe agora é do site.
// ============================================================================

import {
  FILAS, TZ, coletarAnalises, fmtData, fmtKda, normalizarPeriodo, parseMetaTiers, pct, resolverFilas, resolverJanela, truncar
} from '../../shared/relatorio-metricas.js';
// Superfície pública histórica: quem já importava daqui não precisa mudar nada.
export {
  QUEUES_RANKED, FILAS, PERIODOS, HORA_CORTE, resolverFilas, normalizarPeriodo,
  nomeCampeao, parseMetaTiers, sqlMarcos10, coletarAnalises,
  periodoIntervalo, diaParaEpoch, corteAnterior, resolverJanela
} from '../../shared/relatorio-metricas.js';
export { gerarProsa } from '../../shared/relatorio-prosa.js';

const NOME_BOT = 'Cronista da Tribo';

// ---------------------------------------------------------------------------
// Embeds do Discord — UM CARD POR JOGADOR, com uma LINHA por fila jogada. As
// linhas continuam separadas: elo, meta e companhia são coisas diferentes em
// cada fila, e somar os números é justamente o que confundia a leitura. O único
// número que cruza as duas é a COR do card, tirada da WR geral.
// ---------------------------------------------------------------------------
function corPorWr(wr) {
  if (wr >= 55) return 0x22c55e;   // verde
  if (wr >= 48) return 0x8b5cf6;   // roxo
  return 0xef4444;                 // vermelho
}

function mencao(a, userMap) {
  if (!userMap) return '';
  const id = userMap[a.puuid] || userMap[a.gameName] || userMap[a.nome];
  return id ? `<@${id}>` : '';
}

// Endereço do site (o link que o card do Discord entrega). Sobrescrevível por env
// para apontar um ambiente de teste sem mexer no código.
const SITE_URL = (process.env.SITE_URL || 'https://ugabugatimeperfeito.bugadao.com').replace(/\/+$/, '');

// Período do relatório -> preset da tela /relatorios. Sem equivalente ('50 jogos',
// 'todos'), o link vai sem query e a tela abre no padrão dela (Semana).
const PRESET_DO_PERIODO = { semanal: 'semana', mensal: 'mes' };

// epoch -> 'AAAA-MM-DD' no fuso de Brasília (é por DIA que a tela filtra).
function isoBrt(ms) {
  return new Date(Number(ms) - 3 * 3600000).toISOString().slice(0, 10);
}

// Link direto para o Relatório Premium do jogador, já na fila e no período do post.
// Janela ANCORADA (os agendados de segunda/sexta) vai como intervalo livre: é o
// único filtro da tela capaz de dizer "de sexta a segunda". A tela recorta por dia
// inteiro, então as pontas dela são um pouco mais largas que as do post — os jogos
// da manhã do primeiro dia aparecem lá e não aqui.
function linkDoJogador(jog, periodoKey, P, filaChave) {
  const caminho = `/relatorios/${encodeURIComponent(jog.gameName)}/${encodeURIComponent(jog.tagLine)}`;
  const q = new URLSearchParams();
  if (filaChave) q.set('fila', filaChave);
  if (P?.desde && P?.ate) {
    q.set('preset', 'outro');
    q.set('de', isoBrt(P.desde));
    q.set('ate', isoBrt(P.ate));
    return `${SITE_URL}${caminho}?${q.toString()}`;
  }
  const preset = PRESET_DO_PERIODO[periodoKey];
  if (preset) q.set('preset', preset);
  const query = q.toString();
  return `${SITE_URL}${caminho}${query ? `?${query}` : ''}`;
}

// Uma linha de KPIs por fila. BREVE de propósito: o detalhe agora mora no site,
// e o Discord serve só para chamar a atenção e entregar o link.
function linhaKpis(filaInfo, a) {
  return [
    `${filaInfo.emoji} **${filaInfo.label}** — ${a.jogos}j · **${a.vitorias}V-${a.derrotas}D** · **${a.wr}% WR**`,
    `KDA **${fmtKda(a.met.kda)}** · ${a.rotaLabel} · ${a.mainChamp || '—'}${a.elo ? ` · ${a.elo}` : ''}`
  ].join('\n');
}

// O card do jogador: nome, KPIs das filas que ele jogou, e o link.
// `individual` = o post foi pedido para UM jogador só (campo "jogador" do Actions).
// Sem o cabeçalho da tribo por cima, o card precisa se apresentar sozinho.
function embedResumo(jog, periodoKey, P, chaves, individual = false) {
  // A fila do link é a mais jogada no período — a que ele quer ver primeiro.
  const filaPrincipal = chaves
    .filter((k) => jog[k])
    .sort((x, y) => (jog[y].jogos || 0) - (jog[x].jogos || 0))[0];

  const blocos = chaves.filter((k) => jog[k]).map((k) => linhaKpis(FILAS[k], jog[k]));
  // Entra como primeiro "bloco" para pegar de graça o mesmo espaçamento das filas.
  if (individual) blocos.unshift(`🎯 **Relatório individual** — este card saiu só para **${jog.gameName}**, fora da rodada da tribo.`);
  const total = chaves.reduce((n, k) => n + (jog[k]?.jogos || 0), 0);
  const wrGeral = pct(
    chaves.reduce((n, k) => n + (jog[k]?.vitorias || 0), 0),
    total
  );

  // O mesmo link vai no `url` do embed (que torna o título clicável) e escrito
  // por extenso no corpo — no celular o título não parece um link.
  const link = linkDoJogador(jog, periodoKey, P, filaPrincipal);

  return {
    title: truncar(`👤 ${jog.nome}`, 256),
    url: link,
    description: truncar(
      `${blocos.join('\n\n')}\n\n🔗 **[Acesse o link para ver o relatório completo](${link})**`,
      4000
    ),
    color: corPorWr(wrGeral),
    footer: { text: `${P.titulo} · ${P.janela}${individual ? ' · pedido avulso' : ''}` }
  };
}

// Cabeçalho (mensagem 1): o de-para do post — período, filas e quantos jogaram.
function montarHeader(P, resumo, ativos, chaves) {
  const filaLabel = chaves.map((k) => FILAS[k].label).join(' + ');
  const total = chaves.reduce((n, k) => n + (resumo.porFila[k]?.partidas || 0), 0);
  return {
    title: `${P.emoji} ${P.titulo}`,
    description: [
      `**Ranked ${filaLabel}** · ${P.janela}`,
      `👥 **${ativos}** jogador(es) · 🎮 **${total}** partidas avaliadas`,
      `📆 ${fmtData(resumo.primeira)} a ${fmtData(resumo.ultima)}`,
      '',
      'Cada card abaixo traz o resumo e o **link do relatório completo** no site.'
    ].join('\n'),
    color: 0x8b5cf6,
    footer: { text: `Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: TZ })}` },
    timestamp: new Date().toISOString()
  };
}

// UMA mensagem por jogador: a menção no content (para o ping chegar) e o card
// com os KPIs + link no embed. Antes eram DUAS mensagens por jogador, cada uma
// com a prosa inteira e cinco quadros de números — o que agora vive no site.
function montarMensagemJogador(jog, periodoKey, P, userMap, chaves, individual) {
  const msg = {
    username: NOME_BOT,
    embeds: [embedResumo(jog, periodoKey, P, chaves, individual)],
    allowed_mentions: { parse: ['users'] }
  };
  const m = mencao(jog, userMap);
  if (m) msg.content = individual ? `${m} seu relatório individual saiu 👇` : `${m} seu relatório saiu 👇`;
  return msg;
}

// Cabeçalho + um card por jogador. No modo INDIVIDUAL o cabeçalho da tribo não
// existe: quem pediu quer um card só, e um "👥 1 jogador · 12 partidas" em cima
// dele seria um resumo da tribo que a tribo nem viu.
export function montarMensagens(jogadores, periodoKey, P, userMap, { resumo, ativos, chaves, individual = false }) {
  const mensagens = individual ? [] : [{
    username: NOME_BOT,
    embeds: [montarHeader(P, resumo, ativos, chaves)],
    allowed_mentions: { parse: ['users'] }
  }];
  for (const jog of jogadores) mensagens.push(montarMensagemJogador(jog, periodoKey, P, userMap, chaves, individual));
  return mensagens;
}

// ---------------------------------------------------------------------------
// Envio ao Discord (sequencial, com tratamento de 429)
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function postarDiscord(webhookUrl, mensagens) {
  if (!webhookUrl) throw new Error('DISCORD_WEBHOOK ausente.');
  for (const msg of mensagens) {
    let tentativas = 0;
    while (true) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
      if (res.status === 429 && tentativas < 3) {
        let retry = 1;
        try { retry = (await res.clone().json())?.retry_after || 1; } catch { /* usa 1s */ }
        await sleep((Number(retry) + 0.3) * 1000);
        tentativas++;
        continue;
      }
      if (!res.ok) throw new Error(`Discord respondeu ${res.status}: ${await res.text()}`);
      break;
    }
    await sleep(600); // respiro entre mensagens (o cabeçalho + uma por jogador)
  }
}

// ---------------------------------------------------------------------------
// ORQUESTRADOR — gera o cabeçalho e, depois, UM CARD POR JOGADOR (com as filas
// que ele jogou no período, uma linha para cada).
// `fila`: 'solo' | 'flex' | 'ambas' (default) restringe as filas cobertas.
//   opts: { queryRows, periodo, fila?, puuids?, metaCsv?, userMap?, agora? }
//   retorna { mensagens, ativos, periodo, fila }
// ---------------------------------------------------------------------------
export async function gerarRelatorio({ queryRows, periodo = 'semanal', fila = 'ambas', puuids = null, somentePremium = null, metaCsv = null, userMap = null, agora = Date.now(), individual = false, rotuloAlvo = '' }) {
  const periodoKey = normalizarPeriodo(periodo);
  // A janela dos períodos ancorados (segunda/sexta) só existe no INSTANTE do post:
  // é aqui que "desde o corte anterior" vira um recorte concreto em milissegundos.
  const P = resolverJanela(periodoKey, agora);

  // Regra: sem seleção explícita de puuids ("para todos") o relatório cobre SÓ premium
  // (has_premium = 1) — igual ao sync/backfill. Alvo explícito ignora o filtro.
  const soPrem = somentePremium == null ? !puuids : somentePremium;

  const meta = metaCsv ? parseMetaTiers(metaCsv).table : null;
  const chaves = resolverFilas(fila);

  // Coleta por fila (Solo 420 / Flex 440 são consultas independentes, filtradas
  // por queue_id) e depois AGRUPA por jogador — é esse agrupamento que permite um
  // card único com as duas filas dentro. Os números seguem separados por fila.
  const porFila = {};
  for (const chave of chaves) {
    porFila[chave] = await coletarAnalises({
      queryRows, P, puuids, soPrem, meta, agora, queues: [FILAS[chave].id], filaChave: chave
    });
  }

  const map = new Map();
  for (const chave of chaves) {
    for (const a of porFila[chave].analises) {
      if (!map.has(a.puuid)) map.set(a.puuid, { puuid: a.puuid, nome: a.nome, gameName: a.gameName, tagLine: a.tagLine, solo: null, flex: null });
      map.get(a.puuid)[chave] = a;
    }
  }
  // Ordem dos jogadores no post: quem mais jogou no período (somando as filas)
  // aparece primeiro. Dentro do jogador, a ordem é sempre Solo/Duo → Flex.
  const jogadores = [...map.values()]
    .map(j => ({ ...j, totalJogos: (j.solo?.jogos || 0) + (j.flex?.jogos || 0) }))
    .sort((x, y) => y.totalJogos - x.totalJogos);

  // Resumo agregado (contagem por fila + janela global de datas) pro cabeçalho.
  const resumo = { porFila: {}, primeira: null, ultima: null };
  for (const chave of chaves) {
    const r = porFila[chave].resumo;
    resumo.porFila[chave] = r;
    if (r.primeira != null) resumo.primeira = resumo.primeira == null ? r.primeira : Math.min(resumo.primeira, r.primeira);
    if (r.ultima != null) resumo.ultima = resumo.ultima == null ? r.ultima : Math.max(resumo.ultima, r.ultima);
  }

  const ativos = jogadores.length;
  let mensagens;
  if (!jogadores.length) {
    const filaLabel = chaves.map(k => FILAS[k].label).join(' + ');
    const quem = individual && rotuloAlvo ? `**${rotuloAlvo}** não jogou` : 'ninguém da tribo jogou';
    mensagens = [{
      username: NOME_BOT,
      content: `${P.emoji} **${P.titulo} — Ranked ${filaLabel}**: ${quem} ranqueada nos ${P.janela}. 😴`
    }];
  } else {
    mensagens = montarMensagens(jogadores, periodoKey, P, userMap, { resumo, ativos, chaves, individual });
  }

  return { ativos, periodo: periodoKey, fila, individual, janela: { desde: P.desde ?? null, ate: P.ate ?? null, rotulo: P.janela }, mensagens };
}
