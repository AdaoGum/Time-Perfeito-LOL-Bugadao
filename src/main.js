import { createApp } from 'vue';
import App from './App.vue';
import router from './Router.js';
import { resolveDDragonVersion } from './utils.js';
import './style.css';

// Começa a descobrir o patch ao vivo do Data Dragon o quanto antes (não bloqueia o
// mount). App.vue aguarda a mesma promessa antes de baixar os dados estáticos.
resolveDDragonVersion();

createApp(App).use(router).mount('#app');
