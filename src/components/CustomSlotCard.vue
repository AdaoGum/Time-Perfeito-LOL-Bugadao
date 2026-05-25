<template>
  <div
    class="rounded-xl border border-slate-800 bg-slate-950/70 p-2"
    :draggable="Boolean(slot.gameName)"
    @dragstart="$emit('dragstart', slot.id)"
    @dragover.prevent
    @drop="$emit('drop', slot.id)"
  >
    <div v-if="!slot.gameName && !slot.showSearch" class="rounded-lg border border-dashed border-amber-700/70 bg-slate-900/60 p-3">
      <button
        type="button"
        class="flex w-full items-center justify-center rounded-lg border border-amber-700 bg-slate-900 py-4 text-lg font-black text-amber-300 hover:bg-slate-800"
        @click="slot.showSearch = true"
      >[+]</button>
      <div class="mt-2 grid grid-cols-2 gap-1">
        <button
          type="button"
          class="rounded border border-cyan-700 bg-cyan-900/30 px-2 py-1 text-[10px] font-black text-cyan-300 hover:bg-cyan-900/50"
          @click="slot.showSearch = true"
        >Buscar</button>
        <button
          type="button"
          class="rounded border border-amber-700 bg-amber-900/30 px-2 py-1 text-[10px] font-black text-amber-300 hover:bg-amber-900/50"
          @click="$emit('anonymous', slot.id)"
        >Anonimo</button>
      </div>
    </div>

    <div v-else class="space-y-2">
      <div class="flex items-center gap-2">
        <img
          class="h-7 w-7 rounded border border-slate-700 object-cover sm:h-8 sm:w-8"
          :src="slot.gameName ? 'https://ddragon.leagueoflegends.com/cdn/' + ddragonVersion + '/img/profileicon/' + (slot.profileIconId || 29) + '.png' : 'https://ddragon.leagueoflegends.com/cdn/' + ddragonVersion + '/img/profileicon/29.png'"
          alt="icone"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-[11px] font-bold text-slate-200 sm:text-xs">{{ slot.gameName || 'Slot vazio' }}</p>
          <p class="text-[9px] text-slate-500 sm:text-[10px]">{{ slot.tagLine ? '#' + slot.tagLine : 'Adicione um jogador' }}</p>
        </div>
        <button
          v-if="slot.gameName || slot.showSearch"
          type="button"
          class="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-white"
          @click="$emit('clear', slot.id)"
        >X</button>
      </div>

      <div v-if="slot.gameName || slot.showSearch" class="mt-2 flex gap-1">
        <input
          v-model="slot.rawInput"
          class="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white placeholder:text-slate-500"
          placeholder="Nome#TAG"
        />
        <button
          type="button"
          class="rounded border border-cyan-700 bg-cyan-900/40 px-2 py-1 text-[10px] font-black text-cyan-300 hover:bg-cyan-900/60"
          @click="$emit('search', slot.id)"
        >Buscar</button>
        <button
          v-if="!slot.gameName"
          type="button"
          class="rounded border border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white"
          @click="slot.showSearch = false"
        >Fechar</button>
        <button
          v-if="!slot.gameName"
          type="button"
          class="rounded border border-amber-700 px-2 py-1 text-[10px] font-bold text-amber-300 hover:text-amber-200"
          @click="$emit('anonymous', slot.id)"
        >Anonimo</button>
      </div>

      <p v-if="slot.loading" class="mt-1 text-[10px] font-bold text-cyan-300 animate-pulse">Buscando invocador...</p>

      <details class="mt-2 rounded border border-slate-800 bg-slate-900/50 px-2 py-1">
        <summary class="cursor-pointer text-[10px] font-black uppercase tracking-wide text-slate-400">Ajustes manuais de elo</summary>
        <div class="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
          <select v-model="slot.manualTier" class="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[10px] text-slate-200">
            <option value="">Tier</option>
            <option v-for="tier in tierOptions" :key="tier" :value="tier">{{ tier }}</option>
          </select>
          <select v-model="slot.manualRank" class="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[10px] text-slate-200">
            <option value="">Div</option>
            <option v-for="rank in rankOptions" :key="rank" :value="rank">{{ rank }}</option>
          </select>
          <input v-model="slot.manualLp" class="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[10px] text-slate-200" placeholder="LP" />
          <input v-model="slot.manualWinRate" class="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[10px] text-slate-200" placeholder="WR%" />
        </div>
      </details>

      <p v-if="slot.error" class="mt-1 text-[10px] font-bold text-red-400">{{ slot.error }}</p>
    </div>
  </div>
</template>

<script setup>
import { DDRAGON_VERSION } from '../utils.js';

defineProps({
  slot: {
    type: Object,
    required: true
  }
});

defineEmits(['search', 'clear', 'anonymous', 'dragstart', 'drop']);

const ddragonVersion = DDRAGON_VERSION;
const tierOptions = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'];
const rankOptions = ['I', 'II', 'III', 'IV'];
</script>
