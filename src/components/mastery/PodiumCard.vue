<script setup>
import { computed } from 'vue'
import ChampionAvatar from '../ui/ChampionAvatar.vue'

const props = defineProps({
  entry: {
    type: Object,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  maxPoints: {
    type: Number,
    required: true,
  },
})

const styles = [
  { ring: 'border-yellow-400/80 shadow-[0_0_24px_rgba(250,204,21,0.35)]', rank: 'text-yellow-300', bar: 'from-yellow-300 to-orange-500', icon: '👑' },
  { ring: 'border-slate-300/80 shadow-[0_0_20px_rgba(226,232,240,0.25)]', rank: 'text-slate-100', bar: 'from-slate-200 to-slate-400', icon: '🥈' },
  { ring: 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.25)]', rank: 'text-orange-300', bar: 'from-orange-400 to-orange-600', icon: '🥉' },
  { ring: 'border-zinc-500/80 shadow-[0_0_16px_rgba(161,161,170,0.2)]', rank: 'text-zinc-300', bar: 'from-zinc-300 to-zinc-500', icon: '⛓️' },
  { ring: 'border-amber-900/80 shadow-[0_0_16px_rgba(120,53,15,0.2)]', rank: 'text-amber-700', bar: 'from-amber-700 to-amber-900', icon: '🪵' },
]

const style = computed(() => styles[props.index] || styles[4])
const percentage = computed(() => Math.max(4, Math.round((props.entry.championPoints / Math.max(1, props.maxPoints)) * 100)))
</script>

<template>
  <article class="relative rounded-3xl border bg-slate-950/70 p-4 transition hover:-translate-y-1" :class="style.ring">
    <span class="absolute -right-2 -top-2 text-2xl">{{ style.icon }}</span>
    <p class="text-center text-4xl font-black" :class="style.rank">#{{ index + 1 }}</p>
    <ChampionAvatar :champion-name="entry.championName" size-class="mx-auto mt-3 h-20 w-20" />
    <p class="mt-3 truncate text-center text-sm font-bold text-white">{{ entry.championName }}</p>
    <p class="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-300">
      M{{ entry.championLevel }} • {{ Number(entry.championPoints || 0).toLocaleString('pt-BR') }}
    </p>
    <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-900">
      <div class="h-full bg-gradient-to-r" :class="style.bar" :style="{ width: `${percentage}%` }" />
    </div>
  </article>
</template>
