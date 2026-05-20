import { state, updateState, onStateChange } from './state.js';
import { TAB_IDS, DDRAGON_VERSION } from './utils.js';
import { initTelemetryInterval } from './components/Telemetry.js';
import { renderHomeTab } from './components/Home.js';
import { renderProfileTab, handleProfileSearch } from './components/Profile.js';
import { renderMasteryTab } from './components/Mastery.js';
import { renderSynergyTab, handleSlotFetch, getSelectedChampions, generateCompositionAnalysis } from './components/Synergy.js';

const tooltipEl = document.getElementById('mastery-tooltip');

export function renderApp() {
  renderTabsNav();
  
  // Controla a visibilidade das seções baseando-se no state.currentTab
  Object.entries(TAB_IDS).forEach(([tab, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', tab !== state.currentTab);
  });

  // Renderiza a aba ativa de forma totalmente reativa
  if (state.currentTab === 'home') renderHomeTab();
  else if (state.currentTab === 'perfil') renderProfileTab();
  else if (state.currentTab === 'maestria') renderMasteryTab();
  else if (state.currentTab === 'sinergia') renderSynergyTab();
}

function renderTabsNav() {
  const nav = document.getElementById('tabs-nav');
  if (!nav) return;
  
  const tabs = [
    { id: 'home', label: '🛡️ TEMPLO' },
    { id: 'perfil', label: '⚔️ CAÇADA' },
    { id: 'maestria', label: '🌋 CAVERNA' },
    { id: 'sinergia', label: '👥 TRIBO' }
  ];

  nav.innerHTML = tabs.map(({ id, label }) => {
    const act = state.currentTab === id;
    return `<button data-action="switch-tab" data-tab="${id}" class="px-3 py-1.5 font-cave text-xs sm:text-sm transition-all border-b-4 cursor-pointer ${act ? 'border-orange-500 text-orange-500 scale-105 font-bold' : 'border-stone-900 text-stone-600 hover:text-stone-400'}" type="button">${label}</button>`;
  }).join('');
}

async function loadStaticData() {
  try {
    // Carrega campeões em PT-BR para as sugestões ficarem certinhas na busca
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/pt_BR/champion.json`);
    const json = await res.json();
    state.staticData.championList = Object.values(json.data || {});
    renderApp();
  } catch (e) {
    console.error("Erro ao carregar dados do Data Dragon:", e);
  }
}

// Vincula a renderização automática às mudanças de estado
onStateChange(renderApp);

// Inicialização do ecossistema do site
document.addEventListener('DOMContentLoaded', () => { 
  loadStaticData(); 
  initTelemetryInterval(); 
});

// Eventos de Formulário (Aba de Busca de Perfil)
document.addEventListener('submit', e => { 
  if (e.target.id === 'profile-form') handleProfileSearch(e); 
});

// Delegador de Cliques Global (Evita criar múltiplos listeners)
document.addEventListener('click', e => {
  const t = e.target.closest('[data-action]'); if (!t) return;
  const a = t.dataset.action; const id = Number(t.dataset.id);

  // Navegação: Suporta tanto os botões do cabeçalho quanto os cards gigantes alargados da Home
  if (a === 'switch-tab' || a === 'nav-card') { 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
    updateState('currentTab', t.dataset.tab); 
  }
  
  // Limpeza de banners de erros
  if (a === 'clear-profile-error') updateState('searchProfile.error', null);
  if (a === 'clear-mastery-error') updateState('masteryDashboard.error', null);
  if (a === 'clear-slot-error') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) updateState(`teamPlanner.slots.${idx}.error`, null);
  }

  // Configurações do Planejador de Equipe (Sinergia)
  if (a === 'set-queue') updateState('teamPlanner.queueType', t.dataset.queue);
  if (a === 'set-player-count') updateState('teamPlanner.playerCount', Number(t.dataset.count));
  if (a === 'set-slot-type') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) updateState(`teamPlanner.slots.${idx}.type`, t.dataset.type);
  }

  // Ações dos Slots da Equipe
  if (a === 'slot-fetch') handleSlotFetch(id);
  if (a === 'slot-select-mastery') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) updateState(`teamPlanner.slots.${idx}.championSelected`, t.dataset.name);
  }
  if (a === 'slot-clear') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) {
      updateState(`teamPlanner.slots.${idx}.searchedData`, null);
      updateState(`teamPlanner.slots.${idx}.championSelected`, '');
      updateState(`teamPlanner.slots.${idx}.masteryChoices`, []);
    }
  }
  if (a === 'slot-select-suggestion') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) {
      updateState(`teamPlanner.slots.${idx}.championSelected`, t.dataset.name);
      updateState(`teamPlanner.slots.${idx}.suggestions`, []);
      updateState(`teamPlanner.slots.${idx}.query`, t.dataset.name);
    }
  }

  // Aciona o ritual de cálculo de composição
  if (a === 'analyze-composition') {
    const champs = getSelectedChampions();
    updateState('teamPlanner.analysisLoading', true);
    updateState('teamPlanner.analysisResult', null);
    setTimeout(() => {
      updateState('teamPlanner.analysisResult', generateCompositionAnalysis(champs));
      updateState('teamPlanner.analysisLoading', false);
    }, 2000);
  }
});

// Delegador de Inputs Global (Para barras de digitação reativas)
document.addEventListener('input', e => {
  const t = e.target; const a = t.dataset.action; const id = Number(t.dataset.id);
  if (!a) return;

  if (a === 'slot-query') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) {
      updateState(`teamPlanner.slots.${idx}.query`, t.value);
      const low = t.value.toLowerCase();
      const list = low ? state.staticData.championList.filter(c => c.name.toLowerCase().includes(low)).map(c => c.name) : [];
      updateState(`teamPlanner.slots.${idx}.suggestions`, list);
    }
  }
  if (a === 'slot-summoner') {
    const idx = state.teamPlanner.slots.findIndex(s => s.id === id);
    if (idx >= 0) {
      const [n, tg] = t.value.split('#');
      updateState(`teamPlanner.slots.${idx}.gameName`, (n || '').trim());
      updateState(`teamPlanner.slots.${idx}.tagLine`, (tg || '').trim());
    }
  }
});

// Sistema de Tooltip Flutuante da Caverna dos Monos
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-action="show-tooltip"]');
  if (!t || !tooltipEl) return;
  tooltipEl.innerHTML = `<p class="font-cave text-base text-orange-400">${t.dataset.name}</p><p class="text-[10px] uppercase text-stone-400 mt-0.5">Nível de Mestria: ${t.dataset.level}</p><p class="text-xs text-stone-200 mt-1 font-bold">PTS: ${Number(t.dataset.points || 0).toLocaleString('pt-BR')}</p>`;
  tooltipEl.classList.remove('hidden');
});

document.addEventListener('mousemove', e => {
  if (tooltipEl && !tooltipEl.classList.contains('hidden')) {
    tooltipEl.style.left = `${e.clientX + 16}px`;
    tooltipEl.style.top = `${e.clientY + 12}px`;
  }
});

document.addEventListener('mouseout', e => {
  if (tooltipEl && e.target.closest('[data-action="show-tooltip"]')) tooltipEl.classList.add('hidden');
});