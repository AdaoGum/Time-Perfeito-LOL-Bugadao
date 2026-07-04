<template>
  <!-- Sobreposição de busca: aparece quando nenhum perfil foi pesquisado ainda.
       Some assim que um perfil é encontrado (store.searchProfile.puuid preenchido). -->
  <div
    v-if="!hasProfile && !loading"
    class="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl bg-slate-950/85 backdrop-blur-sm p-4"
  >
    <h2 class="mb-8 text-center text-2xl font-black tracking-wide text-slate-100 drop-shadow-[0_2px_16px_rgba(6,182,212,0.5)] sm:text-4xl">
      <span class="bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-500 bg-clip-text text-transparent">{{ title }}</span>
    </h2>

    <!-- Mesma caixa de busca da tela inicial (Home) -->
    <div class="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
      <SearchBar
        buttonText="Começar Jornada"
        autocomplete
        :routeToProfile="true"
        @show-overlay="c => $emit('show-overlay', c)"
        @hide-overlay="$emit('hide-overlay')"
        @show-udyr="$emit('show-udyr')"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { state } from '../store.js';
import SearchBar from './SearchBar.vue';

defineProps({
  title: {
    type: String,
    default: 'Busque um Invocador'
  }
});

defineEmits(['show-overlay', 'hide-overlay', 'show-udyr']);

const hasProfile = computed(() => Boolean(state.searchProfile.puuid));
const loading = computed(() => state.searchProfile.loading);
</script>
