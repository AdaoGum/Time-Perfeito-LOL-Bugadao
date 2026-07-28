<!--
  Mastery.vue — Caverna dos Monos. Usa o MESMO ChampionCard do Panteão/Meta (tamanho
  compacto `w-28 sm:w-32`, igual ao do Meta), acrescentando por slot o que é próprio
  da maestria: posição no ranking, nível (M) e pontos. O top 5 ganha as molduras de
  metal — ouro, prata, bronze, ferro e madeira.
-->
<template>
  <div class="relative min-h-[74vh] space-y-6">

    <!-- Busca sobreposta enquanto nenhum perfil foi pesquisado (mesmo container/espaçamento
         das telas Caçadas Passadas e Olhar Espiritual — todas usam o SearchGate). -->
    <SearchGate
      title="BUGA! Caverna dos Monos"
      action="profile_brief"
      @show-overlay="c => $emit('show-overlay', c)"
      @hide-overlay="$emit('hide-overlay')"
      @show-udyr="$emit('show-udyr')"
    />

    <!-- Buscando: perfil leve + maestrias (mesmo feedback das Caçadas/Visão) -->
    <div
      v-if="carregando"
      class="flex items-center justify-center gap-3 rounded-xl border border-cyan-800/50 bg-cyan-950/30 px-4 py-3"
    >
      <div class="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"></div>
      <p class="animate-pulse text-sm font-bold tracking-wide text-cyan-300">Contando os monos do buga. <span class="text-lime-300">UGA BUGA</span></p>
    </div>

    <!-- Has mastery data -->
    <template v-if="grupos.length">
      <section class="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-xl">
        <h2 class="mb-1 text-center text-2xl font-black text-slate-100">ESSES SÃO SEUS UGA MONOS SEU BUGA</h2>
        <p class="mb-5 text-center text-xs uppercase tracking-wider text-slate-400">
          {{ total }} campeões com maestria · clique num card para abrir a ficha
        </p>

        <div
          v-for="(grupo, gi) in grupos"
          :key="grupo.key"
          :class="gi ? 'mt-6 border-t border-slate-800 pt-4' : ''"
        >
          <h3 class="mb-3 text-sm font-black uppercase tracking-wider text-slate-300" :class="grupo.titleCls">{{ grupo.title }}</h3>
          <div class="flex flex-wrap gap-2.5" :class="grupo.rowCls">
            <div v-for="item in grupo.entries" :key="item.entry.championName" :class="grupo.cardCls">
              <ChampionCard
                :champ="resolveChamp(item.entry.championName)"
                :frame-class="item.metal ? item.metal.frame : ''"
                @open="selected = $event"
              >
                <!-- Posição no ranking + nível de maestria, sobre a arte -->
                <template #overlay>
                  <span
                    class="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-black"
                    :class="item.metal ? item.metal.text : 'text-slate-300'"
                  >
                    <i v-if="item.metal" class="fa-solid" :class="item.metal.icon"></i>#{{ item.rank }}
                  </span>
                  <span
                    class="absolute right-1 top-1 rounded border px-1 py-0.5 text-[10px] font-black"
                    :class="levelTone(item.entry.championLevel)"
                  >M{{ item.entry.championLevel }}</span>
                </template>

                <!-- Metal (só no top 5) + pontos + barra proporcional ao #1 -->
                <template #footer>
                  <div class="w-full space-y-0.5">
                    <p v-if="item.metal" class="text-center text-[9px] font-black uppercase tracking-wider" :class="item.metal.text">{{ item.metal.label }}</p>
                    <p class="truncate text-center text-[10px] font-bold text-slate-300">{{ fmtPontos(item.entry.championPoints) }} pts</p>
                    <div class="h-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        class="h-full bg-gradient-to-r"
                        :class="item.metal ? item.metal.bar : 'from-cyan-600 to-cyan-400'"
                        :style="{ width: masteryPct(item.entry) + '%' }"
                      ></div>
                    </div>
                  </div>
                </template>
              </ChampionCard>
            </div>
          </div>
        </div>
      </section>

      <!-- Ficha (modal) — abre SOBRE a caverna, sem trocar de rota (igual ao Meta) -->
      <ChampionSheet
        v-if="selected"
        :champ="selected"
        @close="selected = null"
        @open-item="goToItem"
        @open-champion="selected = $event"
      />
    </template>

    <!-- Empty state (no data). O esqueleto completo é MAIS ALTO que a tela, o que
         empurrava a caixa de busca (SearchGate, absolute inset-0, centralizada) para
         fora do campo de visão e deixava esta página com um tamanho diferente das
         Caçadas/Visão. O clamp em 74vh iguala a altura das três telas. -->
    <template v-else>
      <div class="max-h-[74vh] overflow-hidden">
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-xl opacity-50">
          <h2 class="mb-1 text-center text-2xl font-black text-slate-600">ESSES SÃO SEUS UGA MONOS SEU BUGA</h2>
          <p class="mb-5 text-center text-xs uppercase tracking-wider text-slate-600">Pódio de maestria, nível e pontos por campeão</p>
          <div class="flex flex-wrap gap-2.5">
            <div v-for="i in 20" :key="i" class="w-28 sm:w-32">
              <div class="w-full rounded-lg border-2 border-slate-700/50 bg-slate-800/60" style="aspect-ratio: 308 / 560;"></div>
              <div class="mx-auto mt-1 h-2.5 w-16 rounded bg-slate-800/60"></div>
              <div class="mt-1 h-1 rounded-full bg-slate-800/60"></div>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { state } from '../store.js';
import { loadProfileIntoStore, loadMasteriesInBackground } from '../api.js';
import SearchGate from './SearchGate.vue';
import ChampionCard from './ChampionCard.vue';
import ChampionSheet from './ChampionSheet.vue';

const store = state;
const route = useRoute();
const router = useRouter();

const selected = ref(null);

// A busca aqui é leve (profile_brief) + maestrias: as duas etapas contam como "buscando".
const carregando = computed(() => store.searchProfile.loading || store.masteryDashboard.loading);

const total = computed(() => store.masteryDashboard.allMasteries.length);
const maxPoints = computed(() => store.masteryDashboard.allMasteries[0]?.championPoints || 1);

// Metais do pódio: #1 ouro … #5 madeira. `frame` substitui a moldura do ChampionCard.
const METALS = [
  { label: 'Ouro', icon: 'fa-crown', text: 'text-yellow-300', frame: 'border-yellow-400/80 shadow-[0_0_22px_rgba(250,204,21,0.45)]', bar: 'from-yellow-300 to-amber-500' },
  { label: 'Prata', icon: 'fa-medal', text: 'text-slate-200', frame: 'border-slate-300/80 shadow-[0_0_20px_rgba(203,213,225,0.4)]', bar: 'from-slate-200 to-slate-400' },
  { label: 'Bronze', icon: 'fa-medal', text: 'text-orange-300', frame: 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.35)]', bar: 'from-orange-400 to-orange-600' },
  { label: 'Ferro', icon: 'fa-shield-halved', text: 'text-zinc-300', frame: 'border-zinc-400/80 shadow-[0_0_20px_rgba(161,161,170,0.35)]', bar: 'from-zinc-300 to-zinc-500' },
  { label: 'Madeira', icon: 'fa-tree', text: 'text-amber-600', frame: 'border-amber-800/90 shadow-[0_0_20px_rgba(120,53,15,0.5)]', bar: 'from-amber-700 to-amber-900' }
];

// Pódio (top 5, com metal), o resto do top 20 e a cauda — todos com o mesmo card.
const grupos = computed(() => {
  const all = store.masteryDashboard.allMasteries;
  const marcar = (lista, base) => lista.map((entry, i) => ({
    entry,
    rank: base + i,
    metal: METALS[base + i - 1] || null
  }));

  // O pódio fica CENTRALIZADO e com o card do MESMO tamanho do Panteão. O card do
  // Panteão é fluido (1/N da largura disponível, N = 4/5/6/8/10 por faixa), então
  // largura fixa não serve: a linha do pódio é uma grade de 5 colunas cuja LARGURA é
  // a fração equivalente a 5 colunas do Panteão (+ a folga do p-5 desta seção).
  // Abaixo de sm o Panteão tem 4 colunas e 5 cards não cabem — aí volta pro flex-wrap.
  const PODIO = {
    rowCls: 'justify-center sm:mx-auto sm:grid sm:w-full sm:grid-cols-5 md:w-[88%] lg:w-[65%] xl:w-[51%]',
    titleCls: 'text-center',
    cardCls: 'w-32 sm:w-auto'
  };
  const LISTA = { rowCls: '', titleCls: '', cardCls: 'w-28 sm:w-32' };

  const out = [];
  if (all.length) out.push({ key: 'podio', title: 'Pódio dos Monos (#1 ao #5)', entries: marcar(all.slice(0, 5), 1), ...PODIO });
  if (all.length > 5) out.push({ key: 'top20', title: 'Top 15 Seguinte (#6 ao #20)', entries: marcar(all.slice(5, 20), 6), ...LISTA });
  if (all.length > 20) out.push({ key: 'outros', title: `Outros Campeões (${all.length - 20})`, entries: marcar(all.slice(20), 21), ...LISTA });
  return out;
});

// Nome do campeão (vindo da maestria) → objeto do DDragon usado pelo card/ficha.
const champByName = computed(() => {
  const map = {};
  for (const c of store.staticData.championList || []) map[c.name] = c;
  return map;
});
function resolveChamp(name) {
  return champByName.value[name] || { name };
}

function masteryPct(entry) {
  return Math.max(4, Math.round((entry.championPoints / maxPoints.value) * 100));
}

function fmtPontos(pontos) {
  return Number(pontos || 0).toLocaleString('pt-BR');
}

// Cor do selo de nível: quanto mais alto, mais quente.
function levelTone(level) {
  if (level >= 8) return 'border-red-600/60 bg-red-950/85 text-red-300';
  if (level >= 6) return 'border-orange-600/60 bg-orange-950/85 text-orange-300';
  if (level >= 4) return 'border-sky-600/60 bg-sky-950/85 text-sky-300';
  return 'border-slate-600/60 bg-slate-950/85 text-slate-300';
}

function goToItem(itemId) {
  router.push(`/items/${itemId}`);
}

defineEmits(['show-overlay', 'hide-overlay', 'show-udyr']);

// Carrega o jogador presente na URL (/mastery/:gameName/:tagLine) — permite atualizar
// a página sem refazer a busca. Aqui basta o perfil LEVE (identidade) + as maestrias:
// nada de histórico/proficiência/companheiros, que é o que tornava a busca lenta.
async function loadFromRoute() {
  // Sem jogador na URL (entrou pela sidebar) cai no jogador ativo do store — assim
  // quem já buscou em outra tela vê os monos sem precisar buscar de novo.
  const gameName = route.params.gameName ? decodeURIComponent(route.params.gameName) : (store.searchProfile.gameName || '');
  const tagLine = route.params.tagLine ? decodeURIComponent(route.params.tagLine) : (store.searchProfile.tagLine || '');
  if (!gameName || !tagLine) return;

  const sameLoaded =
    store.searchProfile.puuid &&
    (store.searchProfile.gameName || '').toLowerCase() === gameName.toLowerCase() &&
    (store.searchProfile.tagLine || '').toLowerCase() === tagLine.toLowerCase();

  // Mesmo jogador já no store: só falta a lista de maestrias (ex.: veio de outra tela).
  if (sameLoaded) {
    if (!store.masteryDashboard.allMasteries.length && !store.masteryDashboard.loading) {
      loadMasteriesInBackground(store.searchProfile.puuid, gameName, tagLine);
    }
    return;
  }

  try {
    await loadProfileIntoStore(gameName, tagLine, { action: 'profile_brief' });
  } catch (e) {
    // erro já fica em store.searchProfile.error
  }
}

onMounted(loadFromRoute);
watch(() => [route.params.gameName, route.params.tagLine], loadFromRoute);
</script>
