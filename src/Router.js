import { createRouter, createWebHistory } from 'vue-router';
// Imports de cada página necessária do sistema
import Home from './components/Home.vue';
import Profile from './components/Profile.vue';
import Mastery from './components/Mastery.vue';
import Tribo from './components/Tribo.vue';
import SaguaoCustom from './components/saguaoCustom.vue';
import Ancestralidade from './components/Ancestralidade.vue';
import Champions from './components/Champions.vue';
import Items from './components/Items.vue';
import MetaTierList from './components/MetaTierList.vue';
import ModuleHub from './components/ModuleHub.vue';

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
  { path: '/ancestralidade', component: Ancestralidade },

  // Hubs de módulo (títulos clicáveis das categorias da sidebar)
  { path: '/jogadores', component: ModuleHub, props: { module: 'players' } },
  { path: '/campeoes', component: ModuleHub, props: { module: 'champions' } },

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
  { path: '/ficha/:championId', component: () => import('./components/ChampionPage.vue') },
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
