<script setup>
defineProps({
  queueType: {
    type: String,
    required: true,
  },
  playerCount: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits(['update:queueType', 'update:playerCount'])
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <div>
      <p class="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">Tipo de Fila</p>
      <div class="inline-flex rounded-2xl border border-stone-700 bg-slate-950/80 p-1">
        <button type="button" class="rounded-xl px-4 py-2 text-sm font-semibold transition" :class="queueType === 'solo_duo' ? 'bg-cyan-600 text-white' : 'text-stone-400 hover:text-white'" @click="emit('update:queueType', 'solo_duo')">Solo/Duo</button>
        <button type="button" class="rounded-xl px-4 py-2 text-sm font-semibold transition" :class="queueType === 'flex' ? 'bg-cyan-600 text-white' : 'text-stone-400 hover:text-white'" @click="emit('update:queueType', 'flex')">Fila Flex</button>
      </div>
    </div>
    <div>
      <p class="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-stone-400">Quantidade de Jogadores</p>
      <div class="flex flex-wrap gap-2">
        <button v-for="count in [1, 2, 3, 4, 5]" :key="count" type="button" class="h-11 w-11 rounded-full border-2 text-sm font-bold transition" :class="playerCount === count ? 'border-lime-400 bg-lime-500/20 text-lime-200' : 'border-stone-700 bg-slate-950/70 text-stone-300 hover:border-stone-500'" @click="emit('update:playerCount', count)">
          {{ count }}
        </button>
      </div>
    </div>
  </div>
</template>
