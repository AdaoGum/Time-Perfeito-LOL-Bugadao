import { state, updateState } from '../state.js';
import { championImage, profileIconImage, itemImage, calculateKdaRatio, formatDuration, errorBanner } from '../utils.js';
import { workerRequest } from '../api.js';

export function renderProfileTab() {
  const section = document.getElementById('aba-perfil');
  if (!section) return;
  const { searchProfile } = state;
  const hasProfile = Boolean(searchProfile.puuid);
  const winRate = searchProfile.stats.winRate || 0;
  const winColor = winRate >= 50 ? 'bg-blue-500' : 'bg-red-500';
  const matches = searchProfile.matches || [];
  const avgKda = matches.length
    ? ((matches.reduce((acc, m) => acc + Number(m.kills || 0) + Number(m.assists || 0), 0)) /
      Math.max(1, matches.reduce((acc, m) => acc + Number(m.deaths || 0), 0))).toFixed(2)
    : '0.00';
  const rankLabel = searchProfile.stats?.tier && searchProfile.stats?.tier !== 'UNRANKED'
    ? `${searchProfile.stats.tier} ${searchProfile.stats.rank || ''}`.trim()
    : 'UNRANKED';

  const matchesHtml = (searchProfile.matches || []).slice(0, 20).map((match) => {
    const isWin = Boolean(match.win);
    const rowClass = isWin ? 'border-blue-800 bg-blue-950/40 text-blue-100' : 'border-red-800 bg-red-950/40 text-red-100';
    const ratio = calculateKdaRatio(match.kills, match.deaths, match.assists);
    const ratioClass = Number(ratio) >= 4 ? 'text-amber-400' : 'text-slate-300';
    const items = [match.item0, match.item1, match.item2, match.item3, match.item4, match.item5, match.item6];
    const participants = Array.isArray(match.players) ? match.players : [];
    const playerEntry = participants.find((p) => p?.championName === match.championName);
    const allyTeamId = playerEntry?.teamId;
    const alliedPlayers = participants.filter((p) => p?.teamId === allyTeamId).slice(0, 5);
    const enemyPlayers = participants.filter((p) => p?.teamId !== allyTeamId).slice(0, 5);

    const rosterColumn = (list, tone) => `
      <div class="rounded-md border border-slate-700/70 bg-slate-950/60 p-1.5">
        <div class="space-y-1">
          ${list.map((p) => `
            <div class="grid grid-cols-[18px_1fr] items-center gap-1.5">
              <img class="h-[18px] w-[18px] rounded-sm border border-slate-700" src="${championImage(p?.championName || 'Aatrox')}" alt="${p?.championName || 'Campeao'}" loading="lazy" />
              <span class="truncate text-[11px] font-semibold leading-none ${tone}">${p?.gameName || 'Desconhecido'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    return `
      <article class="mb-3 grid gap-3 rounded-xl border ${rowClass} p-3 md:grid-cols-[70px_1fr_160px_180px_280px] md:items-center">
        <img class="h-16 w-16 rounded-lg border border-slate-700 object-cover shadow-md" src="${championImage(match.championName || 'Aatrox')}" alt="${match.championName}" loading="lazy" />
        <div>
          <p class="font-bold ${isWin ? 'text-blue-400' : 'text-red-400'}">${isWin ? 'VITÓRIA' : 'DERROTA'}</p>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-300">${match.queueType || 'Outro Modo'}</p>
          <p class="text-sm text-slate-300">${formatDuration(match.gameDuration)}</p>
        </div>
        <div>
          <p class="text-base font-bold text-white">${match.kills} / ${match.deaths} / ${match.assists}</p>
          <p class="text-sm font-medium ${ratioClass}">${ratio} KDA</p>
        </div>
        <div class="grid grid-cols-4 gap-1">
          ${items.map(itemId => itemId ? `<img class="h-8 w-8 rounded border border-slate-700 bg-slate-800 shadow" src="${itemImage(itemId)}" loading="lazy" />` : '<div class="h-8 w-8 rounded border border-slate-700 bg-slate-800/50"></div>').join('')}
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          ${rosterColumn(alliedPlayers, 'text-blue-200')}
          ${rosterColumn(enemyPlayers, 'text-red-200')}
        </div>
      </article>
    `;
  }).join('');

  section.innerHTML = `
    <div class="space-y-6">
      <div class="pt-2">
        <form id="profile-form" class="w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-5 relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-transparent pointer-events-none"></div>
          ${errorBanner(searchProfile.error, 'clear-profile-error')}
          <div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center relative z-10">
            <input required id="profile-summoner" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition" placeholder="Nome#TAG (ex: Faker#KR1)" value="${searchProfile.gameName && searchProfile.tagLine ? `${searchProfile.gameName}#${searchProfile.tagLine}` : ''}" />
            <button ${searchProfile.loading ? 'disabled' : ''} class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2 font-bold text-white shadow-lg transition hover:bg-blue-500 hover:shadow-blue-900/50 disabled:cursor-not-allowed disabled:opacity-70" type="submit">
              ${searchProfile.loading ? '<span class="animate-pulse">Buscando...</span>' : 'Buscar'}
            </button>
          </div>
        </form>
      </div>

      ${searchProfile.loading ? `
        <div class="flex items-center justify-center gap-3 rounded-xl border border-cyan-800/50 bg-cyan-950/30 px-4 py-3">
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"></div>
          <p class="animate-pulse text-sm font-bold tracking-wide text-cyan-300">Buscando as informações com os espiritos ancestrais. <span class="text-lime-300">UGA BUGA</span></p>
        </div>
        <div class="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div class="h-36 animate-pulse rounded-2xl bg-slate-800/60"></div>
          <div class="h-36 animate-pulse rounded-2xl bg-slate-800/60"></div>
        </div>
        <div class="space-y-3">
          ${Array.from({length:5}).map(() => '<div class="h-20 animate-pulse rounded-xl bg-slate-800/40"></div>').join('')}
        </div>
      ` : !hasProfile ? `
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
            ${Array.from({length:5}).map(() => `
              <div class="grid gap-3 rounded-xl border border-slate-800/40 bg-slate-950/30 p-3 md:grid-cols-[70px_1fr_160px_180px_280px] md:items-center">
                <div class="h-16 w-16 rounded-lg border border-slate-700 bg-slate-800"></div>
                <div class="space-y-2"><div class="h-3 w-20 rounded bg-slate-800"></div><div class="h-2.5 w-14 rounded bg-slate-800"></div><div class="h-2.5 w-16 rounded bg-slate-800"></div></div>
                <div class="space-y-2"><div class="h-4 w-24 rounded bg-slate-800"></div><div class="h-3 w-16 rounded bg-slate-800"></div></div>
                <div class="grid grid-cols-4 gap-1">${Array.from({length:7}).map(() => '<div class="h-8 w-8 rounded border border-slate-700 bg-slate-800/60"></div>').join('')}</div>
                <div class="grid grid-cols-2 gap-1.5"><div class="h-20 rounded-md bg-slate-800/30"></div><div class="h-20 rounded-md bg-slate-800/30"></div></div>
              </div>
            `).join('')}
          </div>
        </section>
      ` : `
        <div class="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
            <div class="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-950/80 p-4">
              <img class="h-24 w-24 rounded-2xl border-2 border-slate-700 shadow-xl" src="${profileIconImage(searchProfile.profileIconId || 29)}" alt="Ícone" />
              <div>
                <h2 class="text-3xl font-black text-white drop-shadow-md">${searchProfile.gameName}<span class="ml-2 text-lg font-medium text-slate-400">#${searchProfile.tagLine}</span></h2>
                <span class="mt-2 inline-block rounded-full border border-cyan-700 bg-cyan-950/40 px-4 py-1 text-xs font-bold text-cyan-400 shadow-sm">Nível ${searchProfile.summonerLevel || 0}</span>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl flex flex-col justify-center">
            <h3 class="mb-3 text-lg font-semibold text-slate-200 text-center">Resumo Competitivo</h3>
            <div class="mb-3 rounded-xl border border-amber-700/40 bg-gradient-to-r from-amber-900/20 to-slate-950 p-3 text-center">
              <p class="text-xs uppercase tracking-widest text-amber-300">Elo Atual</p>
              <p class="text-2xl font-black text-amber-100">${rankLabel}</p>
              <p class="text-sm font-bold text-amber-300">${Number(searchProfile.stats?.lp || 0)} LP</p>
            </div>
            <div class="mb-3 grid grid-cols-2 gap-3 text-center">
              <div class="rounded-xl border border-slate-700 bg-slate-950/80 p-3 shadow-inner"><p class="text-xs font-semibold text-slate-400 uppercase">Vitórias</p><p class="text-2xl font-black text-blue-400">${searchProfile.stats.wins}</p></div>
              <div class="rounded-xl border border-slate-700 bg-slate-950/80 p-3 shadow-inner"><p class="text-xs font-semibold text-slate-400 uppercase">KDA Geral</p><p class="text-2xl font-black text-cyan-300">${avgKda}</p></div>
            </div>
            <p class="mb-2 text-center text-sm font-medium text-slate-300">Win Rate: <span class="font-bold text-white">${winRate.toFixed(1)}%</span></p>
            <div class="h-3 overflow-hidden rounded-full bg-slate-800 shadow-inner">
              <div class="h-full ${winColor} transition-all duration-1000" style="width: ${Math.max(0, Math.min(100, winRate))}%"></div>
            </div>
          </section>
        </div>

        <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-xl font-bold text-slate-100">Últimas ${searchProfile.matches.length} Partidas</h3>
          </div>
          <div class="space-y-3">
            ${matchesHtml || '<p class="text-center text-slate-400 py-8">Nenhum histórico recente encontrado.</p>'}
          </div>
        </section>
      `}
    </div>
  `;
}

export async function handleProfileSearch(event) {
  event.preventDefault();
  const summoner = document.getElementById('profile-summoner')?.value?.trim();
  if (!summoner) return;
  
  const [gameNameRaw, tagLineRaw] = summoner.split('#');
  const gameName = (gameNameRaw || '').trim();
  const tagLine = (tagLineRaw || '').trim();
  if (!gameName || !tagLine) {
    updateState('searchProfile.error', 'Formato inválido. Use Nome#TAG.');
    return;
  }

  const overlay = document.getElementById('cinematic-overlay');
  const countdownEl = document.getElementById('countdown-text');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  updateState('searchProfile.loading', true);
  
  let count = 3;
  countdownEl.innerText = count;

  const countdownPromise = new Promise(resolve => {
    const timer = setInterval(() => {
      count--;
      if(count > 0) {
        countdownEl.innerText = count;
      } else {
        clearInterval(timer);
        resolve();
      }
    }, 1000);
  });

  const fetchPromise = (async () => {
    try {
      state.searchProfile.error = null;
      const data = await workerRequest('profile_overview', { gameName, tagLine });

      state.searchProfile.puuid = data.puuid || null;
      state.searchProfile.gameName = gameName;
      state.searchProfile.tagLine = tagLine;
      state.searchProfile.profileIconId = data.profileIconId || 29;
      state.searchProfile.summonerLevel = data.summonerLevel || 0;
      state.searchProfile.stats = {
        wins: Number(data.stats?.wins || 0),
        losses: Number(data.stats?.losses || 0),
        winRate: Number(data.stats?.winRate || 0),
        tier: data.stats?.tier || 'UNRANKED',
        rank: data.stats?.rank || '',
        lp: Number(data.stats?.lp || 0)
      };
      state.searchProfile.matches = Array.isArray(data.matches) ? data.matches : [];

      state.masteryDashboard.error = null;
      const masteryData = await workerRequest('masteries', { puuid: data.puuid, gameName, tagLine });
      
      const fromStaticChamp = (entry) => {
        if (!entry) return { championName: 'Aatrox', championLevel: 1, championPoints: 0 };
        const fromStatic = state.staticData.championList.find((champ) => Number(champ.key) === Number(entry.championId));
        return {
          championName: entry.championName || fromStatic?.name || 'Aatrox',
          championLevel: Number(entry.championLevel || 1),
          championPoints: Number(entry.championPoints || 0)
        };
      };

      state.masteryDashboard.allMasteries = (masteryData.masteries || []).map(fromStaticChamp);

    } catch (error) {
      state.searchProfile.error = error.message;
    }
  })();

  await Promise.all([countdownPromise, fetchPromise]);

  // Udyr corre pela tela ao revelar os dados
  const runner = document.getElementById('udyr-runner');
  if (runner) {
    runner.style.cssText = 'left:-260px; bottom:60px; animation:udyr-run 1.6s ease-in-out forwards;';
    runner.classList.remove('hidden');
    setTimeout(() => { runner.classList.add('hidden'); runner.style.animation = ''; }, 1700);
  }

  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
  updateState('searchProfile.loading', false);
}
