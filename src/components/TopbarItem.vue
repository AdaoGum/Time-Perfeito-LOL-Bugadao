<!--
  TopbarItem — um botão da topbar com a prévia de hover (mini mockup + descrição).

  Existe como componente porque a topbar tem DUAS linhas: a de cima com os pilares
  (1º nível) e a de baixo com as páginas do pilar em que você está (2º nível). O
  botão e a prévia são idênticos nas duas — deixá-los inline no App.vue seria o
  mesmo bloco de ~70 linhas escrito duas vezes.

  O `item` vem pronto de `src/navegacao.js` (via App.vue): rótulo, cor, e qual
  mockup desenhar (`preview`). Item de pilar usa o mockup 'pilares', que mostra os
  ícones das páginas que moram dentro dele.
-->
<template>
  <div class="group relative">
    <button
      type="button"
      @click="$emit('ir', item.path)"
      class="cursor-pointer border-b-4 px-3 py-1.5 font-cave text-xs transition-all sm:text-sm"
      :class="ativo ? [item.border, 'scale-105', 'font-bold'] : 'border-transparent opacity-60 hover:opacity-100'"
    >
      <span v-if="item.gradient" class="bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-500 bg-clip-text text-transparent">{{ item.label }}</span>
      <span v-else :class="item.text">{{ item.label }}</span>
    </button>

    <!-- Prévia (hover, desktop): mini mockup + descrição -->
    <div
      class="pointer-events-none absolute right-0 top-full z-[75] mt-2 hidden w-60 max-w-[80vw] translate-y-1 rounded-xl border border-slate-700 bg-slate-950/97 p-3 opacity-0 shadow-2xl backdrop-blur transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 md:group-hover:block"
    >
      <p class="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" :class="item.accent">
        <i class="fa-solid" :class="item.icon"></i> {{ item.label }}
      </p>

      <!-- PILAR: os ícones das páginas que moram dentro dele -->
      <div v-if="item.preview === 'pilares'" class="flex gap-1.5">
        <div v-for="(c, i) in item.icones" :key="i" class="flex h-9 flex-1 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-400">
          <i class="fa-solid text-xs" :class="c"></i>
        </div>
      </div>

      <!-- CAÇADA: mini cards de partida -->
      <div v-else-if="item.preview === 'historico'" class="space-y-1.5">
        <div v-for="win in [true, false]" :key="String(win)" class="flex items-center gap-2 rounded-md border p-1.5" :class="win ? 'border-blue-800/60 bg-blue-950/30' : 'border-red-800/60 bg-red-950/30'">
          <div class="h-5 w-5 shrink-0 rounded bg-slate-700"></div>
          <div class="flex-1 space-y-1"><div class="h-1.5 w-10 rounded bg-slate-600"></div><div class="h-1.5 w-14 rounded bg-slate-700"></div></div>
          <span class="text-[9px] font-black" :class="win ? 'text-blue-400' : 'text-red-400'">{{ win ? 'V' : 'D' }}</span>
        </div>
      </div>

      <!-- VISÃO: radar + barras -->
      <div v-else-if="item.preview === 'analise'" class="flex items-center gap-3">
        <svg viewBox="0 0 40 40" class="h-12 w-12 shrink-0">
          <polygon points="20,3 36,15 30,36 10,36 4,15" fill="none" stroke="#7c3aed" stroke-width="1" opacity="0.6" />
          <polygon points="20,11 30,17 26,31 14,30 10,18" fill="rgba(167,139,250,0.25)" stroke="#c4b5fd" stroke-width="1" />
        </svg>
        <div class="flex-1 space-y-1.5">
          <div class="h-1.5 rounded bg-violet-500/70" style="width:82%"></div>
          <div class="h-1.5 rounded bg-violet-500/50" style="width:58%"></div>
          <div class="h-1.5 rounded bg-violet-500/60" style="width:70%"></div>
        </div>
      </div>

      <!-- CAVERNA: pódio de maestria (ouro, prata, bronze) -->
      <div v-else-if="item.preview === 'mastery'" class="flex items-end justify-center gap-1.5 py-1">
        <div
          v-for="m in PODIO"
          :key="m.i + m.h"
          class="flex w-8 flex-col items-center justify-end rounded border pb-1" :class="[m.h, m.c]"
        >
          <i class="fa-solid text-[10px]" :class="m.i"></i>
        </div>
      </div>

      <!-- RELÍQUIAS: grade de itens -->
      <div v-else-if="item.preview === 'items'" class="grid grid-cols-6 gap-1">
        <div v-for="i in 12" :key="i" class="flex aspect-square items-center justify-center rounded border border-fuchsia-800/50 bg-fuchsia-950/30">
          <i class="fa-solid fa-gem text-[8px] text-fuchsia-400/70"></i>
        </div>
      </div>

      <!-- META: tier list S/A/B -->
      <div v-else-if="item.preview === 'meta'" class="space-y-1.5">
        <div v-for="row in TIERS" :key="row.t" class="flex items-center gap-2">
          <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[9px] font-black" :class="row.c">{{ row.t }}</span>
          <div class="flex gap-1"><div v-for="i in row.n" :key="i" class="h-4 w-4 rounded-full border border-slate-600 bg-slate-700"></div></div>
        </div>
      </div>

      <!-- PANTEÃO: grade de campeões -->
      <div v-else-if="item.preview === 'pantheon'" class="grid grid-cols-6 gap-1">
        <div v-for="i in 12" :key="i" class="aspect-square rounded border border-slate-700 bg-slate-800"></div>
      </div>

      <!-- RELATÓRIOS: cards de jogador com o KPI de vitória -->
      <div v-else-if="item.preview === 'relatorios'" class="space-y-1.5">
        <div v-for="i in 2" :key="i" class="flex items-center gap-2 rounded-md border border-emerald-800/60 bg-emerald-950/30 p-1.5">
          <div class="h-5 w-5 shrink-0 rounded bg-slate-700"></div>
          <div class="flex-1 space-y-1"><div class="h-1.5 w-12 rounded bg-slate-600"></div><div class="h-1.5 w-16 rounded bg-slate-700"></div></div>
          <span class="text-[9px] font-black text-emerald-400">{{ i === 1 ? '57%' : '48%' }}</span>
        </div>
      </div>

      <!-- TRIBO / CUSTOMIZADA: 5 vagas -->
      <div v-else class="flex justify-center gap-1.5 py-1">
        <div v-for="i in 5" :key="i" class="flex h-8 w-8 items-center justify-center rounded-lg border border-lime-700/50 bg-lime-950/40">
          <i class="fa-solid fa-user text-[10px] text-lime-400/80"></i>
        </div>
      </div>

      <p class="mt-2.5 text-[10px] font-medium leading-snug text-slate-400">{{ item.desc }}</p>
      <span class="absolute right-4 top-0 h-2.5 w-2.5 -translate-y-[6px] rotate-45 border-l border-t border-slate-700 bg-slate-950"></span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  // Nó já achatado pelo App.vue a partir de src/navegacao.js.
  item: { type: Object, required: true },
  ativo: { type: Boolean, default: false }
});
defineEmits(['ir']);

const PODIO = [
  { h: 'h-8', c: 'border-slate-400/70 bg-slate-400/10 text-slate-200', i: 'fa-medal' },
  { h: 'h-11', c: 'border-yellow-400/70 bg-yellow-400/10 text-yellow-300', i: 'fa-crown' },
  { h: 'h-7', c: 'border-orange-500/70 bg-orange-500/10 text-orange-300', i: 'fa-medal' }
];
const TIERS = [
  { t: 'S', c: 'text-rose-300 border-rose-500/60 bg-rose-500/10', n: 4 },
  { t: 'A', c: 'text-amber-300 border-amber-500/60 bg-amber-500/10', n: 3 },
  { t: 'B', c: 'text-sky-300 border-sky-500/60 bg-sky-500/10', n: 5 }
];
</script>
