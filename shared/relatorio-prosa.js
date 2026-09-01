// ============================================================================
// PROSA DO RELATÓRIO DA TRIBO — NLG "IA sem IA" (banco de frases, JS puro).
//
// Camada de TEXTO: recebe o objeto de análise pronto (shared/relatorio-metricas.js)
// e devolve a narração em markdown. Não consulta banco, não conhece Discord e
// não importa nada de Node/Vite — por isso roda igual no coletor, no Worker e
// NO BROWSER, que é onde a tela de Relatórios Premium a executa (o servidor manda
// só os números; o texto é montado no front, num chunk carregado sob demanda).
//
// Determinismo: a semente é `puuid|data|período|fila`. O mesmo relatório aberto
// duas vezes hoje lê igual; amanhã, diferente.
//
// Regra do banco: cada gancho tem MUITAS variações e quase toda frase é montada
// por composição (abertura × miolo × fecho), pra dois jogadores com números
// parecidos nunca lerem o mesmo texto.
// ============================================================================

import {
  pick, seedRng, sementeTexto, pRota, ROLE_LABEL,
  fmtDataHora, fmtDuracao, fmtMilhar, capitalizarFrases, truncar
} from './relatorio-metricas.js';


function fraseAbertura(rng, a, periodoJanela) {
  if (a.jogos >= 40) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela} — isso já é profissão.`,
    `**${a.jogos} jogos** no período: a fila devia te cobrar aluguel.`,
    `Maratona pesada: **${a.jogos} partidas** nos ${periodoJanela}.`,
    `**${a.jogos} partidas** — volume de quem mora na Fenda.`,
    `Você abriu o cliente **${a.jogos} vezes** e não olhou pra trás.`,
    `Com **${a.jogos} jogos**, você foi um dos motores da tribo no período.`,
    `**${a.jogos} partidas** nos ${periodoJanela}: dedicação em nível industrial.`
  ]);
  if (a.jogos >= 20) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela} — presença de sobra.`,
    `**${a.jogos} jogos** no período: você não deu descanso pra fila.`,
    `Com **${a.jogos} partidas**, você foi um dos pilares de atividade da tribo.`,
    `**${a.jogos} partidas** no retrovisor — maratonista de ranqueada, hein?`,
    `Grind de respeito: **${a.jogos} jogos** nos ${periodoJanela}.`,
    `A fila viu você **${a.jogos} vezes** no período — dedicação de sobra.`,
    `**${a.jogos} jogos** disputados: constância que dá pra pôr no currículo.`,
    `Nos ${periodoJanela} deu **${a.jogos} partidas** — ritmo de quem está atrás de elo.`
  ]);
  if (a.jogos >= 10) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela}.`,
    `**${a.jogos} jogos** no período — um ritmo saudável.`,
    `Você somou **${a.jogos} partidas** nos ${periodoJanela}, presença constante.`,
    `**${a.jogos} jogos** na conta: nem de menos, nem exagero.`,
    `**${a.jogos} partidas** — amostra já bem confiável pra tirar conclusão.`,
    `Deu pra jogar: **${a.jogos} partidas** nos ${periodoJanela}.`
  ]);
  if (a.jogos >= 5) return pick(rng, [
    `Foram **${a.jogos} partidas** ranqueadas nos ${periodoJanela}.`,
    `**${a.jogos} jogos** no período — participação modesta, mas participação.`,
    `**${a.jogos} partidas** apenas; dá pra ver a direção, não a estrada toda.`,
    `Você marcou presença em **${a.jogos} jogos** nos ${periodoJanela}.`,
    `**${a.jogos} partidas** na conta — amostra curta, leitura com cautela.`
  ]);
  return pick(rng, [
    `Poucas partidas dessa vez (**${a.jogos}**), então leve os números com um grão de sal.`,
    `Só **${a.jogos} jogo(s)** — amostra pequena, mas dá pra sentir a direção.`,
    `Aparição relâmpago: **${a.jogos} jogo(s)** no período.`,
    `Com apenas **${a.jogos} partida(s)**, é mais um retrato do que um filme.`,
    `**${a.jogos} jogo(s)** — passou pra dar oi na fila e sumiu.`,
    `Amostra mínima (**${a.jogos}**): trate os números como rascunho.`
  ]);
}

function fraseWr(rng, a) {
  const main = a.mainChamp || '—';
  const placar = `${a.vitorias}V-${a.derrotas}D`;
  const em = `${pRota(a.rotaPrinc, 'em')} **${a.rotaLabel}**`;   // "no Topo" / "na Selva"
  const art = `${pRota(a.rotaPrinc, 'artigo')} **${a.rotaLabel}**`;
  if (a.wr >= 60) return pick(rng, [
    `WR de **${a.wr}%** (${placar}) ${em}, com **${main}** na frente — isso é fase de subida.`,
    `Fechou **${a.wr}% de vitórias** (${placar}) puxando ${art} com **${main}**. Números de quem carrega.`,
    `**${a.wr}%** de aproveitamento (${placar}), a maior parte ${em} com **${main}** — dominante.`,
    `Placar de **${placar}** — **${a.wr}% de WR** ${em}, **${main}** liderando a escalação.`
  ]);
  if (a.wr >= 52) return pick(rng, [
    `WR de **${a.wr}%** (${placar}) ${em}, com **${main}** como principal.`,
    `Fechou **${a.wr}% de vitórias** (${placar}) puxando ${art} (**${main}** na linha de frente).`,
    `**${a.wr}%** de aproveitamento (${placar}), a maior parte ${em} com **${main}**.`,
    `Saldo positivo: **${placar}** (**${a.wr}%**), quase tudo ${em} com **${main}**.`,
    `**${a.wr}% de WR** (${placar}) — ${art} é sua casa e **${main}**, sua chave.`
  ]);
  if (a.wr >= 45) return pick(rng, [
    `WR de **${a.wr}%** (${placar}) ${em}, com **${main}** como principal — em cima do muro.`,
    `**${placar}** dá **${a.wr}%**: equilíbrio puro ${em}, com **${main}** no comando.`,
    `**${a.wr}%** de aproveitamento (${placar}) ${em} — nem subiu, nem caiu.`,
    `Fechou em **${a.wr}%** (${placar}) puxando ${art} com **${main}**; a balança está no fio.`
  ]);
  return pick(rng, [
    `WR de **${a.wr}%** (${placar}) ${em}, com **${main}** como principal — período teimoso.`,
    `**${placar}** fecha em **${a.wr}%**: a fila cobrou caro ${em}.`,
    `**${a.wr}%** de aproveitamento (${placar}) — **${main}** e ${art} não seguraram a onda.`,
    `Saldo negativo: **${placar}** (**${a.wr}%**) puxando ${art}.`
  ]);
}

// Tempero por fila: Solo/Duo e Flex têm naturezas diferentes — reforça a
// personalização (o mesmo jogador ouve algo distinto em cada relatório).
function fraseFilaFlavor(rng, a, filaInfo) {
  if (!filaInfo) return '';
  if (filaInfo.chave === 'flex') return ' ' + pick(rng, [
    'No Flex o que decide é o entrosamento — jogar afinado com a tribo pesa mais que o elo individual.',
    'Flex é território de premade: composição e comunicação ditam o ritmo do jogo.',
    'No Flex dá pra ousar em comps coordenadas que a Solo jamais perdoaria.',
    'Aqui é jogo de equipe de verdade — o Flex premia quem soma com o time.',
    'Flex tem elo próprio e vida própria: o que funciona aqui nem sempre traduz pra Solo.',
    'No Flex o inimigo costuma vir em bando — quem tem call organizada leva.',
    'Fila Flex: menos ego, mais objetivo. Quem joga junto sobe junto.'
  ]);
  return ' ' + pick(rng, [
    'Na Solo/Duo é você contra o mundo — cada erro é seu, cada carry também.',
    'Solo/Duo não perdoa: aqui o elo mede o quanto você segura o time sozinho.',
    'Na fila solo o mérito é individual — subir aqui é o teste mais puro de skill.',
    'Solo/Duo é a prova de fogo: sem premade pra cobrir, o que sobra é você.',
    'Na Solo/Duo o PDL é honesto: ele mede exatamente o que você entrega sozinho.',
    'Solo/Duo é onde o elo dói e onde ele vale — sem atalho, sem álibi.',
    'Aqui não tem call de Discord pra salvar: Solo/Duo é leitura de jogo e sangue frio.'
  ]);
}

// Quando/como foi o ritmo: primeira e última partida, dias ativos, tempo em jogo.
function fraseQuando(rng, a) {
  const j = a.janela;
  if (!j || j.primeira == null || j.ultima == null) return null;
  const partes = [];
  partes.push(pick(rng, [
    `A jornada começou em **${fmtDataHora(j.primeira)}** e a última partida foi em **${fmtDataHora(j.ultima)}**`,
    `Primeiro jogo em **${fmtDataHora(j.primeira)}**, último em **${fmtDataHora(j.ultima)}**`,
    `Da abertura em **${fmtDataHora(j.primeira)}** até o encerramento em **${fmtDataHora(j.ultima)}**`,
    `A janela vai de **${fmtDataHora(j.primeira)}** a **${fmtDataHora(j.ultima)}**`,
    `Sua temporada nesse recorte abriu em **${fmtDataHora(j.primeira)}** e fechou em **${fmtDataHora(j.ultima)}**`
  ]));
  if (j.diasAtivos > 0) {
    partes.push(pick(rng, [
      `foram **${j.diasAtivos} dia(s) com ranqueada**${j.jogosPorDia ? ` (média de **${j.jogosPorDia} jogo(s)/dia**)` : ''}`,
      `você sentou pra jogar em **${j.diasAtivos} dia(s) diferentes**${j.jogosPorDia ? `, uns **${j.jogosPorDia}** por dia` : ''}`,
      `deu **${j.diasAtivos} dia(s) ativo(s)**${j.jogosPorDia ? ` a **${j.jogosPorDia} partida(s)** cada` : ''}`
    ]));
  }
  if (j.tempoTotal > 0) {
    partes.push(pick(rng, [
      `e **${fmtDuracao(j.tempoTotal)}** dentro da Fenda, com partidas de **${fmtDuracao(j.durMedia)}** em média`,
      `somando **${fmtDuracao(j.tempoTotal)}** de jogo (média de **${fmtDuracao(j.durMedia)}** por partida)`,
      `totalizando **${fmtDuracao(j.tempoTotal)}** em campo — cada jogo durando cerca de **${fmtDuracao(j.durMedia)}**`
    ]));
  }
  let txt = partes.join('; ') + '.';
  const h = a.horarios;
  if (h && h.dia && h.faixa && h.total >= 5) {
    txt += ' ' + pick(rng, [
      `Seu horário nobre é **${h.dia.label} ${h.faixa.label}** — é quando a maior parte das filas acontece.`,
      `O padrão aponta pra **${h.dia.label} ${h.faixa.label}**: é aí que você mais joga (**${h.dia.n}** partidas ${h.dia.comArtigo}).`,
      `Estatisticamente, seu dia de ranqueada é **${h.dia.label}**, geralmente **${h.faixa.label}** (${h.faixa.wr}% de WR nessa faixa).`,
      `Você concentra as filas **${h.faixa.label}**, com pico na **${h.dia.label}**.`
    ]);
  }
  return txt;
}

function frasesFortes(rng, a) {
  const out = [];
  if (a.classe.kp === 'forte') out.push(pick(rng, [
    `sua **participação em abates (${Math.round(a.met.kp * 100)}%)** é de quem aparece nas brigas`,
    `você vive as jogadas do time — **${Math.round(a.met.kp * 100)}% de KP**`,
    `**${Math.round(a.met.kp * 100)}% de KP**: onde a luta acontece, você está lá`,
    `com **${Math.round(a.met.kp * 100)}% de participação**, dificilmente o time briga sem você`,
    `**KP de ${Math.round(a.met.kp * 100)}%** — presença de mapa acima da média da rota`
  ]));
  if (a.classe.csMin === 'forte') out.push(pick(rng, [
    `o **farm está afiado (${a.met.csMin} CS/min)**, acima do padrão da rota`,
    `você não perde onda: **${a.met.csMin} CS/min**`,
    `**${a.met.csMin} CS/min** — a última hitbox é sempre sua`,
    `sua economia é sólida: **${a.met.csMin} CS/min** e **${a.met.gpm} de ouro/min**`,
    `**${a.met.csMin} CS/min** mostra disciplina de lane — item na hora certa`
  ]));
  if (a.classe.visMin === 'forte') out.push(pick(rng, [
    `a **visão de mapa (${a.met.visMin}/min)** está exemplar`,
    `você ilumina o mapa como poucos (**${a.met.visMin} de visão/min**)`,
    `**${a.met.visMin} de visão/min**: o mapa não tem segredo pro seu time`,
    `**visão de ${a.met.visMin}/min** — você joga com o minimapa ligado, e isso aparece`,
    `sentinela é investimento e você entendeu: **${a.met.visMin} de visão/min**`
  ]));
  if (a.classe.kda === 'forte') out.push(pick(rng, [
    `o **KDA ${a.met.kda}** mostra que você troca bem e morre pouco`,
    `**KDA ${a.met.kda}** — consistência de quem sobrevive pra carregar`,
    `**KDA ${a.met.kda}**: você escolhe as brigas e sai vivo delas`,
    `média de **${a.med.k}/${a.med.d}/${a.med.a}** por jogo (**KDA ${a.met.kda}**) é placar de quem decide`,
    `**KDA ${a.met.kda}** com só **${a.med.d} mortes** por partida — cirúrgico`
  ]));
  if (a.met.dmg >= 20000) out.push(pick(rng, [
    `você despeja **${fmtMilhar(a.met.dmg)} de dano** em campeões por jogo`,
    `**${fmtMilhar(a.met.dmg)} de dano médio** — a barra de vida inimiga sente`
  ]));
  return out;
}

function frasesFracas(rng, a) {
  const out = [];
  if (a.classe.csMin === 'fraco') out.push(pick(rng, [
    `o **farm (${a.met.csMin} CS/min)** está abaixo do que a rota pede — é ouro que vira item, e item que vira vitória`,
    `dá pra apertar o **CS/min (hoje ${a.met.csMin})**: cada onda perdida é um item a menos no meio do jogo`,
    `**${a.met.csMin} CS/min** deixa ouro na mesa — 10 minions a mais por jogo já é outra história`,
    `**${a.met.csMin} CS/min**: antes de rotacionar, limpe a onda; ouro parado não ganha jogo`,
    `o **farm (${a.met.csMin}/min)** cobra caro no fim — o item de power spike chega tarde`
  ]));
  if (a.classe.kda === 'fraco') out.push(pick(rng, [
    `o **KDA ${a.met.kda}** conta que você está morrendo demais — segurar essas mortes já empurraria a WR pra cima`,
    `**KDA ${a.met.kda}**: menos mortes arriscadas e o resultado muda sozinho`,
    `**KDA ${a.met.kda}** — cada morte evitada é um objetivo a mais pro time; respeite o mapa`,
    `são **${a.med.d} mortes por partida** (**KDA ${a.met.kda}**) — muita entrega grátis de ouro`,
    `**KDA ${a.met.kda}** é sinal de briga comprada: escolha melhor quando entrar`
  ]));
  if (a.classe.visMin === 'fraco') out.push(pick(rng, [
    `a **visão (${a.met.visMin}/min)** está baixa — mais sentinelas = menos emboscadas e mais objetivos`,
    `invista em **visão (hoje ${a.met.visMin}/min)**: enxergar o mapa evita mortes bobas`,
    `**${a.met.visMin} de visão/min** é pouco — a wardzinha barata salva mais jogo que parece`,
    `**visão de ${a.met.visMin}/min**: comprar sentinela de controle antes do objetivo muda a briga`,
    `com **${a.met.visMin} de visão/min** você joga no escuro — e no escuro o gank sempre chega`
  ]));
  if (a.classe.kp === 'fraco') out.push(pick(rng, [
    `sua **participação (${Math.round(a.met.kp * 100)}%)** está tímida — aparecer mais nas jogadas do time rende`,
    `**KP ${Math.round(a.met.kp * 100)}%**: rotacionar junto do time aumenta seu impacto`,
    `**KP ${Math.round(a.met.kp * 100)}%** — o time briga e você está longe; chegar junto muda o placar`,
    `**${Math.round(a.met.kp * 100)}% de KP** é pouco ${pRota(a.rotaPrinc, 'para')} ${a.rotaLabel}: o jogo acontece onde você não está`,
    `subir a **participação (hoje ${Math.round(a.met.kp * 100)}%)** costuma ser o ajuste mais barato pra WR`
  ]));
  return out;
}

// Sequências (streaks) — dá o "clima" do período e o momento atual.
function fraseSequencias(rng, a) {
  const s = a.seq;
  if (!s || a.jogos < 3) return null;
  const partes = [];
  if (s.maiorV >= 3) partes.push(pick(rng, [
    `o auge foi uma sequência de **${s.maiorV} vitórias seguidas**`,
    `você emendou **${s.maiorV} vitórias em sequência** no melhor momento`,
    `teve uma arrancada de **${s.maiorV} jogos ganhos em fila**`
  ]));
  if (s.maiorD >= 3) partes.push(pick(rng, [
    `e o fundo do poço foi um tilt de **${s.maiorD} derrotas seguidas**`,
    `mas também tomou **${s.maiorD} derrotas em sequência** — hora de ter parado`,
    `e a pior maré foi de **${s.maiorD} jogos perdidos em fila**`
  ]));
  if (s.atual && s.atual.tam >= 2) partes.push(s.atual.vitoria
    ? pick(rng, [
      `no fim da amostra você estava **${s.atual.tam} vitórias em fila** — quente`,
      `e fechou o período embalado, com **${s.atual.tam} vitórias seguidas**`,
      `a última coisa que a fila viu foi você ganhando **${s.atual.tam} vezes seguidas**`
    ])
    : pick(rng, [
      `e o período terminou com **${s.atual.tam} derrotas em fila** — dá um respiro antes da próxima`,
      `a amostra fecha com **${s.atual.tam} derrotas seguidas**; sair do tilt vale mais que a próxima fila`,
      `e a última sequência foi de **${s.atual.tam} derrotas** — reset mental antes de voltar`
    ]));
  if (!partes.length) {
    if (s.maiorV >= 2 || s.maiorD >= 2) return pick(rng, [
      'O período foi de altos e baixos alternados — sem sequência longa pra nenhum dos lados.',
      'Nada de maratona de vitórias nem de tilt gigante: o resultado foi picotado jogo a jogo.',
      'Vitória e derrota se revezaram o tempo todo, sem embalo nem espiral.'
    ]);
    return null;
  }
  const abre = pick(rng, ['Na montanha-russa, ', 'Falando de embalo, ', 'No ritmo do período, ', 'Sobre as sequências: ', 'Na linha do tempo, ']);
  return abre + partes.join('; ') + '.';
}

// Comentário sobre o pool de campeões (usa o top 5 do período).
function fraseCampeoes(rng, a) {
  const top = a.topPlayed || [];
  if (!top.length) return null;
  const partes = [];
  const lista = top.slice(0, 3).map(c => `**${c.nome}** (${c.n}j, ${c.wr}%)`).join(', ');
  partes.push(pick(rng, [
    `Seu trio mais rodado foi ${lista}`,
    `A escalação preferida: ${lista}`,
    `Quem mais apareceu na sua tela: ${lista}`,
    `O pódio de picks ficou com ${lista}`,
    `No banco de campeões, os titulares foram ${lista}`
  ]));
  if (a.melhorTop && a.piorTop && a.melhorTop.nome !== a.piorTop.nome && a.melhorTop.wr - a.piorTop.wr >= 15) {
    partes.push(pick(rng, [
      `dentro do top 5, **${a.melhorTop.nome}** puxa pra cima (**${a.melhorTop.wr}%** em ${a.melhorTop.n}) enquanto **${a.piorTop.nome}** puxa pra baixo (**${a.piorTop.wr}%** em ${a.piorTop.n})`,
      `**${a.melhorTop.nome}** é o que mais rende (**${a.melhorTop.wr}%**) e **${a.piorTop.nome}** o que mais dói (**${a.piorTop.wr}%**)`,
      `a diferença é gritante: **${a.melhorTop.nome}** entrega **${a.melhorTop.wr}%** e **${a.piorTop.nome}**, só **${a.piorTop.wr}%**`
    ]));
  }
  if (a.pool >= 12) partes.push(pick(rng, [
    `no total foram **${a.pool} campeões diferentes** — pool largo demais costuma diluir a maestria`,
    `você rodou **${a.pool} campeões distintos**; afunilar em 3 ou 4 acelera a subida`,
    `com **${a.pool} picks diferentes**, sobra versatilidade e falta repetição`
  ]));
  else if (a.pool <= 3 && a.jogos >= 10) partes.push(pick(rng, [
    `e o pool é enxuto (**${a.pool} campeões**) — ótimo pra maestria, arriscado contra ban`,
    `são só **${a.pool} campeões** no período: especialista assumido (cuidado com o counter-pick)`,
    `**${a.pool} campeões** apenas — foco total, mas um ban certeiro te desmonta`
  ]));
  else if (a.concentracao >= 45 && top[0]) partes.push(pick(rng, [
    `**${top[0].nome}** sozinho é **${a.concentracao}%** das suas filas`,
    `quase metade do período (**${a.concentracao}%**) foi só de **${top[0].nome}**`
  ]));
  return partes.join('; ') + '.';
}

function fraseEvolucao(rng, a) {
  const t = a.tend;
  const partes = [];
  if (t.wr && Math.abs(t.wr.delta) >= 3) {
    partes.push(t.wr.delta > 0
      ? pick(rng, [
        `sua **WR subiu de ${t.wr.antes}% para ${t.wr.agora}%**`,
        `a vitória **cresceu (${t.wr.antes}% → ${t.wr.agora}%)**`,
        `você **destravou a WR (${t.wr.antes}% → ${t.wr.agora}%)**`,
        `a taxa de vitória **ganhou ${Math.abs(t.wr.delta)} pontos (${t.wr.antes}% → ${t.wr.agora}%)**`
      ])
      : pick(rng, [
        `a **WR caiu de ${t.wr.antes}% para ${t.wr.agora}%**`,
        `a vitória **recuou (${t.wr.antes}% → ${t.wr.agora}%)**`,
        `a **WR esfriou (${t.wr.antes}% → ${t.wr.agora}%)**`,
        `a taxa **perdeu ${Math.abs(t.wr.delta)} pontos (${t.wr.antes}% → ${t.wr.agora}%)**`
      ]));
  }
  if (t.kda && Math.abs(t.kda.delta) >= 0.3) {
    partes.push(t.kda.delta > 0
      ? pick(rng, [
        `o **KDA melhorou (${t.kda.antes} → ${t.kda.agora})**`,
        `você está morrendo menos — **KDA ${t.kda.antes} → ${t.kda.agora}**`,
        `o **KDA reagiu (${t.kda.antes} → ${t.kda.agora})**`
      ])
      : pick(rng, [
        `o **KDA piorou (${t.kda.antes} → ${t.kda.agora})**`,
        `o **KDA recuou (${t.kda.antes} → ${t.kda.agora})**`,
        `você está morrendo mais — **KDA ${t.kda.antes} → ${t.kda.agora}**`
      ]));
  }
  if (t.csMin && Math.abs(t.csMin.delta) >= 0.5) {
    partes.push(t.csMin.delta > 0
      ? `o **farm subiu (${t.csMin.antes} → ${t.csMin.agora} CS/min)**`
      : `o **farm caiu (${t.csMin.antes} → ${t.csMin.agora} CS/min)**`);
  }
  if (t.jogos && Math.abs(t.jogos.delta) >= 5) {
    partes.push(t.jogos.delta > 0
      ? `e o volume aumentou (**${t.jogos.antes} → ${t.jogos.agora} jogos**)`
      : `e o volume caiu (**${t.jogos.antes} → ${t.jogos.agora} jogos**)`);
  }
  if (t.ouro10 && Math.abs(t.ouro10.delta) >= 150) {
    partes.push(t.ouro10.delta > 0
      ? `e o **ouro aos 10min** está mais alto (+${t.ouro10.delta}), sinal de early melhor`
      : `e o **ouro aos 10min** caiu (${t.ouro10.delta}), o começo de jogo travou`);
  }
  if (!partes.length) return null;
  const abre = pick(rng, [
    'Comparando com o período anterior, ', 'Na evolução, ', 'Olhando a tendência, ',
    'De lá pra cá, ', 'Na comparação com antes, ', 'Contra o recorte passado, ',
    'Na régua do período anterior, '
  ]);
  return abre + partes.join('; ') + '.';
}

function fraseRecomendacao(rng, a) {
  const partes = [];
  const bom = a.bestChamps[0];
  // Sem artigo antes de nome de campeão: "insista em Seraphine", não "no Seraphine".
  if (bom && bom.n >= 3) {
    partes.push(pick(rng, [
      `com **${bom.nome}** você segura **${bom.wr}%** em ${bom.n} jogos — é sua zona de conforto`,
      `seu melhor pick é **${bom.nome} (${bom.wr}% em ${bom.n})**`,
      `quando bate o desespero, **${bom.nome}** (${bom.wr}% em ${bom.n}) é o pick que raramente falha`,
      `insista em **${bom.nome}**: ${bom.wr}% de vitória em ${bom.n} jogos não é sorte`,
      `**${bom.nome}** é seu cavalo de batalha (${bom.wr}% em ${bom.n}) — banido ele, tenha o plano B pronto`
    ]));
  }
  if (a.piorTop && a.piorTop.n >= 4 && a.piorTop.wr <= 40 && a.piorTop.nome !== bom?.nome) {
    partes.push(pick(rng, [
      `já **${a.piorTop.nome}** cobra caro (${a.piorTop.wr}% em ${a.piorTop.n}) — ou treina no normal, ou tira da rotação`,
      `pense duas vezes antes de pegar **${a.piorTop.nome}** (${a.piorTop.wr}% em ${a.piorTop.n} jogos)`,
      `**${a.piorTop.nome}** está drenando PDL (${a.piorTop.wr}% em ${a.piorTop.n}); vale revisar build/matchup`
    ]));
  }
  if (a.offRole) {
    const off = ROLE_LABEL[a.offRole.rota] || a.offRole.rota;
    const offArt = pRota(a.offRole.rota, 'artigo');
    const offEm = pRota(a.offRole.rota, 'em');
    const minha = `${pRota(a.rotaPrinc, 'em')} **${a.rotaLabel}**`;
    partes.push(pick(rng, [
      `${offEm} **${off}** a coisa cai pra **${a.offRole.wr}%** (${a.offRole.n} jogos) — se a meta é subir, concentre as filas na sua rota principal`,
      `evite forçar **${off}** (só ${a.offRole.wr}% em ${a.offRole.n}); seu rendimento é melhor ${minha}`,
      `${offArt} **${off}** te puxa pra baixo (${a.offRole.wr}% em ${a.offRole.n}) — deixa essa rota pro modo normal`,
      `autofill de **${off}** custa caro pra você: ${a.offRole.wr}% contra ${a.wr}% no geral`
    ]));
  }
  if (a.sugestaoMeta) {
    const minha = `${pRota(a.rotaPrinc, 'em')} **${a.rotaLabel}**`;
    partes.push(pick(rng, [
      `no patch atual, **${a.sugestaoMeta.nome} (tier ${a.sugestaoMeta.tier})** está forte ${minha} e combina com seu perfil — vale testar`,
      `de olho no meta: **${a.sugestaoMeta.nome}** (${a.sugestaoMeta.tier}) é uma boa aposta ${minha} agora`,
      `se quiser um pick novo, **${a.sugestaoMeta.nome}** (${a.sugestaoMeta.tier}) está brilhando ${minha} neste patch`,
      `o meta pede **${a.sugestaoMeta.nome}** (tier ${a.sugestaoMeta.tier}) ${minha} — experimenta em normal antes de levar pra ranqueada`
    ]));
  }
  if (!partes.length) return null;
  // As variações nascem em minúscula (encaixam em qualquer posição) — a junção
  // vira frases de verdade aqui.
  return capitalizarFrases(partes.join('. ').replace(/\.\./g, '.') + '.');
}

// Assinatura motivacional de fechamento (varia por semente; dá personalidade).
function fraseFechamento(rng, a) {
  if (a.wr >= 60) return pick(rng, [
    'Nesse ritmo o problema não é subir, é achar quem te acompanhe. 👑',
    'Fase de smurf: aproveita a janela e sobe enquanto está quente. 🔥',
    'Elo é consequência quando o desempenho está assim. 🚀'
  ]);
  if (a.wr >= 55) return pick(rng, [
    'Segue nesse embalo que o próximo elo é questão de tempo. 🔥',
    'Tá voando — mantém a cabeça fria e continua subindo. 🚀',
    'Fase quente dessas é pra aproveitar: bora de PDL. 📈',
    'Consistência assim vira divisão nova em poucas semanas. 🧭'
  ]);
  if (a.wr >= 48) return pick(rng, [
    'Equilíbrio é base — um ajuste fino e a balança vira pro seu lado. ⚖️',
    'Você está no fio: pequenos detalhes decidem a próxima subida. 🎯',
    'Constância aqui, e o próximo degrau vem naturalmente. 🧗',
    'Falta pouco: escolha um ponto fraco e ataque só ele nas próximas filas. 🛠️'
  ]);
  if (a.wr >= 40) return pick(rng, [
    'Período difícil acontece — foco no que dá pra controlar e a maré volta. 💪',
    'Cabeça erguida: todo mundo tem sequência ruim, o importante é ajustar. 🛠️',
    'Respira, revisa um ponto de cada vez e volta com tudo na próxima. 🌊'
  ]);
  return pick(rng, [
    'Maré brava. Menos filas seguidas, mais revisão de replay — a virada vem. 🧊',
    'Hora de recalibrar: reduz o volume, escolhe 2 campeões e recomeça. 🧱',
    'Foi ruim, e tudo bem. O próximo período começa do zero. 🌅'
  ]);
}

// Prosa de UMA fila do jogador (Solo/Duo e Flex têm cada uma a sua).
export function gerarProsa(a, periodoJanela, filaInfo = null) {
  const filaChave = filaInfo?.chave || a.fila || 'geral';
  const rng = seedRng(sementeTexto(a.puuid, periodoJanela, filaChave));
  const paras = [];

  // 1) Abertura: atividade + WR/rota/main + tempero da fila.
  paras.push(fraseAbertura(rng, a, periodoJanela) + ' ' + fraseWr(rng, a) + fraseFilaFlavor(rng, a, filaInfo));

  // 2) Quando os jogos aconteceram (janela real + ritmo + horário nobre).
  const quando = fraseQuando(rng, a);
  if (quando) paras.push('🕒 ' + quando);

  // 3) Fortes.
  const fortes = frasesFortes(rng, a);
  if (fortes.length) {
    const abre = pick(rng, ['Do lado bom: ', 'Seus trunfos: ', 'O que está funcionando: ', 'No que você brilha: ', 'Crédito onde é devido: ', 'Pontos altos: ']);
    paras.push('✅ ' + abre + fortes.slice(0, 2).join(', e ') + '.');
  }

  // 4) A melhorar.
  const fracas = frasesFracas(rng, a);
  if (fracas.length) {
    const abre = pick(rng, ['Onde dá pra crescer: ', 'Pontos de atenção: ', 'Pra evoluir: ', 'A lição de casa: ', 'O que está custando jogo: ', 'Na régua da rota: ']);
    paras.push('⚠️ ' + abre + fracas.slice(0, 2).join(', e ') + '.');
  } else {
    paras.push('✅ ' + pick(rng, [
      'Sem pontos fracos gritantes nas métricas da rota — bom equilíbrio.',
      'Nenhuma métrica destoando pra baixo: base sólida e consistente.',
      'Fundamentos redondos — nada gritando por conserto por aqui.',
      'Todas as métricas dentro (ou acima) do esperado pra rota. Difícil reclamar.'
    ]));
  }

  // 5) Sequências de vitória/derrota.
  const seq = fraseSequencias(rng, a);
  if (seq) paras.push('🎲 ' + seq);

  // 6) Campeões do período (o top 5 detalhado vai nos campos do embed).
  const champ = fraseCampeoes(rng, a);
  if (champ) paras.push('🐉 ' + champ);

  // 7) Evolução vs. período anterior (só no modo 'janela').
  const evo = fraseEvolucao(rng, a);
  if (evo) paras.push('📈 ' + evo);

  // 8) Recomendação.
  const rec = fraseRecomendacao(rng, a);
  if (rec) paras.push('🎯 ' + rec);

  // 9) Fechamento motivacional.
  paras.push('— ' + fraseFechamento(rng, a));

  return truncar(paras.join('\n\n'), 4000);
}
