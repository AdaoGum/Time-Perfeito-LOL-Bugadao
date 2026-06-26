<template>
  <div class="space-y-5">

    <!-- ============================ FILTROS ============================ -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 shadow-xl">
      <div class="flex flex-col gap-3">

        <!-- Quantidade de partidas -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Amostra</span>
          <div class="flex gap-1 rounded-lg border border-slate-700 bg-slate-950 p-0.5">
            <button v-for="s in SAMPLE_SIZES" :key="s"
              type="button"
              @click="sampleSize = s"
              :disabled="!sizeEnabled(s)"
              :title="sizeEnabled(s) ? `Analisar ${s === 'all' ? 'todas as' : 'as últimas ' + s} partidas filtradas` : 'Sem partidas suficientes'"
              class="rounded-md px-3 py-1 text-[11px] font-bold transition"
              :class="sampleSize === s ? 'bg-blue-600 text-white' : (sizeEnabled(s) ? 'text-slate-400 hover:text-slate-200' : 'cursor-not-allowed text-slate-600 opacity-40')"
            >{{ s === 'all' ? 'Todas' : s }}</button>
          </div>
          <span class="text-[11px] font-semibold text-slate-500">{{ sample.length }} de {{ filteredAll.length }} jogos analisados</span>
        </div>

        <!-- Rota -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Rota</span>
          <div class="flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-950 p-0.5">
            <button v-for="r in ROLE_BUTTONS" :key="r.value"
              type="button"
              @click="roleFilter = r.value"
              class="flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-bold transition"
              :class="roleFilter === r.value ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'"
            >
              <img v-if="r.icon" :src="r.icon" class="h-3.5 w-3.5 brightness-200" :alt="r.label" />
              {{ r.label }}
            </button>
          </div>
        </div>

        <!-- Fila + Campeão -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Fila</span>
            <select v-model="queueFilter"
              class="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-bold text-slate-200 focus:border-blue-500 focus:outline-none">
              <option value="ALL">Todas as filas</option>
              <option value="SOLO">Ranqueada Solo/Duo</option>
              <option value="FLEX">Ranqueada Flex</option>
              <option value="NORMAL">Normais</option>
              <option value="ARAM">ARAM</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Campeão</span>
            <select v-model="championFilter"
              class="max-w-[180px] rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-bold text-slate-200 focus:border-blue-500 focus:outline-none">
              <option value="ALL">Todos os campeões</option>
              <option v-for="c in championOptions" :key="c.name" :value="c.name">{{ c.name }} ({{ c.games }})</option>
            </select>
          </div>

          <button v-if="hasActiveFilters" type="button" @click="resetFilters"
            class="rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] font-bold text-amber-300 transition hover:bg-slate-800">
            ✕ Limpar filtros
          </button>
        </div>
      </div>
    </section>

    <!-- ===================== ESTADO VAZIO ===================== -->
    <div v-if="!agg" class="rounded-2xl border border-slate-800 bg-slate-900/80 p-10 text-center">
      <p class="text-3xl mb-2">🦴</p>
      <p class="font-bold text-slate-300">Nenhuma partida para os filtros selecionados.</p>
      <p class="text-xs text-slate-500 mt-1">Os ancestrais ainda estão sincronizando o histórico — ele se enche durante a busca da madrugada.</p>
    </div>

    <template v-else>
      <!-- ===================== CARDS DE RESUMO ===================== -->
      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black" :class="agg.winRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ agg.winRate }}%</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Win Rate</div>
          <div class="text-[10px] text-slate-500">{{ agg.wins }}V / {{ agg.losses }}D</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-emerald-400">{{ agg.kda }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">KDA</div>
          <div class="text-[10px] text-slate-500">{{ agg.avgKills }}/{{ agg.avgDeaths }}/{{ agg.avgAssists }}</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-amber-400">{{ agg.csMin }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">CS / min</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-teal-300">{{ agg.kp }}%</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Participação</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-indigo-300">{{ agg.avgVision }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Visão / jogo</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-yellow-300">{{ agg.goldPerMin }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Ouro / min</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-rose-300">{{ formatK(agg.avgDmg) }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Dano / jogo</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-slate-200">{{ agg.distinctChamps }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Campeões</div>
        </div>
      </section>

      <!-- ===================== TAGS ===================== -->
      <section v-if="tags.length" class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
        <h3 class="mb-3 text-sm font-bold text-slate-100">🏷️ O que define este jogador</h3>
        <div class="flex flex-wrap gap-2">
          <span v-for="tag in tags" :key="tag.label"
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold" :class="tag.cls">
            <span>{{ tag.icon }}</span>{{ tag.label }}
          </span>
        </div>
      </section>

      <!-- ===================== GRÁFICO 1 e 2: RADAR + DONUT DE ROTAS ===================== -->
      <div class="grid gap-4 lg:grid-cols-2">

        <!-- Radar GPI -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <h3 class="mb-1 text-sm font-bold text-slate-100">📡 Perfil de Jogo (GPI)</h3>
          <p class="mb-3 text-[11px] text-slate-500">Pontos fortes e fracos normalizados de 0 a 100 dentro da amostra atual.</p>
          <div class="mx-auto w-full max-w-[280px]">
            <RadarChart :axes="radar" :size="260" color="#38bdf8" />
          </div>
        </section>

        <!-- Donut de rotas -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <h3 class="mb-1 text-sm font-bold text-slate-100">🧭 Distribuição por Rota</h3>
          <p class="mb-3 text-[11px] text-slate-500">Quantas partidas (e win rate) por posição na amostra.</p>
          <div v-if="roleData.total" class="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-around">
            <svg viewBox="0 0 140 140" class="h-40 w-40 flex-shrink-0">
              <g transform="rotate(-90 70 70)">
                <circle v-for="s in roleData.segments" :key="s.role"
                  cx="70" cy="70" r="54" fill="none" :stroke="s.color" stroke-width="18"
                  :stroke-dasharray="`${s.dash.toFixed(2)} ${s.gap.toFixed(2)}`"
                  :stroke-dashoffset="s.offset.toFixed(2)" />
              </g>
              <text x="70" y="66" text-anchor="middle" class="fill-white" style="font-size:20px;font-weight:800">{{ roleData.total }}</text>
              <text x="70" y="83" text-anchor="middle" class="fill-slate-400" style="font-size:8px;font-weight:700">JOGOS C/ ROTA</text>
            </svg>
            <div class="w-full max-w-[180px] space-y-1.5">
              <div v-for="r in roleData.list" :key="r.role" class="flex items-center gap-2 text-[11px]">
                <span class="h-3 w-3 flex-shrink-0 rounded-sm" :style="{ background: r.color }"></span>
                <span class="font-bold text-slate-200 w-10">{{ r.label }}</span>
                <span class="text-slate-500">{{ r.games }}j ({{ r.pct }}%)</span>
                <span class="ml-auto font-black" :class="r.winRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ r.winRate }}%</span>
              </div>
            </div>
          </div>
          <p v-else class="py-8 text-center text-xs text-slate-500">Sem partidas com rota definida (ex.: ARAM) na amostra.</p>
        </section>
      </div>

      <!-- ===================== GRÁFICO 3: BARRAS DE CAMPEÕES ===================== -->
      <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
        <h3 class="mb-1 text-sm font-bold text-slate-100">⚔️ Desempenho por Campeão</h3>
        <p class="mb-3 text-[11px] text-slate-500">Top {{ champBars.length }} campeões mais jogados na amostra — barra azul = % de vitórias.</p>
        <div class="space-y-2.5">
          <div v-for="c in champBars" :key="c.name">
            <div class="mb-1 flex items-center justify-between text-[11px]">
              <div class="flex min-w-0 items-center gap-2">
                <img :src="championImage(c.name)" class="h-6 w-6 flex-shrink-0 rounded-full border border-slate-600" :alt="c.name" loading="lazy" />
                <span class="truncate font-bold text-slate-200">{{ c.name }}</span>
                <span class="flex-shrink-0 text-slate-500">{{ c.games }}j</span>
              </div>
              <div class="flex flex-shrink-0 items-center gap-3">
                <span class="hidden sm:inline text-slate-400">{{ c.csMin }} cs/m</span>
                <span class="font-bold" :class="c.kda >= 4 ? 'text-amber-400' : 'text-slate-300'">{{ c.kda }} KDA</span>
                <span class="w-9 text-right font-black" :class="c.winRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ c.winRate }}%</span>
              </div>
            </div>
            <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-rose-900/40">
              <div class="h-full bg-blue-500 transition-all duration-700" :style="{ width: c.winRate + '%' }"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================== GRÁFICO 4: LINHA DE EVOLUÇÃO ===================== -->
      <section v-if="trend" class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
        <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-bold text-slate-100">📈 Evolução ao Longo do Tempo</h3>
          <div class="flex items-center gap-4 text-[10px] font-bold">
            <span class="flex items-center gap-1"><span class="h-2 w-4 rounded-sm bg-blue-500"></span>Win Rate</span>
            <span class="flex items-center gap-1"><span class="h-0 w-4 border-t-2 border-dashed border-amber-400"></span>KDA</span>
          </div>
        </div>
        <p class="mb-3 text-[11px] text-slate-500">Da partida mais antiga (esq.) à mais recente (dir.), agrupadas em {{ trend.blocks.length }} blocos.</p>
        <svg :viewBox="`0 0 ${trend.W} ${trend.H}`" class="h-auto w-full">
          <!-- linha de referência 50% -->
          <line :x1="0" :x2="trend.W" :y1="trend.y50" :y2="trend.y50" stroke="#475569" stroke-width="1" stroke-dasharray="3 3" />
          <text :x="2" :y="trend.y50 - 3" class="fill-slate-500" style="font-size:7px;font-weight:700">50%</text>
          <!-- área win rate -->
          <path :d="trend.wrArea" fill="#3b82f626" />
          <!-- linha win rate -->
          <path :d="trend.wrPath" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" />
          <!-- linha KDA -->
          <path :d="trend.kdaPath" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round" stroke-dasharray="4 3" />
          <!-- pontos -->
          <circle v-for="(p, i) in trend.wrPts" :key="'w' + i" :cx="p.x" :cy="p.y" r="2.5" fill="#3b82f6">
            <title>Bloco {{ i + 1 }}: {{ p.wr }}% WR ({{ p.games }} jogos)</title>
          </circle>
          <circle v-for="(p, i) in trend.kdaPts" :key="'k' + i" :cx="p.x" :cy="p.y" r="2.5" fill="#f59e0b">
            <title>Bloco {{ i + 1 }}: {{ p.kda }} KDA</title>
          </circle>
        </svg>
      </section>

      <!-- ===================== GRÁFICO 5 + FORMA ===================== -->
      <div class="grid gap-4 lg:grid-cols-2">

        <!-- Multikills (barras verticais) -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <h3 class="mb-1 text-sm font-bold text-slate-100">💥 Destaques de Combate</h3>
          <p class="mb-3 text-[11px] text-slate-500">Total de abates especiais acumulados na amostra.</p>
          <div class="flex h-40 items-end justify-around gap-3 border-b border-slate-800 px-2 pb-1">
            <div v-for="b in multiBars" :key="b.label" class="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span class="text-[11px] font-black text-slate-200">{{ b.value }}</span>
              <div class="w-full max-w-[34px] rounded-t transition-all duration-700" :class="b.color" :style="{ height: `${Math.max(2, b.pct)}%` }"></div>
            </div>
          </div>
          <div class="mt-1 flex justify-around gap-3 px-2">
            <span v-for="b in multiBars" :key="b.label" class="flex-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-400">{{ b.label }}</span>
          </div>
        </section>

        <!-- Forma recente (sequência de resultados) -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <h3 class="mb-1 text-sm font-bold text-slate-100">🔥 Forma Recente</h3>
          <p class="mb-3 text-[11px] text-slate-500">Últimos resultados (mais recente à esquerda) e sequências da amostra.</p>
          <div class="mb-4 flex flex-wrap gap-1.5">
            <span v-for="(m, i) in form.recent" :key="i"
              class="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-black"
              :class="m.win ? 'bg-blue-600/80 text-white' : 'bg-red-600/80 text-white'"
              :title="`${m.championName} — ${m.win ? 'Vitória' : 'Derrota'}`">
              {{ m.win ? 'V' : 'D' }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div class="text-lg font-black" :class="form.streakType ? 'text-blue-400' : 'text-red-400'">{{ form.streak }}{{ form.streakType ? 'V' : 'D' }}</div>
              <div class="text-[9px] font-bold uppercase tracking-wide text-slate-400">Sequência atual</div>
            </div>
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div class="text-lg font-black text-blue-400">{{ form.bestWin }}V</div>
              <div class="text-[9px] font-bold uppercase tracking-wide text-slate-400">Melhor sequência</div>
            </div>
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div class="text-lg font-black text-red-400">{{ form.bestLoss }}D</div>
              <div class="text-[9px] font-bold uppercase tracking-wide text-slate-400">Pior sequência</div>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { state } from '../store.js';
import { championImage } from '../utils.js';
import RadarChart from './RadarChart.vue';

const store = state;
const num = (v) => Number(v || 0);
const formatK = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v)));

const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Sup' };
const ROLE_COLORS = { TOP: '#f59e0b', JUNGLE: '#22c55e', MIDDLE: '#06b6d4', BOTTOM: '#f43f5e', UTILITY: '#a855f7' };
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
const SAMPLE_SIZES = [20, 50, 100, 200, 'all'];

const miniRoleIcon = (pos) => {
  const map = { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'middle', BOTTOM: 'bottom', UTILITY: 'utility' };
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${map[pos]}.png`;
};
const ROLE_BUTTONS = [
  { value: 'ALL', label: 'Todas', icon: null },
  ...ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r], icon: miniRoleIcon(r) }))
];

// -------------------- Filtros --------------------
const sampleSize = ref(50);
const roleFilter = ref('ALL');
const championFilter = ref('ALL');
const queueFilter = ref('ALL');

const proficiency = computed(() => store.searchProfile.proficiencyMatches || []);

const hasActiveFilters = computed(() =>
  roleFilter.value !== 'ALL' || championFilter.value !== 'ALL' || queueFilter.value !== 'ALL'
);
function resetFilters() {
  roleFilter.value = 'ALL';
  championFilter.value = 'ALL';
  queueFilter.value = 'ALL';
}

// Habilita uma amostra somente quando há jogos suficientes no total (mantém 'all' e o menor sempre)
const sizeEnabled = (s) => s === 'all' || s === SAMPLE_SIZES[0] || proficiency.value.length >= s;

// Ao trocar de jogador: zera filtros e escolhe a maior amostra preset disponível
watch(() => store.searchProfile.puuid, () => {
  resetFilters();
  const n = proficiency.value.length;
  sampleSize.value = n >= 100 ? 100 : n >= 50 ? 50 : n >= 20 ? 20 : 'all';
}, { immediate: true });

const queuePredicate = (m) => {
  const q = num(m.queueId);
  switch (queueFilter.value) {
    case 'SOLO': return q === 420;
    case 'FLEX': return q === 440;
    case 'NORMAL': return q === 400 || q === 430;
    case 'ARAM': return q === 450;
    default: return true;
  }
};

const byRoleQueue = computed(() => proficiency.value.filter((m) => {
  if (!queuePredicate(m)) return false;
  if (roleFilter.value !== 'ALL' && m.teamPosition !== roleFilter.value) return false;
  return true;
}));

const championOptions = computed(() => {
  const counts = {};
  for (const m of byRoleQueue.value) {
    if (m.championName) counts[m.championName] = (counts[m.championName] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, games]) => ({ name, games }));
});

// Se o campeão selecionado some ao mudar rota/fila, volta para "Todos"
watch([roleFilter, queueFilter], () => {
  if (championFilter.value !== 'ALL' && !championOptions.value.some((c) => c.name === championFilter.value)) {
    championFilter.value = 'ALL';
  }
});

const filteredAll = computed(() =>
  byRoleQueue.value.filter((m) => championFilter.value === 'ALL' || m.championName === championFilter.value)
);

// Amostra final (proficiency já vem ordenada da mais recente para a mais antiga)
const sample = computed(() => sampleSize.value === 'all' ? filteredAll.value : filteredAll.value.slice(0, sampleSize.value));

// -------------------- Agregados --------------------
const agg = computed(() => {
  const ms = sample.value;
  const n = ms.length;
  if (!n) return null;
  let wins = 0, k = 0, d = 0, a = 0, cs = 0, dur = 0, gold = 0, dmg = 0, vision = 0, control = 0, timeDead = 0;
  let dbl = 0, tpl = 0, qd = 0, pt = 0, solo = 0;
  let gpmSum = 0, gpmCnt = 0, kpSum = 0, kpCnt = 0;
  for (const m of ms) {
    if (m.win) wins++;
    k += num(m.kills); d += num(m.deaths); a += num(m.assists);
    cs += num(m.cs); dur += num(m.gameDuration);
    gold += num(m.goldEarned); dmg += num(m.damageChampions);
    vision += num(m.visionScore); control += num(m.controlWards); timeDead += num(m.totalTimeSpentDead);
    dbl += num(m.doubleKills); tpl += num(m.tripleKills); qd += num(m.quadraKills); pt += num(m.pentaKills); solo += num(m.soloKills);
    if (m.goldPerMin) { gpmSum += num(m.goldPerMin); gpmCnt++; }
    if (m.killParticipation != null) { kpSum += num(m.killParticipation); kpCnt++; }
  }
  const kda = d === 0 ? (k + a) : (k + a) / d;
  const csMin = dur > 0 ? cs / (dur / 60) : 0;
  return {
    games: n, wins, losses: n - wins, winRate: Math.round(wins / n * 100),
    kda: +kda.toFixed(2),
    avgKills: +(k / n).toFixed(1), avgDeaths: +(d / n).toFixed(1), avgAssists: +(a / n).toFixed(1),
    csMin: +csMin.toFixed(1),
    goldPerMin: gpmCnt ? Math.round(gpmSum / gpmCnt) : (dur > 0 ? Math.round(gold / (dur / 60)) : 0),
    avgDmg: Math.round(dmg / n),
    avgVision: +(vision / n).toFixed(1),
    avgControl: +(control / n).toFixed(1),
    kp: kpCnt ? Math.round(kpSum / kpCnt * 100) : 0,
    multi: { double: dbl, triple: tpl, quadra: qd, penta: pt, solo },
    distinctChamps: new Set(ms.map((m) => m.championName).filter(Boolean)).size
  };
});

// -------------------- Radar GPI --------------------
const radar = computed(() => {
  const a = agg.value;
  if (!a) return [];
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  return [
    { label: 'Win Rate', value: clamp(a.winRate) },
    { label: 'KDA', value: clamp(a.kda / 5 * 100) },
    { label: 'Farm', value: clamp(a.csMin / 10 * 100) },
    { label: 'Agressão', value: clamp(a.avgKills / 12 * 100) },
    { label: 'Sobrevivência', value: clamp(100 - a.avgDeaths / 12 * 100) },
    { label: 'Visão', value: clamp(a.avgVision / 60 * 100) },
    { label: 'Ouro/min', value: clamp(a.goldPerMin / 500 * 100) },
    { label: 'Participação', value: clamp(a.kp) }
  ];
});

// -------------------- Barras de campeões --------------------
const champBars = computed(() => {
  const map = {};
  for (const m of sample.value) {
    const name = m.championName;
    if (!name) continue;
    const c = map[name] || (map[name] = { name, games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0, dur: 0 });
    c.games++; if (m.win) c.wins++;
    c.k += num(m.kills); c.d += num(m.deaths); c.a += num(m.assists);
    c.cs += num(m.cs); c.dur += num(m.gameDuration);
  }
  return Object.values(map).map((c) => ({
    name: c.name, games: c.games, wins: c.wins, losses: c.games - c.wins,
    winRate: Math.round(c.wins / c.games * 100),
    kda: +(c.d === 0 ? (c.k + c.a) : (c.k + c.a) / c.d).toFixed(2),
    csMin: +(c.dur > 0 ? c.cs / (c.dur / 60) : 0).toFixed(1)
  })).sort((a, b) => b.games - a.games).slice(0, 10);
});

// -------------------- Donut de rotas --------------------
const roleData = computed(() => {
  const counts = {};
  let total = 0;
  for (const m of sample.value) {
    const r = m.teamPosition;
    if (!ROLES.includes(r)) continue;
    counts[r] = (counts[r] || 0) + 1;
    total++;
  }
  if (!total) return { total: 0, segments: [], list: [] };
  const C = 2 * Math.PI * 54;
  const list = ROLES.filter((r) => counts[r]).map((r) => {
    const games = counts[r];
    const wins = sample.value.filter((m) => m.teamPosition === r && m.win).length;
    return { role: r, label: ROLE_LABELS[r], color: ROLE_COLORS[r], games, wins, winRate: Math.round(wins / games * 100), pct: Math.round(games / total * 100) };
  }).sort((a, b) => b.games - a.games);
  let offset = 0;
  const segments = list.map((item) => {
    const dash = (item.games / total) * C;
    const seg = { ...item, dash, gap: C - dash, offset: -offset };
    offset += dash;
    return seg;
  });
  return { total, segments, list };
});

// -------------------- Linha de evolução --------------------
const trend = computed(() => {
  const ms = [...sample.value].reverse(); // mais antiga -> mais recente
  const n = ms.length;
  if (n < 2) return null;
  const buckets = Math.min(12, n);
  const per = Math.ceil(n / buckets);
  const blocks = [];
  for (let i = 0; i < n; i += per) {
    const chunk = ms.slice(i, i + per);
    let wins = 0, k = 0, d = 0, a = 0;
    for (const m of chunk) { if (m.win) wins++; k += num(m.kills); d += num(m.deaths); a += num(m.assists); }
    const kda = d === 0 ? (k + a) : (k + a) / d;
    blocks.push({ wr: Math.round(wins / chunk.length * 100), kda: +kda.toFixed(2), games: chunk.length });
  }
  const W = 320, H = 130, padX = 10, padY = 14;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const maxKda = Math.max(3, ...blocks.map((b) => b.kda));
  const xAt = (i) => blocks.length === 1 ? W / 2 : padX + (i / (blocks.length - 1)) * innerW;
  const yWr = (v) => padY + (1 - v / 100) * innerH;
  const yKda = (v) => padY + (1 - v / maxKda) * innerH;
  const wrPts = blocks.map((b, i) => ({ x: xAt(i), y: yWr(b.wr), ...b }));
  const kdaPts = blocks.map((b, i) => ({ x: xAt(i), y: yKda(b.kda), ...b }));
  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const baseY = H - padY;
  const wrArea = `${line(wrPts)} L${wrPts[wrPts.length - 1].x.toFixed(1)} ${baseY} L${wrPts[0].x.toFixed(1)} ${baseY} Z`;
  return { W, H, y50: padY + 0.5 * innerH, wrPts, kdaPts, wrPath: line(wrPts), kdaPath: line(kdaPts), wrArea, blocks };
});

// -------------------- Multikills --------------------
const multiBars = computed(() => {
  const a = agg.value;
  if (!a) return [];
  const m = a.multi;
  const items = [
    { label: 'Solo', value: m.solo, color: 'bg-cyan-500' },
    { label: 'Double', value: m.double, color: 'bg-emerald-500' },
    { label: 'Triple', value: m.triple, color: 'bg-amber-500' },
    { label: 'Quadra', value: m.quadra, color: 'bg-orange-500' },
    { label: 'Penta', value: m.penta, color: 'bg-rose-500' }
  ];
  const max = Math.max(1, ...items.map((i) => i.value));
  return items.map((i) => ({ ...i, pct: Math.round(i.value / max * 100) }));
});

// -------------------- Forma recente --------------------
const form = computed(() => {
  const recent = sample.value.slice(0, 25); // mais recente primeiro
  let streakType = null, streak = 0;
  for (const m of recent) {
    if (streakType === null) { streakType = !!m.win; streak = 1; }
    else if (!!m.win === streakType) streak++;
    else break;
  }
  const chrono = [...sample.value].reverse();
  let bestWin = 0, curW = 0, bestLoss = 0, curL = 0;
  for (const m of chrono) {
    if (m.win) { curW++; curL = 0; } else { curL++; curW = 0; }
    bestWin = Math.max(bestWin, curW);
    bestLoss = Math.max(bestLoss, curL);
  }
  return { recent, streakType, streak, bestWin, bestLoss };
});

// -------------------- Tags --------------------
const tags = computed(() => {
  const a = agg.value;
  if (!a) return [];
  const t = [];
  if (a.winRate >= 55) t.push({ label: 'Em Ascensão', icon: '📈', cls: 'border-emerald-600/50 bg-emerald-950/40 text-emerald-300' });
  else if (a.winRate < 45 && a.games >= 15) t.push({ label: 'Fase Difícil', icon: '📉', cls: 'border-rose-600/50 bg-rose-950/40 text-rose-300' });
  if (a.kda >= 4) t.push({ label: 'Jogador Focado', icon: '🎯', cls: 'border-amber-600/50 bg-amber-950/40 text-amber-300' });
  if (a.avgDeaths <= 4) t.push({ label: 'Difícil de Matar', icon: '🛡️', cls: 'border-cyan-600/50 bg-cyan-950/40 text-cyan-300' });
  if (a.avgKills >= 8) t.push({ label: 'Carregador', icon: '⚔️', cls: 'border-red-600/50 bg-red-950/40 text-red-300' });
  if (a.csMin >= 7.5) t.push({ label: 'Mestre do Farm', icon: '🌾', cls: 'border-lime-600/50 bg-lime-950/40 text-lime-300' });
  if (a.avgVision >= 40) t.push({ label: 'Controle de Visão', icon: '👁️', cls: 'border-indigo-600/50 bg-indigo-950/40 text-indigo-300' });
  if (a.kp >= 60) t.push({ label: 'Sempre Presente', icon: '🤝', cls: 'border-teal-600/50 bg-teal-950/40 text-teal-300' });
  if (a.multi.penta > 0) t.push({ label: `${a.multi.penta} Penta${a.multi.penta > 1 ? 's' : ''}`, icon: '🏆', cls: 'border-yellow-500/50 bg-yellow-950/40 text-yellow-300' });
  if (a.distinctChamps >= 12) t.push({ label: 'Versátil', icon: '🔄', cls: 'border-fuchsia-600/50 bg-fuchsia-950/40 text-fuchsia-300' });
  else if (a.distinctChamps > 0 && a.distinctChamps <= 3) t.push({ label: 'One-Trick', icon: '🐎', cls: 'border-purple-600/50 bg-purple-950/40 text-purple-300' });
  if (a.winRate >= 45 && a.winRate <= 55 && a.games >= 20) t.push({ label: 'Consistente', icon: '⚖️', cls: 'border-slate-600/50 bg-slate-800/60 text-slate-300' });
  if (!t.length) t.push({ label: 'Jogador Equilibrado', icon: '🎮', cls: 'border-slate-600/50 bg-slate-800/60 text-slate-300' });
  return t;
});
</script>
