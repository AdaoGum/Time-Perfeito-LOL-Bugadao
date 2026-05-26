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
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white lg:hidden"
          @click="store.ui.sidebarMobileOpen = !store.ui.sidebarMobileOpen"
          aria-label="Abrir menu lateral"
        >
          ☰
        </button>

        <h1 class="text-base font-extrabold tracking-tight sm:text-lg md:text-xl">
          <span class="bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-500 bg-clip-text text-transparent">UGA BUGA Infos + Caverna dos Monos + Tribo Perfeita</span>
        </h1>
      </div>
      
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
          v-for="tab in topTabs"
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

  <div
    v-if="store.ui.sidebarMobileOpen"
    class="fixed inset-0 z-20 bg-slate-950/60 lg:hidden"
    @click="store.ui.sidebarMobileOpen = false"
  ></div>

  <aside
    class="fixed bottom-0 left-0 top-16 z-30 flex flex-col border-r border-slate-800 bg-slate-950/95 backdrop-blur transition-all duration-300"
    :class="[
      store.ui.sidebarCollapsed ? 'w-20' : 'w-72',
      store.ui.sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    ]"
  >
    <div class="flex items-center justify-between border-b border-slate-800 px-3 py-3">
      <span v-if="!store.ui.sidebarCollapsed" class="text-xs font-black uppercase tracking-wider text-slate-400">Spiritual Bar</span>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-700 text-slate-300 hover:text-white"
        @click="toggleSidebarCollapse"
        :aria-label="store.ui.sidebarCollapsed ? 'Expandir sidebar' : 'Minimizar sidebar'"
      >
        {{ store.ui.sidebarCollapsed ? '»' : '«' }}
      </button>
    </div>

    <div class="border-b border-slate-800 p-3">
      <button
        v-if="store.ui.sidebarCollapsed"
        type="button"
        class="mb-2 inline-flex h-8 w-8 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
        @click="sidebarSearchOpen = !sidebarSearchOpen"
        aria-label="Abrir busca"
      >
        🔍
      </button>

      <div v-if="!store.ui.sidebarCollapsed || sidebarSearchOpen" class="space-y-2">
        <p v-if="!store.ui.sidebarCollapsed" class="text-[10px] font-black uppercase tracking-wider text-slate-500">Busca rápida</p>
        <SearchBar
          buttonText=""
          @show-overlay="handleShowOverlay"
          @hide-overlay="handleHideOverlay"
          @show-udyr="handleShowUdyr"
        />
      </div>
    </div>

    <div v-if="store.searchProfile.puuid" class="border-b border-slate-800 p-3">
      <div class="rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg" :class="store.ui.sidebarCollapsed ? 'p-2' : 'p-3'">
        <div class="flex gap-2" :class="store.ui.sidebarCollapsed ? 'flex-col items-center justify-start' : 'items-center'">
          <img
            class="rounded-lg border border-slate-700 object-cover"
            :class="store.ui.sidebarCollapsed ? 'h-9 w-9' : 'h-10 w-10'"
            :src="profileIconImage(store.searchProfile.profileIconId)"
            @error="(e) => e.target.src = profileIconImage(29)"
          />
          <div class="min-w-0" :class="store.ui.sidebarCollapsed ? 'w-full text-center -mt-1' : 'flex-1'">
            <p class="truncate font-black text-slate-100" :class="store.ui.sidebarCollapsed ? 'text-[9px]' : 'text-[11px]'">
              {{ store.searchProfile.gameName }}<span class="font-medium text-slate-500">#{{ store.searchProfile.tagLine }}</span>
            </p>
            <p class="font-bold text-slate-400" :class="store.ui.sidebarCollapsed ? 'text-[8px]' : 'text-[10px]'">Nível {{ store.searchProfile.summonerLevel }}</p>
          </div>
        </div>
        <div v-if="!store.ui.sidebarCollapsed" class="mt-2 space-y-1">
          <p class="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-black uppercase text-cyan-400">
            Solo/Duo: {{ store.searchProfile.statsSolo?.tier && store.searchProfile.statsSolo?.tier !== 'UNRANKED' ? `${store.searchProfile.statsSolo.tier} ${store.searchProfile.statsSolo.rank || ''}`.trim() : 'UNRANKED' }}
          </p>
          <p class="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-black uppercase text-purple-400">
            Flex: {{ store.searchProfile.statsFlex?.tier && store.searchProfile.statsFlex?.tier !== 'UNRANKED' ? `${store.searchProfile.statsFlex.tier} ${store.searchProfile.statsFlex.rank || ''}`.trim() : 'UNRANKED' }}
          </p>
        </div>
      </div>
    </div>


    <nav class="flex-1 space-y-2 overflow-y-auto p-3">
      <button
        v-for="tab in sidebarTabs"
        :key="`side-${tab.id}`"
        type="button"
        @click="goToTab(tab.path)"
        class="flex w-full items-center rounded-lg border px-2 py-2 text-left text-xs font-bold transition"
        :class="route.path === tab.path
          ? 'border-orange-500 bg-orange-500/10 text-orange-400'
          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white'"
      >
        <span class="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-950 text-[10px] font-black">
          {{ tab.label.slice(0, 1) }}
        </span>
        <span v-if="!store.ui.sidebarCollapsed" class="ml-2 truncate">{{ tab.label }}</span>
      </button>
    </nav>

    <div class="border-t border-slate-800 p-3">
      <div
        class="rounded-xl border border-slate-700 bg-slate-900/90 p-3 backdrop-blur-sm transition-all"
        :class="store.ui.sidebarCollapsed ? 'px-2 py-2' : ''"
      >
        <div v-if="!store.ui.sidebarCollapsed" class="mb-2 border-b border-slate-700/50 pb-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
          Monitor da API (Riot)
        </div>
        <div class="flex items-center justify-between text-sm font-semibold" :class="store.ui.sidebarCollapsed ? 'text-[10px]' : ''">
          <span class="text-slate-300">{{ store.ui.sidebarCollapsed ? 'Uso' : 'Uso (2 min)' }}</span>
          <span class="text-white">{{ telUsage }}/100</span>
        </div>
        <div v-if="!store.ui.sidebarCollapsed" class="mt-1 flex items-center justify-between text-sm font-semibold">
          <span class="text-slate-300">Disponível</span>
          <span :class="telAvailableClass">{{ telAvailable }}</span>
        </div>
        <div class="mt-2 rounded py-1 text-center text-xs font-medium" :class="telTimeClass">
          {{ store.ui.sidebarCollapsed ? telAvailable : telTimeText }}
        </div>
        <div v-if="!store.ui.sidebarCollapsed" class="mt-3 space-y-2 border-t border-slate-700/50 pt-3">
          <div
            v-for="group in telGroupSummaries"
            :key="group.key"
            class="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5"
          >
            <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide">
              <span :class="group.labelClass">{{ group.label }}</span>
              <span class="text-slate-300">{{ group.usage }} pts</span>
            </div>
            <div class="mt-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>{{ group.requestCount }} req</span>
              <span>{{ group.timeText }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main -->
  <main class="w-full px-4 pb-16 pt-24 transition-[margin] duration-300 md:px-6" :style="mainStyle">
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
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
const sidebarSearchOpen = ref(false);
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440);

const topTabs = [
  { id: 'home', path: '/', label: 'TEMPLO' },
  { id: 'perfil', path: '/profile', label: 'CAÇADA' },
  { id: 'maestria', path: '/mastery', label: 'CAVERNA' },
  { id: 'sinergia', path: '/synergy', label: 'TRIBO' },
];

const sidebarTabs = [
  ...topTabs,
  { id: 'saguaoCustom', path: '/saguaoCustom', label: 'SAGUAO' },
];

// Overlay / countdown handlers
function handleShowOverlay(count = 3) {
  showOverlay.value = true;
  countdown.value = count;
}

function handleHideOverlay() {
  showOverlay.value = false;
}

function goToTab(path) {
  store.ui.sidebarMobileOpen = false;
  router.push(path);
}

function toggleSidebarCollapse() {
  store.ui.sidebarCollapsed = !store.ui.sidebarCollapsed;
  localStorage.setItem('sidebar-collapsed', String(store.ui.sidebarCollapsed));
  if (!store.ui.sidebarCollapsed) {
    sidebarSearchOpen.value = false;
  }
}

function updateViewport() {
  viewportWidth.value = window.innerWidth;
  if (window.innerWidth >= 1024) {
    store.ui.sidebarMobileOpen = false;
  }
}

const isDesktop = computed(() => viewportWidth.value >= 1024);

const mainStyle = computed(() => {
  if (!isDesktop.value) {
    return { marginLeft: '0px', width: '100%' };
  }

  const leftOffset = store.ui.sidebarCollapsed ? 80 : 288;
  return {
    marginLeft: `${leftOffset}px`,
    width: `calc(100% - ${leftOffset}px)`
  };
});

watch(
  () => route.path,
  () => {
    store.ui.sidebarMobileOpen = false;
    sidebarSearchOpen.value = false;
  }
);

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
  window.addEventListener('resize', updateViewport);
  const saved = localStorage.getItem('sidebar-collapsed');
  if (saved !== null) {
    store.ui.sidebarCollapsed = saved === 'true';
  }
  updateViewport();
});
onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('resize', updateViewport);
});

// =========================================================
// BLOCO DE TELEMETRIA CORRIGIDO E SEGURO CONTRA UNDEFINED
// =========================================================
const telemetryTick = ref(0);
let telInterval = null;
const TELEMETRY_WINDOW_MS = 120000;
const TELEMETRY_GROUP_META = [
  { key: 'full-profile', label: 'Perfil Completo', labelClass: 'text-amber-300' },
  { key: 'light-profile', label: 'Perfil Leve', labelClass: 'text-cyan-300' },
  { key: 'masteries', label: 'Maestrias', labelClass: 'text-fuchsia-300' },
  { key: 'other', label: 'Outros', labelClass: 'text-slate-300' }
];

function formatTelemetryReset(msLeft) {
  const secsLeft = Math.max(0, Math.ceil(msLeft / 1000));
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pruneTelemetry(now = Date.now()) {
  const twoMinsAgo = now - TELEMETRY_WINDOW_MS;
  const ts = store.telemetry?.timestamps || [];
  while (ts.length > 0 && ts[0] < twoMinsAgo) ts.shift();

  const events = store.telemetry?.events || [];
  while (events.length > 0 && events[0].at < twoMinsAgo) events.shift();
}

function updateTelemetry() {
  pruneTelemetry();
  telemetryTick.value++;
}

onMounted(() => {
  telInterval = setInterval(updateTelemetry, 1000);
});
onUnmounted(() => {
  if (telInterval) clearInterval(telInterval);
});

const telUsage = computed(() => {
  telemetryTick.value;
  const events = store.telemetry?.events || [];
  if (events.length > 0) {
    return events.reduce((sum, event) => sum + Number(event.cost || 0), 0);
  }
  return store.telemetry?.timestamps?.length || 0;
});

const telAvailable = computed(() => 100 - telUsage.value);

const telAvailableClass = computed(() => {
  const a = telAvailable.value;
  if (a > 25) return 'text-green-400';
  if (a > 10) return 'text-amber-400';
  return 'text-red-500 animate-pulse font-black';
});

const telTimeText = computed(() => {
  telemetryTick.value;
  const events = store.telemetry?.events || [];
  if (events.length === 0) return 'Status: Liberado';
  const oldest = events[0]?.at || Date.now();
  const msLeft = TELEMETRY_WINDOW_MS - (Date.now() - oldest);
  return `Reset geral: ${formatTelemetryReset(msLeft)}`;
});

const telTimeClass = computed(() => {
  if ((store.telemetry?.timestamps || []).length === 0) { // Travado com || []
    return 'bg-slate-950/50 text-slate-400';
  }
  return 'bg-blue-950/40 text-blue-300 border border-blue-800/50';
});

const telGroupSummaries = computed(() => {
  telemetryTick.value;
  const events = store.telemetry?.events || [];

  return TELEMETRY_GROUP_META.map((meta) => {
    const groupEvents = events.filter((event) => event.group === meta.key);
    const usage = groupEvents.reduce((sum, event) => sum + Number(event.cost || 0), 0);
    const oldest = groupEvents[0]?.at || null;
    const timeText = oldest
      ? `Reset: ${formatTelemetryReset(TELEMETRY_WINDOW_MS - (Date.now() - oldest))}`
      : 'Livre';

    return {
      ...meta,
      usage,
      requestCount: groupEvents.length,
      timeText
    };
  }).filter((group) => group.usage > 0 || group.requestCount > 0);
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
