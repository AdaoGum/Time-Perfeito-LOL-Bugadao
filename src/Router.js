import { createRouter, createWebHistory } from 'vue-router';

// A Home é a única tela EAGER: é a porta de entrada, e esperar um chunk para
// desenhar a primeira tela seria trocar bundle por latência à toa.
import Home from './components/Home.vue';

// Todas as outras entram por `() => import(...)`, cada uma no seu chunk. O que
// isso tira do bundle inicial não é só o componente: é a cauda de dados que ele
// arrasta (o Panteão/Meta puxam `meta-builds.json`, que sozinho é a maior parte
// do que era baixado antes mesmo de o usuário sair da Home).
// Rota nova nasce aqui dentro — voltar a `import X from ...` no topo devolve a
// tela (e a cauda dela) para o chunk inicial sem ninguém perceber.
const Profile = () => import('./components/Profile.vue');
const Mastery = () => import('./components/Mastery.vue');
const Tribo = () => import('./components/Tribo.vue');
const SaguaoCustom = () => import('./components/saguaoCustom.vue');
const Ancestralidade = () => import('./components/Ancestralidade.vue');
const Champions = () => import('./components/Champions.vue');
const Items = () => import('./components/Items.vue');
const MetaTierList = () => import('./components/MetaTierList.vue');
const ModuleHub = () => import('./components/ModuleHub.vue');
const RelatoriosPremium = () => import('./components/RelatoriosPremium.vue');
const ChampionPage = () => import('./components/ChampionPage.vue');

// Constantes das rotas de cada página do sistema
const routes = [
  { path: '/', component: Home },

  // --- CAÇADAS (Histórico) — espírito do Tigre. Entra direto na visão de histórico. ---
  { path: '/historico', component: Profile, props: { entry: 'historico' } },
  { path: '/historico/:gameName/:tagLine', component: Profile, props: { entry: 'historico' } },

  // --- VISÃO (Análise) — espírito da Fênix. Entra direto na visão de estatísticas. ---
  { path: '/analise', component: Profile, props: { entry: 'estatisticas' } },
  { path: '/analise/:gameName/:tagLine', component: Profile, props: { entry: 'estatisticas' } },

  // Perfil "genérico" (busca da topbar): mantém o seletor Histórico ↔ Estatísticas.
  { path: '/profile', component: Profile },
  // Rota com o jogador embutido: permite recarregar a página sem perder a busca.
  // `view` opcional: sem ele = seletor; /historico e /estatisticas abrem a visão direta.
  { path: '/profile/:gameName/:tagLine/:view(historico|estatisticas)?', component: Profile },

  // Caverna dos Monos. Com o jogador na URL a busca feita aqui NÃO sai da tela
  // (antes caía no /profile) e sobrevive ao refresh, igual às Caçadas/Visão.
  { path: '/mastery', component: Mastery },
  { path: '/mastery/:gameName/:tagLine', component: Mastery },
  { path: '/synergy', component: Tribo },
  { path: '/saguaoCustom', component: SaguaoCustom },

  // Relatórios Premium. UM registro de rota com params opcionais (igual ao
  // /champions/:championId?): sem params = o grid de cards; com o jogador = a
  // tela cheia dele. Como o registro é o mesmo, o scrollBehavior abaixo NÃO rola
  // ao abrir/fechar — o "X" devolve a lista na posição em que ela estava.
  { path: '/relatorios/:gameName?/:tagLine?', component: RelatoriosPremium },
  { path: '/ancestralidade', component: Ancestralidade },

  // Hubs de PILAR (títulos clicáveis das categorias da sidebar / cabeçalho dos
  // portais da Home). Só os pilares com MAIS DE UMA página têm hub — o do Meta é a
  // própria tier list, e o das Equipes é a Tribo. Ver src/navegacao.js.
  { path: '/jogadores', component: ModuleHub, props: { pilar: 'jogador' } },
  { path: '/campeoes', component: ModuleHub, props: { pilar: 'campeoes' } },

  // --- SEÇÃO CAMPEÕES ---
  // Panteão dos Campeões: catálogo completo. `:championId` (id do DDragon,
  // ex.: MonkeyKing) opcional = deep-link direto para a ficha do campeão.
  { path: '/champions/:championId?', component: Champions },
  // Relíquias Ancestrais: arsenal de itens. `:itemId` opcional = detalhe direto.
  { path: '/items/:itemId?', component: Items },
  // META & Tier List do patch atual (S/A/B/C/D por rota).
  { path: '/meta', component: MetaTierList },
  // Ficha do campeão em TELA CHEIA: substitui a tela de onde veio (Panteão, Meta,
  // Caverna, Histórico…) e volta para ela pelo botão "Voltar". Carregada sob demanda
  // — é a maior tela do sistema e não precisa pesar no bundle inicial.
  { path: '/ficha/:championId', component: ChampionPage },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Abrir/fechar uma modal (ex.: /champions ↔ /champions/:id) ou trocar de sub-view
    // mantém o MESMO registro de rota — nesse caso NÃO rolamos, para o conteúdo de
    // trás ficar exatamente onde o usuário clicou (sem "pulo" para o topo).
    const mesmaView = to.matched[0] && from.matched[0] && to.matched[0].path === from.matched[0].path;
    if (mesmaView) return false;
    // Voltar/avançar no histórico: restaura a posição salva.
    if (savedPosition) return savedPosition;
    // Navegação normal entre páginas distintas: sobe ao topo.
    return { top: 0, behavior: 'smooth' };
  },
});

export default router;
