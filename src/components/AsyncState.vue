<!--
  AsyncState — invólucro padrão de feedback para qualquer busca ao back.
  Mostra: spinner (loading) → caixa de erro com "Tentar de novo" (error) → conteúdo (slot).

  Uso:
    <AsyncState :loading="loading" :error="error" loading-text="Carregando..." accent="cyan" @retry="fetchAgain">
      <MinhaLista :items="items" />
    </AsyncState>

  O estado "vazio" (0 itens) é responsabilidade do conteúdo — este componente só
  cuida de esperar/erro. Cores via `accent` (mapa com classes literais p/ o Tailwind ver).
-->
<template>
  <div v-if="loading" class="flex items-center justify-center gap-3 py-12">
    <div class="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" :class="accentClasses.border"></div>
    <p class="animate-pulse font-black text-sm" :class="accentClasses.text">{{ loadingText }}</p>
  </div>

  <div v-else-if="error" class="rounded-2xl border border-red-900/50 bg-red-950/20 p-6 text-center">
    <p class="font-black text-red-300 text-sm"><i class="fa-solid fa-triangle-exclamation mr-1"></i> {{ errorTitle }}</p>
    <p class="text-xs text-red-400/80 mt-1 break-words">{{ error }}</p>
    <button
      v-if="retryable"
      type="button"
      @click="$emit('retry')"
      class="mt-3 rounded-lg bg-red-800/60 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-red-100 hover:bg-red-700/60 transition cursor-pointer"
    >
      Tentar de novo
    </button>
  </div>

  <slot v-else />
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: [String, Object, null], default: null },
  loadingText: { type: String, default: 'Carregando...' },
  errorTitle: { type: String, default: 'Algo deu errado' },
  accent: { type: String, default: 'cyan' },
  retryable: { type: Boolean, default: true }
});

defineEmits(['retry']);

// Classes literais para o Tailwind conseguir "ver" e não podar.
const ACCENTS = {
  cyan: { border: 'border-cyan-400', text: 'text-cyan-300' },
  amber: { border: 'border-amber-400', text: 'text-amber-300' },
  emerald: { border: 'border-emerald-400', text: 'text-emerald-300' },
  fuchsia: { border: 'border-fuchsia-400', text: 'text-fuchsia-300' }
};

const accentClasses = computed(() => ACCENTS[props.accent] || ACCENTS.cyan);
</script>
