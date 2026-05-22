<template>
  <div class="fixed inset-0 z-0 pointer-events-none select-none" style="background-image:url('./assets/caverna-bg.jpg');background-size:cover;background-position:center;opacity:0.07;filter:brightness(0.4);"></div>

  <!-- Telemetry Monitor -->
  <div class="fixed right-4 top-20 z-40 w-56 rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-2xl backdrop-blur-sm">
    <div class="mb-1.5 border-b border-slate-800 pb-1.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Monitor da API (Riot)</div>
    <div class="flex items-center justify-between text-xs font-bold"><span class="text-slate-400">Uso (2 min)</span><span class="text-white">{{ telUsage }} / 100</span></div>
    <div class="mt-1 flex items-center justify-between text-xs font-bold"><span class="text-slate-400">Disponível</span><span :class="telAvailableClass">{{ telAvailable }}</span></div>
    <div class="mt-2 rounded py-1 text-center text-[10px] font-bold uppercase" :class="telTimeClass">{{ telTimeText }}</div>
  </div>

  <!-- Header Global Refatorado -->
  <header class="fixed inset-x-0 top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
    <div class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
      <h1 class="text-sm font-black tracking-tight text-slate-300 md:text-base text-left">
        <span class="bg-gradient-to-r from-lime-400 via-yellow-400 to-amber-500 bg-clip-text text-transparent uppercase">UGA BUGA PLATFORM</span>
      </h1>
      
      <!-- BUSCA CONDICIONAL NA TOP BAR (Não aparece na Home) -->
      <div v-if="store.currentTab !== 'home'" class="hidden md:block w-72">
        <SearchBar buttonText="" />
      </div>

      <nav class="flex gap-1.5">
        <button
          v-for="tab in tabs" :key="tab.id" type="button" @click="store.currentTab = tab.id"
          class="px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded transition border"
          :class="store.currentTab === tab.id ? 'bg-slate-900 border-cyan-500 text-cyan-400' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'"
        >{{ tab.label }}</button>
      </nav>
    </div>
  </header>

  <!-- Router/View Switcher -->
  <main class="mx-auto w-full max-w-7xl px-4 pb-16 pt-24">
    <Home v-if="store.currentTab === 'home'" />
    <Profile v-else-if="store.currentTab === 'perfil'" />
    <Mastery v-else-if="store.currentTab === 'maestria'" />
    <Synergy v-else-if="store.currentTab === 'sinergia'" />
    <Fogueira v-else-if="store.currentTab === 'fogueira'" />
  </main>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { state } from './store.js';
import { DDRAGON_VERSION } from './utils.js';
import SearchBar from './components/SearchBar.vue';
import Home from './components/Home.vue';
import Profile from './components/Profile.vue';
import Mastery from './components/Mastery.vue';
import Synergy from './components/Synergy.vue';
import Fogueira from './components/Fogueira.vue';

const store = state;
const tabs = [
  { id: 'home', label: 'Templo' },
  { id: 'perfil', label: 'Caçada' },
  { id: 'maestria', label: 'Caverna' },
  { id: 'sinergia', label: 'Tribo' },
  { id: 'fogueira', label: '🔥 Fogueira' }
];

const telemetryTick = ref(0);
let telInterval = null;

function updateTelemetry() {
  const now = Date.now();
  const ts = store.telemetry?.timestamps || [];
  while (ts.length > 0 && ts[0] < now - 120000) ts.shift();
  telemetryTick.value++;
}

onMounted(() => {
  telInterval = setInterval(updateTelemetry, 1000);
  // Fetch DataDragon data
  fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/pt_BR/champion.json`)
    .then(r => r.json()).then(j => { store.staticData.championList = Object.values(j.data || {}); })
    .catch(e => console.error(e));
});
onUnmounted(() => { if (telInterval) clearInterval(telInterval); });

const telUsage = computed(() => { telemetryTick.value; return store.telemetry?.timestamps?.length || 0; });
const telAvailable = computed(() => 100 - telUsage.value);
const telAvailableClass = computed(() => telAvailable.value > 25 ? 'text-green-400' : 'text-red-500 animate-pulse');
const telTimeText = computed(() => {
  telemetryTick.value;
  const ts = store.telemetry?.timestamps || [];
  if (!ts.length) return 'Status: Liberado';
  const left = Math.max(0, Math.ceil((120000 - (Date.now() - ts[0])) / 1000));
  return `Reset em: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
});
const telTimeClass = computed(() => !store.telemetry?.timestamps?.length ? 'bg-slate-950 text-slate-500' : 'bg-blue-950/80 text-blue-300 border border-blue-900');
</script>
