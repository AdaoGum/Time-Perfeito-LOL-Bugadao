<template>
  <div class="min-h-screen bg-slate-950 text-white p-6 flex flex-col justify-center items-center py-16 space-y-8 relative overflow-hidden">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.15),transparent_70%)] pointer-events-none"></div>

    <div class="text-center max-w-2xl space-y-4 relative z-10">
      <h1 class="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600 drop-shadow-md">
        TEMPLO DOS MONOS
      </h1>
      <p class="text-slate-400 text-lg font-medium">Selecione seu caminho...</p>
    </div>

    <!-- MISSÃO 2: Busca centralizada populando a store global antes dos caminhos -->
    <div class="w-full max-w-md bg-slate-900 border border-slate-800/80 p-6 rounded-2xl shadow-2xl relative z-10">
      <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 text-center mb-3">Definir Invocador Global</h2>
      <SearchBar buttonText="Procurar Caminho" @search-success="onGlobalSearchSuccess" />
      <p v-if="store.searchProfile.puuid" class="text-center text-xs font-semibold text-emerald-400 mt-3 animate-pulse">
        🟢 Ativo: {{ store.searchProfile.gameName }}#{{ store.searchProfile.tagLine }}
      </p>
    </div>

    <!-- Cards de Escolha de Caminho -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl mt-4 relative z-10">
      <div class="bg-slate-900 border border-slate-800 p-6 rounded-xl hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all cursor-pointer group">
        <div class="text-amber-400 font-bold mb-2 text-xl group-hover:text-amber-300 transition-colors">🔮 Caverna dos Monos</div>
        <p class="text-xs text-slate-400 leading-relaxed">Descubra maestrias absurdas, pontuações e records individuais de campeões.</p>
      </div>
      
      <div class="bg-slate-900 border border-slate-800 p-6 rounded-xl hover:border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all cursor-pointer group">
        <div class="text-cyan-400 font-bold mb-2 text-xl group-hover:text-cyan-300 transition-colors">⚔️ A Caçada</div>
        <p class="text-xs text-slate-400 leading-relaxed">Analise históricos profundos por abas, KDAs reais e filtros por fila ranqueada ou normal.</p>
      </div>

      <div class="bg-slate-900 border border-slate-800 p-6 rounded-xl hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all cursor-pointer group">
        <div class="text-emerald-400 font-bold mb-2 text-xl group-hover:text-emerald-300 transition-colors">🛡️ A Tribo</div>
        <p class="text-xs text-slate-400 leading-relaxed">Monte composições cirúrgicas com o simulador automático e radar de amigos recentes.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import SearchBar from '../components/SearchBar.vue';
import { state } from '../store.js';

const store = state;

function onGlobalSearchSuccess(profile) {
  console.log('Invocador global setado com sucesso do Templo:', profile.gameName);
}
</script>
