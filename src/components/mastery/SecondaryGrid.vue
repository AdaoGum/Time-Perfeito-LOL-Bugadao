<script setup>
import ChampionAvatar from '../ui/ChampionAvatar.vue'

defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
  maxPoints: {
    type: Number,
    required: true,
  },
  startRank: {
    type: Number,
    default: 6,
  },
})
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <article v-for="(entry, index) in entries" :key="`${entry.championName}-${index}`" class="rounded-2xl border border-stone-700/70 bg-slate-950/60 p-3">
      <div class="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">
        <span>#{{ startRank + index }}</span>
        <span>M{{ entry.championLevel }}</span>
      </div>
      <div class="flex items-center gap-3">
        <ChampionAvatar :champion-name="entry.championName" size-class="h-16 w-16" />
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-stone-100">{{ entry.championName }}</p>
          <p class="text-[10px] text-stone-400">{{ Number(entry.championPoints || 0).toLocaleString('pt-BR') }} pts</p>
        </div>
      </div>
      <div class="mt-3 h-1 overflow-hidden rounded-full bg-slate-900">
        <div class="h-full bg-cyan-500" :style="{ width: `${Math.max(4, Math.round((entry.championPoints / Math.max(1, maxPoints)) * 100))}%` }" />
      </div>
    </article>
  </div>
</template>
