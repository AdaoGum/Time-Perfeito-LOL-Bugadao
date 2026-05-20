<script setup>
import { computed } from 'vue'
import StoneCard from '../ui/StoneCard.vue'
import { profileIconImage } from '../../utils/helpers'

const props = defineProps({
  profile: {
    type: Object,
    required: true,
  },
  averageKda: {
    type: String,
    required: true,
  },
})

const rankLabel = computed(() => {
  const tier = props.profile.stats?.tier
  if (!tier || tier === 'UNRANKED') return 'UNRANKED'
  return `${tier} ${props.profile.stats?.rank || ''}`.trim()
})

const winRate = computed(() => Number(props.profile.stats?.winRate || 0))
const winTone = computed(() => (winRate.value >= 50 ? 'bg-cyan-500' : 'bg-red-500'))
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
    <StoneCard class-name="p-5">
      <div class="flex flex-wrap items-center gap-4 rounded-2xl border border-stone-700/60 bg-slate-950/70 p-4">
        <img :src="profileIconImage(profile.profileIconId || 29)" alt="Ícone" class="h-24 w-24 rounded-2xl border-2 border-stone-600" />
        <div>
          <h2 class="text-3xl font-black text-white">
            {{ profile.gameName }}
            <span class="ml-2 text-lg font-medium text-stone-400">#{{ profile.tagLine }}</span>
          </h2>
          <span class="mt-3 inline-flex rounded-full border border-cyan-700/70 bg-cyan-950/40 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
            Nível {{ profile.summonerLevel || 0 }}
          </span>
        </div>
      </div>
    </StoneCard>

    <StoneCard class-name="p-5">
      <div class="space-y-3 text-center">
        <div class="rounded-2xl border border-orange-500/30 bg-orange-950/20 p-4">
          <p class="text-xs uppercase tracking-[0.25em] text-orange-200">Elo Atual</p>
          <p class="mt-2 text-2xl font-black text-orange-50">{{ rankLabel }}</p>
          <p class="text-sm font-bold text-orange-300">{{ Number(profile.stats?.lp || 0) }} LP</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-2xl border border-stone-700 bg-slate-950/70 p-3">
            <p class="text-xs uppercase tracking-[0.2em] text-stone-400">Vitórias</p>
            <p class="mt-2 text-2xl font-black text-cyan-300">{{ profile.stats?.wins }}</p>
          </div>
          <div class="rounded-2xl border border-stone-700 bg-slate-950/70 p-3">
            <p class="text-xs uppercase tracking-[0.2em] text-stone-400">KDA Geral</p>
            <p class="mt-2 text-2xl font-black text-lime-300">{{ averageKda }}</p>
          </div>
        </div>
        <div>
          <p class="mb-2 text-sm text-stone-300">Win Rate <strong class="text-white">{{ winRate.toFixed(1) }}%</strong></p>
          <div class="h-3 overflow-hidden rounded-full bg-slate-900">
            <div class="h-full transition-all duration-700" :class="winTone" :style="{ width: `${Math.min(100, Math.max(0, winRate))}%` }" />
          </div>
        </div>
      </div>
    </StoneCard>
  </div>
</template>
