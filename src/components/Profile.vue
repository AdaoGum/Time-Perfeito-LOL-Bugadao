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

    <!-- Loading state -->
    <template v-if="store.searchProfile.loading">
      <div class="flex items-center justify-center gap-3 rounded-xl border border-cyan-800/50 bg-cyan-950/30 px-4 py-3">
        <div class="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"></div>
        <p class="animate-pulse text-sm font-bold tracking-wide text-cyan-300">Buscando as informações com os espiritos ancestrais. <span class="text-lime-300">UGA BUGA</span></p>
      </div>
      <div class="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div class="h-36 animate-pulse rounded-2xl bg-slate-800/60"></div>
        <div class="h-36 animate-pulse rounded-2xl bg-slate-800/60"></div>
      </div>
      <div class="space-y-3">
        <div v-for="i in 5" :key="i" class="h-20 animate-pulse rounded-xl bg-slate-800/40"></div>
      </div>
    </template>

    <!-- Empty state (no profile loaded) -->
    <template v-else-if="!hasProfile">
      <div class="grid gap-4 opacity-50 lg:grid-cols-[1.4fr_0.9fr]">
        <section class="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4 shadow-xl">
          <div class="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700/30 bg-slate-950/60 p-4">
            <div class="h-24 w-24 flex-shrink-0 rounded-2xl border-2 border-slate-700 bg-slate-800 shadow-xl"></div>
            <div class="space-y-2">
              <div class="h-8 w-44 rounded-lg bg-slate-800"></div>
              <div class="h-6 w-28 rounded-full bg-slate-800/80"></div>
            </div>
          </div>
        </section>
        <section class="flex flex-col justify-center gap-3 rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4 shadow-xl">
          <div class="mx-auto h-5 w-36 rounded bg-slate-800"></div>
          <div class="space-y-2 rounded-xl border border-slate-700/30 bg-slate-900/50 p-3 text-center">
            <div class="mx-auto h-3 w-20 rounded bg-slate-800"></div>
            <div class="mx-auto h-8 w-28 rounded-lg bg-slate-800"></div>
            <div class="mx-auto h-4 w-16 rounded bg-slate-800"></div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2 rounded-xl border border-slate-700 bg-slate-950/80 p-3"><div class="mx-auto h-2.5 w-16 rounded bg-slate-800"></div><div class="mx-auto h-8 w-10 rounded-lg bg-slate-800"></div></div>
            <div class="space-y-2 rounded-xl border border-slate-700 bg-slate-950/80 p-3"><div class="mx-auto h-2.5 w-20 rounded bg-slate-800"></div><div class="mx-auto h-8 w-14 rounded-lg bg-slate-800"></div></div>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-slate-800/60 shadow-inner"></div>
        </section>
      </div>
      <section class="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5 shadow-xl opacity-40">
        <div class="mb-4 h-6 w-52 rounded-lg bg-slate-800"></div>
        <div class="space-y-3">
          <div v-for="i in 5" :key="i" class="grid gap-3 rounded-xl border border-slate-800/40 bg-slate-950/30 p-3 md:grid-cols-[70px_1fr_160px_180px_280px] md:items-center">
            <div class="h-16 w-16 rounded-lg border border-slate-700 bg-slate-800"></div>
            <div class="space-y-2"><div class="h-3 w-20 rounded bg-slate-800"></div><div class="h-2.5 w-14 rounded bg-slate-800"></div><div class="h-2.5 w-16 rounded bg-slate-800"></div></div>
            <div class="space-y-2"><div class="h-4 w-24 rounded bg-slate-800"></div><div class="h-3 w-16 rounded bg-slate-800"></div></div>
            <div class="grid grid-cols-4 gap-1"><div v-for="j in 7" :key="j" class="h-8 w-8 rounded border border-slate-700 bg-slate-800/60"></div></div>
            <div class="grid grid-cols-2 gap-1.5"><div class="h-20 rounded-md bg-slate-800/30"></div><div class="h-20 rounded-md bg-slate-800/30"></div></div>
          </div>
        </div>
      </section>
    </template>

    <!-- Profile loaded -->
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

        <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl flex flex-col justify-center">
          <h3 class="mb-3 text-lg font-semibold text-slate-200 text-center">Resumo Competitivo</h3>
          <div class="mb-3 rounded-xl border border-amber-700/40 bg-gradient-to-r from-amber-900/20 to-slate-950 p-3 text-center">
            <p class="text-xs uppercase tracking-widest text-amber-300">Elo Atual</p>
            <p class="text-2xl font-black text-amber-100">{{ rankLabel }}</p>
            <p class="text-sm font-bold text-amber-300">{{ store.searchProfile.stats?.lp || 0 }} LP</p>
          </div>
          <div class="mb-3 grid grid-cols-2 gap-3 text-center">
            <div class="rounded-xl border border-slate-700 bg-slate-950/80 p-3 shadow-inner">
              <p class="text-xs font-semibold text-slate-400 uppercase">Vitórias</p>
              <p class="text-2xl font-black text-blue-400">{{ store.searchProfile.stats.wins }}</p>
            </div>
            <div class="rounded-xl border border-slate-700 bg-slate-950/80 p-3 shadow-inner">
              <p class="text-xs font-semibold text-slate-400 uppercase">KDA Geral</p>
              <p class="text-2xl font-black text-cyan-300">{{ avgKda }}</p>
            </div>
          </div>
          <p class="mb-2 text-center text-sm font-medium text-slate-300">Win Rate: <span class="font-bold text-white">{{ winRate.toFixed(1) }}%</span></p>
          <div class="h-3 overflow-hidden rounded-full bg-slate-800 shadow-inner">
            <div class="h-full transition-all duration-1000" :class="winColor" :style="{ width: Math.max(0, Math.min(100, winRate)) + '%' }"></div>
          </div>
        </section>
      </div>

      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-xl font-bold text-slate-100">Últimas {{ store.searchProfile.matches.length }} Partidas</h3>
        </div>
        <div class="space-y-3">
          <p v-if="!store.searchProfile.matches.length" class="text-center text-slate-400 py-8">Nenhum histórico recente encontrado.</p>
          <article
            v-for="match in store.searchProfile.matches.slice(0, 20)"
            :key="match.matchId || match.championName"
            class="mb-3 grid gap-3 rounded-xl border p-3 md:grid-cols-[70px_1fr_160px_180px_280px] md:items-center"
            :class="match.win ? 'border-blue-800 bg-blue-950/40 text-blue-100' : 'border-red-800 bg-red-950/40 text-red-100'"
          >
            <img class="h-16 w-16 rounded-lg border border-slate-700 object-cover shadow-md" :src="championImage(match.championName || 'Aatrox')" :alt="match.championName" loading="lazy" />
            <div>
              <p class="font-bold" :class="match.win ? 'text-blue-400' : 'text-red-400'">{{ match.win ? 'VITÓRIA' : 'DERROTA' }}</p>
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-300">{{ match.queueType || 'Outro Modo' }}</p>
              <p class="text-sm text-slate-300">{{ formatDuration(match.gameDuration) }}</p>
            </div>
            <div>
              <p class="text-base font-bold text-white">{{ match.kills }} / {{ match.deaths }} / {{ match.assists }}</p>
              <p class="text-sm font-medium" :class="Number(calculateKdaRatio(match.kills, match.deaths, match.assists)) >= 4 ? 'text-amber-400' : 'text-slate-300'">
                {{ calculateKdaRatio(match.kills, match.deaths, match.assists) }} KDA
              </p>
            </div>
            <div class="grid grid-cols-4 gap-1">
              <template v-for="(itemId, idx) in [match.item0, match.item1, match.item2, match.item3, match.item4, match.item5, match.item6]" :key="idx">
                <img v-if="itemId" class="h-8 w-8 rounded border border-slate-700 bg-slate-800 shadow" :src="itemImage(itemId)" loading="lazy" />
                <div v-else class="h-8 w-8 rounded border border-slate-700 bg-slate-800/50"></div>
              </template>
            </div>
            <div class="grid grid-cols-2 gap-1.5">
              <div class="rounded-md border border-slate-700/70 bg-slate-950/60 p-1.5">
                <div class="space-y-1">
                  <div v-for="p in alliedPlayers(match)" :key="p?.gameName" class="grid grid-cols-[18px_1fr] items-center gap-1.5">
                    <img class="h-[18px] w-[18px] rounded-sm border border-slate-700" :src="championImage(p?.championName || 'Aatrox')" :alt="p?.championName || 'Campeao'" loading="lazy" />
                    <span class="truncate text-[11px] font-semibold leading-none text-blue-200">{{ p?.gameName || 'Desconhecido' }}</span>
                  </div>
                </div>
              </div>
              <div class="rounded-md border border-slate-700/70 bg-slate-950/60 p-1.5">
                <div class="space-y-1">
                  <div v-for="p in enemyPlayers(match)" :key="p?.gameName" class="grid grid-cols-[18px_1fr] items-center gap-1.5">
                    <img class="h-[18px] w-[18px] rounded-sm border border-slate-700" :src="championImage(p?.championName || 'Aatrox')" :alt="p?.championName || 'Campeao'" loading="lazy" />
                    <span class="truncate text-[11px] font-semibold leading-none text-red-200">{{ p?.gameName || 'Desconhecido' }}</span>
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

const store = state;

const summonerInput = ref(
  store.searchProfile.gameName && store.searchProfile.tagLine
    ? `${store.searchProfile.gameName}#${store.searchProfile.tagLine}`
    : ''
);

const hasProfile = computed(() => Boolean(store.searchProfile.puuid));
const winRate = computed(() => store.searchProfile.stats.winRate || 0);
const winColor = computed(() => winRate.value >= 50 ? 'bg-blue-500' : 'bg-red-500');
const avgKda = computed(() => {
  const matches = store.searchProfile.matches || [];
  if (!matches.length) return '0.00';
  return (
    (matches.reduce((acc, m) => acc + Number(m.kills || 0) + Number(m.assists || 0), 0)) /
    Math.max(1, matches.reduce((acc, m) => acc + Number(m.deaths || 0), 0))
  ).toFixed(2);
});
const rankLabel = computed(() => {
  const stats = store.searchProfile.stats;
  return stats?.tier && stats?.tier !== 'UNRANKED'
    ? `${stats.tier} ${stats.rank || ''}`.trim()
    : 'UNRANKED';
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
}
</script>
