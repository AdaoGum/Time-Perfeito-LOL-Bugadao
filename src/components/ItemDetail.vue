<!--
  ItemDetail — Detalhe de uma relíquia (modal). Atributos, ouro (total/receita/venda),
  componentes (`from`) e evoluções (`into`) navegáveis, e sinergia inversa com
  campeões (championsForItem). Emite `close`, `open-item(id)`, `open-champion(id)`.
-->
<template>
  <div class="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" @click.self="$emit('close')">
    <div class="relative w-full max-w-2xl rounded-3xl border-2 border-fuchsia-500/40 bg-slate-950 shadow-[0_0_60px_rgba(217,70,239,0.22)]">
      <button type="button" class="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-950/80 text-slate-300 transition hover:text-white" @click="$emit('close')" aria-label="Fechar detalhe">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <!-- Cabeçalho -->
      <div class="flex items-start gap-4 border-b border-slate-800 p-5">
        <img :src="itemImage(item.id)" :alt="item.name" class="h-16 w-16 shrink-0 rounded-xl border-2 border-fuchsia-500/50" />
        <div class="min-w-0 pr-8">
          <h2 class="text-xl font-black text-white sm:text-2xl">{{ item.name }}</h2>
          <p v-if="item.plaintext" class="mt-0.5 text-xs font-semibold text-fuchsia-300">{{ item.plaintext }}</p>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold">
            <span class="inline-flex items-center gap-1 text-amber-400"><i class="fa-solid fa-coins"></i> {{ item.gold.total }} ouro total</span>
            <span class="text-slate-500">Receita: <span class="text-slate-300">{{ item.gold.base }}</span></span>
            <span class="text-slate-500">Venda: <span class="text-slate-300">{{ item.gold.sell }}</span></span>
          </div>
        </div>
      </div>

      <div class="max-h-[70vh] space-y-5 overflow-y-auto p-5">
        <!-- Atributos e passivas (descrição sanitizada) -->
        <section>
          <h3 class="mb-2 text-xs font-black uppercase tracking-wider text-fuchsia-300"><i class="fa-solid fa-scroll mr-1"></i> Atributos & Efeitos</h3>
          <p class="whitespace-pre-line rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm leading-relaxed text-slate-300">{{ cleanDescription }}</p>
          <div v-if="tags.length" class="mt-2 flex flex-wrap gap-1.5">
            <span v-for="tag in tags" :key="tag" class="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-400">{{ tag }}</span>
          </div>
        </section>

        <!-- Receita: componentes -->
        <section v-if="components.length">
          <h3 class="mb-2 text-xs font-black uppercase tracking-wider text-cyan-300"><i class="fa-solid fa-diagram-project mr-1"></i> Construído a partir de</h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(comp, i) in components"
              :key="`${comp.id}-${i}`"
              type="button"
              class="group flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 pr-2.5 transition hover:border-cyan-500/60"
              @click="$emit('open-item', comp.id)"
            >
              <img :src="itemImage(comp.id)" :alt="comp.name" class="h-9 w-9 rounded border border-slate-700 group-hover:scale-105" />
              <span class="text-left">
                <span class="block max-w-[9rem] truncate text-[11px] font-bold text-slate-200">{{ comp.name }}</span>
                <span class="block text-[10px] font-black text-amber-400/90">{{ comp.gold }} ouro</span>
              </span>
            </button>
          </div>
        </section>

        <!-- Evoluções -->
        <section v-if="upgrades.length">
          <h3 class="mb-2 text-xs font-black uppercase tracking-wider text-emerald-300"><i class="fa-solid fa-arrow-trend-up mr-1"></i> Evolui para</h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(up, i) in upgrades"
              :key="`${up.id}-${i}`"
              type="button"
              class="group flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 pr-2.5 transition hover:border-emerald-500/60"
              @click="$emit('open-item', up.id)"
            >
              <img :src="itemImage(up.id)" :alt="up.name" class="h-9 w-9 rounded border border-slate-700 group-hover:scale-105" />
              <span class="max-w-[9rem] truncate text-[11px] font-bold text-slate-200">{{ up.name }}</span>
            </button>
          </div>
        </section>

        <!-- Sinergia com campeões (mapa inverso) -->
        <section>
          <h3 class="mb-2 text-xs font-black uppercase tracking-wider text-lime-300"><i class="fa-solid fa-dragon mr-1"></i> Campeões que empunham</h3>
          <div v-if="synergyChampions.length" class="flex flex-wrap gap-2">
            <button
              v-for="champ in synergyChampions"
              :key="champ.id"
              type="button"
              class="group flex flex-col items-center"
              :title="champ.name"
              @click="$emit('open-champion', champ.id || getChampionIdFromName(champ.name))"
            >
              <img :src="championImage(champ.name)" :alt="champ.name" class="h-11 w-11 rounded-lg border border-slate-700 transition group-hover:scale-110 group-hover:border-lime-500" />
              <span class="mt-0.5 max-w-[4rem] truncate text-[9px] font-bold text-slate-400 group-hover:text-slate-200">{{ champ.name }}</span>
            </button>
          </div>
          <p v-else class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            Sem campeões associados a esta relíquia nas builds catalogadas.
          </p>
        </section>

        <!-- Popularidade (fallback neutro enquanto não há fonte de dados) -->
        <section>
          <h3 class="mb-2 text-xs font-black uppercase tracking-wider text-amber-300"><i class="fa-solid fa-fire mr-1"></i> Popularidade no Patch</h3>
          <p class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            <template v-if="synergyChampions.length">
              Aparece nas builds recomendadas de <span class="font-black text-slate-200">{{ synergyChampions.length }}</span> campeões catalogados.
            </template>
            <template v-else>Dados de popularidade indisponíveis para esta relíquia no momento.</template>
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { state } from '../store.js';
import { itemImage, championImage, getChampionIdFromName } from '../utils.js';
import { sanitizeDDragonText } from '../utils/championCatalog.js';
// `championsForItem` deriva a sinergia inversa das builds, então mora no módulo
// pesado (o que traz `meta-builds.json` / `builds-champs.json`).
import { championsForItem } from '../utils/championBuilds.js';

const props = defineProps({
  item: { type: Object, required: true }
});
defineEmits(['close', 'open-item', 'open-champion']);

const store = state;
const itemsMap = computed(() => store.staticData.items || {});

const cleanDescription = computed(() => {
  const text = sanitizeDDragonText(props.item?.description);
  return text || props.item?.plaintext || 'Sem descrição detalhada disponível.';
});

const tags = computed(() => props.item?.tags || []);

function resolveItem(id) {
  const data = itemsMap.value[String(id)];
  return data ? { id: String(id), name: data.name, gold: data.gold?.total ?? 0 } : null;
}

const components = computed(() => (props.item?.from || []).map(resolveItem).filter(Boolean));
const upgrades = computed(() =>
  (props.item?.into || [])
    .map(resolveItem)
    .filter((up) => up && itemsMap.value[up.id]?.gold?.purchasable !== false)
    .slice(0, 12)
);

const synergyChampions = computed(() =>
  championsForItem(props.item?.id, store.staticData.championList || [], itemsMap.value).slice(0, 18)
);
</script>
