<template>
  <!-- Card de KPI padronizado: mesma altura/estrutura para todos, com a linha de
       subtítulo SEMPRE reservada (mesmo vazia) para nenhum card ficar mais curto. -->
  <div class="flex min-h-[92px] flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
    <div class="text-2xl font-black leading-none" :class="valueClass">{{ value }}</div>
    <div class="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{{ label }}</div>
    <div class="mt-0.5 h-[13px] text-[10px] leading-none text-slate-500">{{ sub || ' ' }}</div>
  </div>
</template>

<script setup>
defineProps({
  value: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  sub: { type: String, default: '' },
  valueClass: { type: String, default: 'text-slate-200' }
});
</script>
