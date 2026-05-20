import { state, updateState } from '../state.js';
import { championImage, errorBanner } from '../utils.js';
import { workerRequest } from '../api.js';

export function renderSynergyTab() {
  const section = document.getElementById('aba-sinergia');
  if (!section) return;
  const { teamPlanner } = state;
  const activeSlots = teamPlanner.slots.slice(0, teamPlanner.playerCount);

  section.innerHTML = `
    <div class="space-y-6">
      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="mb-2 text-xs font-bold uppercase text-slate-400">Tipo de Fila</p>
            <div class="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1">
              <button type="button" data-action="set-queue" data-queue="solo_duo" class="rounded-md px-4 py-1.5 text-sm font-semibold transition ${teamPlanner.queueType === 'solo_duo' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}">Solo/Duo</button>
              <button type="button" data-action="set-queue" data-queue="flex" class="rounded-md px-4 py-1.5 text-sm font-semibold transition ${teamPlanner.queueType === 'flex' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}">Fila Flex</button>
            </div>
          </div>
          <div>
            <p class="mb-2 text-xs font-bold uppercase text-slate-400">Tamanho da Equipe</p>
            <div class="flex flex-wrap gap-2">
              ${[1,2,3,4,5].map((count) => `<button type="button" data-action="set-player-count" data-count="${count}" class="h-10 w-10 rounded-full border-2 text-sm font-bold transition ${teamPlanner.playerCount === count ? 'border-cyan-500 bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500 hover:text-white'}">${count}</button>`).join('')}
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
        <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
          ${activeSlots.map((slot, index) => `
            <article class="relative flex flex-col rounded-xl border border-slate-800 bg-slate-950/50 p-4 shadow-inner">
              <div class="mb-4 flex flex-col gap-2">
                <h3 class="text-center text-xs font-bold uppercase tracking-widest text-slate-500">Slot ${index + 1}</h3>
                <div class="flex rounded-md border border-slate-700 bg-slate-900 p-1 text-xs mx-auto">
                  <button type="button" data-action="set-slot-type" data-id="${slot.id}" data-type="profile" class="rounded px-2 py-1 font-semibold ${slot.type === 'profile' ? 'bg-blue-600 text-white' : 'text-slate-400'}">Buscar Perfil</button>
                  <button type="button" data-action="set-slot-type" data-id="${slot.id}" data-type="anonymous" class="rounded px-2 py-1 font-semibold ${slot.type === 'anonymous' ? 'bg-slate-700 text-white' : 'text-slate-400'}">Anônimo</button>
                </div>
              </div>
              ${slot.error ? errorBanner(slot.error, 'clear-slot-error', slot.id) : ''}

              <div class="flex-1 space-y-3">
              ${slot.loading ? `
                <div class="h-10 w-full animate-pulse rounded bg-slate-800"></div><div class="h-24 w-full animate-pulse rounded bg-slate-800"></div>
              ` : slot.type === 'anonymous' ? `
                  <input data-action="slot-query" data-id="${slot.id}" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none" placeholder="Buscar campeão..." value="${slot.query || ''}" />
                  ${slot.suggestions.length ? `
                    <div class="absolute left-0 top-[120px] z-20 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                      ${slot.suggestions.slice(0, 6).map((name) => `
                        <button type="button" data-action="slot-select-suggestion" data-id="${slot.id}" data-name="${name}" class="flex w-full items-center gap-3 border-b border-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-blue-900/50">
                          <img src="${championImage(name)}" class="h-6 w-6 rounded" />${name}
                        </button>
                      `).join('')}
                    </div>
                  ` : ''}
                  ${slot.championSelected ? `
                    <div class="mt-4 flex flex-col items-center rounded-xl border border-cyan-800 bg-cyan-950/20 p-4 shadow-inner">
                      <img class="h-20 w-20 rounded-xl border-2 border-cyan-600 shadow-[0_0_15px_rgba(8,145,178,0.4)]" src="${championImage(slot.championSelected)}" />
                      <p class="mt-3 text-sm font-bold text-cyan-300">${slot.championSelected}</p>
                    </div>
                  ` : ''}
              ` : `
                  ${slot.searchedData ? `
                    <div class="rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-inner">
                      <p class="mb-2 text-center text-[10px] font-bold uppercase text-slate-400">Escolha o Campeão</p>
                      <div class="space-y-1">
                        ${slot.masteryChoices.map((entry) => `
                          <button type="button" data-action="slot-select-mastery" data-id="${slot.id}" data-name="${entry.championName}" class="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-900 px-2 py-1.5 hover:border-blue-500 hover:bg-blue-950/30 transition">
                            <span class="flex items-center gap-2 text-xs font-semibold text-slate-200"><img class="h-5 w-5 rounded" src="${championImage(entry.championName)}" />${entry.championName}</span>
                            <span class="text-[10px] font-bold text-amber-500">M${entry.championLevel}</span>
                          </button>
                        `).join('')}
                      </div>
                    </div>
                    <button type="button" data-action="slot-clear" data-id="${slot.id}" class="mt-2 w-full rounded-lg border border-slate-700 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition">Trocar Perfil</button>
                    ${slot.championSelected ? `
                      <div class="mt-3 text-center border-t border-slate-800 pt-3">
                        <p class="text-[10px] font-bold uppercase text-blue-400 mb-1">Confirmado</p>
                        <div class="inline-flex items-center gap-2 rounded bg-blue-900/40 px-2 py-1 border border-blue-800"><img class="h-6 w-6 rounded" src="${championImage(slot.championSelected)}" /><span class="text-xs font-bold text-blue-200">${slot.championSelected}</span></div>
                      </div>
                    ` : ''}
                  ` : `
                    <div class="flex flex-col gap-2">
                      <input data-action="slot-summoner" data-id="${slot.id}" class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm placeholder:text-slate-600 focus:border-blue-500 focus:outline-none" placeholder="Ex: Kami#BR1" value="${slot.gameName && slot.tagLine ? `${slot.gameName}#${slot.tagLine}` : ''}" />
                      <button type="button" data-action="slot-fetch" data-id="${slot.id}" class="rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-500 shadow">Puxar Perfil</button>
                    </div>
                  `}
              `}
              </div>

              <div class="mt-4 border-t border-slate-800 pt-3">
                <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Zona de Conforto do Invocador</p>
                <div class="grid grid-cols-5 gap-1.5">
                  ${renderComfortZone(slot)}
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <button type="button" data-action="analyze-composition" class="mx-auto flex w-full max-w-lg items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 text-base font-black uppercase tracking-wider text-white shadow-lg transition hover:scale-[1.02] hover:shadow-cyan-900/50">Simular Sinergia de Equipe</button>
        ${teamPlanner.analysisLoading ? '<div class="mt-6 flex flex-col items-center gap-3"><div class="h-2 w-full max-w-md animate-pulse rounded-full bg-slate-800"></div><div class="h-2 w-64 animate-pulse rounded-full bg-slate-800"></div><p class="text-xs font-bold text-cyan-500 animate-pulse uppercase mt-2">Processando Matriz Tática...</p></div>' : ''}
        ${teamPlanner.analysisResult ? renderAnalysisResult(teamPlanner.analysisResult) : ''}
      </section>
    </div>
  `;
}

function renderComfortZone(slot) {
  const hasProfileData = slot.type === 'profile' && slot.searchedData && Array.isArray(slot.masteryChoices) && slot.masteryChoices.length;
  if (!hasProfileData) {
    return Array.from({ length: 5 }).map(() => `
      <div class="rounded-md border border-slate-700 bg-slate-800/60 p-1 text-center">
        <div class="flex h-10 w-full items-center justify-center rounded bg-slate-900 text-xl font-black text-slate-500">?</div>
        <p class="mt-1 truncate text-[9px] text-slate-500">Oculto</p>
      </div>
    `).join('');
  }

  const medalIcons = ['👑', '🥈', '🥉', '⛓️', '🪵'];
  const champList = (state.staticData?.championList || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  return `
    <div class="col-span-5 space-y-2">
      <div class="grid grid-cols-5 gap-1">
        ${slot.masteryChoices.slice(0, 15).map((entry, idx) => {
          const isSelected = slot.championSelected === entry.championName;
          const isTop5 = idx < 5;
          const ring = isSelected
            ? 'border-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.5)] bg-lime-950/30'
            : isTop5 ? 'border-cyan-600/60 bg-slate-900/80 hover:border-cyan-400'
            : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-500';
          return `
            <button type="button" data-action="slot-select-mastery" data-id="${slot.id}" data-name="${entry.championName}"
              class="relative flex flex-col items-center rounded-md border p-0.5 transition ${ring}">
              ${idx < 5 ? `<span class="absolute -right-1 -top-1 text-[9px] leading-none">${medalIcons[idx]}</span>` : ''}
              <img class="h-10 w-10 rounded object-cover" src="${championImage(entry.championName)}" loading="lazy" />
              <p class="mt-0.5 w-full truncate text-center text-[9px] font-semibold text-slate-200 leading-tight">${entry.championName}</p>
              <span class="text-[9px] font-bold text-amber-400">M${entry.championLevel}</span>
            </button>
          `;
        }).join('')}
      </div>
      <select data-action="slot-select-dropdown" data-id="${slot.id}"
        class="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none transition">
        <option value="">Qualquer campeão...</option>
        ${champList.map((c) => `<option value="${c.name}" ${slot.championSelected === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
    </div>
  `;
}

function renderAnalysisResult(result) {
  const bars = [
    { label: 'Dano (AD/AP)', value: result.metrics.damageBalance, color: 'bg-blue-500' },
    { label: 'Controle de Grupo (CC)', value: result.metrics.ccScore, color: 'bg-cyan-400' },
    { label: 'Linha de Frente (Tank)', value: result.metrics.frontline, color: 'bg-amber-500' },
    { label: 'Ritmo (Tempo/Scaling)', value: result.metrics.tempo, color: 'bg-purple-500' }
  ];

  return `
    <div class="mt-8 grid gap-6 lg:grid-cols-[200px_1fr]">
      <div class="flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/80 p-6 shadow-inner">
        <div class="flex h-28 w-28 items-center justify-center rounded-full border-4 border-cyan-500 bg-cyan-950/40 text-5xl font-black text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.4)]">${result.grade}</div>
        <p class="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">Nota Final</p>
      </div>
      <div class="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-6">
        ${bars.map((bar) => `
          <div>
            <div class="mb-1.5 flex items-center justify-between text-xs font-bold uppercase text-slate-300"><span>${bar.label}</span><span>${bar.value}%</span></div>
            <div class="h-2.5 rounded-full bg-slate-800 shadow-inner"><div class="h-full rounded-full ${bar.color} shadow" style="width:${bar.value}%"></div></div>
          </div>
        `).join('')}
      </div>
    </div>
    <blockquote class="mt-6 rounded-xl border-l-4 border-cyan-500 bg-cyan-950/20 p-5 text-sm leading-relaxed text-cyan-50 shadow-inner italic">
      <span class="font-bold uppercase text-cyan-400 not-italic block mb-2 text-xs tracking-widest">Análise do Coach Virtual:</span>
      "${result.coach}"
    </blockquote>
  `;
}

export function getSelectedChampions() {
  return state.teamPlanner.slots.slice(0, state.teamPlanner.playerCount).map(s => s.championSelected).filter(Boolean);
}

export function generateCompositionAnalysis(champions) {
  const uniqueCount = new Set(champions).size;
  const hasDuplicates = uniqueCount < champions.length;
  const completeness = Math.round((champions.length / state.teamPlanner.playerCount) * 100);

  const championMeta = champions.map(name => state.staticData.championList.find(c => c.name === name)).filter(Boolean);
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

export async function handleSlotFetch(slotId) {
  const slotIndex = state.teamPlanner.slots.findIndex((s) => s.id === slotId);
  if (slotIndex < 0) return;
  const slot = state.teamPlanner.slots[slotIndex];

  if (!slot.gameName?.trim() || !slot.tagLine?.trim()) {
    updateState(`teamPlanner.slots.${slotIndex}.error`, 'Preencha nome e tag.');
    return;
  }

  updateState(`teamPlanner.slots.${slotIndex}.loading`, true);
  updateState(`teamPlanner.slots.${slotIndex}.error`, null);

  try {
    const data = await workerRequest('masteries', { gameName: slot.gameName.trim(), tagLine: slot.tagLine.trim() });
    
    const fromStaticChamp = (entry) => {
      if (!entry) return { championName: 'Aatrox', championLevel: 1, championPoints: 0 };
      const fromStatic = state.staticData.championList.find((champ) => Number(champ.key) === Number(entry.championId));
      return {
        championName: entry.championName || fromStatic?.name || 'Aatrox',
        championLevel: Number(entry.championLevel || 1),
        championPoints: Number(entry.championPoints || 0)
      };
    };

    const topMasteries = (data.masteries || []).map(fromStaticChamp).slice(0, 15);
    updateState(`teamPlanner.slots.${slotIndex}.searchedData`, data);
    updateState(`teamPlanner.slots.${slotIndex}.masteryChoices`, topMasteries);
  } catch (error) {
    updateState(`teamPlanner.slots.${slotIndex}.error`, error.message);
  } finally {
    updateState(`teamPlanner.slots.${slotIndex}.loading`, false);
  }
}
