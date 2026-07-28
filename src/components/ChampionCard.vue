<!--
  ChampionCard — card de campeão estilo launcher (arte de loading em retrato + nome).
  Hover: popover-resumo (topo da ficha + skills + meta + lenda), carregado sob demanda.
  Clique: emite `open` (abre a ficha completa no pai).

  ÚNICO card de campeão do sistema — usado no Panteão, no Meta e na Caverna dos Monos.
  O card ocupa 100% da largura do container (proporção fixa 308x560), então QUEM USA
  define o tamanho. Tamanhos canônicos:
    • Meta e Caverna dos Monos → `w-28 sm:w-32` (112/128px) — card compacto de lista.
    • Panteão                  → coluna da grade responsiva (3→10 colunas).

  Encaixes por tela, sem duplicar o componente:
    • prop  `winrate`    → selo de WR no canto (Meta).
    • prop  `frameClass` → substitui a moldura padrão (ex.: metais do top 5 da Caverna).
    • slot  `overlay`    → distintivos sobre a arte (posicione com `absolute`).
    • slot  `footer`     → linha extra abaixo da arte (ex.: pontos de maestria).
-->
<template>
  <button
    ref="btnEl"
    type="button"
    class="group flex w-full flex-col items-center gap-1"
    :title="champ.name"
    @click="$emit('open', champ)"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <div
      class="relative w-full overflow-hidden rounded-lg border-2 bg-slate-900 transition duration-200 group-hover:border-cyan-400/80"
      :class="frameClass || 'border-slate-700/70 shadow group-hover:shadow-[0_0_18px_rgba(6,182,212,0.35)]'"
      style="aspect-ratio: 308 / 560;"
    >
      <img
        :src="imgSrc"
        :alt="champ.name"
        loading="lazy"
        class="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
        @error="onImgError"
      />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/10 to-transparent"></div>
      <span
        v-if="Number.isFinite(winrate)"
        class="absolute right-1 top-1 rounded bg-slate-950/85 px-1 py-0.5 text-[10px] font-black"
        :class="winrate >= 50 ? 'text-emerald-300' : 'text-slate-300'"
      >{{ winrate }}%</span>
      <slot name="overlay" />
      <span class="pointer-events-none absolute inset-x-0 bottom-0 truncate px-1.5 pb-1.5 pt-5 text-center text-[11px] font-black text-white drop-shadow">{{ champ.name }}</span>
    </div>
    <slot name="footer" />
  </button>

  <!-- Popover-resumo (hover) -->
  <teleport to="body">
    <div
      v-if="showPop"
      :style="popStyle"
      class="pointer-events-none fixed z-[95] w-72 overflow-hidden rounded-2xl border-2 border-cyan-500/40 bg-slate-950/95 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm"
    >
      <!-- Cabeçalho -->
      <div class="relative h-20">
        <img :src="splashSrc" :alt="champ.name" class="h-full w-full object-cover object-top opacity-50" @error="(e) => e.target.style.display = 'none'" />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
        <div class="absolute bottom-0 left-0 flex items-end gap-2 p-2.5">
          <img :src="iconSrc" :alt="champ.name" class="h-11 w-11 rounded-lg border-2 border-cyan-500/60" />
          <div class="min-w-0 pb-0.5">
            <p class="truncate text-sm font-black leading-tight text-white">{{ champ.name }}</p>
            <p v-if="champ.title" class="truncate text-[10px] font-semibold uppercase tracking-wide text-cyan-300">{{ champ.title }}</p>
          </div>
        </div>
      </div>

      <div class="space-y-2.5 p-2.5">
        <!-- tags + tipo de dano -->
        <div class="flex flex-wrap items-center gap-1">
          <span v-for="tag in champ.tags || []" :key="tag" class="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[9px] font-black uppercase text-slate-300">{{ TAG_LABELS[tag] || tag }}</span>
          <span class="rounded border border-fuchsia-700/60 bg-fuchsia-950/40 px-1 py-0.5 text-[9px] font-black uppercase text-fuchsia-300">{{ damageLabel }}</span>
        </div>

        <!-- meta (rotas onde joga) ou rotas prováveis -->
        <div v-if="metaEntries.length" class="flex flex-wrap gap-1">
          <span v-for="e in metaEntries" :key="e.role" class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-black" :class="TIER_STYLES[e.tier].badge">
            <img :src="roleIconImage(e.role)" :alt="e.role" class="h-3 w-3" />{{ e.tier }}<span v-if="Number.isFinite(e.winrate)" class="font-bold text-slate-300"> · {{ e.winrate }}%</span>
          </span>
        </div>
        <div v-else class="flex flex-wrap gap-1">
          <span v-for="role in roles" :key="role" class="inline-flex items-center gap-1 rounded border border-cyan-800/50 bg-cyan-950/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-cyan-300"><img :src="roleIconImage(role)" :alt="role" class="h-3 w-3" />{{ roleLabel(role) }}</span>
        </div>

        <!-- skills -->
        <div>
          <p class="mb-1 text-[9px] font-black uppercase tracking-wider text-violet-300">Habilidades</p>
          <div v-if="abilities.length" class="flex gap-1.5">
            <div v-for="a in abilities" :key="a.key" class="relative" :title="a.name">
              <img :src="a.icon" :alt="a.name" class="h-8 w-8 rounded border border-slate-700" @error="(e) => e.target.style.visibility = 'hidden'" />
              <span class="absolute -bottom-1 -right-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-violet-600 text-[8px] font-black text-white">{{ a.key }}</span>
            </div>
          </div>
          <p v-else class="text-[10px] italic text-slate-500">carregando…</p>
        </div>

        <!-- lenda -->
        <div v-if="loreShort">
          <p class="mb-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">Lenda</p>
          <p class="line-clamp-3 text-[10px] leading-snug text-slate-400">{{ loreShort }}</p>
        </div>
      </div>

      <!-- Aviso: clique abre a ficha completa -->
      <div class="flex items-center justify-center gap-1.5 border-t border-cyan-500/20 bg-cyan-950/30 px-2.5 py-1.5 text-center text-[9px] font-black uppercase tracking-wider text-cyan-300">
        <i class="fa-solid fa-arrow-pointer"></i> Clique para ver a ficha completa
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue';
import {
  championImage, championLoadingImage, championSplashImage,
  championSpellImage, championPassiveImage, roleIconImage, fetchChampionDetail
} from '../utils.js';
import { TAG_LABELS, DAMAGE_LABELS, TIER_STYLES, ROLES, rolesOf, metaEntriesOf, sanitizeDDragonText } from '../utils/championCatalog.js';
import { getChampionMetrics } from '../utils/sinergiaMotor.js';

const props = defineProps({
  champ: { type: Object, required: true },
  winrate: { type: Number, default: NaN },
  // Substitui a moldura padrão (borda + sombra). Vazio = moldura neutra do catálogo.
  frameClass: { type: String, default: '' }
});
defineEmits(['open']);

const imgFailed = ref(false);
const imgSrc = computed(() => (imgFailed.value ? championImage(props.champ.name) : championLoadingImage(props.champ.name, 0)));
function onImgError() { imgFailed.value = true; }
const splashSrc = computed(() => championSplashImage(props.champ.name, 0));
const iconSrc = computed(() => championImage(props.champ.name));

const metrics = computed(() => getChampionMetrics(props.champ?.name, props.champ?.tags || []));
const damageLabel = computed(() => DAMAGE_LABELS[metrics.value?.damageType] || DAMAGE_LABELS.AD);
const roles = computed(() => rolesOf(props.champ));
const metaEntries = computed(() => metaEntriesOf(props.champ?.name));
function roleLabel(r) { return ROLES.find((x) => x.key === r)?.label || r; }

// ---- Hover popover (carrega a ficha sob demanda; cacheada por fetchChampionDetail) ----
const showPop = ref(false);
const popStyle = ref({});
const btnEl = ref(null);
const detail = ref(null);
let hoverTimer = null;

const abilities = computed(() => {
  const d = detail.value;
  if (!d) return [];
  const list = [];
  if (d.passive) list.push({ key: 'P', name: d.passive.name, icon: championPassiveImage(d.passive.image?.full) });
  const keys = ['Q', 'W', 'E', 'R'];
  (d.spells || []).forEach((s, i) => list.push({ key: keys[i] || '·', name: s.name, icon: championSpellImage(s.image?.full) }));
  return list;
});
const loreShort = computed(() => {
  const t = sanitizeDDragonText(detail.value?.lore || '');
  return t.length > 240 ? `${t.slice(0, 240)}…` : t;
});

function computePosition() {
  const r = btnEl.value?.getBoundingClientRect();
  if (!r) return;
  const W = 288, margin = 8, H = 360;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = r.right + margin;
  if (left + W > vw) left = r.left - W - margin;
  if (left < margin) left = Math.max(margin, (vw - W) / 2);
  let top = r.top;
  if (top + H > vh) top = Math.max(margin, vh - H - margin);
  popStyle.value = { left: `${left}px`, top: `${top}px` };
}

function onEnter() {
  hoverTimer = setTimeout(async () => {
    computePosition();
    showPop.value = true;
    if (!detail.value) {
      try { detail.value = await fetchChampionDetail(props.champ.name); } catch { /* segue sem skills/lenda */ }
    }
  }, 180);
}
function onLeave() {
  clearTimeout(hoverTimer);
  showPop.value = false;
}
onUnmounted(() => clearTimeout(hoverTimer));
</script>
