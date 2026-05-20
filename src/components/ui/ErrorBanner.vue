<script setup>
import { computed } from 'vue'

const props = defineProps({
  message: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close'])

const classes = computed(() => {
  const isWarning = props.message.includes('muitas consultas') || props.message.includes('Chave')
  return isWarning
    ? 'border-amber-700/70 bg-amber-950/40 text-amber-200'
    : 'border-red-700/70 bg-red-950/40 text-red-200'
})
</script>

<template>
  <div v-if="message" class="mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm" :class="classes">
    <p>{{ message }}</p>
    <button class="rounded-lg border border-current px-2 py-1 text-xs font-semibold transition hover:opacity-80" type="button" @click="emit('close')">
      Fechar
    </button>
  </div>
</template>
