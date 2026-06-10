<template>
  <div class="space-y-6 text-white">
    <!-- TELA 1: PORTÃO DE PROTEÇÃO POR SENHA -->
    <section v-if="!isAuthenticated" class="mx-auto max-w-md rounded-2xl border border-orange-950/40 bg-slate-900/90 p-6 shadow-2xl text-center backdrop-blur-md mt-12">
      <span class="text-4xl">🔒</span>
      <h2 class="text-xl font-black tracking-wide text-amber-300 uppercase mt-2">Área Ancestral Restrita</h2>
      <p class="text-xs text-slate-400 mt-1">Insira a palavra rítmica da tribo para abrir os registros brutos do D1.</p>
      
      <form @submit.prevent="checkSecretPassword" class="mt-4 space-y-3">
        <input
          v-model="passwordInput"
          type="password"
          class="w-full rounded-lg border border-slate-700 bg-slate-950 text-center text-sm text-white focus:border-amber-500 focus:outline-none"
          placeholder="Digite a senha secreta..."
        />
        <button type="submit" class="w-full rounded-lg bg-amber-700 py-2 text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition">
          Desbloquear Banco
        </button>
        <p v-if="loginError" class="text-xs font-bold text-red-400 mt-1 animate-pulse">{{ loginError }}</p>
      </form>
    </section>

    <!-- TELA 2: O DASHBOARD COMPLETO (SÓ REVELADO COM A SENHA CORRETA) -->
    <template v-else>
      <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl relative z-40">
        <h2 class="text-xl font-black text-cyan-300 uppercase">Ancestralidade de Dados (D1 Studio)</h2>
        <p class="text-xs text-slate-400">Varredura profunda cruzando registros globais de invocadores e estatísticas táticas.</p>
        
        <!-- PAINEL DE FILTROS AVANÇADOS COM DROP DOWNS SUSPENSOS -->
        <div class="mt-4 grid gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-3">
          
          <!-- FILTRO 1: DROP DOWN MULTISELECT DE JOGADORES -->
          <div class="relative">
            <label class="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Jogadores Monitorados</label>
            <button 
              type="button"
              @click="showPlayerDropdown = !showPlayerDropdown; showQueueDropdown = false"
              class="w-full flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <span class="truncate">
                {{ selectedPlayers.length ? `Selecionados (${selectedPlayers.length})` : 'Todos os Jogadores' }}
              </span>
              <span class="text-[10px] text-slate-500">▼</span>
            </button>

            <div 
              v-if="showPlayerDropdown" 
              class="absolute left-0 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2 z-50 shadow-2xl divide-y divide-slate-900"
            >
              <div class="p-1 flex items-center justify-between text-[9px] font-black uppercase text-slate-500 pb-1.5">
                <span>Selecione a Tribo</span>
                <button type="button" @click="selectedPlayers = []" class="text-amber-400 hover:underline">Limpar</button>
              </div>
              <button 
                v-for="player in uniquePlayers" 
                :key="player"
                type="button"
                @click="togglePlayerFilter(player)"
                class="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs font-bold text-slate-300 hover:bg-slate-900/60 transition-colors"
              >
                <input type="checkbox" :checked="selectedPlayers.includes(player)" class="pointer-events-none rounded border-slate-700 bg-slate-900 text-cyan-500" />
                <span class="truncate">{{ player }}</span>
              </button>
            </div>
          </div>

          <!-- FILTRO 2: DROP DOWN MULTISELECT DE TIPOS DE PARTIDA -->
          <div class="relative">
            <label class="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Tipos de Partida</label>
            <button 
              type="button"
              @click="showQueueDropdown = !showQueueDropdown; showPlayerDropdown = false"
              class="w-full flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <span class="truncate">
                {{ selectedQueues.length ? `Selecionadas (${selectedQueues.length})` : 'Todos os Modos' }}
              </span>
              <span class="text-[10px] text-slate-500">▼</span>
            </button>

            <div 
              v-if="showQueueDropdown" 
              class="absolute left-0 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2 z-50 shadow-2xl divide-y divide-slate-900"
            >
              <div class="p-1 flex items-center justify-between text-[9px] font-black uppercase text-slate-500 pb-1.5">
                <span>Filas de Matchmaking</span>
                <button type="button" @click="selectedQueues = []" class="text-amber-400 hover:underline">Limpar</button>
              </div>
              <button 
                v-for="mode in queueModesOptions" 
                :key="mode.value"
                type="button"
                @click="toggleQueueFilter(mode.value)"
                class="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs font-bold text-slate-300 hover:bg-slate-900/60 transition-colors"
              >
                <input type="checkbox" :checked="selectedQueues.includes(mode.value)" class="pointer-events-none rounded border-slate-700 bg-slate-900 text-blue-500" />
                <span>{{ mode.label }}</span>
              </button>
            </div>
          </div>

          <!-- FILTRO 3: PERÍODO DE CALENDÁRIO -->
          <div>
            <label class="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Período Histórico</label>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <span class="text-[8px] text-slate-500 uppercase block">De:</span>
                <input type="date" v-model="filterStartDate" class="w-full rounded border border-slate-800 bg-slate-900 p-1 text-[11px] text-white focus:outline-none" />
              </div>
              <div>
                <span class="text-[8px] text-slate-500 uppercase block">Até:</span>
                <input type="date" v-model="filterEndDate" class="w-full rounded border border-slate-800 bg-slate-900 p-1 text-[11px] text-white focus:outline-none" />
              </div>
            </div>
          </div>
        </div>

        <!-- CONTROLADORES DA PAGINAÇÃO -->
        <div class="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-3 text-[11px] font-bold">
          <div class="text-slate-400">
            Filtrados: <strong class="text-cyan-400">{{ filteredHistory.length }}</strong> registros | 
            Exibindo página <strong class="text-white">{{ currentPage }}</strong> de <strong class="text-white">{{ totalPages }}</strong>
          </div>
          
          <div class="flex items-center gap-2">
            <span class="text-slate-400 text-[10px] uppercase tracking-wider">Jogos por página:</span>
            <div class="flex gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-1">
              <button 
                v-for="size in perPageOptions" 
                :key="size"
                type="button"
                @click="itemsPerPage = size"
                class="rounded px-2.5 py-1 text-[10px] font-black transition-all"
                :class="itemsPerPage === size ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
              >
                {{ size }}
              </button>
            </div>
            <button @click="fetchFullHistoryFromD1" class="text-cyan-400 underline hover:text-cyan-300 ml-2">Atualizar 🔄</button>
          </div>
        </div>
      </section>

      <!-- FECHAMENTO DOS DROPDOWNS AO CLICAR FORA -->
      <div v-if="showPlayerDropdown || showQueueDropdown" class="fixed inset-0 z-30" @click="showPlayerDropdown = false; showQueueDropdown = false"></div>

      <!-- ELEMENTO DE CARREGAMENTO -->
      <div v-if="loadingData" class="text-center py-12">
        <p class="animate-pulse font-black text-cyan-300 text-sm">Consultando tabelas brutas da nuvem...</p>
      </div>

      <!-- LISTAGEM EM FORMATO GRID COMPACTO (1 COLUNA MOBILE, 2 COLUNAS PC) -->
      <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-4 relative z-10">
        <p v-if="!paginatedHistory.length" class="col-span-full text-center text-slate-500 py-12 font-bold bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
          Nenhum registro bruto corresponde aos filtros aplicados nas colunas.
        </p>

        <article
          v-for="row in paginatedHistory"
          :key="row.match_id + '-' + row.game_name"
          class="rounded-2xl border p-4 bg-slate-900/40 backdrop-blur-sm transition hover:bg-slate-900/70 flex flex-col justify-between gap-4 shadow-xl"
          :class="row.win === 1 ? 'border-blue-900/50 bg-blue-950/10 text-blue-100' : 'border-red-900/50 bg-red-950/10 text-red-100'"
        >
          <!-- CARD PARTE DE CIMA: INFORMAÇÕES DO JOGADOR + STATUS GLOBAL DA PARTIDA -->
          <div class="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/60 pb-2.5">
            <div class="space-y-0.5">
              <p class="font-black text-white text-sm">
                {{ row.game_name }}<span class="text-slate-500 text-xs font-semibold">#{{ row.tag_line }}</span>
              </p>
              <p class="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <span class="text-cyan-400 text-[9px] font-black uppercase tracking-wider">Solo:</span> {{ formatRank(row.tier, row.rank) }}
                <span class="text-slate-700">|</span>
                <span class="text-purple-400 text-[9px] font-black uppercase tracking-wider">Flex:</span> {{ formatRank(row.flex_tier, row.flex_rank) }}
              </p>
              <p class="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                <span class="text-cyan-400 font-black text-[9px]">WR S:</span> {{ Number(row.win_rate || 0).toFixed(1) }}%
                <span class="text-slate-700">|</span>
                <span class="text-purple-400 font-black text-[9px]">WR F:</span> {{ Number(row.flex_win_rate || 0).toFixed(1) }}%
              </p>
            </div>
            
            <div class="text-right">
              <p class="font-black text-sm uppercase tracking-wider" :class="row.win === 1 ? 'text-blue-400' : 'text-red-400'">
                {{ row.win === 1 ? 'VITÓRIA' : 'DERROTA' }}
              </p>
              <p class="text-[10px] font-semibold text-slate-400">{{ formatRelativeDate(row.game_creation) }}</p>
              <p class="text-[9px] text-slate-600 font-medium font-mono">ID: {{ row.match_id }}</p>
            </div>
          </div>

          <!-- CARD PARTE DE BAIXO: DIVIDIDO LINDO EM 2 SUB-COLUNAS (DADOS VS OUTROS JOGADORES) -->
          <div class="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-4 items-center">
            
            <!-- SUB-COLUNA ESQUERDA: CAMPEÃO, KDA, COMPACT DURATION E ITENS -->
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <img class="h-12 w-12 rounded-xl border border-slate-700 object-cover shadow-md flex-shrink-0" :src="championImage(row.champion_name)" alt="champ" />
                <div class="min-w-0">
                  <p class="text-xs font-black text-slate-200 uppercase tracking-wide truncate">{{ row.champion_name }}</p>
                  <p class="text-sm font-black text-white tracking-widest mt-0.5">
                    {{ row.kills }} <span class="text-slate-600">/</span> {{ row.deaths }} <span class="text-slate-600">/</span> {{ row.assists }}
                  </p>
                  <p class="text-[11px] font-bold text-slate-400 truncate">
                    {{ calculateKdaRatio(row.kills, row.deaths, row.assists) }} KDA <span class="text-slate-600 font-normal">•</span> {{ formatDuration(row.game_duration) }}
                  </p>
                </div>
              </div>

              <!-- ITEMS GRID (COMPACTO) -->
              <div class="flex flex-wrap gap-1">
                <template v-for="(itemId, idx) in safeParseJson(row.items, [0,0,0,0,0,0])" :key="idx">
                  <img v-if="itemId" class="h-6 w-6 rounded border border-slate-700 bg-slate-800 shadow-sm" :src="itemImage(itemId)" loading="lazy" />
                  <div v-else class="h-6 w-6 rounded border border-slate-800/30 bg-slate-900/40"></div>
                </template>
              </div>
            </div>

            <!-- SUB-COLUNA DIREITA: OS OUTROS 9 JOGADORES DA PARTIDA (PERFEITO EM 2 COLUNAS INTERNAS) -->
            <div class="grid grid-cols-2 gap-1 bg-slate-950/40 rounded-xl p-2 border border-slate-900/60 h-full content-center">
              <!-- TIME ALIADO -->
              <div class="space-y-0.5 border-r border-slate-900/60 pr-1 flex flex-col justify-center">
                <div v-for="p in filterTeam(row, true)" :key="p.gameName" class="flex items-center gap-1 overflow-hidden">
                  <img class="h-3.5 w-3.5 rounded-sm border border-slate-800 flex-shrink-0 shadow-sm" :src="championImage(p.championName)" loading="lazy" />
                  <span class="truncate text-[9px] font-bold" :class="isMe(row, p) ? 'text-amber-300 font-black' : 'text-blue-300/80'">
                    {{ p.gameName }}
                  </span>
                </div>
              </div>
              <!-- TIME INIMIGO -->
              <div class="space-y-0.5 pl-1 flex flex-col justify-center">
                <div v-for="p in filterTeam(row, false)" :key="p.gameName" class="flex items-center gap-1 overflow-hidden">
                  <img class="h-3.5 w-3.5 rounded-sm border border-slate-800 flex-shrink-0 shadow-sm" :src="championImage(p.championName)" loading="lazy" />
                  <span class="truncate text-[9px] font-bold text-red-300/80">
                    {{ p.gameName }}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </article>

        <!-- NAVEGADOR DE PÁGINAS INFERIOR (CUPULA CENTRALIZADA) -->
        <div v-if="totalPages > 1" class="col-span-full flex items-center justify-center gap-4 border-t border-slate-800/80 pt-5 pb-6">
          <button 
            type="button" 
            :disabled="currentPage === 1"
            @click="currentPage--"
            class="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-300 transition-all hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            « Anterior
          </button>
          
          <span class="text-xs font-bold text-slate-400">
            Página <strong class="text-cyan-400">{{ currentPage }}</strong> de <strong class="text-white">{{ totalPages }}</strong>
          </span>
          
          <button 
            type="button" 
            :disabled="currentPage === totalPages"
            @click="currentPage++"
            class="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-300 transition-all hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Próxima »
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { workerRequest } from '../api.js';
import { championImage, itemImage, calculateKdaRatio, formatDuration } from '../utils.js';

const isAuthenticated = ref(false);
const passwordInput = ref('');
const loginError = ref(null);
const loadingData = ref(false);
const databaseRows = ref([]);

// Estados de Visibilidade dos Dropdowns Suspensos
const showPlayerDropdown = ref(false);
const showQueueDropdown = ref(false);

// Arrays de Seleção Múltipla dos Filtros
const selectedPlayers = ref([]);
const selectedQueues = ref([]);

// Filtro de Data
const filterStartDate = ref('');
const filterEndDate = ref('');

// Configurações de Paginação
const currentPage = ref(1);
const itemsPerPage = ref(20);
const perPageOptions = [20, 50, 75, 100];

// Opções Estruturadas para o Multiselect de Filas
const queueModesOptions = [
  { value: 'Ranked Solo', label: 'Ranked Solo' },
  { value: 'Ranked Flex', label: 'Ranked Flex' },
  { value: 'Normal Draft', label: 'Normal Draft' },
  { value: 'Normal Blind', label: 'Normal Blind' },
  { value: 'ARAM', label: 'ARAM' },
  { value: 'Arena', label: 'Arena' },
  { value: 'Outros', label: 'Outros Modos' }
];

function checkSecretPassword() {
  if (passwordInput.value === 'ugabuga') {
    isAuthenticated.value = true;
    loginError.value = null;
    fetchFullHistoryFromD1();
  } else {
    loginError.value = 'Chave incorreta. Os espíritos do D1 negaram seu acesso.';
  }
}

async function fetchFullHistoryFromD1() {
  loadingData.value = true;
  try {
    const response = await workerRequest('admin_all_history', {});
    if (response?.history) {
      databaseRows.value = response.history;
    }
  } catch (err) {
    console.error('Falha ao raspar D1:', err.message);
  } finally {
    loadingData.value = false;
  }
}

const uniquePlayers = computed(() => {
  const set = new Set();
  databaseRows.value.forEach(row => {
    if (row.game_name) set.add(`${row.game_name}#${row.tag_line}`);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
});

function togglePlayerFilter(playerKey) {
  const index = selectedPlayers.value.indexOf(playerKey);
  if (index > -1) selectedPlayers.value.splice(index, 1);
  else selectedPlayers.value.push(playerKey);
}

function toggleQueueFilter(queueValue) {
  const index = selectedQueues.value.indexOf(queueValue);
  if (index > -1) selectedQueues.value.splice(index, 1);
  else selectedQueues.value.push(queueValue);
}

// 📊 MOTOR DE FILTRAGEM TOTAL
const filteredHistory = computed(() => {
  return databaseRows.value.filter(row => {
    if (selectedPlayers.value.length > 0) {
      const currentKey = `${row.game_name}#${row.tag_line}`;
      if (!selectedPlayers.value.includes(currentKey)) return false;
    }

    if (selectedQueues.value.length > 0) {
      const q = row.queueType; 
      const isMatch = selectedQueues.value.some(selected => {
        if (selected === 'Outros') {
          return !['Ranked Solo', 'Ranked Flex', 'Normal Draft', 'Normal Blind', 'ARAM', 'Arena'].includes(q);
        }
        return q === selected;
      });
      if (!isMatch) return false;
    }

    if (row.game_creation) {
      const rowTime = Number(row.game_creation);
      if (filterStartDate.value) {
        const startLimit = new Date(filterStartDate.value).getTime();
        if (rowTime < startLimit) return false;
      }
      if (filterEndDate.value) {
        const endLimit = new Date(filterEndDate.value).getTime() + 86400000;
        if (rowTime > endLimit) return false;
      }
    }

    return true;
  });
});

const totalPages = computed(() => {
  return Math.ceil(filteredHistory.value.length / itemsPerPage.value) || 1;
});

const paginatedHistory = computed(() => {
  const startOffset = (currentPage.value - 1) * itemsPerPage.value;
  const endOffset = startOffset + itemsPerPage.value;
  return filteredHistory.value.slice(startOffset, endOffset);
});

watch([filteredHistory, itemsPerPage], () => {
  currentPage.value = 1;
});

function formatRank(tier, rank) {
  if (!tier || tier === 'UNRANKED') return 'Unranked';
  return `${tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()} ${rank || ''}`.trim();
}

function formatRelativeDate(timestamp) {
  if (!timestamp) return 'Data Antiga';
  const diff = Date.now() - Number(timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `Há ${minutes} min`;
  if (hours < 24) return `Há ${hours} horas`;
  return `Há ${days} dias`;
}

function safeParseJson(jsonString, fallback) {
  try { return jsonString ? JSON.parse(jsonString) : fallback; } 
  catch (e) { return fallback; }
}

function isMe(row, participant) {
  return participant.gameName?.toLowerCase().trim() === row.game_name?.toLowerCase().trim();
}

function filterTeam(row, getAllies) {
  const participants = safeParseJson(row.participants, []);
  const targetMe = participants.find(p => p.gameName?.toLowerCase().trim() === row.game_name?.toLowerCase().trim());
  const myTeamId = targetMe?.teamId || 100;
  
  return participants.filter(p => getAllies ? p.teamId === myTeamId : p.teamId !== myTeamId).slice(0, 5);
}
</script>