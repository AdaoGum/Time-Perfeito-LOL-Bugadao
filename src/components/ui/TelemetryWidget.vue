<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUgaStore } from '../../store/ugaStore'

const store = useUgaStore()
const { telemetry } = storeToRefs(store)

const count = computed(() => telemetry.value.timestamps.length)
const available = computed(() => Math.max(0, telemetry.value.maxRequests - count.value))
const nextReset = computed(() => {
  if (!count.value) return 'Status: Liberado'
  const oldest = telemetry.value.timestamps[0]
  const remainingMs = telemetry.value.windowMs - (Date.now() - oldest)
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(seconds / 60)
  return `Próximo reset: ${minutes}:${String(seconds % 60).padStart(2, '0')}`
})
const tone = computed(() => {
  if (available.value > 25) return 'text-green-400'
  if (available.value > 10) return 'text-amber-400'
  return 'text-red-400 animate-pulse'
})
</script>

<template>
  <aside class="fixed right-4 top-20 z-40 hidden w-60 rounded-2xl border border-stone-700/80 bg-slate-950/90 p-4 shadow-2xl backdrop-blur md:block">
    <p class="mb-3 text-center text-xs font-bold uppercase tracking-[0.3em] text-stone-400">Monitor da Riot API</p>
    <div class="space-y-2 text-sm">
      <div class="flex items-center justify-between">
        <span class="text-stone-300">Uso (2 min)</span>
        <strong>{{ count }} / {{ telemetry.maxRequests }}</strong>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-stone-300">Disponível</span>
        <strong :class="tone">{{ available }}</strong>
      </div>
      <div class="rounded-xl border border-cyan-900/60 bg-cyan-950/30 px-3 py-2 text-center text-xs text-cyan-100">
        {{ nextReset }}
      </div>
    </div>
  </aside>
</template>
