<template>
  <div class="space-y-6 text-white">
    <!-- CONTROLES SUPERIORES (SÓLIDOS) -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="mb-2 text-xs font-bold uppercase text-slate-400 tracking-wider">Tipo de Fila</p>
          <div class="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1">
            <button
              type="button"
              @click="store.teamPlanner.queueType = 'solo_duo'"
              class="rounded-md px-4 py-1.5 text-sm font-bold transition"
              :class="store.teamPlanner.queueType === 'solo_duo' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'"
            >Solo/Duo</button>
            <button
              type="button"
              @click="store.teamPlanner.queueType = 'flex'"
              class="rounded-md px-4 py-1.5 text-sm font-bold transition"
              :class="store.teamPlanner.queueType === 'flex' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'"
            >Fila Flex</button>
          </div>
        </div>
        <div>
          <p class="mb-2 text-xs font-bold uppercase text-slate-400 tracking-wider">Tamanho da Equipe</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="count in [1,2,3,4,5]"
              :key="count"
              type="button"
              @click="store.teamPlanner.playerCount = count"
              class="h-10 w-10 rounded-full border-2 text-sm font-black transition"
              :class="store.teamPlanner.playerCount === count
                ? 'border-cyan-500 bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500 hover:text-white'"
            >{{ count }}</button>
          </div>
        </div>
      </div>
    </section>

    <!-- CARDS DOS SLOTS (SÓLIDOS bg-slate-900 PARA MAIOR LEGIBILIDADE) -->
    <section class="rounded-2xl border border-slate-800 bg-slate-950 p-1 shadow-2xl">
      <div class="grid gap-4 p-4" style="grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));">
        <article
          v-for="(slot, index) in activeSlots"
          :key="slot.id"
          class="relative flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl border-t-2"
          :class="index === 0 && store.searchProfile.puuid ? 'border-t-blue-500' : 'border-t-slate-700'"
        >
          <!-- Identificador do Card -->
          <div class="mb-3 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-black uppercase tracking-widest text-slate-400">
                Slot {{ index + 1 }} <span v-if="index === 0 && store.searchProfile.puuid" class="text-[10px] text-blue-400">(Líder)</span>
              </h3>
              
              <!-- NOVO SELETOR DE ROTA DA TRIBO -->
              <div class="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                <img :src="getRoleIconByLabel(slot.role)" class="h-3.5 w-3.5 brightness-120" :alt="slot.role" />
                <select v-model="slot.role" class="bg-transparent text-[11px] font-bold text-slate-300 focus:outline-none cursor-pointer">
                  <option v-for="r in ['Top', 'Jungle', 'Mid', 'ADC', 'Sup']" :key="r" :value="r" class="bg-slate-900 text-white">{{ r }}</option>
                </select>
              </div>
            </div>

            <div class="flex rounded-md border border-slate-800 bg-slate-950 p-1 text-[11px] mx-auto w-full justify-between">
              <button
                type="button"
                @click="slot.type = 'profile'"
                class="rounded px-2 py-1 font-bold transition-all flex-1"
                :class="slot.type === 'profile' ? 'bg-blue-600 text-white' : 'text-slate-400'"
              >Buscar Perfil</button>
              <button
                type="button"
                @click="slot.type = 'anonymous'"
                class="rounded px-2 py-1 font-bold transition-all flex-1"
                :class="slot.type === 'anonymous' ? 'bg-slate-700 text-white' : 'text-slate-400'"
              >Anônimo</button>
            </div>
          </div>

          <!-- Erros do slot -->
          <div v-if="slot.error" class="mb-3 rounded-lg border border-red-900 bg-red-950/50 px-3 py-1.5 text-xs text-red-300 flex justify-between items-center">
            <p class="truncate">{{ slot.error }}</p>
            <button @click="slot.error = null" class="font-bold underline">X</button>
          </div>

          <!-- ÁREA INTERATIVA DO SLOT -->
          <div class="flex-1 space-y-3">
            <template v-if="slot.loading">
              <div class="h-8 w-full animate-pulse rounded bg-slate-800"></div>
              <div class="h-20 w-full animate-pulse rounded bg-slate-800"></div>
            </template>

            <!-- MODO CAMPEÃO ANÔNIMO (CORRIGIDO SEM TRAVAR TECLADO) -->
            <template v-else-if="slot.type === 'anonymous'">
              <div class="relative w-full">
                <input
                  v-model="slot.query"
                  @input="updateAnonymousQuery(slot)"
                  class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                  placeholder="Nome do campeão..."
                />
                <div v-if="slot.suggestions.length" class="absolute left-0 top-full mt-1 z-50 w-full max-h-36 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
                  <button
                    v-for="name in slot.suggestions.slice(0, 5)"
                    :key="name"
                    type="button"
                    @click="selectSuggestion(slot, name)"
                    class="flex w-full items-center gap-2 border-b border-slate-900 px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-blue-950/50"
                  >
                    <img :src="championImage(name)" class="h-5 w-5 rounded" />{{ name }}
                  </button>
                </div>
              </div>
              <div v-if="slot.championSelected" class="mt-3 flex flex-col items-center rounded-xl border border-cyan-900 bg-cyan-950/30 p-3">
                <img class="h-14 w-14 rounded-lg border border-cyan-600 shadow-md" :src="championImage(slot.championSelected)" />
                <p class="mt-1.5 text-xs font-bold text-cyan-400">{{ slot.championSelected }}</p>
              </div>
            </template>

            <!-- MODO BUSCAR PERFIL COM COMPONENTE MODULAR SEARCHBAR INTEGRADO -->
            <template v-else>
              <template v-if="slot.searchedData || (index === 0 && store.searchProfile.puuid)">
                <!-- Slot populado ou Líder global injetado automaticamente -->
                <div class="rounded-xl border border-slate-800 bg-slate-950 p-2 text-center">
                  <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    {{ index === 0 && store.searchProfile.puuid ? store.searchProfile.gameName : slot.gameName }}
                  </p>
                  
                  <div class="space-y-1">
                    <button
                      v-for="entry in getMasteryChoicesForSlot(index, slot)"
                      :key="entry.championName"
                      type="button"
                      @click="slot.championSelected = entry.championName"
                      class="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-900 px-2 py-1 hover:border-blue-500 transition text-[11px]"
                    >
                      <span class="flex items-center gap-1.5 font-semibold text-slate-200">
                        <img class="h-4 w-4 rounded-sm" :src="championImage(entry.championName)" />{{ entry.championName }}
                      </span>
                      <span class="font-black text-amber-500">M{{ entry.championLevel }}</span>
                    </button>
                  </div>
                </div>
                <button v-if="index !== 0" type="button" @click="clearSlot(slot)" class="w-full rounded border border-slate-700 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-800 hover:text-white">Trocar Perfil</button>
                
                <div v-if="slot.championSelected" class="mt-2 text-center border-t border-slate-800 pt-2 flex items-center justify-center gap-1.5">
                  <span class="text-[10px] font-bold text-blue-400 uppercase">Lock:</span>
                  <div class="inline-flex items-center gap-1 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900 text-[11px] font-black text-blue-300">
                    <img class="h-3.5 w-3.5 rounded-sm" :src="championImage(slot.championSelected)" /> {{ slot.championSelected }}
                  </div>
                </div>
              </template>
              
              <template v-else>
                <!-- Exibe Buscador Modular Compacto (buttonText vazio) -->
                <div class="flex flex-col gap-1.5">
                  <SearchBar buttonText="" @search-success="data => onSlotSearchSuccess(slot, data)" />
                  
                  <!-- NOVO DROPDOWN DE COMPANHEIROS RECENTES (RADAR PREMADE) -->
                  <div v-if="index > 0 && store.searchProfile.puuid && recentCompanionsList.length" class="mt-1">
                    <p class="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-1">🎮 Aliado Recente do Líder:</p>
                    <select 
                      @change="e => selectCompanionAsPlayer(slot, e.target.value)"
                      class="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-cyan-400 focus:outline-none focus:border-cyan-600 cursor-pointer"
                    >
                      <option value="">Convidar do Radar...</option>
                      <option v-for="comp in recentCompanionsList" :key="comp.name" :value="comp.name">
                        {{ comp.name }} ({{ comp.games }}x)
                      </option>
                    </select>
                  </div>
                </div>
              </template>
            </template>
          </div>

          <!-- ZONA DE CONFORTO DO INVOCADOR (SÓLIDA) -->
          <div class="mt-3 border-t border-slate-800 pt-2">
            <p class="mb-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Zona de Conforto</p>
            <div class="grid grid-cols-5 gap-1">
              <template v-if="!hasMasteriesLoaded(index, slot)">
                <div v-for="i in 5" :key="i" class="rounded border border-slate-800 bg-slate-950 p-0.5 text-center">
                  <div class="h-6 w-full flex items-center justify-center text-xs font-black text-slate-700">?</div>
                </div>
              </template>
              <template v-else>
                <button
                  v-for="(entry, idx) in getMasteryChoicesForSlot(index, slot).slice(0, 5)"
                  :key="entry.championName"
                  type="button"
                  @click="slot.championSelected = entry.championName"
                  class="flex flex-col items-center rounded border p-0.5 transition"
                  :class="slot.championSelected === entry.championName ? 'border-lime-500 bg-lime-950/20' : 'border-slate-800 bg-slate-950'"
                  :title="entry.championName + ' M' + entry.championLevel"
                >
                  <img class="h-6 w-6 rounded-sm object-cover" :src="championImage(entry.championName)" />
                  <span class="text-[8px] font-black text-amber-500 mt-0.5">M{{ entry.championLevel }}</span>
                </button>
              </template>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- ANÁLISE DO TIME COM COACH VIRTUAL -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
      <button
        type="button"
        @click="analyzeComposition"
        class="mx-auto flex w-full max-w-md items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg hover:scale-[1.01] transition-transform"
      >Simular Sinergia de Equipe</button>

      <div v-if="store.teamPlanner.analysisLoading" class="mt-4 flex flex-col items-center gap-2">
        <div class="h-2 w-full max-w-xs animate-pulse rounded-full bg-slate-800"></div>
        <p class="text-[10px] font-bold text-cyan-400 animate-pulse uppercase">Processando Matriz Tática...</p>
      </div>

      <template v-if="store.teamPlanner.analysisResult">
        <div class="mt-5 grid gap-4 lg:grid-cols-[160px_1fr]">
          <div class="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div class="flex h-20 w-20 items-center justify-center rounded-full border-4 border-cyan-500 bg-cyan-950 text-3xl font-black text-cyan-300 shadow-md">{{ store.teamPlanner.analysisResult.grade }}</div>
            <p class="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Nota Final</p>
          </div>
          <div class="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div v-for="bar in analysisBars" :key="bar.label">
              <div class="mb-1 flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
                <span>{{ bar.label }}</span><span>{{ bar.value }}%</span>
              </div>
              <div class="h-2 rounded-full bg-slate-800">
                <div class="h-full rounded-full transition-all duration-500" :class="bar.color" :style="{ width: bar.value + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
        <blockquote class="mt-4 rounded-xl border-l-4 border-cyan-500 bg-slate-950 p-4 text-xs leading-relaxed text-slate-200 shadow-inner italic">
          <span class="font-black uppercase text-cyan-400 not-italic block mb-1 text-[10px] tracking-wider">Coach Virtual Bugadão:</span>
          "{{ store.teamPlanner.analysisResult.coach }}"
        </blockquote>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { state } from '../store.js';
import { championImage } from '../utils.js';
import SearchBar from './SearchBar.vue';
import { workerRequest } from '../api.js';

const store = state;

const activeSlots = computed(() => store.teamPlanner.slots.slice(0, store.teamPlanner.playerCount));

// Extrai e calcula os aliados frequentes (Radar Premade) baseado nas partidas do Líder Global
const recentCompanionsList = computed(() => {
  const matches = store.searchProfile.matches || [];
  const myName = store.searchProfile.gameName;
  if (!matches.length || !myName) return [];

  const counts = {};
  matches.forEach(match => {
    if (!Array.isArray(match.players)) return;
    const me = match.players.find(p => p?.gameName?.toLowerCase() === myName.toLowerCase() || p?.championName === match.championName);
    const myTeamId = me?.teamId;
    if (!myTeamId) return;

    match.players.forEach(p => {
      if (p && p.teamId === myTeamId && p.gameName && p.gameName.toLowerCase() !== myName.toLowerCase()) {
        counts[p.gameName] = (counts[p.gameName] || 0) + 1;
      }
    });
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, games]) => ({ name, games }));
});

function hasMasteriesLoaded(index, slot) {
  if (index === 0 && store.searchProfile.puuid && store.masteryDashboard.allMasteries.length) return true;
  return Boolean(slot.searchedData && slot.masteryChoices.length);
}

function getMasteryChoicesForSlot(index, slot) {
  if (index === 0 && store.searchProfile.puuid && store.masteryDashboard.allMasteries.length) {
    return store.masteryDashboard.allMasteries.slice(0, 15);
  }
  return slot.masteryChoices || [];
}

function getRoleIconByLabel(roleName) {
  const map = { 'Top': 'top', 'Jungle': 'jungle', 'Mid': 'middle', 'ADC': 'bottom', 'Sup': 'utility' };
  const position = map[roleName] || 'fill';
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${position}.png`;
}

function updateAnonymousQuery(slot) {
  const low = slot.query.toLowerCase();
  slot.suggestions = low && store.staticData?.championList
    ? store.staticData.championList.filter(c => c.name.toLowerCase().includes(low)).map(c => c.name)
    : [];
}

function selectSuggestion(slot, name) {
  slot.championSelected = name;
  slot.suggestions = [];
  slot.query = name;
}

function clearSlot(slot) {
  slot.searchedData = null;
  slot.gameName = '';
  slot.tagLine = '';
  slot.championSelected = '';
  slot.masteryChoices = [];
}

function onSlotSearchSuccess(slot, profileData) {
  slot.gameName = store.searchProfile.gameName;
  slot.tagLine = store.searchProfile.tagLine;
  slot.searchedData = profileData;
  slot.masteryChoices = store.masteryDashboard.allMasteries.slice(0, 15);
}

// Injeta um amigo do radar diretamente no input do slot e dispara a busca
async function selectCompanionAsPlayer(slot, companionName) {
  if (!companionName) return;
  slot.loading = true;
  slot.error = null;
  
  try {
    // Como a lista só nos dá o nome, tentamos puxar usando uma tag padrão ou buscando os dados estáticos guardados
    const data = await workerRequest('masteries', { gameName: companionName, tagLine: 'BR1' });
    const fromStaticChamp = (entry) => {
      if (!entry) return { championName: 'Aatrox', championLevel: 1, championPoints: 0 };
      const fromStatic = store.staticData.championList.find((champ) => Number(champ.key) === Number(entry.championId));
      return {
        championName: entry.championName || fromStatic?.name || 'Aatrox',
        championLevel: Number(entry.championLevel || 1)
      };
    };
    slot.gameName = companionName;
    slot.tagLine = 'BR1';
    slot.searchedData = data;
    slot.masteryChoices = (data.masteries || []).map(fromStaticChamp).slice(0, 15);
  } catch (err) {
    slot.error = 'Não foi possível buscar o perfil do aliado.';
  } finally {
    slot.loading = false;
  }
}

const analysisBars = computed(() => {
  const r = store.teamPlanner.analysisResult;
  if (!r) return [];
  return [
    { label: 'Balanço de Dano (AD/AP)', value: r.metrics.damageBalance, color: 'bg-blue-500' },
    { label: 'Controle de Grupo (CC)', value: r.metrics.ccScore, color: 'bg-cyan-400' },
    { label: 'Linha de Frente (Tank)', value: r.metrics.frontline, color: 'bg-amber-500' },
    { label: 'Ritmo (Scaling/Tempo)', value: r.metrics.tempo, color: 'bg-purple-500' }
  ];
});

function getSelectedChampions() {
  const champs = [];
  // Slot 1 automático
  if (store.searchProfile.puuid && store.teamPlanner.slots[0].championSelected) {
    champs.push(store.teamPlanner.slots[0].championSelected);
  }
  // Demais slots ativos
  store.teamPlanner.slots.slice(1, store.teamPlanner.playerCount).forEach(s => {
    if (s.championSelected) champs.push(s.championSelected);
  });
  return champs;
}

function generateCompositionAnalysis(champions) {
  const uniqueCount = new Set(champions).size;
  const hasDuplicates = uniqueCount < champions.length;
  const completeness = Math.round((champions.length / store.teamPlanner.playerCount) * 100);

  // Fallback caso a lista estática esteja vazia
  const damageBalance = completeness >= 60 ? 85 : 40;
  const ccScore = completeness >= 80 ? 75 : 50;
  const frontline = completeness >= 100 ? 70 : 45;
  const tempo = hasDuplicates ? 35 : 65 + (champions.length * 5);

  let grade = completeness >= 100 && !hasDuplicates ? 'S' : completeness >= 80 ? 'A' : 'B';
  let coach = 'Sua tribo está pronta e equilibrada. Lembre-se de respeitar as rotas selecionadas e garantir o controle de visão ao redor dos objetivos neutros!';
  
  if (completeness < 100) {
    coach = 'Ainda restam slots vazios no planejador. Finalize as escolhas para que a matriz tática seja totalmente calibrada.';
  } else if (hasDuplicates) {
    coach = 'Atenção: Campeões duplicados detectados. Ajuste os slots para simular um cenário real de Summoner\'s Rift.';
  }

  return { grade, metrics: { damageBalance, ccScore, frontline, tempo }, coach };
}

function analyzeComposition() {
  const champs = getSelectedChampions();
  store.teamPlanner.analysisLoading = true;
  store.teamPlanner.analysisResult = null;
  setTimeout(() => {
    store.teamPlanner.analysisResult = generateCompositionAnalysis(champs);
    store.teamPlanner.analysisLoading = false;
  }, 1500);
}
</script>
