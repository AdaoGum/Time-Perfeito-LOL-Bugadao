<template>
  <section class="mx-auto w-full max-w-6xl overflow-hidden rounded-xl border border-cyan-900/50 bg-slate-950/80 shadow-2xl">
    <div
      class="relative p-3 sm:p-4"
      style="background-image: linear-gradient(rgba(2, 6, 23, 0.74), rgba(2, 6, 23, 0.9)), url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ashe_0.jpg'); background-size: cover; background-position: center;"
    >
      <div class="flex flex-wrap items-start justify-between gap-4 border-b border-cyan-900/40 pb-3">
        <div class="flex items-start gap-3">
          <img
            class="h-11 w-11 rounded border border-cyan-600/60 bg-slate-950 object-cover shadow-[0_0_18px_rgba(8,145,178,0.35)]"
            src="https://ddragon.leagueoflegends.com/cdn/15.10.1/img/profileicon/29.png"
            alt="Lobby"
          />
          <div>
            <h2 class="text-lg font-black uppercase tracking-wide text-amber-100">Fogueira Custom 5x5</h2>
            <p class="text-[11px] uppercase tracking-wider text-slate-300">Summoner's Rift • 5v5 • Blind Pick</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            @click="inviteFirstEmpty"
            class="min-w-[112px] rounded border border-amber-500/70 bg-slate-950/70 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-200 hover:bg-slate-900"
          >Invite</button>
          <button
            type="button"
            @click="drawBalancedTeams"
            class="min-w-[112px] rounded border border-yellow-500/70 bg-gradient-to-b from-yellow-600 to-yellow-700 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-950 hover:from-yellow-500 hover:to-yellow-600"
          >Festa da Fogueira</button>
          <button
            type="button"
            @click="drawRandomTeams"
            class="min-w-[112px] rounded border border-cyan-600/70 bg-slate-950/70 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-cyan-200 hover:bg-slate-900"
          >Sortear</button>
        </div>
      </div>

      <p class="mt-2 text-[11px] text-slate-300">
        Funções sem repetição por time: TOP, JUNGLE, MID, ADC, SUP. <span class="font-bold text-amber-300">AUTOFILL</span> é coringa e pode repetir.
      </p>
      <p v-if="statusMessage" class="mt-2 rounded border border-amber-700/40 bg-amber-950/40 px-2 py-1 text-[11px] font-bold text-amber-200">
        {{ statusMessage }}
      </p>

      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 class="mb-1 text-xs font-black uppercase tracking-[0.15em] text-amber-300">Team 1</h3>
          <div class="rounded border border-cyan-900/40 bg-slate-950/45">
            <div
              v-for="slot in blueSlots"
              :key="`blue-${slot.id}`"
              class="border-b border-cyan-900/30 last:border-b-0"
            >
              <div class="flex items-center justify-between gap-2 px-2 py-2 text-xs">
                <div class="min-w-0 flex items-center gap-2">
                  <span class="w-7 text-[10px] font-black text-slate-400">{{ slot.summonerLevel || '-' }}</span>
                  <img
                    class="h-7 w-7 rounded border border-cyan-700/50 object-cover"
                    :src="profileIconUrl(slot.profileIconId)"
                    alt="Icone"
                  />
                  <div class="min-w-0">
                    <p class="truncate font-bold text-amber-100">{{ slot.gameName || 'Empty' }}</p>
                    <p class="truncate text-[10px] text-slate-400">{{ slot.tagLine ? `#${slot.tagLine}` : 'Aguardando jogador' }}</p>
                  </div>
                </div>

                <div class="flex items-center gap-1">
                  <select
                    v-model="slot.role"
                    class="rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[10px] font-black text-slate-200"
                  >
                    <option v-for="role in roleOptions" :key="`blue-role-${slot.id}-${role}`" :value="role">{{ role }}</option>
                  </select>
                  <button
                    v-if="slot.gameName"
                    type="button"
                    @click="clearCustomSlot(slot.id)"
                    class="rounded border border-slate-700 px-2 py-1 text-[10px] font-black text-slate-300 hover:text-white"
                  >X</button>
                  <button
                    v-else
                    type="button"
                    @click="slot.showSearch = !slot.showSearch"
                    class="rounded border border-amber-600/70 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200 hover:bg-slate-900"
                  >Join</button>
                </div>
              </div>

              <div v-if="slot.showSearch" class="space-y-2 px-2 pb-2">
                <SearchBar
                  buttonText="Buscar"
                  @search-start="onSearchStart(slot.id)"
                  @search-success="(data) => onSearchSuccess(slot.id, data)"
                  @search-error="(msg) => onSearchError(slot.id, msg)"
                />
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="setCustomAnonymous(slot.id)"
                    class="rounded border border-amber-700 px-2 py-1 text-[10px] font-black text-amber-300"
                  >Anônimo</button>
                  <button
                    type="button"
                    @click="slot.showSearch = false"
                    class="rounded border border-slate-700 px-2 py-1 text-[10px] font-black text-slate-300"
                  >Fechar</button>
                </div>
                <p v-if="slot.loading" class="text-[10px] font-bold text-cyan-300">Buscando invocador...</p>
                <p v-if="slot.error" class="text-[10px] font-bold text-red-400">{{ slot.error }}</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="mb-1 text-xs font-black uppercase tracking-[0.15em] text-amber-300">Team 2</h3>
          <div class="rounded border border-cyan-900/40 bg-slate-950/45">
            <div
              v-for="slot in redSlots"
              :key="`red-${slot.id}`"
              class="border-b border-cyan-900/30 last:border-b-0"
            >
              <div class="flex items-center justify-between gap-2 px-2 py-2 text-xs">
                <div class="min-w-0 flex items-center gap-2">
                  <span class="w-7 text-[10px] font-black text-slate-400">{{ slot.summonerLevel || '-' }}</span>
                  <img
                    class="h-7 w-7 rounded border border-cyan-700/50 object-cover"
                    :src="profileIconUrl(slot.profileIconId)"
                    alt="Icone"
                  />
                  <div class="min-w-0">
                    <p class="truncate font-bold text-amber-100">{{ slot.gameName || 'Empty' }}</p>
                    <p class="truncate text-[10px] text-slate-400">{{ slot.tagLine ? `#${slot.tagLine}` : 'Aguardando jogador' }}</p>
                  </div>
                </div>

                <div class="flex items-center gap-1">
                  <select
                    v-model="slot.role"
                    class="rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[10px] font-black text-slate-200"
                  >
                    <option v-for="role in roleOptions" :key="`red-role-${slot.id}-${role}`" :value="role">{{ role }}</option>
                  </select>
                  <button
                    v-if="slot.gameName"
                    type="button"
                    @click="clearCustomSlot(slot.id)"
                    class="rounded border border-slate-700 px-2 py-1 text-[10px] font-black text-slate-300 hover:text-white"
                  >X</button>
                  <button
                    v-else
                    type="button"
                    @click="slot.showSearch = !slot.showSearch"
                    class="rounded border border-amber-600/70 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200 hover:bg-slate-900"
                  >Join</button>
                </div>
              </div>

              <div v-if="slot.showSearch" class="space-y-2 px-2 pb-2">
                <SearchBar
                  buttonText="Buscar"
                  @search-start="onSearchStart(slot.id)"
                  @search-success="(data) => onSearchSuccess(slot.id, data)"
                  @search-error="(msg) => onSearchError(slot.id, msg)"
                />
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="setCustomAnonymous(slot.id)"
                    class="rounded border border-amber-700 px-2 py-1 text-[10px] font-black text-amber-300"
                  >Anônimo</button>
                  <button
                    type="button"
                    @click="slot.showSearch = false"
                    class="rounded border border-slate-700 px-2 py-1 text-[10px] font-black text-slate-300"
                  >Fechar</button>
                </div>
                <p v-if="slot.loading" class="text-[10px] font-bold text-cyan-300">Buscando invocador...</p>
                <p v-if="slot.error" class="text-[10px] font-bold text-red-400">{{ slot.error }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 rounded border border-cyan-900/40 bg-slate-950/45 p-2">
        <p class="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-300">Reservas / Espectadores</p>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div
            v-for="slot in reserveSlots"
            :key="`reserve-${slot.id}`"
            class="rounded border border-slate-800 bg-slate-900/50 p-2"
          >
            <div class="flex items-center justify-between gap-1">
              <p class="truncate text-[10px] font-bold text-slate-300">{{ slot.gameName || 'Empty' }}</p>
              <select v-model="slot.role" class="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[9px] font-bold text-slate-200">
                <option v-for="role in roleOptions" :key="`reserve-role-${slot.id}-${role}`" :value="role">{{ role }}</option>
              </select>
            </div>
            <div class="mt-1 flex gap-1">
              <button
                type="button"
                @click="slot.showSearch = !slot.showSearch"
                class="flex-1 rounded border border-amber-700/70 px-1 py-0.5 text-[9px] font-black text-amber-200"
              >Join</button>
              <button
                type="button"
                @click="setCustomAnonymous(slot.id)"
                class="rounded border border-slate-700 px-1 py-0.5 text-[9px] font-black text-slate-300"
              >A</button>
            </div>
            <div v-if="slot.showSearch" class="mt-1">
              <SearchBar
                buttonText="Buscar"
                @search-start="onSearchStart(slot.id)"
                @search-success="(data) => onSearchSuccess(slot.id, data)"
                @search-error="(msg) => onSearchError(slot.id, msg)"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-2 md:grid-cols-2">
        <div class="rounded border border-cyan-900/40 bg-slate-950/60 px-3 py-2">
          <p class="text-xs font-black text-cyan-300">Pontos Team 1: {{ blueMmr }}</p>
          <p class="text-[11px] text-slate-400">Jogadores: {{ blueFilledCount }}/5</p>
        </div>
        <div class="rounded border border-cyan-900/40 bg-slate-950/60 px-3 py-2">
          <p class="text-xs font-black text-red-300">Pontos Team 2: {{ redMmr }}</p>
          <p class="text-[11px] text-slate-400">Jogadores: {{ redFilledCount }}/5</p>
        </div>
      </div>
      <p class="mt-2 text-center text-xs font-black" :class="mmrDiff <= 120 ? 'text-emerald-300' : 'text-amber-300'">
        Diferença: {{ mmrDiff }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import SearchBar from './SearchBar.vue';
import { DDRAGON_VERSION } from '../utils.js';

const roleOptions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUP', 'AUTOFILL'];
const rerollSeed = ref(0);
const statusMessage = ref('');

const customSlots = reactive(Array.from({ length: 15 }, (_, i) => createCustomSlot(i + 1)));

const blueSlots = computed(() => customSlots.slice(0, 5));
const redSlots = computed(() => customSlots.slice(5, 10));
const reserveSlots = computed(() => customSlots.slice(10, 15));

const blueFilledCount = computed(() => blueSlots.value.filter((slot) => slot.gameName).length);
const redFilledCount = computed(() => redSlots.value.filter((slot) => slot.gameName).length);
const blueMmr = computed(() => blueSlots.value.reduce((sum, slot) => sum + mmrWeight(slot), 0));
const redMmr = computed(() => redSlots.value.reduce((sum, slot) => sum + mmrWeight(slot), 0));
const mmrDiff = computed(() => Math.abs(blueMmr.value - redMmr.value));

function createCustomSlot(id) {
  return {
    id,
    showSearch: false,
    loading: false,
    error: null,
    gameName: '',
    tagLine: '',
    summonerLevel: 0,
    profileIconId: 29,
    statsSolo: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    statsFlex: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    manualTier: '',
    manualRank: '',
    manualLp: '',
    role: 'AUTOFILL'
  };
}

function profileIconUrl(profileIconId) {
  const iconId = profileIconId || 29;
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${iconId}.png`;
}

function onSearchStart(slotId) {
  const slot = customSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.loading = true;
  slot.error = null;
}

function onSearchSuccess(slotId, profileData) {
  const slot = customSlots.find((item) => item.id === slotId);
  if (!slot) return;

  slot.loading = false;
  slot.error = null;
  slot.showSearch = false;
  slot.gameName = profileData?.gameName || slot.gameName;
  slot.tagLine = profileData?.tagLine || slot.tagLine;
  slot.summonerLevel = Number(profileData?.summonerLevel || 0);
  slot.profileIconId = profileData?.profileIconId || 29;
  slot.statsSolo = profileData?.statsSolo || slot.statsSolo;
  slot.statsFlex = profileData?.statsFlex || slot.statsFlex;
  slot.manualTier = slot.manualTier || slot.statsSolo?.tier || 'UNRANKED';
  slot.manualRank = slot.manualRank || slot.statsSolo?.rank || 'IV';
  slot.manualLp = String(slot.statsSolo?.lp || 0);
  statusMessage.value = '';
}

function onSearchError(slotId, message) {
  const slot = customSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.loading = false;
  slot.error = message;
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
  slot.summonerLevel = 0;
  slot.profileIconId = 29;
  slot.manualTier = slot.manualTier || 'UNRANKED';
  slot.manualRank = slot.manualRank || 'IV';
  slot.manualLp = slot.manualLp || '0';
}

function inviteFirstEmpty() {
  const target = customSlots.find((slot) => !slot.gameName && !slot.showSearch);
  if (!target) {
    statusMessage.value = 'Todos os slots já possuem jogador.';
    return;
  }
  target.showSearch = true;
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

function hasValidRoles(team) {
  const used = new Set();
  for (const slot of team) {
    const role = String(slot.role || 'AUTOFILL').toUpperCase();
    if (role === 'AUTOFILL') continue;
    if (used.has(role)) return false;
    used.add(role);
  }
  return true;
}

function teamMmr(team) {
  return team.reduce((sum, slot) => sum + mmrWeight(slot), 0);
}

function applyTeams(blueTeam, redTeam, reserveTeam) {
  const ordered = [...blueTeam, ...redTeam, ...reserveTeam];
  while (ordered.length < 15) {
    ordered.push(createCustomSlot(ordered.length + 1));
  }

  for (let i = 0; i < 15; i += 1) {
    const base = ordered[i] || createCustomSlot(i + 1);
    customSlots[i] = { ...createCustomSlot(i + 1), ...base, id: i + 1 };
  }
}

function drawBalancedTeams() {
  rerollSeed.value += 1;
  const allFilled = customSlots.filter((slot) => slot.gameName);
  if (allFilled.length < 2) {
    statusMessage.value = 'Adicione pelo menos 2 jogadores para sortear.';
    return;
  }

  const shuffled = [...allFilled]
    .map((slot) => ({ slot, seed: Math.random() + rerollSeed.value * 0.01 }))
    .sort((a, b) => a.seed - b.seed)
    .map((item) => item.slot);

  const selectedTen = shuffled.slice(0, 10);
  const reserves = shuffled.slice(10, 15);
  const teamSize = Math.ceil(selectedTen.length / 2);
  const combos = combinations(selectedTen, teamSize);

  const candidates = [];
  for (const blueCandidate of combos) {
    const blueSet = new Set(blueCandidate.map((slot) => slot.id));
    const redCandidate = selectedTen.filter((slot) => !blueSet.has(slot.id));
    if (Math.abs(redCandidate.length - blueCandidate.length) > 1) continue;
    if (!hasValidRoles(blueCandidate) || !hasValidRoles(redCandidate)) continue;

    const diff = Math.abs(teamMmr(blueCandidate) - teamMmr(redCandidate));
    candidates.push({ blueCandidate, redCandidate, diff });
  }

  if (!candidates.length) {
    statusMessage.value = 'Não foi possível montar times sem repetir função. Use AUTOFILL para liberar combinações.';
    return;
  }

  candidates.sort((a, b) => a.diff - b.diff);
  const pool = candidates.slice(0, Math.min(5, candidates.length));
  const picked = pool[Math.floor(Math.random() * pool.length)];

  applyTeams(picked.blueCandidate.slice(0, 5), picked.redCandidate.slice(0, 5), reserves.slice(0, 5));
  statusMessage.value = `Festa da Fogueira concluída. Diferença alvo: ${picked.diff}. Clique novamente para novo sorteio.`;
}

function drawRandomTeams() {
  rerollSeed.value += 1;
  const allFilled = customSlots.filter((slot) => slot.gameName);
  if (allFilled.length < 2) {
    statusMessage.value = 'Adicione pelo menos 2 jogadores para sortear.';
    return;
  }

  const shuffled = [...allFilled]
    .map((slot) => ({ slot, seed: Math.random() + rerollSeed.value * 0.01 }))
    .sort((a, b) => a.seed - b.seed)
    .map((item) => item.slot);

  const selectedTen = shuffled.slice(0, 10);
  const reserves = shuffled.slice(10, 15);
  const teamSize = Math.ceil(selectedTen.length / 2);
  const combos = combinations(selectedTen, teamSize);

  const validSplits = combos
    .map((blueCandidate) => {
      const blueSet = new Set(blueCandidate.map((slot) => slot.id));
      const redCandidate = selectedTen.filter((slot) => !blueSet.has(slot.id));
      return { blueCandidate, redCandidate };
    })
    .filter(({ blueCandidate, redCandidate }) => Math.abs(redCandidate.length - blueCandidate.length) <= 1)
    .filter(({ blueCandidate, redCandidate }) => hasValidRoles(blueCandidate) && hasValidRoles(redCandidate));

  if (!validSplits.length) {
    statusMessage.value = 'Sorteio aleatório inválido com as funções atuais. Use AUTOFILL para permitir combinações.';
    return;
  }

  const picked = validSplits[Math.floor(Math.random() * validSplits.length)];
  applyTeams(picked.blueCandidate.slice(0, 5), picked.redCandidate.slice(0, 5), reserves.slice(0, 5));
  statusMessage.value = 'Sorteio aleatório concluído. Clique novamente para outro resultado.';
}

</script>