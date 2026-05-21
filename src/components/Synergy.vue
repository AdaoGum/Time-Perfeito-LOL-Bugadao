<template>
  <div class="space-y-6">
    <!-- Controls -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="mb-2 text-xs font-bold uppercase text-slate-400">Tipo de Fila</p>
          <div class="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1">
            <button
              type="button"
              @click="store.teamPlanner.queueType = 'solo_duo'"
              class="rounded-md px-4 py-1.5 text-sm font-semibold transition"
              :class="store.teamPlanner.queueType === 'solo_duo' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'"
            >Solo/Duo</button>
            <button
              type="button"
              @click="store.teamPlanner.queueType = 'flex'"
              class="rounded-md px-4 py-1.5 text-sm font-semibold transition"
              :class="store.teamPlanner.queueType === 'flex' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'"
            >Fila Flex</button>
          </div>
        </div>
        <div>
          <p class="mb-2 text-xs font-bold uppercase text-slate-400">Tamanho da Equipe</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="count in [1,2,3,4,5]"
              :key="count"
              type="button"
              @click="store.teamPlanner.playerCount = count"
              class="h-10 w-10 rounded-full border-2 text-sm font-bold transition"
              :class="store.teamPlanner.playerCount === count
                ? 'border-cyan-500 bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500 hover:text-white'"
            >{{ count }}</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Slots -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
      <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <article
          v-for="(slot, index) in activeSlots"
          :key="slot.id"
          class="relative flex flex-col rounded-xl border border-slate-800 bg-slate-950/50 p-4 shadow-inner"
        >
          <div class="mb-4 flex flex-col gap-2">
            <h3 class="text-center text-xs font-bold uppercase tracking-widest text-slate-500">Slot {{ index + 1 }}</h3>
            <div class="flex rounded-md border border-slate-700 bg-slate-900 p-1 text-xs mx-auto">
              <button
                type="button"
                @click="slot.type = 'profile'"
                class="rounded px-2 py-1 font-semibold"
                :class="slot.type === 'profile' ? 'bg-blue-600 text-white' : 'text-slate-400'"
              >Buscar Perfil</button>
              <button
                type="button"
                @click="slot.type = 'anonymous'"
                class="rounded px-2 py-1 font-semibold"
                :class="slot.type === 'anonymous' ? 'bg-slate-700 text-white' : 'text-slate-400'"
              >Anônimo</button>
            </div>
          </div>

          <div v-if="slot.error" class="mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
            :class="isRateLimit(slot.error) ? 'border-amber-700 bg-amber-950/40 text-amber-300' : 'border-red-800 bg-red-950/40 text-red-300'">
            <p>{{ slot.error }}</p>
            <button @click="slot.error = null" class="rounded border border-current px-2 py-0.5 text-xs font-semibold hover:opacity-80" type="button">Fechar</button>
          </div>

          <div class="flex-1 space-y-3">
            <!-- Loading -->
            <template v-if="slot.loading">
              <div class="h-10 w-full animate-pulse rounded bg-slate-800"></div>
              <div class="h-24 w-full animate-pulse rounded bg-slate-800"></div>
            </template>

            <!-- Anonymous type -->
            <template v-else-if="slot.type === 'anonymous'">
              <input
                v-model="slot.query"
                @input="updateAnonymousQuery(slot)"
                class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                placeholder="Buscar campeão..."
              />
              <div v-if="slot.suggestions.length" class="absolute left-0 top-[120px] z-20 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                <button
                  v-for="name in slot.suggestions.slice(0, 6)"
                  :key="name"
                  type="button"
                  @click="selectSuggestion(slot, name)"
                  class="flex w-full items-center gap-3 border-b border-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-blue-900/50"
                >
                  <img :src="championImage(name)" class="h-6 w-6 rounded" />{{ name }}
                </button>
              </div>
              <div v-if="slot.championSelected" class="mt-4 flex flex-col items-center rounded-xl border border-cyan-800 bg-cyan-950/20 p-4 shadow-inner">
                <img class="h-20 w-20 rounded-xl border-2 border-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.4)]" :src="championImage(slot.championSelected)" />
                <p class="mt-3 text-sm font-bold text-cyan-300">{{ slot.championSelected }}</p>
              </div>
            </template>

            <!-- Profile type -->
            <template v-else>
              <template v-if="slot.searchedData">
                <div class="rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-inner">
                  <p class="mb-2 text-center text-[10px] font-bold uppercase text-slate-400">Escolha o Campeão</p>
                  <div class="space-y-1">
                    <button
                      v-for="entry in slot.masteryChoices"
                      :key="entry.championName"
                      type="button"
                      @click="slot.championSelected = entry.championName"
                      class="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-900 px-2 py-1.5 hover:border-blue-500 hover:bg-blue-950/30 transition"
                    >
                      <span class="flex items-center gap-2 text-xs font-semibold text-slate-200">
                        <img class="h-5 w-5 rounded" :src="championImage(entry.championName)" />{{ entry.championName }}
                      </span>
                      <span class="text-[10px] font-bold text-amber-500">M{{ entry.championLevel }}</span>
                    </button>
                  </div>
                </div>
                <button type="button" @click="clearSlot(slot)" class="mt-2 w-full rounded-lg border border-slate-700 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition">Trocar Perfil</button>
                <div v-if="slot.championSelected" class="mt-3 text-center border-t border-slate-800 pt-3">
                  <p class="text-[10px] font-bold uppercase text-blue-400 mb-1">Confirmado</p>
                  <div class="inline-flex items-center gap-2 rounded bg-blue-900/40 px-2 py-1 border border-blue-800">
                    <img class="h-6 w-6 rounded" :src="championImage(slot.championSelected)" />
                    <span class="text-xs font-bold text-blue-200">{{ slot.championSelected }}</span>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="flex flex-col gap-2">
                  <input
                    :value="slot.gameName && slot.tagLine ? `${slot.gameName}#${slot.tagLine}` : ''"
                    @input="updateSlotSummoner(slot, $event)"
                    class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                    placeholder="Ex: Kami#BR1"
                  />
                  <button type="button" @click="handleSlotFetch(slot)" class="rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-500 shadow">Puxar Perfil</button>
                </div>
              </template>
            </template>
          </div>

          <!-- Comfort zone -->
          <div class="mt-4 border-t border-slate-800 pt-3">
            <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Zona de Conforto do Invocador</p>
            <div class="grid grid-cols-5 gap-1.5">
              <!-- Empty placeholders when no data -->
              <template v-if="!(slot.type === 'profile' && slot.searchedData && slot.masteryChoices.length)">
                <div v-for="i in 5" :key="i" class="rounded-md border border-slate-700 bg-slate-800/60 p-1 text-center">
                  <div class="flex h-10 w-full items-center justify-center rounded bg-slate-900 text-xl font-black text-slate-500">?</div>
                  <p class="mt-1 truncate text-[9px] text-slate-500">Oculto</p>
                </div>
              </template>
              <!-- Mastery choices grid -->
              <template v-else>
                <div class="col-span-5 space-y-2">
                  <div class="grid grid-cols-5 gap-1">
                    <button
                      v-for="(entry, idx) in slot.masteryChoices.slice(0, 15)"
                      :key="entry.championName"
                      type="button"
                      @click="slot.championSelected = entry.championName"
                      class="relative flex flex-col items-center rounded-md border p-0.5 transition"
                      :class="slot.championSelected === entry.championName
                        ? 'border-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.5)] bg-lime-950/30'
                        : idx < 5 ? 'border-cyan-600/60 bg-slate-900/80 hover:border-cyan-400'
                        : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-500'"
                    >
                      <span v-if="idx < 5" class="absolute -right-1 -top-1 text-[9px] leading-none">{{ medalIcons[idx] }}</span>
                      <img class="h-10 w-10 rounded object-cover" :src="championImage(entry.championName)" loading="lazy" />
                      <p class="mt-0.5 w-full truncate text-center text-[9px] font-semibold text-slate-200 leading-tight">{{ entry.championName }}</p>
                      <span class="text-[9px] font-bold text-amber-400">M{{ entry.championLevel }}</span>
                    </button>
                  </div>
                  <select
                    :value="slot.championSelected"
                    @change="slot.championSelected = $event.target.value"
                    class="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none transition"
                  >
                    <option value="">Qualquer campeão...</option>
                    <option
                      v-for="c in sortedChampionList"
                      :key="c.name"
                      :value="c.name"
                    >{{ c.name }}</option>
                  </select>
                </div>
              </template>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- Analysis section -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <button
        type="button"
        @click="analyzeComposition"
        class="mx-auto flex w-full max-w-lg items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 text-base font-black uppercase tracking-wider text-white shadow-lg transition hover:scale-[1.02] hover:shadow-cyan-900/50"
      >Simular Sinergia de Equipe</button>

      <div v-if="store.teamPlanner.analysisLoading" class="mt-6 flex flex-col items-center gap-3">
        <div class="h-2 w-full max-w-md animate-pulse rounded-full bg-slate-800"></div>
        <div class="h-2 w-64 animate-pulse rounded-full bg-slate-800"></div>
        <p class="text-xs font-bold text-cyan-500 animate-pulse uppercase mt-2">Processando Matriz Tática...</p>
      </div>

      <template v-if="store.teamPlanner.analysisResult">
        <div class="mt-8 grid gap-6 lg:grid-cols-[200px_1fr]">
          <div class="flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/80 p-6 shadow-inner">
            <div class="flex h-28 w-28 items-center justify-center rounded-full border-4 border-cyan-500 bg-cyan-950/40 text-5xl font-black text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.4)]">{{ store.teamPlanner.analysisResult.grade }}</div>
            <p class="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">Nota Final</p>
          </div>
          <div class="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-6">
            <div v-for="bar in analysisBars" :key="bar.label">
              <div class="mb-1.5 flex items-center justify-between text-xs font-bold uppercase text-slate-300">
                <span>{{ bar.label }}</span><span>{{ bar.value }}%</span>
              </div>
              <div class="h-2.5 rounded-full bg-slate-800 shadow-inner">
                <div class="h-full rounded-full shadow" :class="bar.color" :style="{ width: bar.value + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
        <blockquote class="mt-6 rounded-xl border-l-4 border-cyan-500 bg-cyan-950/20 p-5 text-sm leading-relaxed text-cyan-50 shadow-inner italic">
          <span class="font-bold uppercase text-cyan-400 not-italic block mb-2 text-xs tracking-widest">Análise do Coach Virtual:</span>
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
import { workerRequest } from '../api.js';

const store = state;

const medalIcons = ['👑', '🥈', '🥉', '⛓️', '🪵'];

const activeSlots = computed(() => store.teamPlanner.slots.slice(0, store.teamPlanner.playerCount));

const sortedChampionList = computed(() =>
  (store.staticData?.championList || []).slice().sort((a, b) => a.name.localeCompare(b.name))
);

const analysisBars = computed(() => {
  const r = store.teamPlanner.analysisResult;
  if (!r) return [];
  return [
    { label: 'Dano (AD/AP)', value: r.metrics.damageBalance, color: 'bg-blue-500' },
    { label: 'Controle de Grupo (CC)', value: r.metrics.ccScore, color: 'bg-cyan-400' },
    { label: 'Linha de Frente (Tank)', value: r.metrics.frontline, color: 'bg-amber-500' },
    { label: 'Ritmo (Tempo/Scaling)', value: r.metrics.tempo, color: 'bg-purple-500' }
  ];
});

function isRateLimit(msg) {
  return msg?.includes('muitas consultas') || msg?.includes('expirou');
}

function updateSlotSummoner(slot, event) {
  const [n, tg] = event.target.value.split('#');
  slot.gameName = (n || '').trim();
  slot.tagLine = (tg || '').trim();
}

function updateAnonymousQuery(slot) {
  const low = slot.query.toLowerCase();
  slot.suggestions = low
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
  slot.championSelected = '';
  slot.masteryChoices = [];
}

async function handleSlotFetch(slot) {
  if (!slot.gameName?.trim() || !slot.tagLine?.trim()) {
    slot.error = 'Preencha nome e tag.';
    return;
  }

  slot.loading = true;
  slot.error = null;

  try {
    const data = await workerRequest('masteries', { gameName: slot.gameName.trim(), tagLine: slot.tagLine.trim() });

    const fromStaticChamp = (entry) => {
      if (!entry) return { championName: 'Aatrox', championLevel: 1, championPoints: 0 };
      const fromStatic = store.staticData.championList.find((champ) => Number(champ.key) === Number(entry.championId));
      return {
        championName: entry.championName || fromStatic?.name || 'Aatrox',
        championLevel: Number(entry.championLevel || 1),
        championPoints: Number(entry.championPoints || 0)
      };
    };

    const topMasteries = (data.masteries || []).map(fromStaticChamp).slice(0, 15);
    slot.searchedData = data;
    slot.masteryChoices = topMasteries;
  } catch (error) {
    slot.error = error.message;
  } finally {
    slot.loading = false;
  }
}

function getSelectedChampions() {
  return store.teamPlanner.slots.slice(0, store.teamPlanner.playerCount)
    .map(s => s.championSelected)
    .filter(Boolean);
}

function generateCompositionAnalysis(champions) {
  const uniqueCount = new Set(champions).size;
  const hasDuplicates = uniqueCount < champions.length;
  const completeness = Math.round((champions.length / store.teamPlanner.playerCount) * 100);

  const championMeta = champions.map(name => store.staticData.championList.find(c => c.name === name)).filter(Boolean);
  const tags = championMeta.flatMap(c => c.tags || []);

  const adLike = tags.filter(tag => ['Fighter', 'Marksman', 'Assassin'].includes(tag)).length;
  const apLike = tags.filter(tag => ['Mage', 'Support'].includes(tag)).length;
  const ccLike = tags.filter(tag => ['Tank', 'Support'].includes(tag)).length;
  const frontlineLike = tags.filter(tag => ['Tank', 'Fighter'].includes(tag)).length;

  const totalTagBase = Math.max(1, tags.length);
  const damageBalance = 100 - Math.min(100, Math.abs(adLike - apLike) * 18);
  const ccScore = Math.min(100, Math.round((ccLike / totalTagBase) * 100) + 25);
  const frontline = Math.min(100, Math.round((frontlineLike / totalTagBase) * 100) + 20);
  const tempo = Math.max(20, Math.min(100, 60 + (champions.length * 6) - (hasDuplicates ? 25 : 0)));

  let grade = completeness >= 100 && !hasDuplicates ? 'S' : completeness >= 80 && !hasDuplicates ? 'A' : completeness >= 60 ? 'B' : completeness >= 40 ? 'C' : 'D';

  let coach = 'A composição está incompleta. Preencha todos os slots para um feedback tático preciso.';
  if (champions.includes('Yasuo') && champions.includes('Malphite')) coach = 'Combo devastador detectado (Malphite + Yasuo). Foquem em lutar por objetivos em áreas fechadas do mapa.';
  else if (hasDuplicates) coach = 'Campeões repetidos detectados! Lembre-se que no Rift só pode haver um de cada.';
  else if (frontline < 45 && completeness > 80) coach = 'Alerta: Linha de frente extremamente frágil. Vocês sofrerão contra iniciações pesadas (Hard Engage). Um tanque faz falta.';
  else if (damageBalance < 45 && completeness > 80) coach = 'Dano muito concentrado em um único tipo (AD ou AP). O time inimigo vai construir armadura/resistência mágica barata e anular vocês.';
  else if (completeness === 100) coach = 'Composição sólida com boas condições de vitória. Respeitem o tempo de pico (power spike) de cada campeão e controlem a visão.';

  return { grade, metrics: { damageBalance, ccScore, frontline, tempo }, coach };
}

function analyzeComposition() {
  const champs = getSelectedChampions();
  store.teamPlanner.analysisLoading = true;
  store.teamPlanner.analysisResult = null;
  setTimeout(() => {
    store.teamPlanner.analysisResult = generateCompositionAnalysis(champs);
    store.teamPlanner.analysisLoading = false;
  }, 2000);
}
</script>
