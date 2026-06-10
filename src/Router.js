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
  { path: '/profile', component: Profile },
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
