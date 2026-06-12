<template>
  <div class="w-full relative z-30">
    <form @submit.prevent="executeSearch" class="w-full flex gap-2" :class="{ 'max-w-md mx-auto': buttonText }">
      <div class="relative flex-1">
        <!-- Ícone de Lupa interno apenas no modo compacto (quando buttonText for vazio) -->
        <span v-if="!buttonText" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">🔍</span>
        
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
import { state } from '../store.js';
import { workerRequest } from '../api.js';

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
  emit('search-start');

  try {
    const data = await workerRequest(props.action, { gameName, tagLine });
    const normalizedData = {
      ...data,
      gameName: data?.gameName || gameName,
      tagLine: data?.tagLine || tagLine,
      profileIconId: data?.profileIconId || 29,
      summonerLevel: data?.summonerLevel || 0,
      statsSolo: {
        wins: Number(data.statsSolo?.wins || 0),
        losses: Number(data.statsSolo?.losses || 0),
        winRate: Number(data.statsSolo?.winRate || 0),
        tier: data.statsSolo?.tier || 'UNRANKED',
        rank: data.statsSolo?.rank || '',
        lp: Number(data.statsSolo?.lp || 0)
      },
      statsFlex: {
        wins: Number(data.statsFlex?.wins || 0),
        losses: Number(data.statsFlex?.losses || 0),
        winRate: Number(data.statsFlex?.winRate || 0),
        tier: data.statsFlex?.tier || 'UNRANKED',
        rank: data.statsFlex?.rank || '',
        lp: Number(data.statsFlex?.lp || 0)
      },
      matches: Array.isArray(data.matches) ? data.matches : [],
      proficiencyMatches: Array.isArray(data.proficiencyMatches) ? data.proficiencyMatches : [],
      companions: {
        solo: Array.isArray(data.companions?.solo) ? data.companions.solo : [],
        flex: Array.isArray(data.companions?.flex) ? data.companions.flex : []
      }
    };

    if (props.syncGlobalStore) {
      state.searchProfile.puuid = normalizedData.puuid || null;
      state.searchProfile.gameName = normalizedData.gameName;
      state.searchProfile.tagLine = normalizedData.tagLine;
      state.searchProfile.profileIconId = normalizedData.profileIconId;
      state.searchProfile.summonerLevel = normalizedData.summonerLevel;
      state.searchProfile.statsSolo = normalizedData.statsSolo;
      state.searchProfile.statsFlex = normalizedData.statsFlex;
      state.searchProfile.stats = {
        wins: Number(data.stats?.wins || 0),
        losses: Number(data.stats?.losses || 0),
        winRate: Number(data.stats?.winRate || 0),
        tier: data.stats?.tier || 'UNRANKED',
        rank: data.stats?.rank || '',
        lp: Number(data.stats?.lp || 0)
      };
      state.searchProfile.matches = normalizedData.matches;
      state.searchProfile.proficiencyMatches = normalizedData.proficiencyMatches;
      state.searchProfile.companions = normalizedData.companions;
      state.searchProfile.error = null;
    }

    emit('search-success', props.syncGlobalStore ? state.searchProfile : normalizedData);

    if (props.loadMasteries && normalizedData.puuid) {
      workerRequest('masteries', { puuid: normalizedData.puuid, gameName, tagLine })
        .then((masteryData) => {
          const fromStaticChamp = (entry) => {
            if (!entry) return { championName: 'Aatrox', championLevel: 1, championPoints: 0, lastPlayTime: 0 };
            const fromStatic = state.staticData.championList.find((champ) => Number(champ.key) === Number(entry.championId));
            return {
              championName: entry.championName || fromStatic?.name || 'Aatrox',
              championLevel: Number(entry.championLevel || 1),
              championPoints: Number(entry.championPoints || 0),
              lastPlayTime: Number(entry.lastPlayTime || 0)
            };
          };
          state.masteryDashboard.allMasteries = (masteryData.masteries || []).map(fromStaticChamp);
        })
        .catch((mErr) => {
          console.warn('Erro nas maestrias em background:', mErr);
        });
    }
  } catch (error) {
    localError.value = error.message;
    emit('search-error', error.message);
  } finally {
    loading.value = false;
  }
}
</script>
