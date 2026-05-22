<template>
  <div class="space-y-6">
    <div class="pt-2">
      <form @submit.prevent="handleProfileSearch" class="w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-5 relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-transparent pointer-events-none"></div>

        <div v-if="store.searchProfile.error" class="mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
          :class="isRateLimit(store.searchProfile.error) ? 'border-amber-700 bg-amber-950/40 text-amber-300' : 'border-red-800 bg-red-950/40 text-red-300'">
          <p>{{ store.searchProfile.error }}</p>
          <button @click="store.searchProfile.error = null" class="rounded border border-current px-2 py-0.5 text-xs font-semibold hover:opacity-80" type="button">Fechar</button>
        </div>

        <div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center relative z-10">
          <input
            v-model="summonerInput"
            required
            class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition"
            placeholder="Nome#TAG (ex: Faker#KR1)"
          />
          <button
            :disabled="store.searchProfile.loading"
            class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2 font-bold text-white shadow-lg transition hover:bg-blue-500 hover:shadow-blue-900/50 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
          >
            <span v-if="store.searchProfile.loading" class="animate-pulse">Buscando...</span>
            <span v-else>Buscar</span>
          </button>
        </div>
      </form>
    </div>

    <div class="mt-12 border-t border-slate-700 pt-8">
      <button
        @click="showDebug = !showDebug"
        class="mb-4 flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2 font-bold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white border border-slate-600 shadow-md"
      >
        <span v-if="!showDebug">👁️ Mostrar Dados Brutos do Worker</span>
        <span v-else>🙈 Esconder Dados Brutos</span>
      </button>

      <div v-if="showDebug" class="max-h-[600px] overflow-auto rounded-xl bg-[#0d1117] p-5 shadow-inner border border-slate-700">
        <pre class="text-xs font-mono text-green-400">{{ JSON.stringify(store.searchProfile, null, 2) }}</pre>
      </div>
    </div>

    <template v-if="store.searchProfile.loading">
      <div class="flex items-center justify-center gap-3 rounded-xl border border-cyan-800/50 bg-cyan-950/30 px-4 py-3">
        <div class="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"></div>
        <p class="animate-pulse text-sm font-bold tracking-wide text-cyan-300">Buscando as informações com os espiritos ancestrais. <span class="text-lime-300">UGA BUGA</span></p>
      </div>
      <div class="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div class="h-36 animate-pulse rounded-2xl bg-slate-800/60"></div>
        <div class="h-36 animate-pulse rounded-2xl bg-slate-800/60"></div>
      </div>
    </template>

    <template v-else-if="!hasProfile">
      <div class="grid gap-4 opacity-50 lg:grid-cols-[1.4fr_0.9fr]">
        <section class="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4 shadow-xl">
          <div class="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700/30 bg-slate-950/60 p-4">
            <div class="h-24 w-24 flex-shrink-0 rounded-2xl border-2 border-slate-700 bg-slate-800 shadow-xl"></div>
          </div>
        </section>
      </div>
    </template>

    <template v-else>
      <div class="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
          <div class="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-950/80 p-4">
            <img 
              :src="profileIconImage(store.searchProfile.profileIconId)" 
              @error="(e) => e.target.src = 'https://ddragon.leagueoflegends.com/cdn/14.22.1/img/profileicon/29.png'"
              class="h-28 w-28 rounded-full border-4 border-slate-800 shadow-2xl object-cover"
            >
            <div>
              <h2 class="text-3xl font-black text-white drop-shadow-md">
                {{ store.searchProfile.gameName }}<span class="ml-2 text-lg font-medium text-slate-400">#{{ store.searchProfile.tagLine }}</span>
              </h2>
              <span class="mt-2 inline-block rounded-full border border-cyan-700 bg-cyan-950/40 px-4 py-1 text-xs font-bold text-cyan-400 shadow-sm">Nível {{ store.searchProfile.summonerLevel || 0 }}</span>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-slate-800 bg-[#0d1117] p-5 shadow-xl flex flex-col justify-center">
          <h3 class="mb-4 text-center font-bold text-slate-300">Resumo Competitivo</h3>
          
          <div class="mb-4 rounded-xl border border-amber-900/30 bg-amber-950/20 p-4 text-center">
            <div class="text-xs font-bold uppercase tracking-wider text-amber-500/70 mb-1">Elo Atual</div>
            <div class="text-2xl font-black text-amber-500 font-stone">
              {{ rankLabel }}
            </div>
            <div class="mt-1 text-sm font-semibold text-amber-500/80">
              {{ store.searchProfile.stats?.lp || 0 }} LP
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-center">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vitórias (Ranked)</div>
              <div class="text-xl font-black text-blue-400">{{ store.searchProfile.stats.wins }}</div>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-center">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">KDA (20 Partidas)</div>
              <div class="text-xl font-black text-emerald-400">{{ avgKda }}</div>
            </div>
          </div>

          <div class="text-center">
            <div class="mb-1 text-xs font-bold text-slate-400">Win Rate: <span class="text-slate-200">{{ winRate.toFixed(1) }}%</span></div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div class="h-full bg-blue-500 transition-all duration-1000" :style="`width: ${winRate}%`"></div>
            </div>
          </div>
        </section>
      </div>

        <section v-if="battleCompanions.length" class="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <h3 class="mb-4 text-lg font-bold text-slate-100">Companheiros de Batalha</h3>
        <div class="flex flex-wrap gap-3">
          <div v-for="(comp, i) in battleCompanions" :key="comp.name" class="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2.5">
            <span class="text-xs font-black text-slate-500">#{{ i + 1 }}</span>
            <span class="font-bold text-cyan-300">{{ comp.name }}</span>
            <span class="text-xs font-semibold text-slate-400">{{ comp.games }} partida{{ comp.games > 1 ? 's' : '' }}</span>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div class="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 class="text-xl font-bold text-slate-100">Histórico de Partidas</h3>
          
          <div class="flex gap-2 overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-1">
            <button v-for="tab in tabs" :key="tab"
              @click="activeTab = tab"
              class="whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-bold transition-all"
              :class="activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
            >
              {{ tab }}
            </button>
          </div>
        </div>

        <div v-if="filteredMatches.length" class="mb-5 grid grid-cols-1 gap-4 rounded-xl border border-slate-700/50 bg-slate-950/40 p-4 sm:grid-cols-3">
          
          <div class="text-center sm:border-r border-slate-800">
            <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Winrate ({{ activeTab }})</p>
            <p class="text-3xl font-black mt-1" :class="recentWinRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ recentWinRate }}%</p>
            <p class="text-xs font-medium text-slate-500">{{ filteredMatches.filter(m => m.win).length }}V / {{ filteredMatches.filter(m => !m.win).length }}D</p>
          </div>

          <div class="text-center sm:border-r border-slate-800 px-2">
            <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Rotas Jogadas</p>
            <div class="flex flex-col items-center justify-center space-y-1.5">
              <div v-for="(role, index) in roleStats.slice(0, 3)" :key="role.name" 
                   class="flex w-full max-w-[130px] items-center justify-between rounded bg-slate-900/80 px-2 py-1 border border-slate-800">
                <div class="flex items-center gap-1.5">
                  <img :src="getRoleIcon(role.name)" class="h-4 w-4 opacity-80" :alt="role.name" />
                  <span class="text-xs font-bold" :class="index === 0 ? 'text-amber-400' : 'text-slate-400'">{{ role.name }}</span>
                </div>
                <span class="text-[10px] font-bold text-slate-300">{{ role.percentage }}%</span>
              </div>
            </div>
          </div>

          <div class="text-center">
            <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Top Campeões</p>
            <div class="flex flex-wrap justify-center gap-2">
              <div v-for="champ in topChampions" :key="champ.name" class="flex items-center gap-1.5 rounded bg-slate-900/60 px-2 py-1 border border-slate-800">
                <img class="h-5 w-5 rounded-full border border-slate-600" :src="championImage(champ.name)" :alt="champ.name" />
                <span class="text-[10px] font-bold text-slate-200">{{ champ.name }}</span>
                <span class="text-[10px] text-slate-500">{{ champ.games }}x</span>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <p v-if="!filteredMatches.length" class="text-center text-slate-400 py-8 font-semibold">
            Nenhuma partida encontrada na aba <span class="text-amber-400">"{{ activeTab }}"</span>.
          </p>

          <article
            v-for="match in filteredMatches"
            :key="match.matchId || match.championName + Math.random()"
            class="grid gap-3 rounded-xl border p-3 md:grid-cols-[70px_1fr_160px_180px_280px] md:items-center transition hover:brightness-110"
            :class="match.win ? 'border-blue-800/50 bg-blue-950/20 text-blue-100' : 'border-red-800/50 bg-red-950/20 text-red-100'"
          >
            <img class="h-16 w-16 rounded-lg border border-slate-700 object-cover shadow-md" :src="championImage(match.championName || 'Aatrox')" :alt="match.championName" loading="lazy" />
            <div>
              <p class="font-black" :class="match.win ? 'text-blue-400' : 'text-red-400'">{{ match.win ? 'VITÓRIA' : 'DERROTA' }}</p>
              <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">{{ match.queueType || 'Outro Modo' }}</p>
              <p class="text-xs font-semibold text-slate-300">{{ formatDuration(match.gameDuration) }}</p>
              <div v-if="matchBadges(match).length" class="mt-1 flex flex-wrap gap-1">
                <span v-for="badge in matchBadges(match)" :key="badge.label"
                  class="rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  :class="badge.color">{{ badge.label }}</span>
              </div>
            </div>
            <div>
              <p class="text-base font-black text-white tracking-widest">{{ match.kills }} <span class="text-slate-500">/</span> {{ match.deaths }} <span class="text-slate-500">/</span> {{ match.assists }}</p>
              <p class="text-xs font-bold" :class="Number(calculateKdaRatio(match.kills, match.deaths, match.assists)) >= 4 ? 'text-amber-400' : 'text-slate-400'">
                {{ calculateKdaRatio(match.kills, match.deaths, match.assists) }} KDA
              </p>
              <p class="mt-1 text-[11px] font-semibold text-slate-400">{{ matchFarm(match) }} CS <span class="text-slate-500 font-normal">({{ matchCsMin(match) }}/min)</span></p>
              <p class="text-[11px] font-semibold text-slate-400">KP: <span class="text-slate-200">{{ matchKP(match) }}</span></p>
            </div>
            <div class="grid grid-cols-4 gap-1">
              <template v-for="(itemId, idx) in [match.item0, match.item1, match.item2, match.item3, match.item4, match.item5, match.item6]" :key="idx">
                <img v-if="itemId" class="h-7 w-7 rounded border border-slate-700 bg-slate-800 shadow" :src="itemImage(itemId)" loading="lazy" />
                <div v-else class="h-7 w-7 rounded border border-slate-700 bg-slate-800/30"></div>
              </template>
            </div>
            <div class="grid grid-cols-2 gap-1.5">
              <div class="rounded bg-slate-950/40 p-1.5">
                <div class="space-y-1">
                  <div v-for="p in alliedPlayers(match)" :key="p?.gameName" class="flex items-center gap-1.5 overflow-hidden">
                    <img class="h-4 w-4 rounded-sm border border-slate-700 flex-shrink-0" :src="championImage(p?.championName || 'Aatrox')" loading="lazy" />
                    <span class="truncate text-[10px] font-semibold text-blue-200/80">{{ p?.gameName || 'Desconhecido' }}</span>
                  </div>
                </div>
              </div>
              <div class="rounded bg-slate-950/40 p-1.5">
                <div class="space-y-1">
                  <div v-for="p in enemyPlayers(match)" :key="p?.gameName" class="flex items-center gap-1.5 overflow-hidden">
                    <img class="h-4 w-4 rounded-sm border border-slate-700 flex-shrink-0" :src="championImage(p?.championName || 'Aatrox')" loading="lazy" />
                    <span class="truncate text-[10px] font-semibold text-red-200/80">{{ p?.gameName || 'Desconhecido' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { state } from '../store.js';
import { championImage, profileIconImage, itemImage, calculateKdaRatio, formatDuration } from '../utils.js';
import { workerRequest } from '../api.js';

const showDebug = ref(false)
const store = state;

const summonerInput = ref(
  store.searchProfile.gameName && store.searchProfile.tagLine
    ? `${store.searchProfile.gameName}#${store.searchProfile.tagLine}`
    : ''
);

// Lógica de Abas
const activeTab = ref('Todas');
const tabs = ['Todas', 'Solo/Duo', 'Flex', 'Normal', 'Outros'];

const filteredMatches = computed(() => {
  const matches = store.searchProfile.matches || [];
  if (activeTab.value === 'Todas') return matches;
  
  return matches.filter(m => {
    const q = m.queueType;
    if (activeTab.value === 'Solo/Duo') return q === 'Ranked Solo';
    if (activeTab.value === 'Flex') return q === 'Ranked Flex';
    if (activeTab.value === 'Normal') return q === 'Normal Draft' || q === 'Normal Blind';
    if (activeTab.value === 'Outros') return !['Ranked Solo', 'Ranked Flex', 'Normal Draft', 'Normal Blind'].includes(q);
    return true;
  });
});

const hasProfile = computed(() => Boolean(store.searchProfile.puuid));
const winRate = computed(() => store.searchProfile.stats.winRate || 0);

const avgKda = computed(() => {
  const matches = store.searchProfile.matches || [];
  if (!matches.length) return '0.00';
  let totalKills = 0, totalDeaths = 0, totalAssists = 0;
  matches.forEach(match => {
    totalKills += Number(match.kills || 0);
    totalDeaths += Number(match.deaths || 0);
    totalAssists += Number(match.assists || 0);
  });
  const kda = totalDeaths === 0 ? (totalKills + totalAssists) : ((totalKills + totalAssists) / totalDeaths);
  return kda.toFixed(2);
});

const rankLabel = computed(() => {
  const stats = store.searchProfile.stats;
  return stats?.tier && stats?.tier !== 'UNRANKED'
    ? `${stats.tier} ${stats.rank || ''}`.trim()
    : 'UNRANKED';
});

// Busca os ícones metálicos na Riot (Corrigido para a pasta shared-components)
const getRoleIcon = (roleName) => {
  const map = {
    'Top': 'top',
    'Jungle': 'jungle',
    'Mid': 'middle',
    'ADC': 'bottom',
    'Sup': 'utility'
  };
  const position = map[roleName] || 'fill'; 
  // Caminho correto, testado e à prova de falhas:
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/position-${position}.png`;
};

// Modificado para ler do filteredMatches em vez do geral
const roleStats = computed(() => {
  const matches = filteredMatches.value;
  if (!matches.length) return [];
  const counts = {};
  matches.forEach(m => {
    let role = m.teamPosition && m.teamPosition !== 'Invalid' ? m.teamPosition : 'OUTRO';
    const roleMap = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Sup' };
    role = roleMap[role] || 'Outro';
    counts[role] = (counts[role] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({
      name, count, percentage: Math.round((count / matches.length) * 100)
    }))
    .sort((a, b) => b.count - a.count);
});

const recentWinRate = computed(() => {
  const matches = filteredMatches.value;
  if (!matches.length) return 0;
  return Math.round(matches.filter((m) => m.win).length / matches.length * 100);
});

const topChampions = computed(() => {
  const matches = filteredMatches.value;
  const counts = {};
  for (const m of matches) {
    if (m.championName) counts[m.championName] = (counts[m.championName] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, games]) => ({ name, games }));
});

const battleCompanions = computed(() => {
  const matches = filteredMatches.value;
  const myName = store.searchProfile.gameName;
  const counts = {};
  for (const match of matches) {
    if (!Array.isArray(match.players)) continue;
    const me = match.players.find((p) => p?.championName === match.championName);
    const myTeamId = me?.teamId;
    if (!myTeamId) continue;
    const allies = match.players.filter((p) => p?.teamId === myTeamId && p?.gameName !== myName);
    for (const ally of allies) {
      const key = ally.gameName || 'Desconhecido';
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, games]) => ({ name, games }));
});

function isRateLimit(msg) {
  return msg?.includes('muitas consultas') || msg?.includes('expirou');
}

function alliedPlayers(match) {
  const participants = Array.isArray(match.players) ? match.players : [];
  const playerEntry = participants.find((p) => p?.championName === match.championName);
  const allyTeamId = playerEntry?.teamId;
  return participants.filter((p) => p?.teamId === allyTeamId).slice(0, 5);
}

function enemyPlayers(match) {
  const participants = Array.isArray(match.players) ? match.players : [];
  const playerEntry = participants.find((p) => p?.championName === match.championName);
  const allyTeamId = playerEntry?.teamId;
  return participants.filter((p) => p?.teamId !== allyTeamId).slice(0, 5);
}

function matchFarm(match) {
  return (match.totalMinionsKilled || 0) + (match.neutralMinionsKilled || 0);
}

function matchCsMin(match) {
  const duration = match.gameDuration || 1;
  return (matchFarm(match) / (duration / 60)).toFixed(1);
}

function matchKP(match) {
  const participants = Array.isArray(match.players) ? match.players : [];
  const playerEntry = participants.find((p) => p?.championName === match.championName);
  const myTeamId = playerEntry?.teamId;
  const teamKills = participants
    .filter((p) => p?.teamId === myTeamId)
    .reduce((sum, p) => sum + (p.kills || 0), 0);
  if (!teamKills) return '0%';
  return Math.round(((match.kills || 0) + (match.assists || 0)) / teamKills * 100) + '%';
}

function matchBadges(match) {
  const badges = [];
  if (match.deaths === 0) badges.push({ label: 'Imortal', color: 'text-yellow-300 border-yellow-600 bg-yellow-950/50' });
  if (match.firstBloodKill) badges.push({ label: 'First Blood', color: 'text-red-400 border-red-700 bg-red-950/50' });
  if ((match.visionWardsBoughtInGame || 0) >= 3) badges.push({ label: 'Visão+', color: 'text-purple-300 border-purple-700 bg-purple-950/50' });
  return badges;
}

const emit = defineEmits(['show-overlay', 'hide-overlay', 'show-udyr']);

async function handleProfileSearch() {
  const summoner = summonerInput.value?.trim();
  if (!summoner) return;

  const [gameNameRaw, tagLineRaw] = summoner.split('#');
  const gameName = (gameNameRaw || '').trim();
  const tagLine = (tagLineRaw || '').trim();
  if (!gameName || !tagLine) {
    store.searchProfile.error = 'Formato inválido. Use Nome#TAG.';
    return;
  }

  emit('show-overlay');
  store.searchProfile.loading = true;
  store.searchProfile.error = null;

  let count = 3;
  emit('show-overlay', count);

  const countdownPromise = new Promise(resolve => {
    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        emit('show-overlay', count);
      } else {
        clearInterval(timer);
        resolve();
      }
    }, 1000);
  });

  const fetchPromise = (async () => {
    try {
      const data = await workerRequest('profile_overview', { gameName, tagLine });

      store.searchProfile.puuid = data.puuid || null;
      store.searchProfile.gameName = gameName;
      store.searchProfile.tagLine = tagLine;
      store.searchProfile.profileIconId = data.profileIconId || 29;
      store.searchProfile.summonerLevel = data.summonerLevel || 0;
      store.searchProfile.stats = {
        wins: Number(data.stats?.wins || 0),
        losses: Number(data.stats?.losses || 0),
        winRate: Number(data.stats?.winRate || 0),
        tier: data.stats?.tier || 'UNRANKED',
        rank: data.stats?.rank || '',
        lp: Number(data.stats?.lp || 0)
      };
      store.searchProfile.matches = Array.isArray(data.matches) ? data.matches : [];

      store.masteryDashboard.error = null;
      const masteryData = await workerRequest('masteries', { puuid: data.puuid, gameName, tagLine });

      const fromStaticChamp = (entry) => {
        if (!entry) return { championName: 'Aatrox', championLevel: 1, championPoints: 0 };
        const fromStatic = store.staticData.championList.find((champ) => Number(champ.key) === Number(entry.championId));
        return {
          championName: entry.championName || fromStatic?.name || 'Aatrox',
          championLevel: Number(entry.championLevel || 1),
          championPoints: Number(entry.championPoints || 0)
        };
      };

      store.masteryDashboard.allMasteries = (masteryData.masteries || []).map(fromStaticChamp);

    } catch (error) {
      store.searchProfile.error = error.message;
    }
  })();

  await Promise.all([countdownPromise, fetchPromise]);

  emit('hide-overlay');
  emit('show-udyr');
  store.searchProfile.loading = false;
  activeTab.value = 'Todas'; // Reseta a aba ao buscar um novo jogador
}
</script>