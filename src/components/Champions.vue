<!--
  Champions.vue — Panteão dos Campeões.
  Grade de todos os campeões (DDragon), busca + filtro por rota. Clique abre a
  ficha (ChampionSheet). Deep-link /champions/:championId (id do DDragon) abre a
  ficha direto e sobrevive ao refresh. Relíquias da ficha navegam para /items/:id.
-->
<template>
  <div>
    <!-- Cabeçalho -->
    <header class="mb-5 flex flex-col gap-1">
      <h1 class="flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
        <i class="fa-solid fa-dragon text-cyan-400"></i>
        <span class="bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-400 bg-clip-text text-transparent">Panteão dos Campeões</span>
      </h1>
      <p class="text-sm text-slate-400">Habilidades, perfil tático, relíquias recomendadas e o meta de cada campeão.</p>
    </header>

    <!-- Controles: busca + filtro de rota -->
    <div class="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div class="lg:max-w-xs lg:flex-1">
        <SearchBar context="champions" button-text="" @select-champion="openChampById" />
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-black uppercase tracking-wide transition"
          :class="activeRole === 'ALL' ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'"
          @click="activeRole = 'ALL'"
        >
          <i class="fa-solid fa-layer-group"></i> Todas
        </button>
        <button
          v-for="role in ROLES"
          :key="role.key"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-black uppercase tracking-wide transition"
          :class="activeRole === role.key ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'"
          @click="activeRole = role.key"
        >
          <img :src="roleIconImage(role.key)" :alt="role.label" class="h-4 w-4" /> {{ role.label }}
        </button>
      </div>
    </div>

    <AsyncState :loading="!championList.length" accent="cyan" loading-text="Invocando o panteão..." :retryable="false">
      <p class="mb-3 text-xs font-bold text-slate-500">{{ filtered.length }} campeões</p>
      <div class="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
        <button
          v-for="champ in filtered"
          :key="champ.id"
          type="button"
          class="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-center transition hover:border-cyan-500/70 hover:bg-slate-800/60"
          @click="openChamp(champ)"
        >
          <img
            :src="championImage(champ.name)"
            :alt="champ.name"
            loading="lazy"
            class="mx-auto h-14 w-14 rounded-lg border border-slate-700 transition group-hover:scale-110 sm:h-16 sm:w-16"
          />
          <p class="mt-1.5 truncate text-[11px] font-bold text-slate-200 group-hover:text-white">{{ champ.name }}</p>
          <div class="mt-1 flex flex-wrap justify-center gap-0.5">
            <span v-for="role in rolesOf(champ).slice(0, 3)" :key="role" class="inline-flex h-4 w-4 items-center justify-center rounded bg-slate-950/80">
              <img :src="roleIconImage(role)" :alt="role" class="h-3 w-3" />
            </span>
          </div>
        </button>
      </div>

      <p v-if="!filtered.length" class="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
        Nenhum campeão encontrado para este filtro.
      </p>
    </AsyncState>

    <!-- Ficha (modal) -->
    <ChampionSheet
      v-if="selected"
      :champ="selected"
      @close="closeChamp"
      @open-item="goToItem"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { state } from '../store.js';
import { championImage, getChampionIdFromName, roleIconImage } from '../utils.js';
import { ROLES, rolesOf, normalizeSearch } from '../utils/championCatalog.js';
import SearchBar from './SearchBar.vue';
import ChampionSheet from './ChampionSheet.vue';
import AsyncState from './AsyncState.vue';

const store = state;
const route = useRoute();
const router = useRouter();

const activeRole = ref('ALL');
const selected = ref(null);

const championList = computed(() =>
  [...(store.staticData.championList || [])].sort((a, b) => a.name.localeCompare(b.name))
);

const filtered = computed(() => {
  if (activeRole.value === 'ALL') return championList.value;
  return championList.value.filter((champ) => rolesOf(champ).includes(activeRole.value));
});

// Abre a ficha e reflete o campeão na URL (deep-link/refresh).
function openChamp(champ) {
  selected.value = champ;
  const id = champ.id || getChampionIdFromName(champ.name);
  if (route.params.championId !== id) {
    router.push(`/champions/${id}`);
  }
}

// Abre por id do DDragon (usado pela busca de campeões e pelo deep-link).
function openChampById(id) {
  const champ = championList.value.find(
    (c) => c.id === id || getChampionIdFromName(c.name) === id
  );
  if (champ) openChamp(champ);
}

function closeChamp() {
  selected.value = null;
  if (route.params.championId) router.push('/champions');
}

function goToItem(itemId) {
  router.push(`/items/${itemId}`);
}

// Sincroniza o deep-link (:championId) com a ficha aberta, quando a lista existir.
function syncFromRoute() {
  const id = route.params.championId;
  if (!id) {
    selected.value = null;
    return;
  }
  if (!championList.value.length) return;
  openChampById(id);
}

onMounted(syncFromRoute);
watch(() => route.params.championId, syncFromRoute);
watch(championList, (list) => {
  if (list.length && route.params.championId && !selected.value) syncFromRoute();
});
</script>
