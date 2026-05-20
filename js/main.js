import { state, updateState, onStateChange } from './state.js';
import { TAB_IDS, DDRAGON_VERSION } from './utils.js';
import { initTelemetryInterval } from './components/Telemetry.js';
import { renderHomeTab } from './components/Home.js';
import { renderProfileTab, handleProfileSearch } from './components/Profile.js';
import { renderMasteryTab, handleMasteryOnlySearch } from './components/Mastery.js';
import { renderSynergyTab, handleSlotFetch, getSelectedChampions, generateCompositionAnalysis } from './components/Synergy.js';

const tooltipEl = document.getElementById('mastery-tooltip');

export function renderApp() {
  renderTabsNav();
  Object.entries(TAB_IDS).forEach(([tab, sectionId]) => {
    const el = document.getElementById(sectionId);
    if(el) el.classList.toggle('hidden', tab !== state.currentTab);
  });
  renderHomeTab();
  renderProfileTab();
  renderMasteryTab();
  renderSynergyTab();
}

function renderTabsNav() {
  const nav = document.getElementById('tabs-nav');
  if(!nav) return;
  const tabs = [
    { id: 'home',     label: 'Início',    emoji: '🏠', base: 'border-slate-600/70 bg-slate-800/60 text-slate-200 hover:bg-slate-700/80',           active: 'border-slate-400 bg-slate-700 text-white shadow-[0_0_12px_rgba(148,163,184,0.3)]' },
    { id: 'perfil',   label: 'Perfil',    emoji: '⚔️', base: 'border-cyan-700/40 bg-blue-900/40 text-cyan-200 hover:bg-blue-800/60',               active: 'border-cyan-500 bg-blue-700/80 text-cyan-100 shadow-[0_0_14px_rgba(6,182,212,0.4)]' },
    { id: 'maestria', label: 'Maestrias', emoji: '🏆', base: 'border-amber-700/40 bg-orange-950/40 text-amber-200 hover:bg-orange-900/60',          active: 'border-amber-500 bg-orange-800/70 text-amber-100 shadow-[0_0_14px_rgba(251,146,60,0.35)]' },
    { id: 'sinergia', label: 'Sinergia',  emoji: '🔮', base: 'border-lime-700/40 bg-emerald-950/40 text-lime-200 hover:bg-emerald-900/60',          active: 'border-lime-500 bg-emerald-800/70 text-lime-100 shadow-[0_0_14px_rgba(132,204,22,0.35)]' }
  ];

  nav.innerHTML = tabs.map(({ id, label, emoji, base, active: activeClass }) => {
    const isActive = state.currentTab === id;
    return `<button data-action="switch-tab" data-tab="${id}" type="button"
      class="rounded-xl border px-3 py-1.5 text-sm font-bold transition-all duration-200 ${isActive ? activeClass + ' scale-[1.06]' : base}">${emoji} ${label}</button>`;
  }).join('');
}

function filterChampionSuggestions(query) {
  if (!query) return [];
  const lower = query.toLowerCase();
  return state.staticData.championList.filter(c => c.name.toLowerCase().includes(lower)).map(c => c.name);
}

async function loadChampionStaticData() {
  try {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/champion.json`);
    const json = await response.json();
    const entries = Object.values(json.data || {});
    state.staticData.championList = entries;
    state.staticData.championsById = Object.fromEntries(entries.map(c => [c.key, c]));
    renderApp();
  } catch {}
}

onStateChange(renderApp);

document.addEventListener('DOMContentLoaded', () => {
  renderApp();
  loadChampionStaticData();
  initTelemetryInterval();
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'profile-form') handleProfileSearch(e);
  if (e.target.id === 'mastery-search-form') handleMasteryOnlySearch(e);
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.action === 'slot-select-dropdown') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === Number(t.dataset.id));
    if (idx >= 0 && t.value) updateState(`teamPlanner.slots.${idx}.championSelected`, t.value);
  }
});

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id = Number(target.dataset.id);

  if (action === 'switch-tab') updateState('currentTab', target.dataset.tab);

  if (action === 'nav-card') {
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ripple = document.getElementById('card-ripple');
    if (ripple) {
      ripple.style.cssText = `position:fixed; left:${cx}px; top:${cy}px; width:10px; height:10px; background:${target.dataset.color || '#1e3a5f'}; border-radius:50%; transform:translate(-50%,-50%) scale(0); transition:transform 440ms ease-in, border-radius 440ms ease-in; opacity:0.92;`;
      ripple.classList.remove('hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ripple.style.transform = 'translate(-50%,-50%) scale(260)';
        ripple.style.borderRadius = '0';
      }));
      setTimeout(() => {
        updateState('currentTab', target.dataset.tab);
        ripple.classList.add('hidden');
        ripple.style.transform = 'translate(-50%,-50%) scale(0)';
        ripple.style.borderRadius = '50%';
      }, 420);
    } else {
      updateState('currentTab', target.dataset.tab);
    }
  }
  if (action === 'clear-profile-error') updateState('searchProfile.error', null);
  if (action === 'clear-mastery-error') updateState('masteryDashboard.error', null);
  if (action === 'set-queue') updateState('teamPlanner.queueType', target.dataset.queue);
  if (action === 'set-player-count') updateState('teamPlanner.playerCount', Number(target.dataset.count));
  
  if (action === 'set-slot-type') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) {
      updateState(`teamPlanner.slots.${idx}.type`, target.dataset.type);
      updateState(`teamPlanner.slots.${idx}.error`, null);
    }
  }
  if (action === 'slot-select-suggestion') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) {
      updateState(`teamPlanner.slots.${idx}.championSelected`, target.dataset.name);
      updateState(`teamPlanner.slots.${idx}.suggestions`, []);
    }
  }
  if (action === 'slot-fetch') handleSlotFetch(id);
  if (action === 'slot-select-mastery') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) updateState(`teamPlanner.slots.${idx}.championSelected`, target.dataset.name);
  }
  if (action === 'slot-clear') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) {
      const base = { championSelected: '', searchedData: null, error: null, masteryChoices: [], gameName: '', tagLine: '', loading: false };
      Object.entries(base).forEach(([k, v]) => updateState(`teamPlanner.slots.${idx}.${k}`, v));
    }
  }
  if (action === 'analyze-composition') {
    const champions = getSelectedChampions();
    updateState('teamPlanner.analysisLoading', true);
    updateState('teamPlanner.analysisResult', null);
    setTimeout(() => {
      updateState('teamPlanner.analysisResult', generateCompositionAnalysis(champions));
      updateState('teamPlanner.analysisLoading', false);
    }, 2000);
  }
  if (action === 'clear-slot-error') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) updateState(`teamPlanner.slots.${idx}.error`, null);
  }
});

document.addEventListener('input', (e) => {
  const target = e.target;
  const action = target.dataset.action;
  const id = Number(target.dataset.id);
  if (!action) return;

  if (action === 'slot-query') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) {
      updateState(`teamPlanner.slots.${idx}.query`, target.value);
      updateState(`teamPlanner.slots.${idx}.suggestions`, filterChampionSuggestions(target.value));
    }
  }
  if (action === 'slot-summoner') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) {
      const val = target.value || '';
      const [nameRaw, tagRaw] = val.split('#');
      updateState(`teamPlanner.slots.${idx}.gameName`, (nameRaw || '').trim());
      updateState(`teamPlanner.slots.${idx}.tagLine`, (tagRaw || '').trim());
    }
  }
});

document.addEventListener('mouseover', (e) => {
  const t = e.target.closest('[data-action="show-tooltip"]');
  if (!t || !tooltipEl) return;
  tooltipEl.innerHTML = `<p class="font-bold text-slate-100">${t.dataset.name}</p><p class="text-[10px] uppercase font-bold text-slate-400 mt-1">Nível de Maestria: <span class="text-amber-400">M${t.dataset.level}</span></p><p class="text-xs text-blue-300">Pontos: ${Number(t.dataset.points || 0).toLocaleString('pt-BR')}</p>`;
  tooltipEl.classList.remove('hidden');
});
document.addEventListener('mousemove', (e) => {
  if (tooltipEl && !tooltipEl.classList.contains('hidden')) {
    tooltipEl.style.left = `${e.clientX + 14}px`;
    tooltipEl.style.top = `${e.clientY + 12}px`;
  }
});
document.addEventListener('mouseout', (e) => {
  if (tooltipEl && e.target.closest('[data-action="show-tooltip"]')) tooltipEl.classList.add('hidden');
});
