<script setup>
defineProps({
  result: {
    type: Object,
    required: true,
  },
})

const bars = [
  { label: 'Dano (AD/AP)', key: 'damageBalance', color: 'bg-cyan-500' },
  { label: 'Controle de Grupo', key: 'ccScore', color: 'bg-blue-500' },
  { label: 'Linha de Frente', key: 'frontline', color: 'bg-amber-500' },
  { label: 'Ritmo', key: 'tempo', color: 'bg-purple-500' },
]
</script>

<template>
  <div class="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
    <div class="flex flex-col items-center justify-center rounded-3xl border border-cyan-700/60 bg-cyan-950/20 p-6 text-center">
      <div class="flex h-28 w-28 items-center justify-center rounded-full border-4 border-cyan-400 bg-slate-950 text-5xl font-black text-cyan-200">
        {{ result.grade }}
      </div>
      <p class="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-stone-400">Nota Final</p>
    </div>
    <div class="rounded-3xl border border-stone-700 bg-slate-950/70 p-6">
      <div class="space-y-4">
        <div v-for="bar in bars" :key="bar.key">
          <div class="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-stone-300">
            <span>{{ bar.label }}</span>
            <span>{{ result.metrics[bar.key] }}%</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-slate-900">
            <div class="h-full rounded-full" :class="bar.color" :style="{ width: `${result.metrics[bar.key]}%` }" />
          </div>
        </div>
      </div>
      <blockquote class="mt-6 rounded-2xl border-l-4 border-cyan-500 bg-cyan-950/20 p-4 text-sm italic text-cyan-50">
        <span class="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-cyan-300 not-italic">Xamã virtual</span>
        “{{ result.coach }}”
      </blockquote>
    </div>
  </div>
</template>
