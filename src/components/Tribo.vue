<template>
  <div class="space-y-6 text-white">
    <section class="rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-5 shadow-xl">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-black tracking-wide text-amber-300">TRIBO PERFEITA</h2>
          <p class="text-xs text-slate-400">Escolha a modalidade e monte seu lobby tatico.</p>
        </div>
        <button
          v-if="viewMode !== 'entry'"
          type="button"
          @click="viewMode = 'entry'"
          class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white"
        >Voltar</button>
      </div>
    </section>

    <section
      v-if="viewMode === 'entry'"
      class="rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-6 shadow-xl"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          @click="selectMode('ranked')"
          class="group rounded-2xl border border-amber-700/50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-left transition hover:scale-[1.01] hover:border-amber-500"
        >
          <p class="text-xs font-black tracking-[0.2em] text-amber-400">MODO RANQUEADO</p>
          <p class="mt-2 text-2xl font-black text-slate-100">Solo/Duo ou Flex</p>
          <p class="mt-2 text-sm text-slate-400">Saguão oficial com slots verticais, picks e rota fixa.</p>
        </button>

        <button
          type="button"
          @click="selectMode('custom')"
          class="group rounded-2xl border border-amber-700/50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-left transition hover:scale-[1.01] hover:border-amber-500"
        >
          <p class="text-xs font-black tracking-[0.2em] text-amber-400">PARTIDA CUSTOMIZADA</p>
          <p class="mt-2 text-2xl font-black text-slate-100">5v5 Classico</p>
          <p class="mt-2 text-sm text-slate-400">Gerencie dois times, reservas e sorteio balanceado com re-roll.</p>
        </button>
      </div>
    </section>

    <section
      v-if="viewMode === 'ranked'"
      class="space-y-4 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-5 shadow-xl"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1">
          <button
            type="button"
            @click="queueType = 'solo_duo'"
            class="rounded-md px-4 py-1.5 text-xs font-black transition"
            :class="queueType === 'solo_duo' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'"
          >Solo/Duo</button>
          <button
            type="button"
            @click="queueType = 'flex'"
            class="rounded-md px-4 py-1.5 text-xs font-black transition"
            :class="queueType === 'flex' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'"
          >Flex</button>
        </div>

        <button
          type="button"
          @click="findPerfectTribe"
          class="rounded-lg bg-gradient-to-r from-amber-600 to-orange-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg hover:brightness-110"
        >Encontrar Tribo Perfeita</button>
      </div>

      <div v-if="synergyResult" class="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-3 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-black uppercase tracking-wider text-emerald-300">Sinergia do Time</p>
          <p class="font-black text-emerald-200">Score: {{ synergyResult.score }}/100</p>
        </div>
        <p class="mt-1 text-[11px] text-slate-300">Gerado às {{ synergyResult.generatedAt }} • Aderência por rota: {{ synergyResult.roleMatch }}</p>
        <div class="mt-2 flex flex-wrap gap-1">
          <span
            v-for="tag in synergyResult.topTags"
            :key="tag.tag"
            class="rounded border border-emerald-700/40 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
          >
            {{ tag.tag }} ({{ tag.count }})
          </span>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article
          v-for="(slot, slotIndex) in activeRankedSlots"
          :key="slot.id"
          class="relative flex min-h-[360px] flex-col rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-3"
        >
          <div class="flex items-center justify-between">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Slot {{ slotIndex + 1 }}</p>
            <button
              v-if="slot.gameName"
              type="button"
              @click="resetRankedSlot(slot.id)"
              class="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-white"
            >Limpar</button>
          </div>

          <div class="mt-3 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
            <template v-if="!slot.gameName">
              <button
                type="button"
                @click="slot.showSearch = !slot.showSearch"
                class="flex h-16 w-16 items-center justify-center rounded-full border border-amber-700 bg-slate-900 text-3xl font-black text-amber-400 hover:bg-slate-800"
              >+</button>

              <div v-if="slot.showSearch" class="w-full">
                <SearchBar
                  buttonText=""
                  @search-start="onRankedSearchStart(slot.id)"
                  @search-success="(data) => onRankedSearchSuccess(slot.id, data)"
                  @search-error="(msg) => onRankedSearchError(slot.id, msg)"
                />
              </div>

              <p v-if="slot.loading" class="text-[11px] font-bold text-amber-300">Carregando invocador...</p>
              <p v-if="slot.error" class="text-[10px] font-bold text-red-400">{{ slot.error }}</p>

              <button
                type="button"
                @click="setAnonymous(slot.id)"
                class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white"
              >Anônimo</button>
            </template>

            <template v-else>
              <img
                class="h-16 w-16 rounded-full border-2 border-slate-700 object-cover"
                :src="profileIconImage(slot.profileIconId || 29)"
                @error="(e) => e.target.src = profileIconImage(29)"
                alt="Icone"
              />
              <p class="text-sm font-black text-slate-100">{{ slot.gameName }}</p>
              <p class="text-[10px] font-bold text-slate-500">#{{ slot.tagLine || 'BR1' }}</p>
              <p v-if="slot.masteriesLoading" class="text-[10px] font-bold text-amber-400 animate-pulse">Sincronizando maestrias...</p>

              <div class="grid w-full gap-1 text-[10px]">
                <p class="rounded border border-slate-800 bg-slate-900/70 px-2 py-1 font-bold text-cyan-300">
                  Solo: {{ slot.statsSolo?.tier && slot.statsSolo?.tier !== 'UNRANKED' ? `${slot.statsSolo.tier} ${slot.statsSolo.rank || ''}`.trim() : 'UNRANKED' }}
                </p>
                <p class="rounded border border-slate-800 bg-slate-900/70 px-2 py-1 font-bold text-purple-300">
                  Flex: {{ slot.statsFlex?.tier && slot.statsFlex?.tier !== 'UNRANKED' ? `${slot.statsFlex.tier} ${slot.statsFlex.rank || ''}`.trim() : 'UNRANKED' }}
                </p>
              </div>

              <button
                type="button"
                @click="openChampionModal(slot.id)"
                class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-500"
              >
                {{ slot.championLocked ? `Pick: ${slot.championLocked}` : 'Selecionar Campeão' }}
              </button>

              <div class="w-full rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                <p class="text-[10px] font-black uppercase tracking-wider text-amber-400">Top 10 Maestria</p>
                <div class="mt-1 flex flex-wrap gap-1">
                  <span
                    v-for="entry in slot.masteries.slice(0, 10)"
                    :key="`${slot.id}-${entry.championId}`"
                    class="rounded border border-amber-700/40 bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold text-amber-200"
                  >
                    {{ entry.championName }}
                  </span>
                </div>
              </div>

              <div class="grid w-full grid-cols-5 gap-1">
                <button
                  v-for="role in roles"
                  :key="`${slot.id}-${role.value}`"
                  type="button"
                  @click="slot.role = role.value"
                  class="flex h-8 items-center justify-center rounded-full border transition"
                  :class="slot.role === role.value ? 'border-amber-500 bg-amber-500/20' : 'border-slate-700 bg-slate-900'"
                  :title="role.label"
                >
                  <img class="h-4 w-4" :src="role.icon" :alt="role.label" />
                </button>
              </div>
            </template>
          </div>
        </article>
      </div>
    </section>

    <section
      v-if="viewMode === 'custom'"
      class="space-y-4 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-5 shadow-xl"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Saguão de Torneio 5v5</p>
          <p class="text-[11px] text-slate-500">Arraste jogadores entre Time Azul, Time Vermelho e Reserva.</p>
        </div>
        <button
          type="button"
          @click="drawBalancedTeams"
          class="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg hover:brightness-110"
        >FESTA DA FOGUEIRA (Sortear)</button>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1fr_auto_1fr]">
        <div class="space-y-2 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-2 sm:p-3">
          <p class="text-xs font-black uppercase tracking-wider text-cyan-300">Time Azul</p>
          <div class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 sm:space-y-2 xl:max-h-none xl:overflow-visible">
            <div v-for="slot in blueSlots" :key="slot.id">
              <CustomSlotCard
                :slot="slot"
                @search="searchCustomSlot"
                @clear="clearCustomSlot"
                @dragstart="onDragStart"
                @drop="onDropToSlot"
              />
            </div>
          </div>
        </div>

        <div class="hidden w-px bg-slate-700/70 xl:block"></div>

        <div class="space-y-2 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-2 sm:p-3">
          <p class="text-xs font-black uppercase tracking-wider text-red-300">Time Vermelho</p>
          <div class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 sm:space-y-2 xl:max-h-none xl:overflow-visible">
            <div v-for="slot in redSlots" :key="slot.id">
              <CustomSlotCard
                :slot="slot"
                @search="searchCustomSlot"
                @clear="clearCustomSlot"
                @dragstart="onDragStart"
                @drop="onDropToSlot"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-3">
        <p class="mb-2 text-xs font-black uppercase tracking-wider text-slate-300">Banco de Reservas</p>
        <div class="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <div v-for="slot in reserveSlots" :key="slot.id">
            <CustomSlotCard
              :slot="slot"
              @search="searchCustomSlot"
              @clear="clearCustomSlot"
              @dragstart="onDragStart"
              @drop="onDropToSlot"
            />
          </div>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
          <p class="font-black text-cyan-300">MMR Time Azul: {{ blueMmr }}</p>
          <p class="text-slate-400">Jogadores: {{ blueFilledCount }}/5</p>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
          <p class="font-black text-red-300">MMR Time Vermelho: {{ redMmr }}</p>
          <p class="text-slate-400">Jogadores: {{ redFilledCount }}/5</p>
        </div>
      </div>
      <p class="text-center text-xs font-bold" :class="mmrDiff <= 120 ? 'text-emerald-400' : 'text-amber-400'">
        Diferença de MMR: {{ mmrDiff }}
      </p>
    </section>

    <div
      v-if="championModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      @click.self="closeChampionModal"
    >
      <div class="max-h-[85vh] w-full max-w-4xl rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-lg font-black text-amber-300">Escolher Campeão</h3>
          <button type="button" class="rounded border border-slate-700 px-2 py-1 text-xs font-bold" @click="closeChampionModal">Fechar</button>
        </div>
        <input
          v-model="championModal.query"
          class="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          placeholder="Filtrar campeão..."
        />
        <div class="max-h-[64vh] overflow-y-auto">
          <p v-if="currentModalTop10.length" class="mb-2 text-xs font-black uppercase tracking-wider text-amber-400">Top 10 Maestria</p>
          <div class="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <button
              v-for="champ in filteredTop10"
              :key="`top-${champ}`"
              type="button"
              @click="lockChampionFromModal(champ)"
              class="flex items-center gap-2 rounded-lg border border-amber-700/50 bg-slate-950 px-2 py-1.5 text-left text-xs font-semibold hover:border-amber-400"
            >
              <img class="h-7 w-7 rounded" :src="championImage(champ)" @error="onChampionImageError" :alt="champ" />
              <span class="truncate">{{ champ }}</span>
            </button>
          </div>

          <p class="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Lista Completa</p>
          <div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <button
              v-for="champ in filteredAllChampions"
              :key="champ"
              type="button"
              @click="lockChampionFromModal(champ)"
              class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-left text-xs font-semibold hover:border-cyan-500"
            >
              <img class="h-7 w-7 rounded" :src="championImage(champ)" @error="onChampionImageError" :alt="champ" />
              <span class="truncate">{{ champ }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import SearchBar from './SearchBar.vue';
import { state } from '../store.js';
import { workerRequest } from '../api.js';
import { championImage, profileIconImage, getChampionIdFromName, DDRAGON_VERSION } from '../utils.js';

const store = state;
const viewMode = ref('entry');
const queueType = ref('solo_duo');
const rerollSeed = ref(0);
const draggedSlotId = ref(null);
const synergyResult = ref(null);

const roles = [
  { value: 'TOP', label: 'Top', icon: roleIcon('top') },
  { value: 'JUNGLE', label: 'Jungle', icon: roleIcon('jungle') },
  { value: 'MID', label: 'Mid', icon: roleIcon('middle') },
  { value: 'ADC', label: 'ADC', icon: roleIcon('bottom') },
  { value: 'SUP', label: 'Sup', icon: roleIcon('utility') }
];

const rankedSlots = reactive(Array.from({ length: 5 }, (_, i) => createRankedSlot(i + 1)));
const customSlots = reactive(Array.from({ length: 15 }, (_, i) => createCustomSlot(i + 1)));

const championModal = reactive({
  open: false,
  slotId: null,
  query: ''
});

const activeRankedSlots = computed(() => rankedSlots.slice(0, queueType.value === 'solo_duo' ? 2 : 5));
const blueSlots = computed(() => customSlots.slice(0, 5));
const redSlots = computed(() => customSlots.slice(5, 10));
const reserveSlots = computed(() => customSlots.slice(10, 15));

const blueFilledCount = computed(() => blueSlots.value.filter((slot) => slot.gameName).length);
const redFilledCount = computed(() => redSlots.value.filter((slot) => slot.gameName).length);
const blueMmr = computed(() => blueSlots.value.reduce((sum, slot) => sum + mmrWeight(slot), 0));
const redMmr = computed(() => redSlots.value.reduce((sum, slot) => sum + mmrWeight(slot), 0));
const mmrDiff = computed(() => Math.abs(blueMmr.value - redMmr.value));

const currentModalSlot = computed(() => rankedSlots.find((slot) => slot.id === championModal.slotId) || null);
const currentModalTop10 = computed(() => {
  const slot = currentModalSlot.value;
  if (!slot || slot.type !== 'real') return [];
  return slot.masteries.slice(0, 10).map((entry) => entry.championName);
});

const currentModalAllChampions = computed(() => {
  const slot = currentModalSlot.value;
  const allNames = (store.staticData.championList || []).map((champ) => champ.name).sort((a, b) => a.localeCompare(b));
  if (!slot || slot.type !== 'real') return allNames;
  const topSet = new Set(currentModalTop10.value);
  return allNames.filter((name) => !topSet.has(name));
});

const filteredTop10 = computed(() => {
  const q = championModal.query.trim().toLowerCase();
  return q ? currentModalTop10.value.filter((name) => name.toLowerCase().includes(q)) : currentModalTop10.value;
});

const filteredAllChampions = computed(() => {
  const q = championModal.query.trim().toLowerCase();
  return q ? currentModalAllChampions.value.filter((name) => name.toLowerCase().includes(q)) : currentModalAllChampions.value;
});

function createRankedSlot(id) {
  return {
    id,
    type: 'empty',
    showSearch: false,
    loading: false,
    masteriesLoading: false,
    error: null,
    gameName: '',
    tagLine: '',
    profileIconId: 29,
    statsSolo: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    statsFlex: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    role: roles[id - 1]?.value || 'MID',
    championLocked: '',
    masteries: []
  };
}

function createCustomSlot(id) {
  return {
    id,
    rawInput: '',
    showSearch: false,
    loading: false,
    error: null,
    gameName: '',
    tagLine: '',
    profileIconId: 29,
    statsSolo: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    statsFlex: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    manualTier: '',
    manualRank: '',
    manualLp: '',
    manualWinRate: ''
  };
}

function roleIcon(roleKey) {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${roleKey}.png`;
}

function selectMode(mode) {
  viewMode.value = mode;
}

function resetRankedSlot(slotId) {
  const idx = rankedSlots.findIndex((slot) => slot.id === slotId);
  if (idx === -1) return;
  const role = rankedSlots[idx].role;
  rankedSlots[idx] = { ...createRankedSlot(slotId), role };
}

function setAnonymous(slotId) {
  const slot = rankedSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.type = 'anonymous';
  slot.showSearch = false;
  slot.loading = false;
  slot.masteriesLoading = false;
  slot.error = null;
  slot.gameName = 'Invocador Anonimo';
  slot.tagLine = 'OFFLINE';
  slot.profileIconId = 29;
  slot.championLocked = '';
  slot.masteries = [];
}

function onRankedSearchStart(slotId) {
  const slot = rankedSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.loading = true;
  slot.error = null;
  slot.showSearch = true;
}

async function onRankedSearchSuccess(slotId, profileData) {
  const slot = rankedSlots.find((item) => item.id === slotId);
  if (!slot) return;

  slot.loading = false;
  slot.error = null;
  slot.showSearch = false;
  slot.type = 'real';
  slot.gameName = profileData?.gameName || store.searchProfile.gameName;
  slot.tagLine = profileData?.tagLine || store.searchProfile.tagLine;
  slot.profileIconId = profileData?.profileIconId || store.searchProfile.profileIconId || 29;
  slot.statsSolo = profileData?.statsSolo || store.searchProfile.statsSolo;
  slot.statsFlex = profileData?.statsFlex || store.searchProfile.statsFlex;
  slot.masteriesLoading = true;

  loadRankedMasteries(slot, profileData)
    .finally(() => {
      slot.masteriesLoading = false;
    });
}

function onRankedSearchError(slotId, message) {
  const slot = rankedSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.loading = false;
  slot.masteriesLoading = false;
  slot.showSearch = true;
  slot.error = message;
}

async function loadRankedMasteries(slot, profileData) {
  try {
    const masteryData = await withTimeout(
      workerRequest('masteries', {
        puuid: profileData?.puuid || store.searchProfile.puuid,
        gameName: slot.gameName,
        tagLine: slot.tagLine
      }),
      7000
    );
    slot.masteries = normalizeMasteries(masteryData?.masteries || []);
  } catch (error) {
    slot.masteries = [];
    console.warn('Masteries do slot nao carregaram a tempo:', error?.message || error);
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout ao carregar maestrias.')), timeoutMs);
    })
  ]);
}

function openChampionModal(slotId) {
  championModal.open = true;
  championModal.slotId = slotId;
  championModal.query = '';
}

function closeChampionModal() {
  championModal.open = false;
  championModal.slotId = null;
  championModal.query = '';
}

function lockChampionFromModal(championName) {
  const slot = rankedSlots.find((item) => item.id === championModal.slotId);
  if (!slot) return;
  slot.championLocked = championName;
  closeChampionModal();
}

function normalizeMasteries(list) {
  return (list || []).map((entry) => {
    const staticEntry = (store.staticData.championList || []).find((champ) => Number(champ.key) === Number(entry?.championId));
    return {
      championId: entry?.championId,
      championName: entry?.championName || staticEntry?.name || 'Aatrox',
      championLevel: Number(entry?.championLevel || 1),
      championPoints: Number(entry?.championPoints || 0)
    };
  });
}

function championTags(name) {
  const champ = (store.staticData.championList || []).find((entry) => entry.name === name);
  return champ?.tags || [];
}

function roleDesiredTags(role) {
  const map = {
    TOP: ['Fighter', 'Tank'],
    JUNGLE: ['Fighter', 'Assassin'],
    MID: ['Mage', 'Assassin'],
    ADC: ['Marksman'],
    SUP: ['Support', 'Tank']
  };
  return map[role] || [];
}

function findPerfectTribe() {
  const slots = activeRankedSlots.value;
  const locked = slots.filter((slot) => slot.championLocked).map((slot) => slot.championLocked);
  const lockedSet = new Set(locked);
  const lockedTags = new Set(locked.flatMap((champ) => championTags(champ)));

  for (const slot of slots) {
    if (slot.championLocked) continue;

    const poolFromMastery = slot.masteries.map((entry) => entry.championName);
    const allChampionsPool = (store.staticData.championList || []).map((entry) => entry.name);
    const basePool = slot.type === 'real' && poolFromMastery.length ? poolFromMastery : allChampionsPool;

    let bestChampion = '';
    let bestScore = -Infinity;

    for (const candidate of basePool) {
      if (!candidate) continue;
      let score = 0;
      if (lockedSet.has(candidate)) score -= 100;

      const tags = championTags(candidate);
      const desired = roleDesiredTags(slot.role);
      if (desired.some((tag) => tags.includes(tag))) score += 30;

      for (const tag of tags) {
        if (!lockedTags.has(tag)) score += 6;
      }

      const masteryIndex = basePool.indexOf(candidate);
      if (masteryIndex >= 0) score += Math.max(0, 20 - masteryIndex);
      score += Math.random() * 3;

      if (score > bestScore) {
        bestScore = score;
        bestChampion = candidate;
      }
    }

    if (bestChampion) {
      slot.championLocked = bestChampion;
      lockedSet.add(bestChampion);
      for (const tag of championTags(bestChampion)) {
        lockedTags.add(tag);
      }
    }
  }

  synergyResult.value = summarizeRankedSynergy(slots);
}

function summarizeRankedSynergy(slots) {
  const picks = slots
    .filter((slot) => slot.championLocked)
    .map((slot) => ({ role: slot.role, champion: slot.championLocked }));

  const tagCount = {};
  let roleMatch = 0;

  for (const pick of picks) {
    const tags = championTags(pick.champion);
    const desired = roleDesiredTags(pick.role);
    if (desired.some((tag) => tags.includes(tag))) roleMatch += 1;

    for (const tag of tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }

  const uniqueTags = Object.keys(tagCount).length;
  const rawScore = (uniqueTags * 12) + (roleMatch * 15) + (picks.length * 8);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, count }));

  return {
    score,
    roleMatch,
    topTags,
    generatedAt: new Date().toLocaleTimeString('pt-BR')
  };
}

async function searchCustomSlot(slotId) {
  const slot = customSlots.find((item) => item.id === slotId);
  if (!slot) return;

  const query = slot.rawInput?.trim() || '';
  const [nameRaw, tagRaw] = query.split('#');
  const gameName = (nameRaw || '').trim();
  const tagLine = (tagRaw || '').trim();
  if (!gameName || !tagLine) {
    slot.error = 'Use Nome#TAG.';
    slot.showSearch = true;
    return;
  }

  slot.loading = true;
  slot.error = null;
  try {
    const data = await workerRequest('profile_overview', { gameName, tagLine });
    slot.gameName = data?.gameName || gameName;
    slot.tagLine = data?.tagLine || tagLine;
    slot.profileIconId = data?.profileIconId || 29;
    slot.statsSolo = data?.statsSolo || slot.statsSolo;
    slot.statsFlex = data?.statsFlex || slot.statsFlex;
    slot.manualTier = slot.manualTier || slot.statsSolo?.tier || 'UNRANKED';
    slot.manualRank = slot.manualRank || slot.statsSolo?.rank || 'IV';
    slot.manualLp = String(slot.statsSolo?.lp || 0);
    slot.manualWinRate = String(slot.statsSolo?.winRate || 0);
    slot.showSearch = false;
  } catch (error) {
    slot.error = error?.message || 'Erro ao buscar jogador.';
    slot.showSearch = true;
  } finally {
    slot.loading = false;
  }
}

function clearCustomSlot(slotId) {
  const idx = customSlots.findIndex((item) => item.id === slotId);
  if (idx === -1) return;
  customSlots[idx] = createCustomSlot(slotId);
}

function onDragStart(slotId) {
  draggedSlotId.value = slotId;
}

function onDropToSlot(targetSlotId) {
  const from = draggedSlotId.value;
  if (!from || from === targetSlotId) return;

  const fromIdx = customSlots.findIndex((slot) => slot.id === from);
  const toIdx = customSlots.findIndex((slot) => slot.id === targetSlotId);
  if (fromIdx === -1 || toIdx === -1) return;

  const tmp = { ...customSlots[fromIdx] };
  customSlots[fromIdx] = { ...customSlots[toIdx], id: customSlots[fromIdx].id };
  customSlots[toIdx] = { ...tmp, id: customSlots[toIdx].id };
  draggedSlotId.value = null;
}

function mmrWeight(slot) {
  if (!slot.gameName) return 0;
  const tierWeights = {
    IRON: 100,
    BRONZE: 300,
    SILVER: 500,
    GOLD: 700,
    PLATINUM: 900,
    EMERALD: 1100,
    DIAMOND: 1300,
    MASTER: 1600,
    GRANDMASTER: 1800,
    CHALLENGER: 2000,
    UNRANKED: 400
  };
  const rankBonus = { I: 75, II: 50, III: 25, IV: 0 };

  const tier = String(slot.manualTier || slot.statsSolo?.tier || 'UNRANKED').toUpperCase();
  const rank = String(slot.manualRank || slot.statsSolo?.rank || 'IV').toUpperCase();
  const lp = Number(slot.manualLp || slot.statsSolo?.lp || 0);

  return (tierWeights[tier] || 400) + (rankBonus[rank] || 0) + lp;
}

function teamMmr(slots) {
  return slots.reduce((sum, slot) => sum + mmrWeight(slot), 0);
}

function combinations(items, choose, start = 0, prefix = [], output = []) {
  if (prefix.length === choose) {
    output.push([...prefix]);
    return output;
  }
  for (let i = start; i < items.length; i += 1) {
    prefix.push(items[i]);
    combinations(items, choose, i + 1, prefix, output);
    prefix.pop();
  }
  return output;
}

function drawBalancedTeams() {
  rerollSeed.value += 1;
  const allFilled = customSlots.filter((slot) => slot.gameName);
  if (allFilled.length < 2) return;

  const shuffled = [...allFilled]
    .map((slot) => ({ slot, seed: Math.random() + rerollSeed.value * 0.01 }))
    .sort((a, b) => a.seed - b.seed)
    .map((item) => item.slot);

  const selectedTen = shuffled.slice(0, 10);
  const reserves = shuffled.slice(10);

  const combos = combinations(selectedTen, Math.floor(selectedTen.length / 2));
  let bestBlue = [];
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const blueCandidate of combos) {
    const blueSet = new Set(blueCandidate.map((slot) => slot.id));
    const redCandidate = selectedTen.filter((slot) => !blueSet.has(slot.id));
    if (redCandidate.length !== blueCandidate.length) continue;

    const diff = Math.abs(teamMmr(blueCandidate) - teamMmr(redCandidate));
    const randomNudge = Math.random() * 10;
    if (diff + randomNudge < bestDiff) {
      bestDiff = diff + randomNudge;
      bestBlue = blueCandidate;
    }
  }

  const blueSet = new Set(bestBlue.map((slot) => slot.id));
  const bestRed = selectedTen.filter((slot) => !blueSet.has(slot.id)).slice(0, 5);
  const blueFinal = bestBlue.slice(0, 5);
  const reserveFinal = [...reserves].slice(0, 5);

  const ordered = [...blueFinal, ...bestRed, ...reserveFinal];
  while (ordered.length < 15) {
    ordered.push(createCustomSlot(ordered.length + 1));
  }

  for (let i = 0; i < 15; i += 1) {
    const base = ordered[i] || createCustomSlot(i + 1);
    customSlots[i] = { ...createCustomSlot(i + 1), ...base, id: i + 1 };
  }
}

function fallbackChampionUrl() {
  const fallbackId = encodeURIComponent(getChampionIdFromName('Aatrox'));
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${fallbackId}.png`;
}

function onChampionImageError(event) {
  const target = event?.target;
  if (!target) return;
  target.src = fallbackChampionUrl();
}

const CustomSlotCard = {
  props: {
    slot: { type: Object, required: true }
  },
  emits: ['search', 'clear', 'dragstart', 'drop'],
  data() {
    return {
      ddragonVersion: DDRAGON_VERSION,
      tierOptions: ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'],
      rankOptions: ['I', 'II', 'III', 'IV']
    };
  },
  template: `
    <div
      class="rounded-xl border border-slate-800 bg-slate-950/70 p-2"
      :draggable="Boolean(slot.gameName)"
      @dragstart="$emit('dragstart', slot.id)"
      @dragover.prevent
      @drop="$emit('drop', slot.id)"
    >
      <div class="flex items-center gap-2">
        <img
          class="h-7 w-7 rounded border border-slate-700 object-cover sm:h-8 sm:w-8"
          :src="slot.gameName ? 'https://ddragon.leagueoflegends.com/cdn/' + ddragonVersion + '/img/profileicon/' + (slot.profileIconId || 29) + '.png' : 'https://ddragon.leagueoflegends.com/cdn/' + ddragonVersion + '/img/profileicon/29.png'"
          alt="icone"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-[11px] font-bold text-slate-200 sm:text-xs">{{ slot.gameName || 'Slot vazio' }}</p>
          <p class="text-[9px] text-slate-500 sm:text-[10px]">{{ slot.tagLine ? '#' + slot.tagLine : 'Adicione um jogador' }}</p>
        </div>
        <button
          v-if="slot.gameName || slot.showSearch"
          type="button"
          class="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-white"
          @click="$emit('clear', slot.id)"
        >X</button>
        <button
          v-else
          type="button"
          class="rounded border border-amber-700 bg-slate-900 px-2 py-0.5 text-[11px] font-black text-amber-400 hover:bg-slate-800"
          @click="slot.showSearch = true"
        >[+]</button>
      </div>

      <div v-if="slot.gameName || slot.showSearch" class="mt-2 flex gap-1">
        <input
          v-model="slot.rawInput"
          class="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white placeholder:text-slate-500"
          placeholder="Nome#TAG"
        />
        <button
          type="button"
          class="rounded border border-cyan-700 bg-cyan-900/40 px-2 py-1 text-[10px] font-black text-cyan-300 hover:bg-cyan-900/60"
          @click="$emit('search', slot.id)"
        >Buscar</button>
        <button
          v-if="!slot.gameName"
          type="button"
          class="rounded border border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white"
          @click="slot.showSearch = false"
        >Fechar</button>
      </div>

      <p v-if="slot.loading" class="mt-1 text-[10px] font-bold text-cyan-300 animate-pulse">Buscando invocador...</p>

      <details class="mt-2 rounded border border-slate-800 bg-slate-900/50 px-2 py-1">
        <summary class="cursor-pointer text-[10px] font-black uppercase tracking-wide text-slate-400">Ajustes manuais de elo</summary>
        <div class="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
          <select v-model="slot.manualTier" class="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[10px] text-slate-200">
            <option value="">Tier</option>
            <option v-for="tier in tierOptions" :key="tier" :value="tier">{{ tier }}</option>
          </select>
          <select v-model="slot.manualRank" class="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[10px] text-slate-200">
            <option value="">Div</option>
            <option v-for="rank in rankOptions" :key="rank" :value="rank">{{ rank }}</option>
          </select>
          <input v-model="slot.manualLp" class="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[10px] text-slate-200" placeholder="LP" />
          <input v-model="slot.manualWinRate" class="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[10px] text-slate-200" placeholder="WR%" />
        </div>
      </details>

      <p v-if="slot.error" class="mt-1 text-[10px] font-bold text-red-400">{{ slot.error }}</p>
    </div>
  `
};
</script>
