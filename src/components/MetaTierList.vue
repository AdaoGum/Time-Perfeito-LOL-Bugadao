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
        v-for="role in ROTAS"
        :key="role.key"
        type="button"
        class="inline-flex flex-1 min-w-[5rem] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-black uppercase tracking-wide transition"
        :class="activeRole === role.key ? 'border-amber-500 bg-amber-500/15 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'"
        @click="activeRole = role.key"
      >
        <i v-if="role.key === 'ALL'" class="fa-solid fa-layer-group text-base"></i>
        <img v-else :src="roleIconImage(role.key)" :alt="role.label" class="h-5 w-5" />
        <span class="hidden sm:inline">{{ role.label }}</span>
      </button>
    </div>

    <!-- Quadro de tiers em "baralho" (mesma ideia do card Rotas & Campeões): os ranks
         abertos ficam lado a lado com 3 campeões por linha; os minimizados viram
         espinhas verticais no lugar deles. Abaixo de lg tudo empilha em coluna. -->
    <div
      class="flex flex-col gap-2 lg:grid lg:items-stretch lg:transition-[grid-template-columns] lg:duration-500 lg:ease-out"
      :style="{ gridTemplateColumns: gridColunas }"
    >
      <div
        v-for="tier in TIER_ORDER"
        :key="tier"
        class="flex min-w-0 flex-col overflow-hidden rounded-2xl border transition-all duration-300 lg:min-w-[3rem]"
        :class="[TIER_STYLES[tier].row, isOpen(tier) ? 'p-3' : 'p-2']"
      >
        <!-- Cabeçalho: sempre o mesmo elemento (aberto ou espinha) para a coluna
             animar em vez de piscar; clicar alterna o rank. -->
        <button
          type="button"
          @click="toggleTier(tier)"
          class="flex shrink-0 items-center gap-2 text-left transition hover:brightness-125"
          :class="isOpen(tier) ? 'mb-3 border-b border-slate-800/60 pb-2' : 'h-full lg:flex-col'"
          :title="isOpen(tier) ? `Minimizar tier ${tier}` : `Abrir tier ${tier} (${tiers[tier].length} campeões)`"
        >
          <span
            class="inline-flex shrink-0 items-center justify-center rounded-xl border-2 font-black transition-all"
            :class="[TIER_STYLES[tier].badge, isOpen(tier) ? 'h-10 w-10 text-lg' : 'h-8 w-8 text-base']"
          >{{ tier }}</span>

          <template v-if="isOpen(tier)">
            <div class="min-w-0">
              <p class="truncate text-xs font-black text-slate-200">{{ tierLabel(tier) }}</p>
              <p class="text-[10px] font-bold text-slate-500">{{ tiers[tier].length }} campeões</p>
            </div>
            <i class="fa-solid fa-compress ml-auto text-[10px] text-slate-500"></i>
          </template>
          <template v-else>
            <span class="text-[11px] font-black uppercase tracking-wide text-slate-300 lg:hidden">{{ tierLabel(tier) }}</span>
            <!-- Em coluna o rótulo vai letra por letra, como as espinhas das rotas -->
            <span class="hidden lg:flex lg:flex-col lg:items-center lg:gap-0.5 lg:text-[11px] lg:font-black lg:uppercase lg:leading-none lg:text-slate-400">
              <span v-for="(ch, i) in tierLabel(tier).toUpperCase().split('')" :key="i">{{ ch }}</span>
            </span>
            <span class="ml-auto text-[11px] font-bold text-slate-500 lg:ml-0 lg:mt-auto">{{ tiers[tier].length }}</span>
          </template>
        </button>

        <!-- Campeões: entram depois que a coluna terminou de abrir (delay), saem rápido. -->
        <Transition
          enter-active-class="transition-opacity duration-300 delay-200"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-150"
          leave-to-class="opacity-0"
        >
          <div v-if="isOpen(tier)">
            <!-- Os cards dividem a coluna igualmente; como a largura da coluna é
                 proporcional ao nº de cards por linha, o card sai do mesmo tamanho
                 em todos os ranks abertos. -->
            <div
              v-if="tiers[tier].length"
              class="grid justify-items-center gap-2"
              :style="{ gridTemplateColumns: `repeat(${colsOf(tier)}, minmax(0, 1fr))` }"
            >
              <div v-for="champ in tiers[tier]" :key="champ.name" class="w-full max-w-[9rem]">
                <ChampionCard :champ="resolveChamp(champ.name)" :winrate="champ.winrate" @open="selected = $event" />
              </div>
            </div>
            <p v-else class="py-3 text-center text-[11px] italic text-slate-500">Nenhum campeão neste tier para {{ roleLabel(activeRole) }}.</p>
          </div>
        </Transition>
      </div>
    </div>

    <p class="mt-5 text-center text-[11px] text-slate-500">
      Clique num campeão para abrir a ficha completa aqui mesmo, ou explore todos no
      <button type="button" class="font-bold text-cyan-400 hover:underline" @click="router.push('/champions')">Panteão</button>.
    </p>

    <!-- Ficha (modal) — abre SOBRE a tela do meta, sem trocar de rota -->
    <ChampionSheet
      v-if="selected"
      :champ="selected"
      @close="selected = null"
      @open-item="goToItem"
      @open-champion="selected = $event"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { state } from '../store.js';
import { roleIconImage } from '../utils.js';
import { metaIsStale } from '../utils/sinergiaMotor.js';
import { ROLES, TIER_ORDER, TIER_STYLES, championByName, metaInfo, metaTiersByRole } from '../utils/championCatalog.js';
import ChampionCard from './ChampionCard.vue';
import ChampionSheet from './ChampionSheet.vue';

const router = useRouter();
const store = state;

// 'Todas' (ALL) abre o quadro com todas as rotas juntas — cada campeão no seu melhor tier.
const ROTAS = [{ key: 'ALL', label: 'Todas' }, ...ROLES];
const activeRole = ref('ALL');
const selected = ref(null);
const info = metaInfo();
const stale = metaIsStale();

const tiers = computed(() => metaTiersByRole(activeRole.value));

// ---- Baralho de ranks: até 3 abertos ao mesmo tempo (começa em S, A e B) ----
// O baralho só existe no layout em linha (lg+). Empilhado, todos os ranks ficam abertos.
const MAX_ABERTOS = 3;
const abertos = ref(['S', 'A', 'B']);

const isDesktop = ref(true);
let mq = null;
const onMq = (e) => { isDesktop.value = e.matches; };
onMounted(() => {
  mq = window.matchMedia('(min-width: 1024px)');
  isDesktop.value = mq.matches;
  mq.addEventListener('change', onMq);
});
onUnmounted(() => mq?.removeEventListener('change', onMq));

function isOpen(tier) {
  return !isDesktop.value || abertos.value.includes(tier);
}

// Quantos campeões por linha dentro do rank — o quadro mostra ~9 cards na horizontal:
// 3 abertos = 3+3+3 · 2 abertos = 5 no primeiro e 3 no segundo · 1 aberto = 9.
function colsOf(tier) {
  if (!isDesktop.value) return 3;
  const n = abertos.value.length;
  if (n === 1) return 9;
  if (n === 2) return abertos.value[0] === tier ? 5 : 3;
  return 3;
}

// Colunas do quadro em `fr` (inclusive as minimizadas): unidade única é o que permite
// o navegador INTERPOLAR o grid-template-columns — com `3rem` a troca seria seca.
// A largura de cada rank aberto é proporcional aos cards por linha, então o card sai
// do mesmo tamanho nos três. `lg:min-w-[3rem]` garante o piso da espinha.
const gridColunas = computed(() =>
  TIER_ORDER.map((t) => (isOpen(t) ? `${colsOf(t)}fr` : '0.4fr')).join(' ')
);

// Abrir um rank minimizado fecha o aberto MAIS DISTANTE dele na ordem S→D (clicar em D
// com S/A/B abertos fecha o S). Clicar num aberto minimiza, contanto que sobre um.
function toggleTier(tier) {
  if (isOpen(tier)) {
    if (abertos.value.length > 1) abertos.value = abertos.value.filter((t) => t !== tier);
    return;
  }
  const dist = (t) => Math.abs(TIER_ORDER.indexOf(t) - TIER_ORDER.indexOf(tier));
  const restantes = [...abertos.value];
  while (restantes.length >= MAX_ABERTOS) {
    const maisDistante = restantes.reduce((a, b) => (dist(b) > dist(a) ? b : a));
    restantes.splice(restantes.indexOf(maisDistante), 1);
  }
  restantes.push(tier);
  // Mantém a ordem canônica S→D para o quadro não embaralhar.
  abertos.value = TIER_ORDER.filter((t) => restantes.includes(t));
}

const TIER_LABELS = { S: 'Lendário', A: 'Forte', B: 'Sólido', C: 'Situacional', D: 'Fraco' };
function tierLabel(tier) {
  return TIER_LABELS[tier] || '';
}
function roleLabel(role) {
  return ROTAS.find((r) => r.key === role)?.label || role;
}

// Resolve nome (do CSV do meta) → objeto do campeão do DDragon (pro card/ficha).
function resolveChamp(name) {
  return championByName(store.staticData.championList, name);
}

function goToItem(itemId) {
  router.push(`/items/${itemId}`);
}
</script>
