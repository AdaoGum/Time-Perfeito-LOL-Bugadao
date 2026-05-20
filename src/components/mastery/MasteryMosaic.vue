<script setup>
import ChampionAvatar from '../ui/ChampionAvatar.vue'

const props = defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
})

function tone(level) {
  if (level >= 8) return 'border-red-700/60 bg-red-950/30'
  if (level >= 6) return 'border-orange-700/60 bg-orange-950/30'
  if (level >= 4) return 'border-cyan-700/60 bg-cyan-950/30'
  return 'border-stone-700/60 bg-slate-950/50'
}
</script>

<template>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-10">
    <article v-for="(entry, index) in props.entries" :key="`${entry.championName}-${index}`" class="rounded-2xl border p-2 text-center transition hover:scale-105" :class="tone(entry.championLevel || 1)" :title="`${entry.championName} • M${entry.championLevel} • ${Number(entry.championPoints || 0).toLocaleString('pt-BR')} pts`">
      <ChampionAvatar :champion-name="entry.championName" size-class="mx-auto h-12 w-12" />
      <p class="mt-2 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-200">{{ entry.championName }}</p>
      <span class="text-[10px] font-bold text-amber-300">M{{ entry.championLevel }}</span>
    </article>
  </div>
</template>
