<template>
  <div class="relative mx-auto w-full overflow-hidden rounded-3xl border border-slate-800 min-h-[80vh] p-4 sm:p-8">

    <div
      class="absolute inset-0 bg-cover bg-center transition-[opacity] duration-500"
      :style="{ opacity: activeBg === 0 ? '0.42' : '0', backgroundImage: `url('${UDYR_BASE}Udyr_0.jpg')` }"
    ></div>
    <div
      class="absolute inset-0 bg-cover bg-center transition-[opacity] duration-500"
      :style="{ opacity: activeBg === 1 ? '0.48' : '0', backgroundImage: `url('${UDYR_BASE}Udyr_2.jpg')` }"
    ></div>
    <div
      class="absolute inset-0 bg-cover bg-center transition-[opacity] duration-500"
      :style="{ opacity: activeBg === 2 ? '0.48' : '0', backgroundImage: `url('${UDYR_BASE}Udyr_3.jpg')` }"
    ></div>
    <div
      class="absolute inset-0 bg-cover bg-center transition-[opacity] duration-500"
      :style="{ opacity: activeBg === 3 ? '0.48' : '0', backgroundImage: `url('${UDYR_BASE}Udyr_6.jpg')` }"
    ></div>
    <div class="absolute inset-0 bg-slate-950/72"></div>

    <div class="relative z-10 flex min-h-[74vh] flex-col items-center justify-center w-full">
      <h2 class="mb-10 text-center text-3xl font-black tracking-wide text-slate-100 drop-shadow-[0_2px_16px_rgba(6,182,212,0.5)] sm:text-5xl">
        <span class="bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-500 bg-clip-text text-transparent">Selecione Seu Caminho Ancestral</span>
      </h2>

      <div class="grid w-full max-w-[120rem] gap-6 lg:gap-10 md:grid-cols-3 px-4">

        <button
          type="button"
          @click="navigate('perfil')"
          @mouseenter="activeBg = 1"
          @mouseleave="activeBg = 0"
          class="group relative min-h-[320px] w-full overflow-hidden rounded-2xl text-center border border-cyan-500/40 bg-gradient-to-br from-blue-900/80 via-cyan-800/40 to-slate-950 p-8 sm:p-10 text-left shadow-2xl transition duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(6,182,212,0.35)]"
        >
          <div class="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl transition-all duration-500 group-hover:opacity-80"></div>
          <p class="text-4xl font-black text-cyan-500 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]">UGA!</p>
          <p class="text-3xl font-black text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]">Caçadas Passadas</p>
          <p class="mt-6 text-base font-semibold text-slate-200">Perfil/Informações do Jogador</p>
          <p class="mt-2 text-xs uppercase tracking-widest text-cyan-300/80">Estatísticas · Partidas · Elo</p>
        </button>

        <button
          type="button"
          @click="navigate('maestria')"
          @mouseenter="activeBg = 2"
          @mouseleave="activeBg = 0"
          class="group relative min-h-[320px] w-full overflow-hidden rounded-2xl text-center border border-amber-700/50 bg-gradient-to-br from-red-950/90 via-orange-900/40 to-slate-950 p-8 sm:p-10 text-left shadow-2xl transition duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(251,146,60,0.3)]"
        >
          <div class="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-orange-500/25 blur-3xl transition-all duration-500 group-hover:opacity-80"></div>
          <p class="text-4xl font-black text-amber-500 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]">Buga!</p>
          <p class="text-3xl font-black text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]">Caverna Monos</p>
          <p class="mt-6 text-base font-semibold text-slate-200">Verifique as Maestrias do Jogador</p>
          <p class="mt-2 text-xs uppercase tracking-widest text-amber-300/80">Monos · Pontos · Ranking</p>
        </button>

        <button
          type="button"
          @click="navigate('sinergia')"
          @mouseenter="activeBg = 3"
          @mouseleave="activeBg = 0"
          class="group relative min-h-[320px] w-full overflow-hidden rounded-2xl text-center border border-lime-500/40 bg-gradient-to-br from-emerald-900/80 via-cyan-900/40 to-slate-950 p-8 sm:p-10 text-left shadow-2xl transition duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(132,204,22,0.3)]"
        >
          <div class="absolute -bottom-10 -right-8 h-36 w-36 rounded-full bg-lime-400/25 blur-3xl transition-all duration-500 group-hover:opacity-80"></div>
          <p class="text-4xl font-black text-lime-500 drop-shadow-[0_0_12px_rgba(163,230,53,0.5)]">UGA! BUGA!</p>
          <p class="text-3xl font-black text-lime-300 drop-shadow-[0_0_12px_rgba(163,230,53,0.5)]">Tribo Perfeita</p>
          <p class="mt-6 text-base font-semibold text-slate-200">Monte sua composição com sinergia</p>
          <p class="mt-2 text-xs uppercase tracking-widest text-lime-300/80">Planejador · Sinergia · Conforto</p>
        </button>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { state } from '../store.js';

const UDYR_BASE = 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/';

const activeBg = ref(0);

function navigate(tab) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  state.currentTab = tab;
}
</script>
