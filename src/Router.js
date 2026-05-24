import { createRouter, createWebHistory } from 'vue-router';
import Home from './components/Home.vue';
import Profile from './components/Profile.vue';
import Mastery from './components/Mastery.vue';
import Synergy from './components/Synergy.vue';

const routes = [
  { path: '/', component: Home },
  { path: '/profile', component: Profile },
  { path: '/mastery', component: Mastery },
  { path: '/synergy', component: Synergy },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' };
  },
});

export default router;
