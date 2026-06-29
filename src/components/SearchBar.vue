<template>
  <div class="w-full relative z-30">
    <form @submit.prevent="executeSearch" class="w-full flex gap-2" :class="{ 'max-w-md mx-auto': buttonText }">
      <div class="relative flex-1">
        <!-- Ícone de Lupa interno apenas no modo compacto (quando buttonText for vazio) -->
        <span v-if="!buttonText" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs"><i class="fa-solid fa-magnifying-glass"></i></span>
        
        <input
          v-model="inputQuery"
          required
          :disabled="loading"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
          :class="buttonText ? 'px-4 py-2.5' : 'pl-8 pr-3 py-1.5'"
          placeholder="Nome#TAG (ex: Kami#BR1)"
        />
      </div>

      <!-- Botão customizável controlado por quem chama o componente -->
      <button
        v-if="buttonText"
        :disabled="loading"
        class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white shadow-lg transition hover:bg-blue-500 hover:shadow-blue-900/50 disabled:cursor-not-allowed disabled:opacity-70 text-sm"
        type="submit"
      >
        <span v-if="loading" class="animate-pulse">Buscando...</span>
        <span v-else>{{ buttonText }}</span>
      </button>
    </form>
    
    <!-- Alerta rápido de erro interno -->
    <p v-if="localError" class="absolute left-0 top-full mt-1 text-[11px] font-semibold text-red-400 bg-red-950/90 px-2 py-0.5 rounded border border-red-900/50 z-50">
      {{ localError }}
    </p>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { state } from '../store.js';
import { workerRequest, normalizeProfileData, applyProfileToStore, loadMasteriesInBackground } from '../api.js';

const router = useRouter();

const props = defineProps({
  buttonText: {
    type: String,
    default: 'Buscar'
  },
  initialValue: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    default: 'profile_overview'
  },
  loadMasteries: {
    type: Boolean,
    default: true
  },
  syncGlobalStore: {
    type: Boolean,
    default: true
  },
  // Quando true, ao concluir a busca navega para /profile/:gameName/:tagLine
  // (mantém o jogador na URL, sobrevive ao refresh).
  routeToProfile: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['search-success', 'search-start', 'search-error']);

const inputQuery = ref(props.initialValue);
const loading = ref(false);
const localError = ref(null);

watch(() => props.initialValue, (newVal) => {
  inputQuery.value = newVal;
});

async function executeSearch() {
  const summoner = inputQuery.value?.trim();
  if (!summoner) return;

  const [gameNameRaw, tagLineRaw] = summoner.split('#');
  const gameName = (gameNameRaw || '').trim();
  const tagLine = (tagLineRaw || '').trim();

  if (!gameName || !tagLine) {
    localError.value = 'Use o formato Nome#TAG.';
    return;
  }

  loading.value = true;
  localError.value = null;
  // Liga a animação global de carregamento (esqueleto/spinner do Profile.vue)
  if (props.syncGlobalStore) state.searchProfile.loading = true;
  emit('search-start');

  try {
    const data = await workerRequest(props.action, { gameName, tagLine });
    const normalizedData = normalizeProfileData(data, gameName, tagLine);

    if (props.syncGlobalStore) {
      applyProfileToStore(normalizedData, data);
    }

    emit('search-success', props.syncGlobalStore ? state.searchProfile : normalizedData);

    if (props.loadMasteries && normalizedData.puuid) {
      loadMasteriesInBackground(normalizedData.puuid, gameName, tagLine);
    }

    // Coloca o jogador buscado na URL para sobreviver ao refresh.
    if (props.routeToProfile && normalizedData.puuid) {
      router.push(`/profile/${encodeURIComponent(normalizedData.gameName)}/${encodeURIComponent(normalizedData.tagLine)}`);
    }
  } catch (error) {
    localError.value = error.message;
    if (props.syncGlobalStore) state.searchProfile.error = error.message;
    emit('search-error', error.message);
  } finally {
    loading.value = false;
    if (props.syncGlobalStore) state.searchProfile.loading = false;
  }
}
</script>
