<template>
  <div class="w-full relative z-30">
    <form @submit.prevent="onSubmit" class="w-full flex gap-2" :class="{ 'max-w-md mx-auto': buttonText }">
      <div class="relative flex-1">
        <!-- Ícone de Lupa interno apenas no modo compacto (quando buttonText for vazio) -->
        <span v-if="!buttonText" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs"><i class="fa-solid fa-magnifying-glass"></i></span>

        <input
          ref="inputEl"
          v-model="inputQuery"
          :required="context === 'players'"
          :disabled="loading"
          autocomplete="off"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
          :class="buttonText ? 'px-4 py-2.5' : 'pl-8 pr-3 py-1.5'"
          :placeholder="placeholder"
          @input="onInput"
          @keydown.down.prevent="moveActive(1)"
          @keydown.up.prevent="moveActive(-1)"
          @keydown.enter="onEnter"
          @keydown.esc="closeSuggestions"
          @focus="onFocus"
          @blur="onBlur"
        />

        <!-- Autocomplete híbrido: campeões (Panteão) e/ou jogadores (D1), conforme `context`. -->
        <ul
          v-if="suggestEnabled && showSuggest && suggestions.length"
          class="absolute left-0 right-0 top-full z-[70] mt-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        >
          <li
            v-for="(sug, i) in suggestions"
            :key="suggestKey(sug)"
            class="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-left transition"
            :class="i === activeIndex ? 'bg-slate-800' : 'hover:bg-slate-800/60'"
            @mousedown.prevent="selectSuggestion(sug)"
            @mouseenter="activeIndex = i"
          >
            <!-- Campeão -->
            <template v-if="sug.type === 'champion'">
              <img
                class="h-7 w-7 shrink-0 rounded-md border border-slate-700 object-cover"
                :src="championImage(sug.name)"
                @error="(e) => e.target.style.visibility = 'hidden'"
                alt=""
              />
              <span class="min-w-0 flex-1 truncate text-sm font-bold text-slate-100">{{ sug.name }}</span>
              <span class="shrink-0 rounded border border-cyan-700/60 bg-cyan-950/40 px-1.5 py-0.5 text-[10px] font-black uppercase text-cyan-300">Campeão</span>
            </template>

            <!-- Jogador -->
            <template v-else>
              <img
                class="h-7 w-7 shrink-0 rounded-md border border-slate-700 object-cover"
                :src="profileIconImage(sug.profile_icon_id || 29)"
                @error="(e) => e.target.src = profileIconImage(29)"
                alt=""
              />
              <span class="min-w-0 flex-1 truncate text-sm font-bold text-slate-100">
                {{ sug.game_name }}<span class="font-medium text-slate-500">#{{ sug.tag_line }}</span>
              </span>
              <span
                v-if="rankLabel(sug)"
                class="shrink-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-300"
              >{{ rankLabel(sug) }}</span>
            </template>
          </li>
        </ul>
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
import { ref, watch, computed, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { state } from '../store.js';
import { workerRequest, normalizeProfileData, applyProfileToStore, loadMasteriesInBackground, isRateBlocked, fetchPlayerSuggestions } from '../api.js';
import { profileIconImage, championImage, getChampionIdFromName } from '../utils.js';
import { normalizeSearch } from '../utils/championCatalog.js';

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
  },
  // Liga o autocomplete (dropdown de sugestões).
  autocomplete: {
    type: Boolean,
    default: false
  },
  // Escopo da busca/autocomplete:
  //  - 'players'   (default): SÓ jogadores do D1 — comportamento histórico intacto.
  //  - 'champions': SÓ campeões (Panteão) — Enter escolhe o 1º da lista.
  //  - 'global':    híbrido, até 6 (ideal 3 campeões + 3 jogadores, adaptativo).
  context: {
    type: String,
    default: 'players'
  }
});

const emit = defineEmits(['search-success', 'search-start', 'search-error', 'show-overlay', 'hide-overlay', 'show-udyr', 'select-champion']);

// Sugestões existem sempre nos contextos de campeão/global; em 'players' respeitam
// a flag `autocomplete` (mantém o comportamento atual de quem não pediu dropdown).
const suggestEnabled = computed(() => props.context !== 'players' || props.autocomplete);

const placeholder = computed(() => {
  if (props.context === 'champions') return 'Buscar campeão (ex: Ahri)';
  if (props.context === 'global') return 'Campeão ou Nome#TAG';
  return 'Nome#TAG (ex: Kami#BR1)';
});

// Base da rota do perfil conforme a seção onde a busca acontece. Assim uma busca
// feita dentro de "Caçadas" (Histórico) leva ao histórico, dentro de "Visão"
// (Análise) leva às estatísticas e dentro da "Caverna dos Monos" FICA na maestria;
// nos demais lugares abre o seletor de /profile.
function sectionBase() {
  const p = router.currentRoute.value.path;
  if (p.startsWith('/historico')) return '/historico';
  if (p.startsWith('/analise')) return '/analise';
  if (p.startsWith('/mastery')) return '/mastery';
  return '/profile';
}

const inputEl = ref(null);
const inputQuery = ref(props.initialValue);
const loading = ref(false);
const localError = ref(null);

// ---- Autocomplete ----
const suggestions = ref([]);
const activeIndex = ref(-1);
const showSuggest = ref(false);
let debounceTimer = null;
let suggestToken = 0; // descarta respostas fora de ordem

watch(() => props.initialValue, (newVal) => {
  inputQuery.value = newVal;
});

function rankLabel(sug) {
  const tier = sug?.tier;
  if (tier && tier !== 'UNRANKED') return `${tier} ${sug.rank || ''}`.trim();
  const flex = sug?.flex_tier;
  if (flex && flex !== 'UNRANKED') return `${flex} ${sug.flex_rank || ''}`.trim();
  return '';
}

function suggestKey(sug) {
  return sug.type === 'champion' ? `champ-${sug.id}` : `player-${sug.game_name}-${sug.tag_line}`;
}

// Campeões que casam com o termo (prefixo > substring), como sugestões normalizadas.
function championMatches(termRaw, limit = 6) {
  const term = normalizeSearch(termRaw);
  if (!term) return [];
  const scored = [];
  for (const champ of state.staticData.championList || []) {
    const n = normalizeSearch(champ.name);
    let score = -1;
    if (n === term) score = 3;
    else if (n.startsWith(term)) score = 2;
    else if (n.includes(term)) score = 1;
    if (score >= 0) scored.push({ champ, score });
  }
  scored.sort((a, b) => b.score - a.score || a.champ.name.localeCompare(b.champ.name));
  return scored.slice(0, limit).map(({ champ }) => ({
    type: 'champion',
    id: champ.id || getChampionIdFromName(champ.name),
    name: champ.name
  }));
}

// Distribuição adaptativa: ideal 3+3, teto 6; o lado com sobra preenche o outro.
function mergeHybrid(champs, players, max = 6, idealEach = 3) {
  let nChamp = Math.min(idealEach, champs.length);
  let nPlayer = Math.min(idealEach, players.length);
  let slots = max - nChamp - nPlayer;
  const addChamp = Math.min(slots, champs.length - nChamp);
  nChamp += addChamp;
  slots -= addChamp;
  nPlayer += Math.min(slots, players.length - nPlayer);
  return [...champs.slice(0, nChamp), ...players.slice(0, nPlayer)];
}

function onInput() {
  if (!suggestEnabled.value) return;
  activeIndex.value = -1;
  // O texto pode conter "#TAG"; a parte antes do "#" é o termo de sugestão.
  const termo = inputQuery.value.split('#')[0].trim();
  clearTimeout(debounceTimer);
  if (termo.length < 1) {
    suggestions.value = [];
    showSuggest.value = false;
    return;
  }

  // Contexto SÓ campeões: resolução local e síncrona (sem gastar a chave da Riot).
  if (props.context === 'champions') {
    suggestions.value = championMatches(termo, 8);
    showSuggest.value = suggestions.value.length > 0;
    return;
  }

  const token = ++suggestToken;
  const champs = props.context === 'global' ? championMatches(termo) : [];

  debounceTimer = setTimeout(async () => {
    const players = await fetchPlayerSuggestions(termo);
    if (token !== suggestToken) return; // resposta obsoleta
    const playerSugs = (players || []).map((p) => ({ type: 'player', ...p }));
    suggestions.value = props.context === 'global'
      ? mergeHybrid(champs, playerSugs)
      : playerSugs;
    showSuggest.value = suggestions.value.length > 0;
  }, 180);
}

function moveActive(delta) {
  if (!showSuggest.value || !suggestions.value.length) return;
  const n = suggestions.value.length;
  activeIndex.value = (activeIndex.value + delta + n) % n;
}

function onEnter(e) {
  if (showSuggest.value && activeIndex.value >= 0) {
    e.preventDefault();
    selectSuggestion(suggestions.value[activeIndex.value]);
    return;
  }
  // Sem sugestão ativa: em contexto de campeão o Enter escolhe o 1º campeão da lista.
  if (props.context === 'champions' && suggestions.value.length) {
    e.preventDefault();
    selectSuggestion(suggestions.value[0]);
    return;
  }
  if (props.context === 'global' && !inputQuery.value.includes('#')) {
    const firstChamp = suggestions.value.find((s) => s.type === 'champion');
    if (firstChamp) {
      e.preventDefault();
      selectSuggestion(firstChamp);
    }
  }
  // Caso contrário deixa o submit natural do form disparar executeSearch (jogador).
}

function onFocus() {
  if (suggestEnabled.value && suggestions.value.length) showSuggest.value = true;
}

function onBlur() {
  // Pequeno atraso para permitir o clique (mousedown) numa sugestão.
  setTimeout(() => { showSuggest.value = false; }, 120);
}

function closeSuggestions() {
  showSuggest.value = false;
  activeIndex.value = -1;
}

function selectSuggestion(sug) {
  if (sug.type === 'champion') {
    closeSuggestions();
    suggestions.value = [];
    emit('select-champion', sug.id);
    // No modo global (topbar/home) a busca de campeão leva direto ao Panteão.
    if (props.context === 'global') router.push(`/champions/${sug.id}`);
    return;
  }
  inputQuery.value = `${sug.game_name}#${sug.tag_line}`;
  closeSuggestions();
  suggestions.value = [];
  executeSearch();
}

function onSubmit() {
  closeSuggestions();
  // Em contexto de campeão não há busca de perfil: escolhe o 1º campeão, se houver.
  if (props.context === 'champions') {
    if (suggestions.value.length) selectSuggestion(suggestions.value[0]);
    return;
  }
  // Global sem "#": se casar com campeão, abre o Panteão em vez de exigir Nome#TAG.
  if (props.context === 'global' && !inputQuery.value.includes('#')) {
    const firstChamp = championMatches(inputQuery.value.trim(), 1)[0];
    if (firstChamp) {
      selectSuggestion(firstChamp);
      return;
    }
  }
  executeSearch();
}

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

  // Orçamento global da API estourado: bloqueia antes de gastar a chave.
  // (Defesa rápida no front; o worker também recusa com 429 caso passe.)
  if (isRateBlocked()) {
    const g = state.telemetry.global;
    const secs = Math.max(0, Math.ceil((g.resetAt - Date.now()) / 1000));
    const espera = secs > 0 ? ` Tente em ~${secs}s.` : '';
    const msg = `Limite global da API da Riot atingido. Nenhuma busca pode ser feita agora.${espera}`;
    localError.value = msg;
    if (props.syncGlobalStore) state.searchProfile.error = msg;
    emit('search-error', msg);
    return;
  }

  loading.value = true;
  localError.value = null;
  // Liga a animação ÚNICA de busca (overlay guiado por state.searchProfile.loading).
  if (props.syncGlobalStore) state.searchProfile.loading = true;
  emit('search-start');

  try {
    const data = await workerRequest(props.action, { gameName, tagLine });
    const normalizedData = normalizeProfileData(data, gameName, tagLine);

    if (props.syncGlobalStore) {
      applyProfileToStore(normalizedData, { brief: props.action === 'profile_brief' });
    }

    emit('search-success', props.syncGlobalStore ? state.searchProfile : normalizedData);

    if (props.loadMasteries && normalizedData.puuid) {
      loadMasteriesInBackground(normalizedData.puuid, gameName, tagLine, data?.hadNewGames === true);
    }

    // Coloca o jogador buscado na URL para sobreviver ao refresh. A busca preserva
    // a SEÇÃO atual: em /historico cai na Caçada, em /analise cai na Visão; nas demais
    // (topbar/home) vai pro /profile (seletor Histórico ↔ Estatísticas).
    if (props.routeToProfile && normalizedData.puuid) {
      router.push(`${sectionBase()}/${encodeURIComponent(normalizedData.gameName)}/${encodeURIComponent(normalizedData.tagLine)}`);
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

onUnmounted(() => clearTimeout(debounceTimer));

// Exposto para animações externas (FLIP morph Home -> topbar).
defineExpose({ inputEl });
</script>
