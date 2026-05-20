<script setup>
import { computed } from 'vue'
import StoneCard from '../ui/StoneCard.vue'
import ErrorBanner from '../ui/ErrorBanner.vue'
import ChampionAvatar from '../ui/ChampionAvatar.vue'

const props = defineProps({
  slotData: {
    type: Object,
    required: true,
  },
  championOptions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'set-type',
  'update-query',
  'select-suggestion',
  'update-summoner',
  'fetch-profile',
  'select-champion',
  'clear',
  'clear-error',
])

const slotLabel = computed(() => `Slot ${props.slotData.id}`)
const comfortChoices = computed(() => props.slotData.masteryChoices.slice(0, 5))
</script>

<template>
  <StoneCard class-name="h-full p-4">
    <div class="flex h-full flex-col">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-stone-400">{{ slotLabel }}</p>
          <p class="font-ritual text-lg text-stone-100">{{ slotData.type === 'anonymous' ? 'Modo Anônimo' : 'Busca por Perfil' }}</p>
        </div>
        <div class="rounded-2xl border border-stone-700 bg-slate-950/80 p-1 text-xs">
          <button type="button" class="rounded-xl px-3 py-1.5 font-semibold" :class="slotData.type === 'profile' ? 'bg-cyan-600 text-white' : 'text-stone-400'" @click="emit('set-type', { slotId: slotData.id, type: 'profile' })">Perfil</button>
          <button type="button" class="rounded-xl px-3 py-1.5 font-semibold" :class="slotData.type === 'anonymous' ? 'bg-stone-700 text-white' : 'text-stone-400'" @click="emit('set-type', { slotId: slotData.id, type: 'anonymous' })">Anônimo</button>
        </div>
      </div>

      <ErrorBanner :message="slotData.error || ''" @close="emit('clear-error', slotData.id)" />

      <div class="flex-1 space-y-3">
        <template v-if="slotData.loading">
          <div class="h-12 animate-pulse rounded-2xl bg-slate-900/80" />
          <div class="h-32 animate-pulse rounded-2xl bg-slate-900/60" />
        </template>

        <template v-else-if="slotData.type === 'anonymous'">
          <div class="space-y-2">
            <input :value="slotData.query" class="stone-input" placeholder="Buscar campeão..." @input="emit('update-query', { slotId: slotData.id, value: $event.target.value })" />
            <div v-if="slotData.suggestions.length" class="rounded-2xl border border-stone-700 bg-slate-950/90">
              <button v-for="suggestion in slotData.suggestions" :key="suggestion" type="button" class="flex w-full items-center gap-3 border-b border-stone-800 px-3 py-2 text-left text-sm text-stone-200 last:border-b-0 hover:bg-cyan-950/30" @click="emit('select-suggestion', { slotId: slotData.id, championName: suggestion })">
                <ChampionAvatar :champion-name="suggestion" size-class="h-8 w-8" />
                {{ suggestion }}
              </button>
            </div>
          </div>

          <div v-if="slotData.championSelected" class="rounded-2xl border border-cyan-800/60 bg-cyan-950/20 p-4 text-center">
            <ChampionAvatar :champion-name="slotData.championSelected" size-class="mx-auto h-20 w-20" selected />
            <p class="mt-3 font-bold text-cyan-200">{{ slotData.championSelected }}</p>
          </div>
        </template>

        <template v-else>
          <template v-if="slotData.searchedData">
            <div class="rounded-2xl border border-stone-700 bg-slate-950/80 p-3">
              <p class="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Zona de conforto</p>
              <div class="grid grid-cols-5 gap-2">
                <button v-for="entry in slotData.masteryChoices" :key="entry.championName" type="button" class="rounded-2xl border p-1 transition hover:-translate-y-0.5" :class="slotData.championSelected === entry.championName ? 'border-lime-400 bg-lime-950/20' : 'border-stone-700 bg-slate-900/70'" @click="emit('select-champion', { slotId: slotData.id, championName: entry.championName })">
                  <ChampionAvatar :champion-name="entry.championName" size-class="mx-auto h-10 w-10" :selected="slotData.championSelected === entry.championName" />
                  <p class="mt-1 truncate text-[9px] font-semibold text-stone-200">{{ entry.championName }}</p>
                  <span class="text-[9px] font-bold text-amber-300">M{{ entry.championLevel }}</span>
                </button>
              </div>
            </div>
            <select class="stone-input text-xs uppercase tracking-[0.16em]" :value="slotData.championSelected" @change="emit('select-champion', { slotId: slotData.id, championName: $event.target.value })">
              <option value="">Qualquer campeão...</option>
              <option v-for="name in championOptions" :key="name" :value="name">{{ name }}</option>
            </select>
            <button type="button" class="rounded-2xl border border-stone-700 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-stone-300 transition hover:border-stone-500 hover:text-white" @click="emit('clear', slotData.id)">Trocar perfil</button>
          </template>
          <template v-else>
            <input class="stone-input" :value="slotData.gameName && slotData.tagLine ? `${slotData.gameName}#${slotData.tagLine}` : ''" placeholder="Ex: Kami#BR1" @input="emit('update-summoner', { slotId: slotData.id, value: $event.target.value })" />
            <button type="button" class="rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white" @click="emit('fetch-profile', slotData.id)">Puxar perfil</button>
          </template>
        </template>
      </div>

      <div class="mt-4 border-t border-stone-800 pt-4">
        <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">Pódio do slot</p>
        <div class="grid grid-cols-5 gap-2">
          <template v-if="comfortChoices.length">
            <div v-for="entry in comfortChoices" :key="`comfort-${entry.championName}`" class="rounded-2xl border border-stone-700 bg-slate-950/70 p-1 text-center">
              <ChampionAvatar :champion-name="entry.championName" size-class="mx-auto h-10 w-10" :selected="slotData.championSelected === entry.championName" />
              <p class="mt-1 truncate text-[9px] font-semibold text-stone-200">{{ entry.championName }}</p>
            </div>
          </template>
          <div v-else v-for="placeholder in 5" :key="placeholder" class="rounded-2xl border border-stone-800 bg-slate-950/40 p-2 text-center text-xs text-stone-500">?</div>
        </div>
      </div>
    </div>
  </StoneCard>
</template>
