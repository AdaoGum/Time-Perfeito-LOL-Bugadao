<template>
  <div class="space-y-6 rounded-2xl border border-orange-950/30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-950/20 to-slate-950 p-4">

    <div class="rounded-xl border border-orange-900/30 bg-slate-900/70 p-3">
      <form @submit.prevent="handleMasterySearch" class="flex flex-wrap items-center gap-2">
        <input
          v-model="masterySummoner"
          class="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none transition"
          placeholder="Trocar jogador: Nome#TAG"
        />
        <button class="rounded-lg bg-amber-700 px-4 py-1.5 text-sm font-bold text-white hover:bg-amber-600 transition" type="submit">Atualizar</button>
      </form>
    </div>

    <div v-if="store.masteryDashboard.error" class="mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
      :class="isRateLimit(store.masteryDashboard.error) ? 'border-amber-700 bg-amber-950/40 text-amber-300' : 'border-red-800 bg-red-950/40 text-red-300'">
      <p>{{ store.masteryDashboard.error }}</p>
      <button @click="store.masteryDashboard.error = null" class="rounded border border-current px-2 py-0.5 text-xs font-semibold hover:opacity-80" type="button">Fechar</button>
    </div>

    <!-- Has mastery data -->
    <template v-if="top20.length">
      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <h2 class="mb-1 text-center text-2xl font-black text-slate-100">ESSES SÃO SEUS UGA MONOS SEU BUGA</h2>
        <p class="mb-5 text-xs uppercase tracking-wider text-slate-400">Top 5 de maestria com destaque competitivo</p>

        <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <article
            v-for="(entry, index) in top5"
            :key="entry.championName"
            class="relative rounded-xl border bg-slate-950/80 p-3 transition hover:bg-slate-900"
            :class="monoStyles[index].ring"
          >
            <span class="absolute -right-3 -top-3 text-2xl">{{ monoStyles[index].icon }}</span>
            <div class="mb-2 text-center">
              <span class="text-4xl font-black leading-none" :class="monoStyles[index].rank">#{{ index + 1 }}</span>
            </div>
            <img class="mx-auto h-16 w-16 rounded-lg border-2 border-slate-700 object-cover" :src="championImage(entry.championName)" :alt="entry.championName" loading="lazy" />
            <p class="mt-2 truncate text-center text-sm font-bold text-white">{{ entry.championName }}</p>
            <p class="text-center text-[10px] font-semibold uppercase text-slate-300">M{{ entry.championLevel }} • {{ Number(entry.championPoints || 0).toLocaleString('pt-BR') }}</p>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div class="h-full bg-gradient-to-r" :class="monoStyles[index].bar" :style="{ width: masteryPct(entry) + '%' }"></div>
            </div>
          </article>
        </div>

        <div class="mt-6 border-t border-slate-800 pt-4">
          <h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">Top 15 Seguinte (#6 ao #20)</h3>
          <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <article v-for="(entry, idx) in top15" :key="entry.championName" class="rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
              <div class="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>#{{ idx + 6 }}</span>
                <span>M{{ entry.championLevel }}</span>
              </div>
              <div class="flex items-center gap-2">
                <img class="h-16 w-16 rounded-md border border-slate-700" :src="championImage(entry.championName)" :alt="entry.championName" loading="lazy" />
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-100">{{ entry.championName }}</p>
                  <p class="text-[10px] text-slate-400">{{ Number(entry.championPoints || 0).toLocaleString('pt-BR') }} pts</p>
                </div>
              </div>
              <div class="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                <div class="h-full bg-cyan-500" :style="{ width: masteryPct(entry) + '%' }"></div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <h3 class="mb-4 text-lg font-bold text-slate-200">Outros Campeões ({{ remainder.length }})</h3>
        <div class="grid grid-cols-10 gap-1.5">
          <article
            v-for="entry in remainder"
            :key="entry.championName"
            class="group relative flex cursor-pointer flex-col items-center overflow-hidden rounded-lg border p-1 transition hover:scale-105"
            :class="remainderTone(entry.championLevel)"
            @mouseenter="showTooltip($event, entry)"
            @mouseleave="hideTooltip"
          >
            <img class="h-10 w-10 rounded object-cover opacity-80 transition group-hover:opacity-100" :src="championImage(entry.championName)" loading="lazy" />
            <p class="mt-0.5 w-full truncate text-center text-[9px] font-semibold text-slate-300 leading-tight">{{ entry.championName }}</p>
            <span class="text-[9px] font-bold text-amber-400">M{{ entry.championLevel }}</span>
          </article>
        </div>
      </section>
    </template>

    <!-- Empty state (no data) -->
    <template v-else>
      <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl opacity-50">
        <h2 class="mb-1 text-center text-2xl font-black text-slate-600">ESSES SÃO SEUS UGA MONOS SEU BUGA</h2>
        <p class="mb-5 text-xs uppercase tracking-wider text-slate-600">Top 5 de maestria com destaque competitivo</p>
        <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <article v-for="(icon, i) in ['👑','🥈','🥉','⛓️','🪵']" :key="i" class="relative rounded-xl border border-slate-700/50 bg-slate-950/80 p-3">
            <span class="absolute -right-3 -top-3 text-2xl">{{ icon }}</span>
            <div class="mb-2 text-center"><span class="text-4xl font-black leading-none text-slate-700">#{{ i + 1 }}</span></div>
            <div class="mx-auto h-16 w-16 rounded-lg border-2 border-slate-700 bg-slate-800/80"></div>
            <div class="mt-2 mx-auto h-3.5 w-20 rounded bg-slate-800"></div>
            <div class="mt-1 mx-auto h-2.5 w-16 rounded bg-slate-800/60"></div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/60"></div>
          </article>
        </div>
        <div class="mt-6 border-t border-slate-800 pt-4">
          <h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">Top 15 Seguinte (#6 ao #20)</h3>
          <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <article v-for="i in 15" :key="i" class="rounded-lg border border-slate-700/40 bg-slate-950/50 p-3">
              <div class="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-700"><span>#{{ i + 5 }}</span><span>M?</span></div>
              <div class="flex items-center gap-2">
                <div class="h-16 w-16 flex-shrink-0 rounded-md border border-slate-700 bg-slate-800/80"></div>
                <div class="min-w-0 space-y-1.5"><div class="h-3 w-20 rounded bg-slate-800"></div><div class="h-2.5 w-14 rounded bg-slate-800/60"></div></div>
              </div>
              <div class="mt-2 h-1 overflow-hidden rounded-full bg-slate-800/60"></div>
            </article>
          </div>
        </div>
      </section>
      <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl opacity-30">
        <h3 class="mb-4 text-lg font-bold text-slate-600">Outros Campeões</h3>
        <div class="grid grid-cols-10 gap-1.5">
          <div v-for="i in 50" :key="i" class="h-10 w-full rounded-lg border border-slate-800 bg-slate-800/60"></div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { state } from '../store.js';
import { championImage } from '../utils.js';
import { workerRequest } from '../api.js';

const store = state;

const masterySummoner = ref(
  store.searchProfile.gameName && store.searchProfile.tagLine
    ? `${store.searchProfile.gameName}#${store.searchProfile.tagLine}`
    : ''
);

const top20 = computed(() => store.masteryDashboard.allMasteries.slice(0, 20));
const top5 = computed(() => top20.value.slice(0, 5));
const top15 = computed(() => top20.value.slice(5, 20));
const remainder = computed(() => store.masteryDashboard.allMasteries.slice(20));
const maxPoints = computed(() => top20.value[0]?.championPoints || 1);

const monoStyles = [
  { ring: 'border-yellow-400/80 shadow-[0_0_22px_rgba(250,204,21,0.45)]', rank: 'text-yellow-300', bar: 'from-yellow-300 to-amber-500', icon: '👑' },
  { ring: 'border-slate-300/80 shadow-[0_0_20px_rgba(203,213,225,0.4)]', rank: 'text-slate-200', bar: 'from-slate-200 to-slate-400', icon: '🥈' },
  { ring: 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.35)]', rank: 'text-orange-300', bar: 'from-orange-400 to-orange-600', icon: '🥉' },
  { ring: 'border-zinc-500/80 shadow-[0_0_20px_rgba(161,161,170,0.35)]', rank: 'text-zinc-300', bar: 'from-zinc-300 to-zinc-500', icon: '⛓️' },
  { ring: 'border-amber-900/80 shadow-[0_0_20px_rgba(120,53,15,0.35)]', rank: 'text-amber-700', bar: 'from-amber-700 to-amber-900', icon: '🪵' }
];

function masteryPct(entry) {
  return Math.max(4, Math.round((entry.championPoints / maxPoints.value) * 100));
}

function remainderTone(level) {
  if (level >= 8) return 'border-red-700/60 bg-red-950/40';
  if (level >= 6) return 'border-orange-700/60 bg-orange-950/40';
  if (level >= 4) return 'border-blue-700/60 bg-blue-950/40';
  return 'border-slate-700/40 bg-slate-900/40';
}

function isRateLimit(msg) {
  return msg?.includes('muitas consultas') || msg?.includes('expirou');
}

const emit = defineEmits(['show-tooltip', 'hide-tooltip']);

function showTooltip(event, entry) {
  emit('show-tooltip', { event, name: entry.championName, level: entry.championLevel, points: entry.championPoints });
}

function hideTooltip() {
  emit('hide-tooltip');
}

async function handleMasterySearch() {
  const summoner = masterySummoner.value?.trim();
  if (!summoner) return;
  const [gameNameRaw, tagLineRaw] = summoner.split('#');
  const gameName = (gameNameRaw || '').trim();
  const tagLine = (tagLineRaw || '').trim();
  if (!gameName || !tagLine) return;

  try {
    const data = await workerRequest('masteries', { gameName, tagLine });
    if (data?.masteries) {
      store.masteryDashboard.allMasteries = data.masteries;
    }
  } catch (err) {
    store.masteryDashboard.error = err?.message || 'Erro ao buscar maestrias.';
  }
}
</script>
