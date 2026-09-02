// ============================================================================
// NAVEGAÇÃO — a fonte ÚNICA da árvore de telas do sistema.
//
// Antes esta mesma árvore existia copiada em QUATRO lugares: os portais da Home,
// as abas da topbar, as seções da sidebar e os cards do ModuleHub. Mover uma tela
// de lugar exigia lembrar dos quatro, e bastava esquecer um para o sistema passar
// a dizer duas coisas diferentes sobre onde a tela mora. Agora todos leem daqui.
//
// A árvore tem dois níveis:
//   PILAR  = um dos 4 espíritos do Udyr (o card da Home, a seção da sidebar, o
//            botão do 1º nível da topbar). Tem um `hub`: a tela que lista as
//            opções dele.
//   PÁGINA = uma tela de verdade, com rota. É o sub-link da Home, o item da
//            sidebar, o botão do 2º nível da topbar e o card do hub.
//
// Cada nó carrega as classes de cor das quatro superfícies. É verboso, mas é a
// verbosidade que sobrou depois de matar as quatro cópias — e é o que garante que
// a Caverna dos Monos seja âmbar na Home, na sidebar, na topbar e no hub.
//
// `match` = prefixos de rota que ACENDEM o nó (cobre sub-rotas e apelidos: o
// /historico e o /profile são a mesma Caçada; a ficha em tela cheia é Panteão).
// ============================================================================

export const PILARES = [
  {
    id: 'jogador',
    n: 1,
    label: 'Jogador',
    topo: 'JOGADOR',
    espirito: 'Espírito do Tigre',
    icon: 'fa-user-astronaut',
    arte: '/Udyr_notudyr_tiger.webp',
    hub: '/jogadores',
    desc: 'Perfil, histórico de caçadas, o olhar espiritual e a caverna dos monos.',
    subtitulo: 'Tudo sobre o invocador: histórico, estatísticas e maestrias.',
    // topbar
    text: 'text-cyan-400', border: 'border-cyan-500', accent: 'text-cyan-300',
    // sidebar
    labelClass: 'text-cyan-300', sidebarIcon: 'fa-crown',
    // Home (card grande) + cabeçalho do hub
    cardCls: 'border-cyan-500/40 bg-gradient-to-br from-blue-900/80 via-cyan-800/40 to-slate-950 hover:shadow-[0_0_40px_rgba(6,182,212,0.35)]',
    glowCls: 'bg-cyan-400/20', spiritCls: 'text-cyan-400', titleCls: 'text-cyan-100',
    chipCls: 'border-cyan-800/50 hover:border-cyan-500',
    gradiente: 'from-cyan-300 via-sky-300 to-blue-400',
    paginas: [
      {
        id: 'historico', path: '/historico', match: ['/historico', '/profile'],
        label: 'Caçadas Passadas', topo: 'CAÇADA', icon: 'fa-paw', preview: 'historico',
        desc: 'Histórico de partidas: KDA, itens, runas e confrontos por rota.',
        text: 'text-cyan-400', border: 'border-cyan-500', accent: 'text-cyan-300',
        active: 'border-cyan-500 bg-cyan-500/10 text-cyan-300',
        cardCls: 'border-cyan-500/40 bg-gradient-to-br from-blue-900/70 via-cyan-800/30 to-slate-950 hover:shadow-[0_0_40px_rgba(6,182,212,0.3)]',
        glowCls: 'bg-cyan-400/20', iconBorder: 'border-cyan-600/60', iconColor: 'text-cyan-300', titleCls: 'text-cyan-100'
      },
      {
        id: 'analise', path: '/analise', match: ['/analise'],
        label: 'Olhar Espiritual', topo: 'VISÃO', icon: 'fa-chart-simple', preview: 'analise',
        desc: 'Estatísticas e radar de desempenho sobre todo o histórico.',
        text: 'text-violet-400', border: 'border-violet-500', accent: 'text-violet-300',
        active: 'border-violet-500 bg-violet-500/10 text-violet-300',
        cardCls: 'border-violet-500/40 bg-gradient-to-br from-fuchsia-950/70 via-violet-800/30 to-slate-950 hover:shadow-[0_0_40px_rgba(139,92,246,0.3)]',
        glowCls: 'bg-violet-400/20', iconBorder: 'border-violet-600/60', iconColor: 'text-violet-300', titleCls: 'text-violet-100'
      },
      {
        id: 'mastery', path: '/mastery', match: ['/mastery'],
        label: 'Caverna dos Monos', topo: 'CAVERNA', icon: 'fa-trophy', preview: 'mastery',
        desc: 'Ranking de maestrias: nível, pontos e os campeões mais dominados.',
        text: 'text-amber-400', border: 'border-amber-500', accent: 'text-amber-300',
        active: 'border-amber-500 bg-amber-500/10 text-amber-300',
        cardCls: 'border-amber-700/50 bg-gradient-to-br from-red-950/80 via-orange-900/30 to-slate-950 hover:shadow-[0_0_40px_rgba(251,146,60,0.28)]',
        glowCls: 'bg-orange-500/25', iconBorder: 'border-amber-600/60', iconColor: 'text-amber-300', titleCls: 'text-amber-100'
      }
    ]
  },
  {
    // O espírito do Urso agora guarda o META. O pilar tem UMA página só, então o
    // `hub` dele é a própria tela — um hub com um card só seria uma sala de espera.
    id: 'meta',
    n: 2,
    label: 'Meta',
    topo: 'META',
    espirito: 'Espírito do Urso',
    icon: 'fa-ranking-star',
    arte: '/Udyr_notudyr_bear.webp',
    hub: '/meta',
    desc: 'A tier list do patch: quem sobe, quem cai e o que ganha jogo agora.',
    subtitulo: 'A classificação S/A/B/C/D por rota no patch atual.',
    text: 'text-amber-400', border: 'border-amber-500', accent: 'text-amber-300',
    labelClass: 'text-amber-300', sidebarIcon: 'fa-ranking-star',
    cardCls: 'border-amber-700/50 bg-gradient-to-br from-red-950/90 via-orange-900/40 to-slate-950 hover:shadow-[0_0_40px_rgba(251,146,60,0.3)]',
    glowCls: 'bg-orange-500/25', spiritCls: 'text-amber-400', titleCls: 'text-amber-100',
    chipCls: 'border-amber-800/50 hover:border-amber-500',
    gradiente: 'from-amber-300 via-orange-300 to-red-400',
    paginas: [
      {
        id: 'meta', path: '/meta', match: ['/meta'],
        label: 'Meta & Tier List', topo: 'META', icon: 'fa-ranking-star', preview: 'meta',
        desc: 'A classificação S/A/B/C/D por rota, com winrate, pick e ban do patch.',
        text: 'text-amber-400', border: 'border-amber-500', accent: 'text-amber-300',
        active: 'border-amber-500 bg-amber-500/10 text-amber-300',
        cardCls: 'border-amber-500/40 bg-gradient-to-br from-amber-950/70 via-orange-900/30 to-slate-950 hover:shadow-[0_0_40px_rgba(245,158,11,0.28)]',
        glowCls: 'bg-amber-400/20', iconBorder: 'border-amber-600/60', iconColor: 'text-amber-300', titleCls: 'text-amber-100'
      }
    ]
  },
  {
    id: 'campeoes',
    n: 3,
    label: 'Campeões',
    topo: 'CAMPEÕES',
    espirito: 'Espírito da Fênix',
    icon: 'fa-dragon',
    arte: '/Udyr_notudyr_phoenix.webp',
    hub: '/campeoes',
    desc: 'As fichas do panteão e o arsenal de relíquias ancestrais.',
    subtitulo: 'Fichas de campeões e o arsenal de relíquias.',
    text: 'text-violet-400', border: 'border-violet-500', accent: 'text-violet-300',
    labelClass: 'text-violet-300', sidebarIcon: 'fa-dragon',
    cardCls: 'border-violet-500/40 bg-gradient-to-br from-fuchsia-950/80 via-violet-800/40 to-slate-950 hover:shadow-[0_0_40px_rgba(139,92,246,0.35)]',
    glowCls: 'bg-violet-400/25', spiritCls: 'text-violet-400', titleCls: 'text-violet-100',
    chipCls: 'border-violet-800/50 hover:border-violet-500',
    gradiente: 'from-fuchsia-300 via-violet-300 to-sky-400',
    paginas: [
      {
        // A ficha em tela cheia (/ficha/:id) é o Panteão por dentro — acende aqui.
        id: 'pantheon', path: '/champions', match: ['/champions', '/ficha'],
        label: 'Panteão dos Campeões', topo: 'PANTEÃO', icon: 'fa-dragon', preview: 'pantheon',
        desc: 'Fichas com habilidades, perfil tático, builds e skins.',
        text: 'text-sky-400', border: 'border-sky-500', accent: 'text-sky-300',
        active: 'border-sky-500 bg-sky-500/10 text-sky-300',
        cardCls: 'border-sky-500/40 bg-gradient-to-br from-blue-900/70 via-sky-800/30 to-slate-950 hover:shadow-[0_0_40px_rgba(56,189,248,0.3)]',
        glowCls: 'bg-sky-400/20', iconBorder: 'border-sky-600/60', iconColor: 'text-sky-300', titleCls: 'text-sky-100'
      },
      {
        id: 'items', path: '/items', match: ['/items'],
        label: 'Relíquias Ancestrais', topo: 'RELÍQUIAS', icon: 'fa-gem', preview: 'items',
        desc: 'Arsenal de itens: atributos, receitas e sinergias por campeão.',
        text: 'text-fuchsia-400', border: 'border-fuchsia-500', accent: 'text-fuchsia-300',
        active: 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300',
        cardCls: 'border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-950/70 via-purple-800/30 to-slate-950 hover:shadow-[0_0_40px_rgba(217,70,239,0.28)]',
        glowCls: 'bg-fuchsia-400/20', iconBorder: 'border-fuchsia-600/60', iconColor: 'text-fuchsia-300', titleCls: 'text-fuchsia-100'
      }
    ]
  },
  {
    id: 'equipes',
    n: 4,
    label: 'Equipes',
    // 'EQUIPES' e não 'TRIBO': o pilar e a primeira página dele apareceriam com o
    // mesmo rótulo na mesma linha da topbar. O topo do pilar espelha o portal da Home.
    topo: 'EQUIPES',
    espirito: 'Espírito da Tartaruga',
    icon: 'fa-people-group',
    arte: '/Udyr_notudyr_turtle.webp',
    hub: '/synergy',
    desc: 'Monte a tribo perfeita por sinergia e equilibre partidas customizadas.',
    subtitulo: 'Composição, lobby customizado e os relatórios da tribo.',
    text: 'text-lime-400', border: 'border-lime-500', accent: 'text-lime-300',
    labelClass: 'text-lime-300', sidebarIcon: 'fa-people-group',
    cardCls: 'border-lime-500/40 bg-gradient-to-br from-emerald-900/80 via-teal-900/40 to-slate-950 hover:shadow-[0_0_40px_rgba(132,204,22,0.3)]',
    glowCls: 'bg-lime-400/25', spiritCls: 'text-lime-400', titleCls: 'text-lime-100',
    chipCls: 'border-lime-800/50 hover:border-lime-500',
    gradiente: 'from-lime-300 via-emerald-300 to-teal-400',
    paginas: [
      {
        id: 'sinergia', path: '/synergy', match: ['/synergy'],
        label: 'Tribo Perfeita', topo: 'TRIBO', icon: 'fa-people-group', preview: 'tribo',
        desc: 'Planejador de composição: encaixe 1 a 5 e ache a sinergia.',
        text: 'text-lime-400', border: 'border-lime-500', accent: 'text-lime-300',
        active: 'border-lime-500 bg-lime-500/10 text-lime-300',
        cardCls: 'border-lime-500/40 bg-gradient-to-br from-emerald-900/70 via-lime-800/30 to-slate-950 hover:shadow-[0_0_40px_rgba(132,204,22,0.3)]',
        glowCls: 'bg-lime-400/20', iconBorder: 'border-lime-600/60', iconColor: 'text-lime-300', titleCls: 'text-lime-100'
      },
      {
        id: 'custom', path: '/saguaoCustom', match: ['/saguaoCustom'],
        label: 'Customizada 5x5', topo: 'CUSTOM', icon: 'fa-shuffle', preview: 'tribo',
        desc: 'Lobby customizado: divide os dez em dois times equilibrados.',
        text: 'text-orange-400', border: 'border-orange-500', accent: 'text-orange-300',
        active: 'border-orange-500 bg-orange-500/10 text-orange-300',
        cardCls: 'border-orange-500/40 bg-gradient-to-br from-orange-950/70 via-amber-900/30 to-slate-950 hover:shadow-[0_0_40px_rgba(249,115,22,0.28)]',
        glowCls: 'bg-orange-400/20', iconBorder: 'border-orange-600/60', iconColor: 'text-orange-300', titleCls: 'text-orange-100'
      },
      {
        id: 'relatorios', path: '/relatorios', match: ['/relatorios'],
        label: 'Relatórios Premium', topo: 'RELATÓRIOS', icon: 'fa-file-invoice', preview: 'relatorios',
        desc: 'O relatório do Cronista com filtro de período, prosa e gráficos.',
        text: 'text-emerald-400', border: 'border-emerald-500', accent: 'text-emerald-300',
        active: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
        cardCls: 'border-emerald-500/40 bg-gradient-to-br from-emerald-900/70 via-teal-800/30 to-slate-950 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]',
        glowCls: 'bg-emerald-400/20', iconBorder: 'border-emerald-600/60', iconColor: 'text-emerald-300', titleCls: 'text-emerald-100'
      }
    ]
  }
];

// Ancestralidade (consulta avançada ao D1): fica FORA da árvore de propósito — é o
// botão especial isolado no rodapé da sidebar, não é caminho de ninguém.
export const ANCESTRALIDADE = {
  path: '/ancestralidade', match: ['/ancestralidade'], label: 'Ancestralidade', icon: 'fa-user-secret'
};

// Todas as páginas achatadas, cada uma sabendo de que pilar veio.
export const PAGINAS = PILARES.flatMap((p) => p.paginas.map((pg) => ({ ...pg, pilar: p.id })));

// Uma rota "casa" com um prefixo quando é ele ou uma sub-rota dele. Comparar por
// `startsWith` cru faria /meta acender em /metamorfose — daí a barra explícita.
export function casaRota(path, prefixos) {
  return (prefixos || []).some((pref) => path === pref || path.startsWith(pref + '/'));
}

export function paginaDaRota(path) {
  return PAGINAS.find((pg) => casaRota(path, pg.match)) || null;
}

// Qual pilar dono da rota atual — é o que decide o 2º nível da topbar e a seção
// acesa na sidebar. O hub entra na conta: /jogadores é o pilar Jogador sem estar
// em nenhuma página dele.
export function pilarDaRota(path) {
  const pg = paginaDaRota(path);
  if (pg) return PILARES.find((p) => p.id === pg.pilar) || null;
  return PILARES.find((p) => casaRota(path, [p.hub])) || null;
}

export function pilarPorId(id) {
  return PILARES.find((p) => p.id === id) || null;
}
