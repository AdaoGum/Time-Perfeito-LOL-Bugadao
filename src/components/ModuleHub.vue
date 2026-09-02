<!--
  ModuleHub — a tela inicial de um PILAR: os cards das telas que moram dentro dele.
  É onde o título clicável da sidebar, o cabeçalho do portal da Home e o 1º nível
  da topbar desembocam. Rotas: /jogadores (pilar="jogador") e /campeoes ("campeoes").

  Os pilares de UMA página só (Meta) não têm hub — o `hub` deles é a própria tela,
  porque um hub com um card só seria uma sala de espera.

  Nada aqui é declarado localmente: os cards, os textos e as cores vêm de
  `src/navegacao.js`, a mesma fonte da Home, da topbar e da sidebar.
-->
<template>
  <div class="min-h-[74vh]">
    <header class="mb-6 flex flex-col gap-1">
      <h1 class="flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
        <i class="fa-solid" :class="[pilar.icon, pilar.spiritCls]"></i>
        <span class="bg-gradient-to-r bg-clip-text text-transparent" :class="pilar.gradiente">{{ pilar.label }}</span>
      </h1>
      <p class="text-sm text-slate-400">{{ pilar.subtitulo }}</p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="card in pilar.paginas"
        :key="card.path"
        type="button"
        class="group relative flex min-h-[190px] flex-col overflow-hidden rounded-2xl border p-5 text-left shadow-xl transition duration-300 hover:scale-[1.02]"
        :class="card.cardCls"
        @click="router.push(card.path)"
      >
        <div class="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl transition-all duration-500 group-hover:opacity-90" :class="card.glowCls"></div>
        <div class="relative z-10 flex h-full flex-col">
          <span class="inline-flex h-12 w-12 items-center justify-center rounded-xl border bg-slate-950/60 text-xl" :class="[card.iconBorder, card.iconColor]">
            <i class="fa-solid" :class="card.icon"></i>
          </span>
          <h2 class="mt-3 text-xl font-black" :class="card.titleCls">{{ card.label }}</h2>
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
import { PILARES, pilarPorId } from '../navegacao.js';

const props = defineProps({
  pilar: { type: String, default: 'jogador' }
});

const router = useRouter();

// Pilar inexistente cai no primeiro em vez de quebrar a tela (degradação graciosa).
const pilar = computed(() => pilarPorId(props.pilar) || PILARES[0]);
</script>
