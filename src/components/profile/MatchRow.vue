<script setup>
import { computed } from 'vue'
import ChampionAvatar from '../ui/ChampionAvatar.vue'
import { calculateKdaRatio, championImage, formatDuration, itemImage } from '../../utils/helpers'

const props = defineProps({
  match: {
    type: Object,
    required: true,
  },
})

const isWin = computed(() => Boolean(props.match.win))
const ratio = computed(() => calculateKdaRatio(props.match.kills, props.match.deaths, props.match.assists))
const ratioTone = computed(() => (Number(ratio.value) >= 4 ? 'text-amber-300' : 'text-stone-300'))
const rowTone = computed(() =>
  isWin.value
    ? 'border-cyan-700/60 bg-cyan-950/25 text-cyan-50'
    : 'border-red-700/60 bg-red-950/25 text-red-50',
)
const participants = computed(() => (Array.isArray(props.match.players) ? props.match.players : []))
const allyTeamId = computed(() => participants.value.find((player) => player?.championName === props.match.championName)?.teamId)
const alliedPlayers = computed(() => participants.value.filter((player) => player?.teamId === allyTeamId.value).slice(0, 5))
const enemyPlayers = computed(() => participants.value.filter((player) => player?.teamId !== allyTeamId.value).slice(0, 5))
const items = computed(() => [
  props.match.item0,
  props.match.item1,
  props.match.item2,
  props.match.item3,
  props.match.item4,
  props.match.item5,
  props.match.item6,
])
</script>

<template>
  <article class="grid gap-3 rounded-3xl border p-4 lg:grid-cols-[72px_1fr_160px_180px_280px] lg:items-center" :class="rowTone">
    <ChampionAvatar :champion-name="match.championName || 'Aatrox'" size-class="h-[72px] w-[72px]" />

    <div>
      <p class="text-lg font-black" :class="isWin ? 'text-cyan-300' : 'text-red-300'">{{ isWin ? 'VITÓRIA' : 'DERROTA' }}</p>
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-stone-300">{{ match.queueType || 'Outro modo' }}</p>
      <p class="mt-1 text-sm text-stone-300">{{ formatDuration(match.gameDuration) }}</p>
    </div>

    <div>
      <p class="text-base font-bold text-white">{{ match.kills }} / {{ match.deaths }} / {{ match.assists }}</p>
      <p class="text-sm font-semibold" :class="ratioTone">{{ ratio }} KDA</p>
    </div>

    <div class="grid grid-cols-4 gap-1">
      <template v-for="(itemId, index) in items" :key="`${match.championName}-${index}`">
        <img v-if="itemId" :src="itemImage(itemId)" alt="Item" class="h-8 w-8 rounded-lg border border-stone-700 bg-slate-900/70" loading="lazy" />
        <div v-else class="h-8 w-8 rounded-lg border border-stone-800 bg-slate-900/40" />
      </template>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div class="rounded-2xl border border-stone-700 bg-slate-950/70 p-2">
        <div class="space-y-1">
          <div v-for="player in alliedPlayers" :key="`${player.gameName}-${player.championName}`" class="grid grid-cols-[18px_1fr] items-center gap-2">
            <img :src="championImage(player.championName || 'Aatrox')" :alt="player.championName" class="h-[18px] w-[18px] rounded-sm border border-stone-700" loading="lazy" />
            <span class="truncate text-[11px] font-semibold text-cyan-100">{{ player.gameName || 'Aliado' }}</span>
          </div>
        </div>
      </div>
      <div class="rounded-2xl border border-stone-700 bg-slate-950/70 p-2">
        <div class="space-y-1">
          <div v-for="player in enemyPlayers" :key="`${player.gameName}-${player.championName}`" class="grid grid-cols-[18px_1fr] items-center gap-2">
            <img :src="championImage(player.championName || 'Aatrox')" :alt="player.championName" class="h-[18px] w-[18px] rounded-sm border border-stone-700" loading="lazy" />
            <span class="truncate text-[11px] font-semibold text-red-100">{{ player.gameName || 'Inimigo' }}</span>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
