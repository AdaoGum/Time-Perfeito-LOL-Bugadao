<!--
  ModuleHub — Tela principal (hub) de um módulo. Reúne os cards das telas do módulo.
  Usado pelas categorias clicáveis da sidebar: /jogadores (module="players") e
  /campeoes (module="champions").
-->
<template>
  <div class="min-h-[74vh]">
    <header class="mb-6 flex flex-col gap-1">
      <h1 class="flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
        <i class="fa-solid" :class="[cfg.icon, cfg.accent]"></i>
        <span class="bg-gradient-to-r bg-clip-text text-transparent" :class="cfg.gradient">{{ cfg.title }}</span>
      </h1>
      <p class="text-sm text-slate-400">{{ cfg.subtitle }}</p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="card in cfg.cards"
        :key="card.to"
        type="button"
        class="group relative flex min-h-[190px] flex-col overflow-hidden rounded-2xl border p-5 text-left shadow-xl transition duration-300 hover:scale-[1.02]"
        :class="card.cardCls"
        @click="go(card.to)"
      >
        <div class="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl transition-all duration-500 group-hover:opacity-90" :class="card.glowCls"></div>
        <div class="relative z-10 flex h-full flex-col">
          <span class="inline-flex h-12 w-12 items-center justify-center rounded-xl border bg-slate-950/60 text-xl" :class="[card.iconBorder, card.iconColor]">
            <i class="fa-solid" :class="card.icon"></i>
          </span>
          <h2 class="mt-3 text-xl font-black" :class="card.titleCls">{{ card.title }}</h2>
          <p class="mt-1.5 flex-1 text-sm font-semibold leading-snug text-slate-300/90">{{ card.desc }}</p>
          <span class="mt-3 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider" :class="card.iconColor">
            Entrar <i class="fa-solid fa-arrow-right transition-transform group-hover:translate-x-1"></i>
          </span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
  module: { type: String, default: 'players' }
});

const router = useRouter();

const MODULES = {
  players: {
    title: 'Jogadores',
    subtitle: 'Tudo sobre o invocador: histórico, estatísticas e maestrias.',
    icon: 'fa-crown',
    accent: 'text-cyan-400',
    gradient: 'from-cyan-300 via-sky-300 to-blue-400',
    cards: [
      { to: '/historico', title: 'Caçadas Passadas', desc: 'Histórico de partidas: KDA, itens, runas e confrontos por rota.', icon: 'fa-paw',
        cardCls: 'border-cyan-500/40 bg-gradient-to-br from-blue-900/70 via-cyan-800/30 to-slate-950 hover:shadow-[0_0_40px_rgba(6,182,212,0.3)]',
        glowCls: 'bg-cyan-400/20', iconBorder: 'border-cyan-600/60', iconColor: 'text-cyan-300', titleCls: 'text-cyan-100' },
      { to: '/analise', title: 'Olhar Espiritual', desc: 'Estatísticas e radar de desempenho sobre todo o histórico.', icon: 'fa-chart-simple',
        cardCls: 'border-violet-500/40 bg-gradient-to-br from-fuchsia-950/70 via-violet-800/30 to-slate-950 hover:shadow-[0_0_40px_rgba(139,92,246,0.3)]',
        glowCls: 'bg-violet-400/20', iconBorder: 'border-violet-600/60', iconColor: 'text-violet-300', titleCls: 'text-violet-100' },
      { to: '/mastery', title: 'Caverna dos Monos', desc: 'Ranking de maestrias: nível, pontos e os campeões mais dominados.', icon: 'fa-trophy',
        cardCls: 'border-amber-700/50 bg-gradient-to-br from-red-950/80 via-orange-900/30 to-slate-950 hover:shadow-[0_0_40px_rgba(251,146,60,0.28)]',
        glowCls: 'bg-orange-500/25', iconBorder: 'border-amber-600/60', iconColor: 'text-amber-300', titleCls: 'text-amber-100' }
    ]
  },
  champions: {
    title: 'Campeões',
    subtitle: 'Meta do patch, fichas de campeões e o arsenal de relíquias.',
    icon: 'fa-dragon',
    accent: 'text-violet-400',
    gradient: 'from-fuchsia-300 via-violet-300 to-sky-400',
    cards: [
      { to: '/meta', title: 'Meta & Tier List', desc: 'A classificação S/A/B/C/D por rota no patch atual.', icon: 'fa-ranking-star',
        cardCls: 'border-amber-500/40 bg-gradient-to-br from-amber-950/70 via-orange-900/30 to-slate-950 hover:shadow-[0_0_40px_rgba(245,158,11,0.28)]',
        glowCls: 'bg-amber-400/20', iconBorder: 'border-amber-600/60', iconColor: 'text-amber-300', titleCls: 'text-amber-100' },
      { to: '/champions', title: 'Panteão dos Campeões', desc: 'Fichas com habilidades, perfil tático, builds e skins.', icon: 'fa-dragon',
        cardCls: 'border-sky-500/40 bg-gradient-to-br from-blue-900/70 via-sky-800/30 to-slate-950 hover:shadow-[0_0_40px_rgba(56,189,248,0.3)]',
        glowCls: 'bg-sky-400/20', iconBorder: 'border-sky-600/60', iconColor: 'text-sky-300', titleCls: 'text-sky-100' },
      { to: '/items', title: 'Relíquias Ancestrais', desc: 'Arsenal de itens: atributos, receitas e sinergias por campeão.', icon: 'fa-gem',
        cardCls: 'border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-950/70 via-purple-800/30 to-slate-950 hover:shadow-[0_0_40px_rgba(217,70,239,0.28)]',
        glowCls: 'bg-fuchsia-400/20', iconBorder: 'border-fuchsia-600/60', iconColor: 'text-fuchsia-300', titleCls: 'text-fuchsia-100' }
    ]
  }
};

const cfg = computed(() => MODULES[props.module] || MODULES.players);

function go(to) {
  router.push(to);
}
</script>
