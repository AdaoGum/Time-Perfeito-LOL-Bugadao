<script setup>
import { ref } from 'vue'
import StoneCard from '../components/ui/StoneCard.vue'
import { useUgaStore } from '../store/ugaStore'

const store = useUgaStore()
const activeBg = ref(0)
const backgrounds = [
  'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_0.jpg',
  'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_2.jpg',
  'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_3.jpg',
  'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_6.jpg',
]
const cards = [
  { id: 'profile', title: 'Caçadas Passadas', subtitle: 'Perfil · Partidas · Elo', accent: 'cyan', lead: 'UGA!', bgIndex: 1 },
  { id: 'mastery', title: 'Caverna Monos', subtitle: 'Monos · Pontos · Ranking', accent: 'amber', lead: 'BUGA!', bgIndex: 2 },
  { id: 'synergy', title: 'Tribo Perfeita', subtitle: 'Planejador · Sinergia · Conforto', accent: 'lime', lead: 'UGA BUGA!', bgIndex: 3 },
]

function openTab(tab) {
  store.setCurrentTab(tab)
}
</script>

<template>
  <StoneCard class-name="relative overflow-hidden p-6 sm:p-8">
    <div v-for="(background, index) in backgrounds" :key="background" class="absolute inset-0 bg-cover bg-center transition-opacity duration-500" :style="{ backgroundImage: `url(${background})`, opacity: activeBg === index ? 0.46 : index === 0 ? 0.18 : 0 }" />
    <div class="absolute inset-0 bg-slate-950/80" />

    <div class="relative z-10 flex min-h-[74vh] flex-col items-center justify-center">
      <p class="lava-chip mb-4">Templo Ancestral</p>
      <h2 class="text-center font-cavern text-2xl text-orange-100 sm:text-4xl">Selecione Seu Caminho Ancestral</h2>
      <p class="mt-4 max-w-3xl text-center text-sm text-stone-300 sm:text-base">
        Agora a caverna virou SPA: cada ritual foi quebrado em microcomponentes, cada visão em uma view dedicada.
      </p>

      <div class="mt-10 grid w-full gap-6 lg:grid-cols-3">
        <button
          v-for="card in cards"
          :key="card.id"
          type="button"
          class="rounded-3xl border p-8 text-left shadow-2xl transition duration-300 hover:-translate-y-1"
          :class="{
            'border-cyan-500/40 bg-cyan-950/20 hover:shadow-ritual': card.accent === 'cyan',
            'border-amber-500/40 bg-orange-950/20 hover:shadow-lava': card.accent === 'amber',
            'border-lime-500/40 bg-lime-950/20 hover:shadow-[0_0_28px_rgba(132,204,22,0.25)]': card.accent === 'lime',
          }"
          @mouseenter="activeBg = card.bgIndex"
          @mouseleave="activeBg = 0"
          @click="openTab(card.id)"
        >
          <p class="font-ritual text-3xl" :class="card.accent === 'cyan' ? 'text-cyan-300' : card.accent === 'amber' ? 'text-amber-300' : 'text-lime-300'">{{ card.lead }}</p>
          <p class="mt-3 text-3xl font-black text-white">{{ card.title }}</p>
          <p class="mt-6 text-sm font-semibold text-stone-200">{{ card.subtitle }}</p>
        </button>
      </div>
    </div>
  </StoneCard>
</template>
