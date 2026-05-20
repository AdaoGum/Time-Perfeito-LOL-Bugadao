<script setup>
import { storeToRefs } from 'pinia'
import { useUgaStore } from '../store/ugaStore'
import StoneCard from '../components/ui/StoneCard.vue'
import PlannerControls from '../components/synergy/PlannerControls.vue'
import PlayerSlot from '../components/synergy/PlayerSlot.vue'
import AnalysisResult from '../components/synergy/AnalysisResult.vue'

const store = useUgaStore()
const { teamPlanner, activeSlots, championOptions } = storeToRefs(store)
</script>

<template>
  <div class="space-y-6">
    <StoneCard class-name="p-5">
      <PlannerControls :queue-type="teamPlanner.queueType" :player-count="teamPlanner.playerCount" @update:queue-type="store.setQueueType" @update:player-count="store.setPlayerCount" />
    </StoneCard>

    <section class="grid gap-4 xl:grid-cols-2">
      <PlayerSlot
        v-for="slot in activeSlots"
        :key="slot.id"
        :slot-data="slot"
        :champion-options="championOptions"
        @set-type="store.setSlotType($event.slotId, $event.type)"
        @update-query="store.updateSlotQuery($event.slotId, $event.value)"
        @select-suggestion="store.selectSlotSuggestion($event.slotId, $event.championName)"
        @update-summoner="store.updateSlotRiotId($event.slotId, $event.value)"
        @fetch-profile="store.fetchSlotProfile"
        @select-champion="store.selectSlotChampion($event.slotId, $event.championName)"
        @clear="store.clearSlot"
        @clear-error="store.clearSlotError"
      />
    </section>

    <StoneCard class-name="p-6">
      <button type="button" class="mx-auto flex w-full max-w-xl items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-600 to-lime-500 px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-ritual transition hover:scale-[1.01]" @click="store.analyzeTeamComposition()">
        Simular sinergia de equipe
      </button>

      <div v-if="teamPlanner.analysisLoading" class="mt-6 text-center">
        <div class="mx-auto h-3 w-full max-w-xl animate-pulse rounded-full bg-slate-900" />
        <p class="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Processando a matriz tática...</p>
      </div>

      <AnalysisResult v-if="teamPlanner.analysisResult" :result="teamPlanner.analysisResult" />
    </StoneCard>
  </div>
</template>
