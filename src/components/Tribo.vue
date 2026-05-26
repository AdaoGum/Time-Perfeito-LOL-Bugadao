<template>
  <div class="space-y-6 text-white">
    <section class="rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-5 shadow-xl">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-black tracking-wide text-cyan-300">Tribo PERFEITO</h2>
          <p class="text-xs text-slate-400">Escolha o modo da fila e monte seu time sem perder o estilo raiz.</p>
        </div>
        <button
          v-if="viewMode !== 'selection'"
          type="button"
          @click="goBackToSelection"
          class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white"
        >Voltar</button>
      </div>
    </section>

    <section
      v-if="viewMode === 'selection'"
      class="rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-6 shadow-xl"
    >
      <FilaSelecao
        mode-label="Lobby"
        title="Escolha da Fila"
        description="Selecione o tipo de partida para montar seu time com fluxo ranqueado ou custom 5x5."
        :mode-options="lobbyModeOptions"
        @selecionar="onSelectLobbyMode"
      />
    </section>

    <section
      v-if="viewMode === 'ranked'"
      class="space-y-4 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-slate-800/80 p-5 shadow-xl"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 border-b border-slate-800/60 pb-2 text-[11px] font-bold tracking-wider text-slate-400">
          <div class="w-3 h-3 bg-cyan-500 rotate-45 border border-slate-950"></div>
          <span>SR • RANQUEADA {{ rankedQueueLabel }} • LOBBY</span>
        </div>

        <button
          type="button"
          @click="findPerfectTribe"
          class="rounded-md bg-gradient-to-b from-cyan-600 to-cyan-800 border border-cyan-400/50 px-5 py-2 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:brightness-110"
        >Encontrar Tribo Perfeito</button>
      </div>

      <div v-if="synergyResult" class="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-3 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-black uppercase tracking-wider text-emerald-300">Sinergia do Time</p>
          <p class="font-black text-emerald-200">Score: {{ synergyResult.score }}/100</p>
        </div>
        <p class="mt-1 text-[11px] text-slate-300">
          Gerado às {{ synergyResult.generatedAt }} • Aderência por rota: {{ synergyResult.roleMatch }}
          <span class="ml-2 text-emerald-200">({{ synergyResult.scoreBefore }} -> {{ synergyResult.scoreAfter }})</span>
        </p>
        <div class="mt-2 flex flex-wrap gap-1">
          <span
            v-for="tag in synergyResult.topTags"
            :key="tag.tag"
            class="rounded border border-emerald-700/40 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
          >
            {{ tag.tag }} ({{ tag.count }})
          </span>
        </div>
        <div v-if="synergyResult.recommendations?.length" class="mt-3 space-y-1 rounded border border-slate-700/60 bg-slate-900/40 p-2">
          <p class="text-[10px] font-black uppercase tracking-wider text-slate-300">Picks automáticos</p>
          <p
            v-for="rec in synergyResult.recommendations"
            :key="`rec-${rec.slotId}`"
            class="text-[11px] text-slate-200"
          >
            Slot {{ rec.slotId }} ({{ rec.role }}): <span class="font-black text-amber-300">{{ rec.champion }}</span>
            • foco: {{ rec.primaryNeed }} • score: {{ rec.score }}
            <span v-if="rec.usedFallback" class="text-amber-300">(fallback)</span>
          </p>
        </div>
        <div v-if="synergyResult.slotOptions?.length" class="mt-3 space-y-2 rounded border border-slate-700/60 bg-slate-900/40 p-2">
          <p class="text-[10px] font-black uppercase tracking-wider text-slate-300">Resumo textual das 5 opções por jogador</p>
          <div
            v-for="slotInfo in synergyResult.slotOptions"
            :key="`slot-summary-${slotInfo.slotId}`"
            class="rounded border border-slate-800 bg-slate-950/50 p-2"
          >
            <p class="text-[10px] font-black text-cyan-300">Slot {{ slotInfo.slotId }} • {{ slotInfo.player }} ({{ slotInfo.role }})</p>
            <p
              v-for="(option, idx) in slotInfo.options"
              :key="`slot-summary-opt-${slotInfo.slotId}-${option.name}`"
              class="mt-1 text-[10px] text-slate-200"
            >
              {{ idx + 1 }}. <span class="font-black text-amber-300">{{ option.name }}</span> • {{ option.summary }} • score {{ option.score }}
            </p>
          </div>
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
                <p class="text-[10px] font-black uppercase tracking-wider text-emerald-300">Top 5 por Sinergia</p>
                <p class="mt-1 text-[10px] text-slate-500">Clique para travar campeão rapidamente.</p>
                <div class="mt-2 space-y-1" v-if="slot.synergyTop5.length">
                  <button
                    v-for="(option, optionIndex) in slot.synergyTop5"
                    :key="`syn-${slot.id}-${option.name}`"
                    type="button"
                    @click="slot.championLocked = option.name"
                    class="flex w-full items-center gap-2 rounded border border-emerald-800/40 bg-slate-950 px-2 py-1 text-left hover:border-emerald-500/70"
                  >
                    <span class="w-4 text-[10px] font-black text-emerald-300">{{ optionIndex + 1 }}</span>
                    <img class="h-6 w-6 rounded" :src="championImage(option.name)" @error="onChampionImageError" :alt="option.name" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-[10px] font-black text-slate-100">{{ option.name }}</p>
                      <p class="truncate text-[9px] text-slate-400">{{ option.summary }}</p>
                    </div>
                    <span class="text-[10px] font-black text-emerald-200">{{ option.score }}</span>
                  </button>
                </div>
                <p v-else class="mt-2 text-[10px] text-slate-500">Clique em Encontrar Lobby Perfeito para gerar as 5 opções.</p>
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
      class="space-y-4 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-slate-800 p-5 shadow-2xl"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-black uppercase tracking-wider text-slate-400">Saguão Custom 5v5</p>
          <p class="text-[11px] text-slate-500">Use os blocos [+] para adicionar jogadores, buscar perfil ou preencher anônimo com elo manual.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            @click="drawBalancedTeams"
            class="rounded-md bg-gradient-to-b from-yellow-600 to-yellow-700 border border-yellow-500/50 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.15)] hover:brightness-110"
          >Festa da Fogueira (Sortear)</button>
          <button
            type="button"
            @click="drawRandomTeams"
            class="rounded-md bg-slate-900 border border-slate-700 px-4 py-2 text-xs font-black uppercase tracking-wider text-yellow-500 hover:bg-slate-800"
          >Fogueira Maluca (Sorteio Raiz)</button>
        </div>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1fr_auto_1fr]">
        <div class="space-y-2 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-3">
          <p class="text-xs font-black tracking-widest text-blue-400 uppercase mb-1">Lado Azul (Time 1)</p>
          <div class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 divide-y divide-slate-900 xl:max-h-none xl:overflow-visible">
            <div v-for="slot in blueSlots" :key="slot.id">
              <CustomSlotCard
                :slot="slot"
                @search="searchCustomSlot"
                @clear="clearCustomSlot"
                @anonymous="setCustomAnonymous"
                @dragstart="onDragStart"
                @drop="onDropToSlot"
              />
            </div>
          </div>
        </div>

        <div class="hidden w-px bg-slate-700/70 xl:block"></div>

        <div class="space-y-2 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-3">
          <p class="text-xs font-black tracking-widest text-red-400 uppercase mb-1">Lado Vermelho (Time 2)</p>
          <div class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 divide-y divide-slate-900 xl:max-h-none xl:overflow-visible">
            <div v-for="slot in redSlots" :key="slot.id">
              <CustomSlotCard
                :slot="slot"
                @search="searchCustomSlot"
                @clear="clearCustomSlot"
                @anonymous="setCustomAnonymous"
                @dragstart="onDragStart"
                @drop="onDropToSlot"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-xl bg-slate-950/60 border border-slate-900 p-4">
        <p class="mb-2 text-[11px] font-black tracking-widest text-slate-400 uppercase">Banco de Reservas / Espectadores</p>
        <div class="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <div v-for="slot in reserveSlots" :key="slot.id">
            <CustomSlotCard
              :slot="slot"
              @search="searchCustomSlot"
              @clear="clearCustomSlot"
              @anonymous="setCustomAnonymous"
              @dragstart="onDragStart"
              @drop="onDropToSlot"
            />
          </div>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-xl border border-slate-900 bg-slate-950/70 p-3 text-xs">
          <p class="font-black text-cyan-300">MMR Time Azul: {{ blueMmr }}</p>
          <p class="text-slate-400">Jogadores: {{ blueFilledCount }}/5</p>
        </div>
        <div class="rounded-xl border border-slate-900 bg-slate-950/70 p-3 text-xs">
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
          <p v-if="currentModalSynergyTop5.length" class="mb-2 text-xs font-black uppercase tracking-wider text-emerald-300">Top 5 por Sinergia (Prioridade)</p>
          <div class="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <button
              v-for="option in filteredSynergyTop5"
              :key="`top-${option.name}`"
              type="button"
              @click="lockChampionFromModal(option.name)"
              class="flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-slate-950 px-2 py-1.5 text-left text-xs font-semibold hover:border-emerald-400"
            >
              <img class="h-7 w-7 rounded" :src="championImage(option.name)" @error="onChampionImageError" :alt="option.name" />
              <div class="min-w-0">
                <p class="truncate font-black text-emerald-100">{{ option.name }}</p>
                <p class="truncate text-[10px] text-slate-400">{{ option.summary }}</p>
              </div>
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
import { useRouter } from 'vue-router';
import SearchBar from './SearchBar.vue';
import CustomSlotCard from './CustomSlotCard.vue';
import FilaSelecao from './FilaSelecao.vue';
import { state } from '../store.js';
import { workerRequest } from '../api.js';
import { championImage, profileIconImage, getChampionIdFromName, DDRAGON_VERSION } from '../utils.js';
import { calcularNecessidadeDoTime, encontrarMelhorPick, getChampionMetrics, roleFitScore, scoreToPercent } from '../utils/sinergiaMotor.js';

const store = state;
const router = useRouter();
const viewMode = ref('selection');
const queueType = ref('solo_duo');
const rerollSeed = ref(0);
const draggedSlotId = ref(null);
const synergyResult = ref(null);

const lobbyModeOptions = [
  { id: 'solo_duo', titulo: 'Ranked Solo/Duo', subtitulo: 'Abra o lobby ranqueado para até 2 jogadores.' },
  { id: 'flex', titulo: 'Ranked Flex', subtitulo: 'Abra o lobby ranqueado para composição completa.' },
  { id: 'custom_5x5', titulo: 'Customizada 5x5', subtitulo: 'Monte dois times, reservas e faça sorteio balanceado.' }
];

const rankedQueueLabel = computed(() => (queueType.value === 'solo_duo' ? 'SOLO/DUO' : 'FLEX'));

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
const currentModalSynergyTop5 = computed(() => {
  const slot = currentModalSlot.value;
  if (!slot) return [];
  return (slot.synergyTop5 || []).slice(0, 5);
});

const currentModalAllChampions = computed(() => {
  const slot = currentModalSlot.value;
  const allNames = (store.staticData.championList || []).map((champ) => champ.name).sort((a, b) => a.localeCompare(b));
  if (!slot) return allNames;
  const topSet = new Set(currentModalSynergyTop5.value.map((option) => option.name));
  return allNames.filter((name) => !topSet.has(name));
});

const filteredSynergyTop5 = computed(() => {
  const q = championModal.query.trim().toLowerCase();
  return q
    ? currentModalSynergyTop5.value.filter((option) => option.name.toLowerCase().includes(q))
    : currentModalSynergyTop5.value;
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
    masteries: [],
    synergyTop5: []
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

function onSelectLobbyMode(mode) {
  synergyResult.value = null;

  if (mode === 'custom_5x5') {
    router.push('/saguaoCustom');
    return;
  }

  queueType.value = mode === 'flex' ? 'flex' : 'solo_duo';
  viewMode.value = 'ranked';
}

function goBackToSelection() {
  closeChampionModal();
  viewMode.value = 'selection';
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
  slot.synergyTop5 = [];
}

function onRankedSearchStart(slotId) {
  const slot = rankedSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.loading = true;
  slot.error = null;
  slot.showSearch = true;
  slot.synergyTop5 = [];
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
  slot.synergyTop5 = [];

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

function candidateMatchesSlotRole(championName, slotRole, tags = []) {
  const metrics = getChampionMetrics(championName, tags);
  const rolesFromSheet = Array.isArray(metrics?.roles) ? metrics.roles : [];
  if (rolesFromSheet.length) return rolesFromSheet.includes(String(slotRole || '').toUpperCase());
  return roleFitScore(slotRole, tags) >= 0.45;
}

function buildCandidatePool(slot, pickedChampions) {
  const pickedSet = new Set(pickedChampions || []);
  const list = [];

  if (slot.type === 'real' && (slot.masteries || []).length) {
    for (const entry of slot.masteries.slice(0, 30)) {
      if (!entry?.championName || pickedSet.has(entry.championName)) continue;
      const tags = championTags(entry.championName);
      if (!candidateMatchesSlotRole(entry.championName, slot.role, tags)) continue;
      list.push({
        name: entry.championName,
        masteryPoints: Number(entry.championPoints || 0),
        tags,
        metrics: getChampionMetrics(entry.championName, tags),
        usedFallback: false
      });
    }
  }

  if (!list.length) {
    const fallback = (store.staticData.championList || [])
      .map((champ) => ({
        name: champ.name,
        masteryPoints: 0,
        tags: champ.tags || [],
        metrics: getChampionMetrics(champ.name, champ.tags || []),
        usedFallback: true
      }))
      .filter((candidate) => !pickedSet.has(candidate.name))
      .filter((candidate) => candidateMatchesSlotRole(candidate.name, slot.role, candidate.tags))
      .sort((a, b) => a.name.localeCompare(b.name));

    return fallback;
  }

  return list;
}

const DIMENSION_LABELS = {
  engage: 'engage',
  poke: 'poke',
  frontline: 'frontline',
  burst: 'burst',
  disengage: 'desengage',
  utility: 'utilidade',
  peel: 'peel',
  waveclear: 'waveclear'
};

function damageTypeLabel(type) {
  if (type === 'AP') return 'dano AP';
  if (type === 'MIXED') return 'dano misto';
  return 'dano AD';
}

function describePickTraits(championName, slotRole, primaryNeed) {
  const tags = championTags(championName);
  const metrics = getChampionMetrics(championName, tags);
  const roleScore = Math.round(roleFitScore(slotRole, tags) * 100);

  const topDimensions = ['engage', 'poke', 'frontline', 'burst', 'disengage', 'utility', 'peel', 'waveclear']
    .map((key) => ({ key, value: Number(metrics?.[key] || 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((item) => DIMENSION_LABELS[item.key] || item.key);

  return `${damageTypeLabel(metrics?.damageType)} • forte em ${topDimensions.join(' + ')} • encaixe na rota ${roleScore}% • cobre ${DIMENSION_LABELS[primaryNeed] || primaryNeed}`;
}

function buildTopRecommendationsForSlot(slot, pickedChampions, context, limit = 5) {
  const localPicked = [...pickedChampions];
  const options = [];

  for (let i = 0; i < limit; i += 1) {
    const pool = buildCandidatePool(slot, localPicked);
    if (!pool.length) break;

    const bestPick = encontrarMelhorPick({
      vetorNecessidade: context.vetorNecessidade,
      snapshotAtual: context.snapshotAtual,
      target: context.target,
      poolCampeoesCandidatos: pool,
      slotRole: slot.role,
      pickedChampions: localPicked
    });

    if (!bestPick?.name) break;

    const summary = describePickTraits(bestPick.name, slot.role, bestPick.primaryNeed);
    options.push({
      ...bestPick,
      summary
    });
    localPicked.push(bestPick.name);
  }

  return options;
}

function findPerfectTribe() {
  const slots = activeRankedSlots.value;
  const initiallyLocked = slots
    .filter((slot) => slot.championLocked)
    .map((slot) => slot.championLocked);

  const chosen = [...initiallyLocked];
  const recommendations = [];
  const beforeContext = calcularNecessidadeDoTime(initiallyLocked, {
    activeSlotCount: slots.length,
    getTagsByChampion: championTags
  });
  const slotOptions = [];

  for (const slot of slots) {
    const basePicks = slot.championLocked
      ? chosen.filter((champion) => champion !== slot.championLocked)
      : [...chosen];

    const currentContext = calcularNecessidadeDoTime(basePicks, {
      activeSlotCount: slots.length,
      getTagsByChampion: championTags
    });

    const top5 = buildTopRecommendationsForSlot(slot, basePicks, currentContext, 5);
    slot.synergyTop5 = top5;
    slotOptions.push({
      slotId: slot.id,
      player: slot.gameName || `Slot ${slot.id}`,
      role: slot.role,
      options: top5
    });

    if (slot.championLocked) continue;

    const bestPick = top5[0];
    if (!bestPick?.name) continue;

    slot.championLocked = bestPick.name;
    chosen.push(bestPick.name);
    recommendations.push({
      slotId: slot.id,
      role: slot.role,
      champion: bestPick.name,
      primaryNeed: bestPick.primaryNeed,
      score: bestPick.score,
      usedFallback: bestPick.usedFallback
    });
  }

  const afterContext = calcularNecessidadeDoTime(chosen, {
    activeSlotCount: slots.length,
    getTagsByChampion: championTags
  });

  synergyResult.value = summarizeRankedSynergy(slots, {
    beforeContext,
    afterContext,
    recommendations,
    slotOptions
  });
  store.teamPlanner.analysisResult = synergyResult.value;
}

function summarizeRankedSynergy(slots, details = {}) {
  const picks = slots
    .filter((slot) => slot.championLocked)
    .map((slot) => ({ role: slot.role, champion: slot.championLocked }));

  const tagCount = {};
  let roleMatch = 0;

  for (const pick of picks) {
    const tags = championTags(pick.champion);
    const roleScore = roleFitScore(pick.role, tags);
    if (roleScore >= 0.7) roleMatch += 1;

    for (const tag of tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }

  const beforeSnapshot = details.beforeContext?.snapshotAtual || null;
  const beforeTarget = details.beforeContext?.target || null;
  const afterSnapshot = details.afterContext?.snapshotAtual || null;
  const afterTarget = details.afterContext?.target || null;

  const scoreBefore = beforeSnapshot && beforeTarget ? scoreToPercent(beforeSnapshot, beforeTarget) : 0;
  const scoreAfter = afterSnapshot && afterTarget ? scoreToPercent(afterSnapshot, afterTarget) : 0;
  const score = Math.max(scoreAfter, scoreBefore);

  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, count }));

  const needs = details.afterContext?.vetorNecessidade || {};
  const sortedNeeds = Object.entries(needs)
    .filter(([key]) => ['engage', 'poke', 'frontline', 'burst', 'disengage', 'utility', 'peel', 'waveclear'].includes(key))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([key]) => key);

  return {
    score,
    scoreBefore,
    scoreAfter,
    roleMatch,
    topTags,
    topNeeds: sortedNeeds,
    recommendations: details.recommendations || [],
    slotOptions: details.slotOptions || [],
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

function setCustomAnonymous(slotId) {
  const slot = customSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.showSearch = false;
  slot.loading = false;
  slot.error = null;
  slot.gameName = 'Invocador Anonimo';
  slot.tagLine = 'OFFLINE';
  slot.profileIconId = 29;
  slot.manualTier = slot.manualTier || 'UNRANKED';
  slot.manualRank = slot.manualRank || 'IV';
  slot.manualLp = slot.manualLp || '0';
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

function drawRandomTeams() {
  rerollSeed.value += 1;
  const allFilled = customSlots.filter((slot) => slot.gameName);
  if (allFilled.length < 2) return;

  const shuffled = [...allFilled]
    .map((slot) => ({ slot, seed: Math.random() + rerollSeed.value * 0.01 }))
    .sort((a, b) => a.seed - b.seed)
    .map((item) => item.slot);

  const blueFinal = shuffled.slice(0, 5);
  const redFinal = shuffled.slice(5, 10);
  const reserveFinal = shuffled.slice(10, 15);

  const ordered = [...blueFinal, ...redFinal, ...reserveFinal];
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
</script>
