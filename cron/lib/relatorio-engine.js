// ============================================================================
// MOTOR DE RELATÓRIO DA TRIBO — NLG "IA sem IA" (JS puro, portável).
//
// Usado pelo job agendado (cron/relatorio-discord.js, Node/Actions) E pelo worker
// (botão no app). Não importa nada de Node (`fs`/`process`) nem do Vite (`?raw`):
// quem chama injeta a função de query e (opcionalmente) o CSV do meta já lido.
//
// Contrato de query injetada:
//   queryRows(sql, params) -> Promise<Array<Object>>  (linhas do D1)
//     • Node/cron:  async (sql,p) => (await queryD1(sql,p)).results
//     • Worker:     async (sql,p) => (await env.DB.prepare(sql).bind(...p).all()).results
//
// Correção de schema: game_creation/game_duration/queue_id ficam em `partidas`.
// ============================================================================

export const QUEUES_RANKED = [420, 440];
const DIA = 86400000;

// Rótulos e janelas por período. Obs.: o relatório "diário" roda todo dia, mas
// analisa os ÚLTIMOS 3 DIAS (janela rolante), e o "semanal" analisa os ÚLTIMOS 30
// DIAS — mais amostra, menos ruído de dia isolado.
export const PERIODOS = {
  dia:    { ms: 3 * DIA,  titulo: '📊 Relatório Diário',  janela: 'últimos 3 dias' },
  semana: { ms: 30 * DIA, titulo: '📅 Relatório Semanal', janela: 'últimos 30 dias' },
  mes:    { ms: 30 * DIA, titulo: '🗓️ Relatório Mensal',  janela: '~30 dias' }
};

// Benchmarks por rota (mira). Abaixo do 1º = "a melhorar"; acima do 2º = "forte".
// csMin null = métrica irrelevante para a rota (ex.: suporte).
const BENCH = {
  TOP:     { csMin: [6, 8],     visMin: [0.4, 0.7], kp: [0.40, 0.55], kda: 2.0 },
  JUNGLE:  { csMin: [4.5, 6.5], visMin: [0.7, 1.1], kp: [0.55, 0.70], kda: 2.5 },
  MIDDLE:  { csMin: [6, 8],     visMin: [0.5, 0.8], kp: [0.50, 0.65], kda: 2.5 },
  BOTTOM:  { csMin: [7, 9],     visMin: [0.4, 0.7], kp: [0.50, 0.65], kda: 2.5 },
  UTILITY: { csMin: null,       visMin: [1.2, 2.0], kp: [0.55, 0.72], kda: 2.5 }
};

// team_position (Riot) -> rótulo humano e -> role do meta-tiers.csv.
const ROLE_LABEL = { TOP: 'Topo', JUNGLE: 'Selva', MIDDLE: 'Meio', BOTTOM: 'Atirador', UTILITY: 'Suporte' };
const ROLE_META  = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };

// ---------------------------------------------------------------------------
// SQL (placeholders `?` posicionais; params em array — igual nos dois ambientes)
// ---------------------------------------------------------------------------
function inClause(puuids) {
  if (!puuids || !puuids.length) return { frag: '', params: [] };
  return { frag: ` AND e.puuid IN (${puuids.map(() => '?').join(',')})`, params: [...puuids] };
}

export function sqlAgregadoJogador(desde, ate, puuids, somentePremium = false) {
  const inC = inClause(puuids);
  const premiumFrag = somentePremium ? ' AND j.has_premium = 1' : '';
  return {
    sql: `
      SELECT e.puuid, j.game_name, j.tag_line, j.tier, j.rank,
        COUNT(*) jogos, SUM(e.win) vitorias,
        SUM(e.kills) k, SUM(e.deaths) d, SUM(e.assists) a,
        AVG(e.cs * 60.0 / NULLIF(p.game_duration,0)) cs_min,
        AVG(e.vision_score * 60.0 / NULLIF(p.game_duration,0)) vis_min,
        AVG(e.kill_participation) kp,
        AVG(e.gold_per_min) gpm,
        AVG(e.damage_champions) dmg
      FROM estatisticas_jogador_partida e
      JOIN partidas p ON p.match_id = e.match_id
      JOIN jogadores j ON j.puuid = e.puuid
      WHERE p.game_creation >= ? AND p.game_creation < ? AND p.game_creation > 0
        AND p.queue_id IN (${QUEUES_RANKED.join(',')})${inC.frag}${premiumFrag}
      GROUP BY e.puuid`,
    params: [desde, ate, ...inC.params]
  };
}

export function sqlPorRota(desde, ate, puuids) {
  const inC = inClause(puuids);
  return {
    sql: `
      SELECT e.puuid, e.team_position, COUNT(*) n, SUM(e.win) v
      FROM estatisticas_jogador_partida e
      JOIN partidas p ON p.match_id = e.match_id
      WHERE p.game_creation >= ? AND p.game_creation < ? AND p.game_creation > 0
        AND p.queue_id IN (${QUEUES_RANKED.join(',')})${inC.frag}
      GROUP BY e.puuid, e.team_position`,
    params: [desde, ate, ...inC.params]
  };
}

export function sqlPorChampion(desde, ate, puuids) {
  const inC = inClause(puuids);
  return {
    sql: `
      SELECT e.puuid, e.champion_name, e.team_position, COUNT(*) n, SUM(e.win) v
      FROM estatisticas_jogador_partida e
      JOIN partidas p ON p.match_id = e.match_id
      WHERE p.game_creation >= ? AND p.game_creation < ? AND p.game_creation > 0
        AND p.queue_id IN (${QUEUES_RANKED.join(',')})${inC.frag}
      GROUP BY e.puuid, e.champion_name`,
    params: [desde, ate, ...inC.params]
  };
}

export function sqlMarcos10(desde, ate, puuids) {
  const inC = puuids && puuids.length
    ? { frag: ` AND m.puuid IN (${puuids.map(() => '?').join(',')})`, params: [...puuids] }
    : { frag: '', params: [] };
  return {
    sql: `
      SELECT m.puuid, AVG(m.total_gold) ouro10, AVG(m.xp) xp10, COUNT(*) n
      FROM estatisticas_jogador_marcos m
      JOIN partidas p ON p.match_id = m.match_id
      WHERE m.minuto = 10 AND p.game_creation >= ? AND p.game_creation < ? AND p.game_creation > 0
        AND p.queue_id IN (${QUEUES_RANKED.join(',')})${inC.frag}
      GROUP BY m.puuid`,
    params: [desde, ate, ...inC.params]
  };
}

// ---------------------------------------------------------------------------
// Meta-tiers.csv -> tabela { 'championKey|ROLE': tier }
// ---------------------------------------------------------------------------
function normChamp(nome) {
  return String(nome || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
// championName da Riot vs Data Dragon (casos que divergem).
const ALIAS_CHAMP = { monkeyking: 'wukong', fiddlesticks: 'fiddlesticks' };
function champKey(nome) {
  const n = normChamp(nome);
  return ALIAS_CHAMP[n] || n;
}

export function parseMetaTiers(csvText) {
  const table = {};
  if (!csvText) return { table, patch: '?' };
  const linhas = String(csvText).replace(/\r/g, '').split('\n');
  let patch = '?';
  for (const raw of linhas) {
    const linha = raw.trim();
    if (!linha) continue;
    if (linha.startsWith('#')) {
      const m = linha.match(/patch:\s*([^|]+)/i);
      if (m) patch = m[1].trim();
      continue;
    }
    if (linha.toLowerCase().startsWith('champion,')) continue;
    const [champ, role, tier] = linha.split(',').map(s => s.trim());
    if (!champ || !role || !tier) continue;
    table[`${champKey(champ)}|${role.toUpperCase()}`] = { nome: champ, tier: tier.toUpperCase() };
  }
  return { table, patch };
}

// ---------------------------------------------------------------------------
// Utilidades numéricas / classificação
// ---------------------------------------------------------------------------
const round = (n, c = 0) => { const f = 10 ** c; return Math.round((Number(n) || 0) * f) / f; };
const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

function classificar(valor, faixa) {
  if (!faixa) return 'na';
  if (valor < faixa[0]) return 'fraco';
  if (valor > faixa[1]) return 'forte';
  return 'mediano';
}

// RNG determinístico com semente (mulberry32 sobre hash da string).
function seedRng(str) {
  let h = 1779033703 ^ String(str).length;
  for (let i = 0; i < String(str).length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// Análise de um jogador (objeto pronto pra virar prosa)
// ---------------------------------------------------------------------------
function analisarJogador(agg, rotas, champs, marcos, prev, prevMarcos, metaTable) {
  const jogos = Number(agg.jogos) || 0;
  const kda = (Number(agg.k) + Number(agg.a)) / Math.max(1, Number(agg.d));
  const wr = pct(Number(agg.vitorias), jogos);

  // Rota principal = mais jogada.
  const rotasOrd = [...rotas].filter(r => r.team_position).sort((x, y) => y.n - x.n);
  const rotaPrinc = rotasOrd[0]?.team_position || 'MIDDLE';
  const bench = BENCH[rotaPrinc] || BENCH.MIDDLE;

  const met = {
    csMin: round(agg.cs_min, 1),
    visMin: round(agg.vis_min, 2),
    kp: Number(agg.kp) || 0,
    kda: round(kda, 2),
    gpm: round(agg.gpm),
    dmg: round(agg.dmg)
  };
  const classe = {
    csMin: classificar(met.csMin, bench.csMin),
    visMin: classificar(met.visMin, bench.visMin),
    kp: classificar(met.kp, bench.kp),
    kda: met.kda >= bench.kda ? 'forte' : (met.kda >= bench.kda * 0.75 ? 'mediano' : 'fraco')
  };

  // Tendência vs período anterior.
  const tend = {};
  if (prev && Number(prev.jogos) > 0) {
    const prevWr = pct(Number(prev.vitorias), Number(prev.jogos));
    const prevKda = (Number(prev.k) + Number(prev.a)) / Math.max(1, Number(prev.d));
    tend.wr = { antes: prevWr, agora: wr, delta: wr - prevWr };
    tend.kda = { antes: round(prevKda, 2), agora: met.kda, delta: round(met.kda - prevKda, 2) };
    tend.csMin = { antes: round(prev.cs_min, 1), agora: met.csMin, delta: round(met.csMin - Number(prev.cs_min || 0), 1) };
  }
  if (marcos && prevMarcos && Number(marcos.n) >= 3 && Number(prevMarcos.n) >= 3) {
    tend.ouro10 = { antes: round(prevMarcos.ouro10), agora: round(marcos.ouro10), delta: round(marcos.ouro10 - prevMarcos.ouro10) };
  }

  // Campeões (do próprio histórico). O "main" é o mais jogado DENTRO da rota principal
  // (evita dizer "no Atirador, jogando mais de Renekton" quando o pico veio de outra rota).
  const champsOrd = [...champs].sort((a, b) => b.n - a.n);
  const champsRota = champsOrd.filter(c => c.team_position === rotaPrinc);
  const mainChamp = (champsRota[0] || champsOrd[0])?.champion_name || null;
  const bestChamps = champsOrd
    .filter(c => c.n >= Math.max(3, Math.round(jogos * 0.1)))
    .map(c => ({ nome: c.champion_name, n: c.n, wr: pct(c.v, c.n) }))
    .sort((a, b) => b.wr - a.wr);

  // Off-role que derruba a WR: 2ª rota mais jogada com amostra e WR pior que a principal.
  const wrPrinc = pct(rotasOrd[0]?.v || 0, rotasOrd[0]?.n || 1);
  let offRole = null;
  for (const r of rotasOrd.slice(1)) {
    if (r.n >= 5) {
      const w = pct(r.v, r.n);
      if (w < wrPrinc - 8) { offRole = { rota: r.team_position, n: r.n, wr: w }; break; }
    }
  }

  // Sugestão do meta: campeão S/A na rota principal que ele ainda não spamma.
  let sugestaoMeta = null;
  if (metaTable) {
    const roleMeta = ROLE_META[rotaPrinc];
    const jogados = new Set(champsOrd.map(c => champKey(c.champion_name)));
    const candidatos = Object.entries(metaTable)
      .filter(([chave, v]) => chave.endsWith(`|${roleMeta}`) && (v.tier === 'S' || v.tier === 'A'))
      .filter(([chave]) => !jogados.has(chave.split('|')[0]))
      .map(([, v]) => v);
    if (candidatos.length) {
      // pseudo-aleatório estável entre os candidatos, priorizando S.
      const s = candidatos.filter(c => c.tier === 'S');
      const pool = s.length ? s : candidatos;
      sugestaoMeta = pool[Math.floor(seedRng(agg.puuid + '|meta')() * pool.length)];
    }
  }

  return {
    puuid: agg.puuid,
    nome: `${agg.game_name}#${agg.tag_line}`,
    gameName: agg.game_name,
    jogos, wr, met, classe, rotaPrinc, rotaLabel: ROLE_LABEL[rotaPrinc] || rotaPrinc,
    tend, mainChamp, bestChamps, offRole, sugestaoMeta
  };
}

// ---------------------------------------------------------------------------
// Geração da prosa (banco de frases + semente puuid+data)
// ---------------------------------------------------------------------------
const NOME_METRICA = {
  csMin: 'farm (CS/min)', visMin: 'visão de mapa', kp: 'participação em abates', kda: 'KDA'
};

function fraseAbertura(rng, a, periodoJanela) {
  if (a.jogos >= 20) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela} — presença de sobra.`,
    `**${a.jogos} jogos** no período: você não deu descanso pra fila.`,
    `Com **${a.jogos} partidas**, você foi um dos pilares de atividade da tribo.`
  ]);
  if (a.jogos >= 5) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela}.`,
    `**${a.jogos} jogos** no período — um ritmo saudável.`
  ]);
  return pick(rng, [
    `Poucas partidas dessa vez (**${a.jogos}**), então leve os números com um grão de sal.`,
    `Só **${a.jogos} jogo(s)** — amostra pequena, mas dá pra sentir a direção.`
  ]);
}

function frasesFortes(rng, a) {
  const out = [];
  if (a.classe.kp === 'forte') out.push(pick(rng, [
    `sua **participação em abates (${Math.round(a.met.kp * 100)}%)** é de quem aparece nas brigas`,
    `você vive as jogadas do time — **${Math.round(a.met.kp * 100)}% de KP**`
  ]));
  if (a.classe.csMin === 'forte') out.push(pick(rng, [
    `o **farm está afiado (${a.met.csMin} CS/min)**, acima do padrão da rota`,
    `você não perde onda: **${a.met.csMin} CS/min**`
  ]));
  if (a.classe.visMin === 'forte') out.push(pick(rng, [
    `a **visão de mapa (${a.met.visMin}/min)** está exemplar`,
    `você ilumina o mapa como poucos (**${a.met.visMin} de visão/min**)`
  ]));
  if (a.classe.kda === 'forte') out.push(pick(rng, [
    `o **KDA ${a.met.kda}** mostra que você troca bem e morre pouco`,
    `**KDA ${a.met.kda}** — consistência de quem sobrevive pra carregar`
  ]));
  return out;
}

function frasesFracas(rng, a) {
  const out = [];
  if (a.classe.csMin === 'fraco') out.push(pick(rng, [
    `o **farm (${a.met.csMin} CS/min)** está abaixo do que a rota pede — é ouro que vira item, e item que vira vitória`,
    `dá pra apertar o **CS/min (hoje ${a.met.csMin})**: cada onda perdida é um item a menos no meio do jogo`
  ]));
  if (a.classe.kda === 'fraco') out.push(pick(rng, [
    `o **KDA ${a.met.kda}** conta que você está morrendo demais — segurar essas mortes já empurraria a WR pra cima`,
    `**KDA ${a.met.kda}**: menos mortes arriscadas e o resultado muda sozinho`
  ]));
  if (a.classe.visMin === 'fraco') out.push(pick(rng, [
    `a **visão (${a.met.visMin}/min)** está baixa — mais sentinelas = menos emboscadas e mais objetivos`,
    `invista em **visão (hoje ${a.met.visMin}/min)**: enxergar o mapa evita mortes bobas`
  ]));
  if (a.classe.kp === 'fraco') out.push(pick(rng, [
    `sua **participação (${Math.round(a.met.kp * 100)}%)** está tímida — aparecer mais nas jogadas do time rende`,
    `**KP ${Math.round(a.met.kp * 100)}%**: rotacionar junto do time aumenta seu impacto`
  ]));
  return out;
}

function fraseEvolucao(rng, a) {
  const t = a.tend;
  const partes = [];
  if (t.wr && Math.abs(t.wr.delta) >= 3) {
    partes.push(t.wr.delta > 0
      ? pick(rng, [`sua **WR subiu de ${t.wr.antes}% para ${t.wr.agora}%**`, `a vitória **cresceu (${t.wr.antes}% → ${t.wr.agora}%)**`])
      : pick(rng, [`a **WR caiu de ${t.wr.antes}% para ${t.wr.agora}%**`, `a vitória **recuou (${t.wr.antes}% → ${t.wr.agora}%)**`]));
  }
  if (t.kda && Math.abs(t.kda.delta) >= 0.3) {
    partes.push(t.kda.delta > 0 ? `o **KDA melhorou (${t.kda.antes} → ${t.kda.agora})**` : `o **KDA piorou (${t.kda.antes} → ${t.kda.agora})**`);
  }
  if (t.ouro10 && Math.abs(t.ouro10.delta) >= 150) {
    partes.push(t.ouro10.delta > 0
      ? `e o **ouro aos 10min** está mais alto (+${t.ouro10.delta}), sinal de early melhor`
      : `e o **ouro aos 10min** caiu (${t.ouro10.delta}), o começo de jogo travou`);
  }
  if (!partes.length) return null;
  const abre = pick(rng, ['Comparando com o período anterior, ', 'Na evolução, ', 'Olhando a tendência, ']);
  return abre + partes.join('; ') + '.';
}

function fraseRecomendacao(rng, a) {
  const partes = [];
  const bom = a.bestChamps[0];
  if (bom && bom.n >= 3) {
    partes.push(pick(rng, [
      `no **${bom.nome} você segura ${bom.wr}%** em ${bom.n} jogos — é sua zona de conforto`,
      `seu melhor pick é **${bom.nome} (${bom.wr}% em ${bom.n})**`
    ]));
  }
  if (a.offRole) {
    partes.push(pick(rng, [
      `de **${ROLE_LABEL[a.offRole.rota] || a.offRole.rota} a coisa cai pra ${a.offRole.wr}%** (${a.offRole.n} jogos) — se a meta é subir, concentre as filas na sua rota principal`,
      `evite forçar **${ROLE_LABEL[a.offRole.rota] || a.offRole.rota}** (só ${a.offRole.wr}% em ${a.offRole.n}); seu rendimento é melhor no ${a.rotaLabel}`
    ]));
  }
  if (a.sugestaoMeta) {
    partes.push(pick(rng, [
      `no patch atual, **${a.sugestaoMeta.nome} (tier ${a.sugestaoMeta.tier})** está forte no ${a.rotaLabel} e combina com seu perfil — vale testar`,
      `de olho no meta: **${a.sugestaoMeta.nome}** (${a.sugestaoMeta.tier}) é uma boa aposta no ${a.rotaLabel} agora`
    ]));
  }
  if (!partes.length) return null;
  return partes.join('. ').replace(/\.\./g, '.') + '.';
}

export function gerarProsa(a, periodoJanela) {
  const rng = seedRng(a.puuid + '|' + new Date().toISOString().slice(0, 10) + '|' + periodoJanela);
  const paras = [];

  // 1) Abertura.
  paras.push(fraseAbertura(rng, a, periodoJanela) + ` WR de **${a.wr}%** no **${a.rotaLabel}**, com **${a.mainChamp || '—'}** como principal.`);

  // 2) Fortes.
  const fortes = frasesFortes(rng, a);
  if (fortes.length) {
    const abre = pick(rng, ['Do lado bom: ', 'Seus trunfos: ', 'O que está funcionando: ']);
    paras.push('✅ ' + abre + fortes.slice(0, 2).join(', e ') + '.');
  }

  // 3) A melhorar.
  const fracas = frasesFracas(rng, a);
  if (fracas.length) {
    const abre = pick(rng, ['Onde dá pra crescer: ', 'Pontos de atenção: ', 'Pra evoluir: ']);
    paras.push('⚠️ ' + abre + fracas.slice(0, 2).join(', e ') + '.');
  } else {
    paras.push('✅ Sem pontos fracos gritantes nas métricas da rota — bom equilíbrio.');
  }

  // 4) Evolução.
  const evo = fraseEvolucao(rng, a);
  if (evo) paras.push('📈 ' + evo);

  // 5) Recomendação.
  const rec = fraseRecomendacao(rng, a);
  if (rec) paras.push('🎯 ' + rec);

  return paras.join('\n\n');
}

// ---------------------------------------------------------------------------
// Embeds do Discord (1 por jogador; pagina em mensagens de até 10)
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

export function montarMensagens(analises, periodoKey, userMap) {
  const P = PERIODOS[periodoKey] || PERIODOS.dia;
  const embeds = analises.map(a => {
    const m = mencao(a, userMap);
    return {
      title: `${a.nome}`,
      description: (m ? m + '\n\n' : '') + gerarProsa(a, P.janela),
      color: corPorWr(a.wr),
      fields: [
        { name: 'Jogos', value: `${a.jogos}`, inline: true },
        { name: 'WR', value: `${a.wr}%`, inline: true },
        { name: 'KDA', value: `${a.met.kda}`, inline: true },
        { name: 'CS/min', value: `${a.met.csMin}`, inline: true },
        { name: 'Visão/min', value: `${a.met.visMin}`, inline: true },
        { name: 'KP', value: `${Math.round(a.met.kp * 100)}%`, inline: true }
      ]
    };
  });

  // Cabeçalho como 1º embed da 1ª mensagem.
  const header = {
    title: `${P.titulo} da Tribo`,
    description: `Período: **${P.janela}** • Ranked Solo/Flex • ${analises.length} jogador(es) ativo(s)`,
    color: 0x8b5cf6,
    footer: { text: `Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` },
    timestamp: new Date().toISOString()
  };

  const todos = [header, ...embeds];
  const mensagens = [];
  for (let i = 0; i < todos.length; i += 10) {
    mensagens.push({
      username: 'Cronista da Tribo',
      embeds: todos.slice(i, i + 10),
      allowed_mentions: { parse: ['users'] }
    });
  }
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
    await sleep(600); // respiro entre mensagens paginadas
  }
}

// ---------------------------------------------------------------------------
// ORQUESTRADOR — busca os dados (via queryRows injetada), analisa e monta as msgs.
//   opts: { queryRows, periodo, puuids?, metaCsv?, agora? }
//   retorna { mensagens, ativos, periodo, patchMeta }
// ---------------------------------------------------------------------------
export async function gerarRelatorio({ queryRows, periodo = 'dia', puuids = null, somentePremium = null, metaCsv = null, userMap = null, agora = Date.now() }) {
  const P = PERIODOS[periodo] || PERIODOS.dia;
  const ate = agora;
  const desde = agora - P.ms;
  const antesDesde = desde - P.ms;   // período anterior equivalente (p/ tendência)

  // Regra: quando NÃO há seleção explícita de puuids ("para todos"), o relatório
  // cobre SÓ jogadores premium (has_premium = 1) — igual aos jobs de sync/backfill.
  // Uma lista explícita de puuids é escape hatch e ignora o filtro premium.
  const soPrem = somentePremium == null ? !puuids : somentePremium;

  const meta = metaCsv ? parseMetaTiers(metaCsv).table : null;

  const qAgg = sqlAgregadoJogador(desde, ate, puuids, soPrem);
  const qRotas = sqlPorRota(desde, ate, puuids);
  const qChamps = sqlPorChampion(desde, ate, puuids);
  const qMarcos = sqlMarcos10(desde, ate, puuids);
  const qAggPrev = sqlAgregadoJogador(antesDesde, desde, puuids, soPrem);
  const qMarcosPrev = sqlMarcos10(antesDesde, desde, puuids);

  const [aggs, rotas, champs, marcos, aggsPrev, marcosPrev] = await Promise.all([
    queryRows(qAgg.sql, qAgg.params),
    queryRows(qRotas.sql, qRotas.params),
    queryRows(qChamps.sql, qChamps.params),
    queryRows(qMarcos.sql, qMarcos.params).catch(() => []),
    queryRows(qAggPrev.sql, qAggPrev.params).catch(() => []),
    queryRows(qMarcosPrev.sql, qMarcosPrev.params).catch(() => [])
  ]);

  const byPuuid = (arr) => arr.reduce((m, r) => ((m[r.puuid] ||= []).push(r), m), {});
  const rotasBy = byPuuid(rotas);
  const champsBy = byPuuid(champs);
  const marcosBy = Object.fromEntries(marcos.map(m => [m.puuid, m]));
  const prevBy = Object.fromEntries(aggsPrev.map(m => [m.puuid, m]));
  const prevMarcosBy = Object.fromEntries(marcosPrev.map(m => [m.puuid, m]));

  const analises = aggs
    .filter(a => Number(a.jogos) > 0)
    .map(a => analisarJogador(a, rotasBy[a.puuid] || [], champsBy[a.puuid] || [], marcosBy[a.puuid], prevBy[a.puuid], prevMarcosBy[a.puuid], meta))
    .sort((x, y) => y.jogos - x.jogos);

  if (!analises.length) {
    return {
      ativos: 0, periodo,
      mensagens: [{
        username: 'Cronista da Tribo',
        content: `${P.titulo}: ninguém da tribo jogou ranqueada nas ${P.janela}. 😴`
      }]
    };
  }

  return { ativos: analises.length, periodo, mensagens: montarMensagens(analises, periodo, userMap) };
}
