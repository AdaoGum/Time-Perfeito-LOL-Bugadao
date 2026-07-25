<!--
  MetaTierList.vue — META & Tier List do patch atual.
  Consome meta-tiers.csv (via championCatalog). Seletor de rota por ícones e
  matriz S/A/B/C/D em linhas coloridas. Clique num campeão abre a ficha no Panteão.
-->
<template>
  <div>
    <!-- Cabeçalho -->
    <header class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
          <i class="fa-solid fa-ranking-star text-amber-400"></i>
          <span class="bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-400 bg-clip-text text-transparent">Meta & Tier List</span>
        </h1>
        <p class="mt-1 text-sm text-slate-400">Quem está forte em cada rota no patch atual — do lendário (S) ao situacional (D).</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="rounded-lg border border-amber-700/50 bg-amber-950/30 px-2.5 py-1 text-xs font-black text-amber-300">Patch {{ info.patch }}</span>
        <span v-if="info.updatedAt" class="rounded-lg border px-2.5 py-1 text-xs font-bold" :class="stale ? 'border-red-700/50 bg-red-950/30 text-red-300' : 'border-slate-700 bg-slate-900 text-slate-400'">
          <i class="fa-solid" :class="stale ? 'fa-triangle-exclamation' : 'fa-calendar-check'"></i>
          {{ stale ? 'Meta desatualizado' : `Atualizado ${info.updatedAt}` }}
        </span>
      </div>
    </header>

    <!-- Seletor de rota por ícones -->
    <div class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="role in ROLES"
        :key="role.key"
        type="button"
        class="inline-flex flex-1 min-w-[5rem] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-black uppercase tracking-wide transition"
        :class="activeRole === role.key ? 'border-amber-500 bg-amber-500/15 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'"
        @click="activeRole = role.key"
      >
        <img :src="roleIconImage(role.key)" :alt="role.label" class="h-5 w-5" />
        <span class="hidden sm:inline">{{ role.label }}</span>
      </button>
    </div>

    <!-- Matriz de tiers -->
    <div class="space-y-3">
      <div
        v-for="tier in TIER_ORDER"
        :key="tier"
        class="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-stretch"
        :class="TIER_STYLES[tier].row"
      >
        <div class="flex shrink-0 items-center gap-2 sm:w-24 sm:flex-col sm:items-center sm:justify-center">
          <span class="inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 text-xl font-black" :class="TIER_STYLES[tier].badge">{{ tier }}</span>
          <span class="text-xs font-bold text-slate-400">{{ tierLabel(tier) }}</span>
        </div>
        <div class="flex-1">
          <div v-if="tiers[tier].length" class="flex flex-wrap gap-2">
            <button
              v-for="champ in tiers[tier]"
              :key="champ.name"
              type="button"
              class="group flex w-16 flex-col items-center"
              :title="champ.name"
              @click="openChampion(champ.name)"
            >
              <img :src="championImage(champ.name)" :alt="champ.name" loading="lazy" class="h-12 w-12 rounded-lg border border-slate-700 transition group-hover:scale-110 group-hover:border-amber-400" />
              <span class="mt-0.5 w-full truncate text-center text-[9px] font-bold text-slate-400 group-hover:text-slate-100">{{ champ.name }}</span>
              <span
                v-if="Number.isFinite(champ.winrate)"
                class="text-[9px] font-black"
                :class="champ.winrate >= 50 ? 'text-emerald-400' : 'text-slate-500'"
              >{{ champ.winrate }}%</span>
            </button>
          </div>
          <p v-else class="py-3 text-center text-xs italic text-slate-500">Nenhum campeão neste tier para {{ roleLabel(activeRole) }}.</p>
        </div>
      </div>
    </div>

    <p class="mt-5 text-center text-[11px] text-slate-500">
      Clique num campeão para abrir a ficha completa no
      <button type="button" class="font-bold text-cyan-400 hover:underline" @click="router.push('/champions')">Panteão</button>.
    </p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { championImage, getChampionIdFromName, roleIconImage } from '../utils.js';
import { metaIsStale } from '../utils/sinergiaMotor.js';
import { ROLES, TIER_ORDER, TIER_STYLES, metaInfo, metaTiersByRole } from '../utils/championCatalog.js';

const router = useRouter();

const activeRole = ref('TOP');
const info = metaInfo();
const stale = metaIsStale();

const tiers = computed(() => metaTiersByRole(activeRole.value));

const TIER_LABELS = { S: 'Lendário', A: 'Forte', B: 'Sólido', C: 'Situacional', D: 'Fraco' };
function tierLabel(tier) {
  return TIER_LABELS[tier] || '';
}
function roleLabel(role) {
  return ROLES.find((r) => r.key === role)?.label || role;
}

function openChampion(name) {
  router.push(`/champions/${getChampionIdFromName(name)}`);
}
</script>
