<template>
  <!-- Background ancestral -->
  <div class="fixed inset-0 z-0 pointer-events-none select-none">
    <div
      class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
      :class="route.path === '/profile' ? 'opacity-60' : 'opacity-0'"
      style="background-image: url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_0.jpg');"
    ></div>
    <div
      class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
      :class="route.path === '/mastery' ? 'opacity-60' : 'opacity-0'"
      style="background-image: url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_3.jpg');"
    ></div>
    <div
      class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
      :class="route.path === '/synergy' ? 'opacity-60' : 'opacity-0'"
      style="background-image: url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_6.jpg');"
    ></div>
    <div class="absolute inset-0 bg-slate-950/72"></div>  
  </div>

  <!-- Udyr Runner -->
  <div ref="udyrRunner" class="pointer-events-none fixed bottom-0 z-[60] hidden h-64 w-40 overflow-hidden" style="left:-260px">
    <img src="https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Udyr_4.jpg"
         class="h-full w-full object-cover object-top" style="transform:scaleX(-1)" alt="Udyr" />
  </div>

  <!-- Card Ripple -->
  <div id="card-ripple" class="pointer-events-none fixed z-[55] hidden" style="width:10px;height:10px;border-radius:50%;transform:translate(-50%,-50%) scale(0)"></div>

  <!-- CARD PERSISTENTE DO INVOCADOR (Superior Esquerdo) -->
  <div v-if="store.searchProfile.puuid" class="fixed left-4 top-20 z-40 w-64 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-2xl flex items-center gap-3">
    <img
      class="w-14 h-14 rounded-lg border border-slate-700 shadow-md object-cover"
      :src="profileIconImage(store.searchProfile.profileIconId)"
      @error="(e) => e.target.src = profileIconImage(29)"
      />
    <div class="overflow-hidden flex-1 min-w-0">
      <h4 class="text-xs font-black text-white truncate">
        {{ store.searchProfile.gameName }}<span class="text-slate-500 font-medium">#{{ store.searchProfile.tagLine }}</span>
      </h4>
      <p class="text-[10px] mt-1 font-bold text-slate-400">Nível {{ store.searchProfile.summonerLevel }}</p>
      
      <div class="mt-1 flex flex-wrap gap-1.5">
        <span class="inline-block text-[9px] font-black tracking-wide text-cyan-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/80 uppercase">
          Solo/Duo: {{ store.searchProfile.statsSolo?.tier && store.searchProfile.statsSolo?.tier !== 'UNRANKED' ? `${store.searchProfile.statsSolo.tier} ${store.searchProfile.statsSolo.rank || ''}`.trim() : 'UNRANKED' }}
        </span>
        
        <span class="inline-block text-[9px] font-black tracking-wide text-purple-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800/80 uppercase">
          Flex: {{ store.searchProfile.statsFlex?.tier && store.searchProfile.statsFlex?.tier !== 'UNRANKED' ? `${store.searchProfile.statsFlex.tier} ${store.searchProfile.statsFlex.rank || ''}`.trim() : 'UNRANKED' }}
        </span>
      </div>
    </div>
  </div>

  <!-- Telemetry Widget -->
  <div class="fixed right-4 top-20 z-40 w-56 rounded-xl border border-slate-700 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-sm transition-all">
    <div class="mb-2 border-b border-slate-700/50 pb-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
      Monitor da API (Riot)
    </div>
    <div class="flex items-center justify-between text-sm font-semibold">
      <span class="text-slate-300">Uso (2 min)</span>
      <span class="text-white">{{ telUsage }} / 100</span>
    </div>
    <div class="mt-1 flex items-center justify-between text-sm font-semibold">
      <span class="text-slate-300">Disponível</span>
      <span :class="telAvailableClass">{{ telAvailable }}</span>
    </div>
    <div class="mt-2 rounded py-1 text-center text-xs font-medium" :class="telTimeClass">{{ telTimeText }}</div>
  </div>

  <!-- Cinematic Overlay -->
  <div
    v-if="showOverlay"
    class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/88 backdrop-blur-sm transition-all"
  >
    <span class="uga-word text-cyan-400/70"  style="top:9%;  left:7%;  font-size:1.4rem; animation-duration:2.8s; animation-delay:0s">UGA</span>
    <span class="uga-word text-fuchsia-400/70" style="top:14%; left:74%; font-size:1.1rem; animation-duration:3.2s; animation-delay:0.4s">Buga</span>
    <span class="uga-word text-lime-400/70"    style="top:28%; left:15%; font-size:1.7rem; animation-duration:2.5s; animation-delay:0.8s">BUGA</span>
    <span class="uga-word text-cyan-300/60"    style="top:22%; left:58%; font-size:0.95rem; animation-duration:3.0s; animation-delay:1.2s">Uga</span>
    <span class="uga-word text-amber-400/70"   style="top:62%; left:9%;  font-size:1.05rem; animation-duration:3.5s; animation-delay:0.6s">UGA BUGA</span>
    <span class="uga-word text-lime-300/60"    style="top:68%; left:78%; font-size:1.25rem; animation-duration:2.7s; animation-delay:1.5s">Uga</span>
    <span class="uga-word text-fuchsia-300/70" style="top:78%; left:43%; font-size:1.35rem; animation-duration:3.1s; animation-delay:0.2s">BUGA</span>
    <span class="uga-word text-cyan-400/60"    style="top:52%; left:28%; font-size:0.9rem;  animation-duration:2.9s; animation-delay:1.8s">UGA</span>
    <span class="uga-word text-amber-300/60"   style="top:42%; left:83%; font-size:1.5rem;  animation-duration:2.6s; animation-delay:2.2s">Buga</span>
    <span class="uga-word text-lime-400/70"    style="top:83%; left:63%; font-size:1.15rem; animation-duration:3.3s; animation-delay:0.9s">UGA</span>
    <div class="relative z-10 flex h-40 w-40 items-center justify-center">
      <svg class="absolute inset-0 h-full w-full animate-[spin_3s_linear_infinite] text-cyan-500" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="15 10" opacity="0.8" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="#3b82f6" stroke-width="4" stroke-dasharray="30 15" class="animate-[spin_2s_linear_infinite_reverse]" />
      </svg>
      <span class="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]">{{ countdown }}</span>
    </div>
    <p class="relative z-10 mt-8 animate-pulse text-center text-lg font-black tracking-[0.12em] text-cyan-300 px-4">
      Buscando as informações com os espiritos ancestrais.<br /><span class="text-lime-300">UGA BUGA</span>
    </p>
  </div>

  <!-- Header -->
  <header class="fixed inset-x-0 top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur">
    <div class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
      <h1 class="text-base font-extrabold tracking-tight sm:text-lg md:text-xl">
        <span class="bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-500 bg-clip-text text-transparent">UGA BUGA Infos + Caverna dos Monos + Tribo Perfeita</span>
      </h1>
      
      <!-- BUSCA INTEGRADA NA TOP BAR -->
      <div v-if="route.path !== '/'" class="hidden md:block w-64">
        <SearchBar 
          buttonText="" 
          @show-overlay="handleShowOverlay"
          @hide-overlay="handleHideOverlay"
          @show-udyr="handleShowUdyr"
        />
      </div>
      <nav class="flex flex-wrap gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          @click="router.push(tab.path)"
          class="px-3 py-1.5 font-cave text-xs sm:text-sm transition-all border-b-4 cursor-pointer"
          :class="route.path === tab.path
            ? 'border-orange-500 text-orange-500 scale-105 font-bold'
            : 'border-stone-900 text-stone-600 hover:text-stone-400'"
        >{{ tab.label }}</button>
      </nav>
    </div>
  </header>

  <!-- Main -->
  <main class="mx-auto w-full max-w-7xl px-4 pb-16 pt-24 md:px-6">
    <router-view v-slot="{ Component }">
      <component
        :is="Component"
        @show-overlay="handleShowOverlay"
        @hide-overlay="handleHideOverlay"
        @show-udyr="handleShowUdyr"
        @show-tooltip="handleShowTooltip"
        @hide-tooltip="handleHideTooltip"
      />
    </router-view>
  </main>

  <!-- Mastery Tooltip -->
  <div
    ref="tooltipEl"
    class="pointer-events-none fixed z-50 hidden rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-2xl"
  ></div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { state } from './store.js';
import { profileIconImage, DDRAGON_VERSION } from './utils.js';
import SearchBar from './components/SearchBar.vue';

const store = state;
const route = useRoute();
const router = useRouter();

const udyrRunner = ref(null);
const tooltipEl = ref(null);

const showOverlay = ref(false);
const countdown = ref(3);

const tabs = [
  { id: 'home', path: '/', label: 'TEMPLO' },
  { id: 'perfil', path: '/profile', label: 'CAÇADA' },
  { id: 'maestria', path: '/mastery', label: 'CAVERNA' },
  { id: 'sinergia', path: '/synergy', label: 'TRIBO' },
];

// Overlay / countdown handlers
function handleShowOverlay(count = 3) {
  showOverlay.value = true;
  countdown.value = count;
}

function handleHideOverlay() {
  showOverlay.value = false;
}

// Udyr runner animation
function handleShowUdyr() {
  const runner = udyrRunner.value;
  if (!runner) return;
  runner.style.cssText = 'left:-260px; bottom:60px; animation:udyr-run 1.6s ease-in-out forwards;';
  runner.classList.remove('hidden');
  setTimeout(() => {
    runner.classList.add('hidden');
    runner.style.animation = '';
  }, 1700);
}

// Mastery tooltip
function handleShowTooltip({ event, name, level, points }) {
  const el = tooltipEl.value;
  if (!el) return;
  el.innerHTML = `<p class="font-cave text-base text-orange-400">${name}</p><p class="text-[10px] uppercase text-stone-400 mt-0.5">Nível de Mestria: ${level}</p><p class="text-xs text-stone-200 mt-1 font-bold">PTS: ${Number(points || 0).toLocaleString('pt-BR')}</p>`;
  el.classList.remove('hidden');
}

function handleHideTooltip() {
  tooltipEl.value?.classList.add('hidden');
}

function onMouseMove(e) {
  const el = tooltipEl.value;
  if (el && !el.classList.contains('hidden')) {
    el.style.left = `${e.clientX + 16}px`;
    el.style.top = `${e.clientY + 12}px`;
  }
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
});
onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
});

// =========================================================
// BLOCO DE TELEMETRIA CORRIGIDO E SEGURO CONTRA UNDEFINED
// =========================================================
const telemetryTick = ref(0);
let telInterval = null;

function updateTelemetry() {
  const now = Date.now();
  const twoMinsAgo = now - 120000;
  // Adicionado fallback caso a store mude
  const ts = store.telemetry?.timestamps || []; 
  while (ts.length > 0 && ts[0] < twoMinsAgo) ts.shift();
  telemetryTick.value++;
}

onMounted(() => {
  telInterval = setInterval(updateTelemetry, 1000);
});
onUnmounted(() => {
  if (telInterval) clearInterval(telInterval);
});

const telUsage = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  telemetryTick.value;
  return store.telemetry?.timestamps?.length || 0; // Travado com ?.
});

const telAvailable = computed(() => 100 - telUsage.value);

const telAvailableClass = computed(() => {
  const a = telAvailable.value;
  if (a > 25) return 'text-green-400';
  if (a > 10) return 'text-amber-400';
  return 'text-red-500 animate-pulse font-black';
});

const telTimeText = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  telemetryTick.value;
  const ts = store.telemetry?.timestamps || []; // Travado com || []
  if (ts.length === 0) return 'Status: Liberado';
  const oldest = ts[0];
  const msLeft = 120000 - (Date.now() - oldest);
  const secsLeft = Math.max(0, Math.ceil(msLeft / 1000));
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  return `Próximo reset: ${m}:${String(s).padStart(2, '0')}`;
});

const telTimeClass = computed(() => {
  if ((store.telemetry?.timestamps || []).length === 0) { // Travado com || []
    return 'bg-slate-950/50 text-slate-400';
  }
  return 'bg-blue-950/40 text-blue-300 border border-blue-800/50';
});

// Load static Data Dragon data on mount
onMounted(async () => {
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/pt_BR/champion.json`);
    const json = await res.json();
    store.staticData.championList = Object.values(json.data || {});
  } catch (e) {
    console.error('Erro ao carregar dados do Data Dragon:', e);
  }
});
</script>
