<!--
  Items.vue — Relíquias Ancestrais (arsenal de itens do Summoner's Rift).
  Consome store.staticData.items (Data Dragon). Grade com busca + filtro por
  categoria (tags). Detalhe (modal): atributos, ouro, componentes/evoluções
  navegáveis e sinergia inversa com campeões. Deep-link /items/:itemId.
-->
<template>
  <div>
    <header class="mb-5 flex flex-col gap-1">
      <h1 class="flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
        <i class="fa-solid fa-gem text-fuchsia-400"></i>
        <span class="bg-gradient-to-r from-fuchsia-300 via-purple-300 to-violet-400 bg-clip-text text-transparent">Relíquias Ancestrais</span>
      </h1>
      <p class="text-sm text-slate-400">O arsenal completo do Rift: atributos, receitas e os campeões que mais empunham cada relíquia.</p>
    </header>

    <!-- Controles -->
    <div class="mb-5 flex flex-col gap-3">
      <div class="relative max-w-sm">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><i class="fa-solid fa-magnifying-glass text-xs"></i></span>
        <input
          v-model="query"
          type="text"
          placeholder="Buscar relíquia por nome..."
          class="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm font-semibold text-white placeholder:text-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
        />
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-black uppercase tracking-wide transition"
          :class="activeCat === cat.key ? 'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'"
          @click="activeCat = cat.key"
        >
          <i class="fa-solid" :class="cat.icon"></i> {{ cat.label }}
        </button>
      </div>
    </div>

    <AsyncState :loading="!allItems.length" accent="fuchsia" loading-text="Reunindo as relíquias..." :retryable="false">
      <p class="mb-3 text-xs font-bold text-slate-500">{{ filtered.length }} relíquias</p>
      <div class="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
        <button
          v-for="item in filtered"
          :key="item.id"
          type="button"
          class="group relative rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 transition hover:border-fuchsia-500/70 hover:bg-slate-800/60"
          :title="item.name"
          @click="openItem(item.id)"
        >
          <img :src="itemImage(item.id)" :alt="item.name" loading="lazy" class="mx-auto h-11 w-11 rounded-md border border-slate-700 transition group-hover:scale-110" />
          <p class="mt-1 truncate text-[9px] font-bold text-slate-400 group-hover:text-slate-200">{{ item.name }}</p>
          <span class="mt-0.5 block text-[9px] font-black text-amber-400/90">{{ item.gold.total }}</span>
        </button>
      </div>

      <p v-if="!filtered.length" class="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
        Nenhuma relíquia encontrada.
      </p>
    </AsyncState>

    <!-- Detalhe (modal) -->
    <ItemDetail
      v-if="selected"
      :item="selected"
      @close="closeItem"
      @open-item="openItem"
      @open-champion="goToChampion"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { state } from '../store.js';
import { itemImage } from '../utils.js';
import { normalizeSearch } from '../utils/championCatalog.js';
import ItemDetail from './ItemDetail.vue';
import AsyncState from './AsyncState.vue';

const store = state;
const route = useRoute();
const router = useRouter();

const query = ref('');
const activeCat = ref('ALL');
const selected = ref(null);

// Categorias amigáveis → tags do Data Dragon (match por interseção).
const categories = [
  { key: 'ALL', label: 'Todas', icon: 'fa-layer-group', tags: null },
  { key: 'AD', label: 'Ataque', icon: 'fa-khanda', tags: ['Damage'] },
  { key: 'CRIT', label: 'Crítico', icon: 'fa-burst', tags: ['CriticalStrike'] },
  { key: 'AS', label: 'Vel. Ataque', icon: 'fa-gauge-high', tags: ['AttackSpeed'] },
  { key: 'AP', label: 'Mágico', icon: 'fa-wand-magic-sparkles', tags: ['SpellDamage'] },
  { key: 'DEF', label: 'Defesa', icon: 'fa-shield-halved', tags: ['Armor', 'SpellBlock', 'Health'] },
  { key: 'MANA', label: 'Mana', icon: 'fa-droplet', tags: ['Mana', 'ManaRegen'] },
  { key: 'VAMP', label: 'Vampirismo', icon: 'fa-heart-pulse', tags: ['LifeSteal', 'SpellVamp'] },
  { key: 'SUP', label: 'Suporte & Visão', icon: 'fa-eye', tags: ['GoldPer', 'Vision', 'Aura'] },
  { key: 'BOOTS', label: 'Botas', icon: 'fa-shoe-prints', tags: ['Boots'] },
  { key: 'CONSUM', label: 'Consumíveis', icon: 'fa-flask', tags: ['Consumable'] }
];

// Itens compráveis no Summoner's Rift (mapa 11), com preço, sem restrição de campeão.
const allItems = computed(() => {
  const raw = store.staticData.items || {};
  return Object.entries(raw)
    .map(([id, data]) => ({ id, ...data }))
    .filter((item) =>
      item.maps?.['11'] === true &&
      item.gold?.purchasable === true &&
      Number(item.gold?.total) > 0 &&
      !item.requiredChampion &&
      !item.hideFromAll
    )
    .sort((a, b) => Number(a.gold.total) - Number(b.gold.total) || a.name.localeCompare(b.name));
});

const filtered = computed(() => {
  const cat = categories.find((c) => c.key === activeCat.value);
  const term = normalizeSearch(query.value);
  return allItems.value.filter((item) => {
    if (cat?.tags && !cat.tags.some((tag) => (item.tags || []).includes(tag))) return false;
    if (term && !normalizeSearch(item.name).includes(term)) return false;
    return true;
  });
});

function openItem(id) {
  const item = allItems.value.find((it) => it.id === String(id))
    || (store.staticData.items?.[id] ? { id: String(id), ...store.staticData.items[id] } : null);
  if (!item) return;
  selected.value = item;
  if (route.params.itemId !== String(id)) router.push(`/items/${id}`);
}

function closeItem() {
  selected.value = null;
  if (route.params.itemId) router.push('/items');
}

function goToChampion(champId) {
  router.push(`/champions/${champId}`);
}

function syncFromRoute() {
  const id = route.params.itemId;
  if (!id) {
    selected.value = null;
    return;
  }
  if (!allItems.value.length) return;
  openItem(id);
}

onMounted(syncFromRoute);
watch(() => route.params.itemId, syncFromRoute);
watch(allItems, (list) => {
  if (list.length && route.params.itemId && !selected.value) syncFromRoute();
});
</script>
