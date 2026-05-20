<script setup>
defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  buttonLabel: {
    type: String,
    default: 'Buscar',
  },
  accentClass: {
    type: String,
    default: 'from-cyan-500 to-blue-500',
  },
})

const emit = defineEmits(['update:modelValue', 'submit'])
</script>

<template>
  <form class="grid gap-3 sm:grid-cols-[1fr_auto]" @submit.prevent="emit('submit')">
    <input
      :value="modelValue"
      class="stone-input"
      placeholder="Nome#TAG (ex: Faker#KR1)"
      required
      @input="emit('update:modelValue', $event.target.value)"
    />
    <button
      class="rounded-2xl bg-gradient-to-r px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-ritual transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
      :class="accentClass"
      :disabled="loading"
      type="submit"
    >
      {{ loading ? 'Consultando...' : buttonLabel }}
    </button>
  </form>
</template>
