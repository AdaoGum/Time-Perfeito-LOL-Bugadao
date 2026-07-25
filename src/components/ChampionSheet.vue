<!--
  ChampionSheet — Ficha completa de um campeão (Panteão).
  Dois modos: MODAL (card central) e EXPANDIDO (ocupa a área útil entre a sidebar
  e a topbar). No modo expandido, mostra o splash da skin selecionada em destaque
  e um carrossel com todas as skins do campeão (Data Dragon). Emite `close`/`open-item`.
-->
<template>
  <div
    :class="isExpanded
      ? 'fixed z-[55]'
      : 'fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6'"
    :style="isExpanded ? expandedStyle : null"
    @click.self="!isExpanded && $emit('close')"
  >
    <div
      :class="isExpanded
        ? 'relative flex h-full w-full flex-col overflow-hidden border-l-2 border-cyan-500/30 bg-slate-950'
        : 'relative w-full max-w-4xl overflow-hidden rounded-3xl border-2 border-cyan-500/40 bg-slate-950 shadow-[0_0_60px_rgba(6,182,212,0.25)]'"
    >
      <!-- Controles (expandir/minimizar + fechar) — canto superior direito -->
      <div class="absolute right-3 top-3 z-20 flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-950/80 text-slate-300 transition hover:text-white"
          @click="toggleExpand"
          :title="isExpanded ? 'Minimizar' : 'Expandir'"
          :aria-label="isExpanded ? 'Minimizar ficha' : 'Expandir ficha'"
        >
          <i class="fa-solid" :class="isExpanded ? 'fa-compress' : 'fa-expand'"></i>
        </button>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-950/80 text-slate-300 transition hover:text-white"
          @click="$emit('close')"
          aria-label="Fechar ficha"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- CABEÇALHO: strip com splash (modal) / barra compacta (expandido) -->
      <div v-if="!isExpanded" class="relative h-40 shrink-0 overflow-hidden rounded-t-3xl sm:h-52">
        <img :src="championSplashImage(champ.name)" :alt="champ.name" class="absolute inset-0 h-full w-full object-cover object-top opacity-60" @error="(e) => e.target.style.display = 'none'" />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>
        <div class="absolute bottom-0 left-0 flex items-end gap-3 p-4 sm:gap-4 sm:p-5">
          <img :src="championImage(champ.name)" :alt="champ.name" class="h-16 w-16 shrink-0 rounded-xl border-2 border-cyan-500/60 shadow-lg sm:h-20 sm:w-20" />
          <div class="min-w-0">
            <h2 class="truncate text-2xl font-black text-white drop-shadow sm:text-3xl">{{ champ.name }}</h2>
            <p class="truncate text-xs font-semibold uppercase tracking-wider text-cyan-300 sm:text-sm">{{ champ.title }}</p>
            <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span v-for="tag in champ.tags || []" :key="tag" class="rounded border border-slate-600 bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-300">{{ TAG_LABELS[tag] || tag }}</span>
              <span class="rounded border border-fuchsia-600/60 bg-fuchsia-950/40 px-1.5 py-0.5 text-[10px] font-black uppercase text-fuchsia-300">{{ damageLabel }}</span>
              <span v-for="role in roles" :key="role" class="inline-flex items-center gap-1 rounded border border-cyan-700/50 bg-cyan-950/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-cyan-300">
                <img :src="roleIconImage(role)" :alt="role" class="h-3 w-3" />{{ roleLabel(role) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950/90 p-3 pr-24">
        <img :src="championImage(champ.name)" :alt="champ.name" class="h-11 w-11 shrink-0 rounded-lg border-2 border-cyan-500/60" />
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 truncate text-lg font-black text-white sm:text-xl">
            {{ champ.name }}
            <span class="truncate text-xs font-semibold uppercase tracking-wider text-cyan-300">{{ champ.title }}</span>
          </h2>
          <div class="mt-0.5 flex flex-wrap items-center gap-1">
            <span v-for="tag in champ.tags || []" :key="tag" class="rounded border border-slate-600 bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-300">{{ TAG_LABELS[tag] || tag }}</span>
            <span class="rounded border border-fuchsia-600/60 bg-fuchsia-950/40 px-1.5 py-0.5 text-[9px] font-black uppercase text-fuchsia-300">{{ damageLabel }}</span>
            <span v-for="role in roles" :key="role" class="inline-flex items-center gap-1 rounded border border-cyan-700/50 bg-cyan-950/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-cyan-300">
              <img :src="roleIconImage(role)" :alt="role" class="h-3 w-3" />{{ roleLabel(role) }}
            </span>
          </div>
        </div>
      </div>

      <!-- CORPO: (expandido) splash em destaque + info + carrossel; (modal) só a info -->
      <div class="flex min-h-0 flex-col" :class="isExpanded ? 'flex-1' : ''">
        <div class="min-h-0" :class="isExpanded ? 'grid flex-1 overflow-hidden lg:grid-cols-[1.5fr_1fr]' : ''">
          <!-- Splash da skin selecionada em destaque (desktop expandido) -->
          <div v-if="isExpanded" class="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 lg:block">
            <img :key="selectedSkinSplash" :src="selectedSkinSplash" :alt="skinName(selectedSkin)" class="h-full w-full animate-[skinFade_0.4s_ease] object-cover object-center" @error="(e) => e.target.style.opacity = 0.2" />
            <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent"></div>
            <div class="absolute bottom-0 left-0 p-5">
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/80">Skin {{ selectedSkinIndex + 1 }} / {{ skins.length || 1 }}</p>
              <p class="text-2xl font-black text-white drop-shadow">{{ skinName(selectedSkin) }}</p>
            </div>
          </div>

          <!-- Bloco de informações (renderizado uma vez; reposicionado por modo) -->
          <div :class="isExpanded ? 'min-h-0 overflow-y-auto border-slate-800 lg:border-l' : ''">
            <!-- Splash compacto no topo (mobile expandido) -->
            <div v-if="isExpanded" class="relative h-48 overflow-hidden lg:hidden">
              <img :key="`m-${selectedSkinSplash}`" :src="selectedSkinSplash" :alt="skinName(selectedSkin)" class="h-full w-full object-cover object-center" @error="(e) => e.target.style.opacity = 0.2" />
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent"></div>
              <p class="absolute bottom-2 left-3 text-lg font-black text-white drop-shadow">{{ skinName(selectedSkin) }}</p>
            </div>

            <div class="grid gap-5 p-4 sm:p-6" :class="isExpanded ? 'grid-cols-1' : 'lg:grid-cols-2'">
              <!-- Coluna 1: meta + radar + lore -->
              <div class="space-y-5">
                <!-- Meta no patch -->
                <section>
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                    <i class="fa-solid fa-ranking-star"></i> Meta no Patch {{ metaPatch }}
                  </h3>
                  <div v-if="metaEntries.length" class="space-y-1.5">
                    <div v-for="entry in metaEntries" :key="entry.role" class="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" :class="TIER_STYLES[entry.tier].row">
                      <span class="inline-flex h-6 w-6 items-center justify-center rounded border text-[11px] font-black" :class="TIER_STYLES[entry.tier].badge">{{ entry.tier }}</span>
                      <span class="inline-flex items-center gap-1 text-xs font-black text-slate-200"><img :src="roleIconImage(entry.role)" :alt="entry.role" class="h-3.5 w-3.5" />{{ roleLabel(entry.role) }}</span>
                      <div class="ml-auto flex gap-2 text-[10px] font-bold">
                        <span class="text-slate-400">WR <span class="text-slate-200">{{ formatPct(entry.winrate) }}</span></span>
                        <span class="text-slate-400">PR <span class="text-slate-200">{{ formatPct(entry.pickrate) }}</span></span>
                        <span class="text-slate-400">BR <span class="text-slate-200">{{ formatPct(entry.banrate) }}</span></span>
                      </div>
                    </div>
                  </div>
                  <p v-else class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">Sem classificação no meta atual para este campeão.</p>
                </section>

                <!-- Radar tático -->
                <section>
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-300">
                    <i class="fa-solid fa-chart-area"></i> Perfil Tático
                  </h3>
                  <div class="rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
                    <RadarChart :axes="radarAxes" color="#22d3ee" :size="240" />
                  </div>
                </section>

                <!-- Lore -->
                <section v-if="detail?.lore">
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
                    <i class="fa-solid fa-book-open"></i> Lenda
                  </h3>
                  <p class="overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-400" :class="isExpanded ? 'max-h-56' : 'max-h-32'">{{ loreShort }}</p>
                </section>
              </div>

              <!-- Coluna 2: habilidades + builds -->
              <div class="space-y-5">
                <!-- Habilidades -->
                <section>
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-violet-300">
                    <i class="fa-solid fa-hat-wizard"></i> Habilidades
                  </h3>
                  <AsyncState :loading="loadingDetail" :error="detailError" accent="fuchsia" loading-text="Consultando os pergaminhos..." @retry="loadDetail">
                    <div v-if="detail" class="space-y-2">
                      <div v-for="ability in abilities" :key="ability.key" class="flex gap-2.5 rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                        <div class="relative shrink-0">
                          <img :src="ability.icon" :alt="ability.name" class="h-11 w-11 rounded-md border border-slate-700" @error="(e) => e.target.style.visibility = 'hidden'" />
                          <span class="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded bg-violet-600 text-[9px] font-black text-white">{{ ability.key }}</span>
                        </div>
                        <div class="min-w-0">
                          <p class="text-xs font-black text-slate-100">{{ ability.name }}</p>
                          <p class="mt-0.5 whitespace-pre-line text-[11px] leading-snug text-slate-400" :class="isExpanded ? '' : 'line-clamp-3'">{{ ability.desc }}</p>
                        </div>
                      </div>
                    </div>
                  </AsyncState>
                </section>

                <!-- Builds recomendadas (até 3): runas + relíquias -->
                <section>
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-lime-300">
                    <i class="fa-solid fa-gem"></i> Builds Recomendadas
                  </h3>

                  <div v-if="builds.length">
                    <!-- Mini abas: o NOME de cada build fica em cima, conectado ao painel -->
                    <div class="flex gap-1">
                      <button
                        v-for="(b, i) in builds"
                        :key="b.key"
                        type="button"
                        class="relative -mb-px min-w-0 flex-1 truncate rounded-t-lg border border-b-0 px-2 py-1.5 text-[10px] font-black uppercase tracking-wide transition"
                        :class="i === activeBuildIndex
                          ? 'border-lime-500/60 bg-slate-900/70 text-lime-300'
                          : 'border-slate-800 bg-slate-950/60 text-slate-500 hover:text-slate-300'"
                        :title="b.label"
                        @click="activeBuildIndex = i"
                      >
                        {{ b.label }}
                      </button>
                    </div>

                    <!-- Painel da aba ativa: altura estável (ocupa o mesmo espaço trocando de aba) -->
                    <div v-if="activeBuild" class="flex min-h-[190px] flex-col gap-3 rounded-b-2xl rounded-tr-2xl border border-lime-500/40 bg-slate-900/40 p-3">
                      <!-- Runas -->
                      <div v-if="activeBuild.runes">
                        <p class="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-300">
                          <i class="fa-solid fa-scroll"></i> Runas
                        </p>
                        <div class="flex flex-wrap items-center gap-3">
                          <div class="flex items-center gap-1.5">
                            <img v-if="runeSrc(activeBuild.runes.primary)" :src="runeSrc(activeBuild.runes.primary)" :alt="runeInfo(activeBuild.runes.primary)?.name" class="h-5 w-5 opacity-80" :title="runeInfo(activeBuild.runes.primary)?.name" />
                            <img v-if="runeSrc(activeBuild.runes.keystone)" :src="runeSrc(activeBuild.runes.keystone)" :alt="runeInfo(activeBuild.runes.keystone)?.name" class="h-10 w-10 rounded-full border-2 border-violet-500/70 bg-slate-950" :title="runeInfo(activeBuild.runes.keystone)?.name" />
                            <span v-else class="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-950 text-slate-600"><i class="fa-solid fa-gem"></i></span>
                            <div class="flex gap-1">
                              <template v-for="pid in activeBuild.runes.primaryPicks" :key="`pp-${pid}`">
                                <img v-if="runeSrc(pid)" :src="runeSrc(pid)" :alt="runeInfo(pid)?.name" class="h-7 w-7 rounded-full border border-slate-700 bg-slate-950" :title="runeInfo(pid)?.name" />
                              </template>
                            </div>
                          </div>
                          <div class="flex items-center gap-1.5 border-l border-slate-700 pl-3">
                            <img v-if="runeSrc(activeBuild.runes.secondary)" :src="runeSrc(activeBuild.runes.secondary)" :alt="runeInfo(activeBuild.runes.secondary)?.name" class="h-5 w-5 opacity-80" :title="runeInfo(activeBuild.runes.secondary)?.name" />
                            <div class="flex gap-1">
                              <template v-for="sid in activeBuild.runes.secondaryPicks" :key="`sp-${sid}`">
                                <img v-if="runeSrc(sid)" :src="runeSrc(sid)" :alt="runeInfo(sid)?.name" class="h-7 w-7 rounded-full border border-slate-700 bg-slate-950" :title="runeInfo(sid)?.name" />
                              </template>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Itens -->
                      <div>
                        <p class="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-lime-300">
                          <i class="fa-solid fa-shield-halved"></i> Ordem de itens
                        </p>
                        <div v-if="activeBuild.items.length" class="flex flex-wrap gap-2">
                          <button
                            v-for="(id, i) in activeBuild.items"
                            :key="`${id}-${i}`"
                            type="button"
                            class="group relative"
                            :title="itemsMap[id]?.name"
                            @click="$emit('open-item', id)"
                          >
                            <img :src="itemImage(id)" :alt="itemsMap[id]?.name" class="h-11 w-11 rounded-md border border-slate-700 transition group-hover:border-lime-500 group-hover:scale-110" />
                            <span class="absolute -left-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-lime-600 text-[9px] font-black text-white">{{ i + 1 }}</span>
                          </button>
                        </div>
                        <p v-else class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">Relíquias ainda carregando ou indisponíveis neste patch.</p>
                      </div>
                    </div>
                  </div>
                  <p v-else class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">Builds ainda carregando ou indisponíveis neste patch.</p>
                </section>
              </div>
            </div>
          </div>
        </div>

        <!-- CARROSSEL DE SKINS (apenas no modo expandido) -->
        <div v-if="isExpanded" class="shrink-0 border-t border-slate-800 bg-slate-950/95 p-3">
          <div class="mb-1.5 flex items-center justify-between">
            <p class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">
              <i class="fa-solid fa-images"></i> Skins ({{ skins.length }})
            </p>
          </div>
          <div v-if="skins.length" class="flex items-center gap-2">
            <button type="button" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-500 hover:text-white" @click="prevSkin" aria-label="Skin anterior">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <div ref="carouselEl" class="flex flex-1 gap-2 overflow-x-auto scroll-smooth pb-1">
              <button
                v-for="(skin, i) in skins"
                :key="skin.id"
                type="button"
                class="group relative shrink-0 overflow-hidden rounded-lg border-2 transition"
                :class="i === selectedSkinIndex ? 'border-cyan-400 shadow-[0_0_14px_rgba(6,182,212,0.4)]' : 'border-slate-700 hover:border-slate-500'"
                :title="skinName(skin)"
                @click="selectSkin(i)"
              >
                <img :src="championLoadingImage(champ.name, skin.num)" :alt="skinName(skin)" loading="lazy" class="h-24 w-[4.2rem] object-cover transition group-hover:scale-105" @error="(e) => e.target.style.opacity = 0.2" />
                <span class="absolute inset-x-0 bottom-0 truncate bg-slate-950/80 px-1 py-0.5 text-center text-[8px] font-bold text-slate-200">{{ skinName(skin) }}</span>
              </button>
            </div>
            <button type="button" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-500 hover:text-white" @click="nextSkin" aria-label="Próxima skin">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
          <p v-else class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            {{ loadingDetail ? 'Carregando as skins...' : 'Skins indisponíveis para este campeão.' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { state } from '../store.js';
import {
  championImage, championSplashImage, championLoadingImage, championSpellImage, championPassiveImage,
  itemImage, runeImage, roleIconImage, fetchChampionDetail
} from '../utils.js';
import {
  TAG_LABELS, DAMAGE_LABELS, TACTICAL_DIMENSIONS, TIER_STYLES, ROLES,
  rolesOf, buildsFor, metaEntriesOf, metaInfo, formatPct, sanitizeDDragonText
} from '../utils/championCatalog.js';
import { getChampionMetrics } from '../utils/sinergiaMotor.js';
import RadarChart from './RadarChart.vue';
import AsyncState from './AsyncState.vue';

const props = defineProps({
  champ: { type: Object, required: true }
});
defineEmits(['close', 'open-item']);

const store = state;
const itemsMap = computed(() => store.staticData.items || {});

const detail = ref(null);
const loadingDetail = ref(false);
const detailError = ref(null);

// ---- Modo expandido (ocupa a área entre a sidebar e a topbar) ----
const isExpanded = ref(false);
function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

const viewportW = ref(typeof window !== 'undefined' ? window.innerWidth : 1440);
function onResize() {
  viewportW.value = window.innerWidth;
}

// Offsets do modo expandido: reserva a largura da sidebar (80/288 no desktop; 0 no
// mobile) e a altura da topbar (64px = top-16, onde a sidebar começa).
const expandedStyle = computed(() => {
  const desktop = viewportW.value >= 1024;
  const left = desktop ? (store.ui.sidebarCollapsed ? 80 : 288) : 0;
  return { top: '64px', left: `${left}px`, right: '0px', bottom: '0px' };
});

const metrics = computed(() => getChampionMetrics(props.champ?.name, props.champ?.tags || []));
const roles = computed(() => rolesOf(props.champ));
const builds = computed(() => buildsFor(props.champ, itemsMap.value));
const activeBuildIndex = ref(0);
const activeBuild = computed(() => builds.value[activeBuildIndex.value] || builds.value[0] || null);
const runesMap = computed(() => state.staticData.runes || {});

// Resolve um perk (runa ou árvore) pelo id → { name, icon } do runesReforged.
function runeInfo(id) {
  return runesMap.value[id] || null;
}
function runeSrc(id) {
  const info = runeInfo(id);
  return info?.icon ? runeImage(info.icon) : '';
}

// ---- Skins (Data Dragon) ----
const skins = computed(() => detail.value?.skins || []);
const selectedSkinIndex = ref(0);
const selectedSkin = computed(() => skins.value[selectedSkinIndex.value] || skins.value[0] || null);
const selectedSkinSplash = computed(() => championSplashImage(props.champ.name, selectedSkin.value?.num ?? 0));
const carouselEl = ref(null);

function skinName(skin) {
  return !skin || skin.name === 'default' ? props.champ?.name : skin.name;
}
function scrollThumbIntoView(i) {
  nextTick(() => {
    const child = carouselEl.value?.children?.[i];
    child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
}
function selectSkin(i) {
  if (i < 0 || i >= skins.value.length) return;
  selectedSkinIndex.value = i;
  scrollThumbIntoView(i);
}
function prevSkin() {
  const n = skins.value.length;
  if (n) selectSkin((selectedSkinIndex.value - 1 + n) % n);
}
function nextSkin() {
  const n = skins.value.length;
  if (n) selectSkin((selectedSkinIndex.value + 1) % n);
}

const metaEntries = computed(() => metaEntriesOf(props.champ?.name));
const metaPatch = computed(() => metaInfo().patch);
const damageLabel = computed(() => DAMAGE_LABELS[metrics.value?.damageType] || DAMAGE_LABELS.AD);

const radarAxes = computed(() =>
  TACTICAL_DIMENSIONS.map((dim) => ({ label: dim.label, value: (Number(metrics.value?.[dim.key]) || 0) * 20 }))
);

const loreShort = computed(() => {
  const text = sanitizeDDragonText(detail.value?.lore || '');
  return text.length > 600 ? `${text.slice(0, 600)}…` : text;
});

const abilities = computed(() => {
  if (!detail.value) return [];
  const list = [];
  if (detail.value.passive) {
    list.push({
      key: 'P',
      name: detail.value.passive.name,
      desc: sanitizeDDragonText(detail.value.passive.description),
      icon: championPassiveImage(detail.value.passive.image?.full)
    });
  }
  const keys = ['Q', 'W', 'E', 'R'];
  (detail.value.spells || []).forEach((spell, i) => {
    list.push({
      key: keys[i] || '·',
      name: spell.name,
      desc: sanitizeDDragonText(spell.description),
      icon: championSpellImage(spell.image?.full)
    });
  });
  return list;
});

function roleLabel(role) {
  return ROLES.find((r) => r.key === role)?.label || role;
}

async function loadDetail() {
  loadingDetail.value = true;
  detailError.value = null;
  try {
    detail.value = await fetchChampionDetail(props.champ.name);
  } catch (e) {
    detailError.value = e.message || 'Falha ao carregar a ficha.';
  } finally {
    loadingDetail.value = false;
  }
}

onMounted(() => {
  loadDetail();
  window.addEventListener('resize', onResize);
});
onUnmounted(() => window.removeEventListener('resize', onResize));

watch(() => props.champ?.name, (novo, antigo) => {
  if (novo && novo !== antigo) {
    detail.value = null;
    activeBuildIndex.value = 0;
    selectedSkinIndex.value = 0;
    loadDetail();
  }
});
</script>

<style>
/* Não-scoped e com nome único: a classe utilitária do Tailwind animate-[skinFade_...]
   referencia este keyframe globalmente (scoped renomearia o keyframe e quebraria o match). */
@keyframes skinFade {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
