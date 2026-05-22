<template>
  <div class="space-y-6 text-white max-w-5xl mx-auto">
    <section class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row gap-4 items-center justify-between">
      <div>
        <p class="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Tamanho do Esquadrão</p>
        <div class="flex gap-1.5">
          <button v-for="i in [1,2,3,4,5]" :key="i" @click="store.teamPlanner.playerCount = i" class="w-8 h-8 rounded-full font-black text-xs border" :class="store.teamPlanner.playerCount === i ? 'bg-blue-600 text-white border-blue-500 shadow-md' : 'bg-slate-950 border-slate-800 text-slate-400'">{{ i }}</button>
        </div>
      </div>
      <div class="text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Simulador Estratégico</div>
    </section>

    <section class="grid grid-cols-1 md:grid-cols-5 gap-4">
      <article v-for="(slot, idx) in activeSlots" :key="slot.id" class="bg-slate-900 border border-slate-800 p-4 rounded-xl relative flex flex-col justify-between min-h-[220px]">
        <div class="space-y-3">
          <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span class="text-xs font-black text-slate-400 uppercase">SLOT {{ idx + 1 }}</span>
            <span class="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded font-black text-cyan-400 border border-slate-800">{{ slot.role }}</span>
          </div>

          <div v-if="idx === 0 && store.searchProfile.puuid" class="p-2 bg-slate-950 rounded border border-blue-900 text-center">
            <p class="text-xs font-black text-blue-400">{{ store.searchProfile.gameName }}</p>
            <p class="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Líder Vinculado</p>
          </div>

          <div v-else class="space-y-2">
            <div v-if="!slot.gameName" class="w-full">
              <SearchBar buttonText="" @search-success="data => bindSlotData(slot, data)" />
            </div>
            <div class="p-2 bg-slate-950 rounded border border-slate-800 text-center relative" v-else>
              <p class="text-xs font-black text-slate-300 truncate">{{ slot.gameName }}</p>
              <button @click="clearSlot(slot)" class="absolute right-1 top-1 text-[9px] text-red-400 font-bold">X</button>
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-800">
          <select v-model="slot.championSelected" class="w-full bg-slate-950 text-xs font-bold text-slate-300 border border-slate-800 rounded p-1 focus:outline-none focus:border-cyan-500 cursor-pointer">
            <option value="">Escolha Campeão...</option>
            <option v-for="c in store.staticData.championList" :key="c.id" :value="c.name">{{ c.name }}</option>
          </select>
        </div>
      </article>
    </section>

    <section class="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center shadow-md">
      <button @click="runAnalysis" class="bg-gradient-to-r from-blue-600 to-cyan-500 font-black uppercase text-xs tracking-widest px-6 py-3 rounded-lg shadow-lg hover:scale-[1.01] transition-transform w-full max-w-sm">
        Simular Composição da Tribo
      </button>
      <div v-if="store.teamPlanner.analysisResult" class="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs leading-relaxed italic text-slate-300">
        <span class="font-black text-cyan-400 not-italic block mb-1">Mestre da Tribo:</span>
        "Formação aceitável para as linhas táticas do ecossistema. Foquem em controle de visão e rotações nos rios."
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { state } from '../store.js';
import SearchBar from './SearchBar.vue';

const store = state;
const activeSlots = computed(() => store.teamPlanner.slots.slice(0, store.teamPlanner.playerCount));

function bindSlotData(slot, profile) {
  slot.gameName = profile.gameName;
  slot.tagLine = profile.tagLine;
}
function clearSlot(slot) {
  slot.gameName = ''; slot.tagLine = ''; slot.championSelected = '';
}
function runAnalysis() {
  store.teamPlanner.analysisResult = { active: true };
}
</script>
