import { createRouter, createWebHistory } from 'vue-router';
// Imports de cada página necessária do sistema
import Home from './components/Home.vue';
import Profile from './components/Profile.vue';
import Mastery from './components/Mastery.vue';
import Tribo from './components/Tribo.vue';
import SaguaoCustom from './components/saguaoCustom.vue';
import Ancestralidade from './components/Ancestralidade.vue';

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

  { path: '/mastery', component: Mastery },
  { path: '/synergy', component: Tribo },
  { path: '/saguaoCustom', component: SaguaoCustom },
  { path: '/ancestralidade', component: Ancestralidade },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' };
  },
});

export default router;
