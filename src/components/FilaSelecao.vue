<template>
  <div class="w-full max-w-3xl mx-auto bg-slate-950/90 border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl backdrop-blur-md sm:flex sm:items-center sm:gap-8">
    <!-- Coluna esquerda: emblema + título + descrição -->
    <div class="shrink-0 text-center sm:w-64 sm:border-r sm:border-slate-800/70 sm:pr-8">
      <div class="relative w-28 h-28 mx-auto mb-4 flex items-center justify-center">
        <div class="absolute inset-0 rounded-full border border-yellow-600/30 animate-pulse"></div>
        <div class="w-20 h-20 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-xl rotate-45 flex items-center justify-center border-2 border-yellow-500/60 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
          <div class="w-12 h-12 border-4 border-slate-950 rounded-full -rotate-45 flex items-center justify-center">
            <div class="w-8 h-1 bg-slate-950 rotate-45"></div>
          </div>
        </div>
      </div>

      <p class="text-xs font-bold tracking-widest text-slate-400 uppercase">{{ modeLabel }}</p>
      <h3 class="text-2xl font-black text-slate-100 uppercase tracking-wide mt-1">{{ title }}</h3>

      <div class="w-full h-[1px] bg-gradient-to-r from-transparent via-slate-700 to-transparent my-4"></div>

      <p class="text-xs text-slate-300 leading-relaxed">{{ description }}</p>
    </div>

    <!-- Coluna direita: opções de modo (ocupam o espaço restante) -->
    <div class="mt-6 grid flex-1 gap-2.5 sm:mt-0 sm:content-center">
      <button
        v-for="modo in modeOptions"
        :key="modo.id"
        type="button"
        @click="$emit('selecionar', modo.id)"
        class="group flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-left transition hover:border-yellow-600/60 hover:bg-slate-900/70 cursor-pointer"
      >
        <div class="mt-1 w-2.5 h-2.5 bg-slate-950 border border-yellow-500/70 rotate-45 flex-shrink-0 transition-colors group-hover:bg-yellow-500 group-hover:shadow-[0_0_8px_rgba(234,179,8,0.7)]"></div>
        <div class="min-w-0">
          <h4 class="text-xs font-black tracking-wider uppercase text-yellow-500/90 group-hover:text-yellow-400">
            {{ modo.titulo }}
          </h4>
          <p class="text-[10px] text-slate-400 font-medium mt-0.5">
            {{ modo.subtitulo }}
          </p>
        </div>
        <i class="fa-solid fa-chevron-right ml-auto self-center text-[10px] text-slate-600 transition group-hover:text-yellow-400"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modeLabel: { type: String, default: '5v5' },
  title: { type: String, default: "Summoner's Rift" },
  description: {
    type: String,
    default: 'Domine sua rota, entre em batalhas de cinco contra cinco e destrua o nexus inimigo no maior modo competitivo do League.'
  },
  modeOptions: {
    type: Array,
    default: () => [
      { id: 'normal', titulo: 'Jogo Dinamico', subtitulo: 'Novas regras para partidas mais rapidas' },
      { id: 'alternada', titulo: 'Escolha Alternada', subtitulo: 'Draft competitivo com bans de campeoes' },
      { id: 'solo_duo', titulo: 'Ranqueada Solo/Duo', subtitulo: 'A prova definitiva de habilidade individual' },
      { id: 'flex', titulo: 'Ranqueada Flex', subtitulo: 'Desabilitados os grupos de 4' }
    ]
  }
});

defineEmits(['selecionar']);
</script>
