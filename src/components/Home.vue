<template>
  <div
    class="relative mx-auto w-full rounded-3xl min-h-[80vh] p-4 sm:p-8 border transition-colors duration-500"
    :class="activeBg !== 0 ? 'border-slate-800' : 'border-transparent'"
  >
    <!-- CAMADA DE FUNDO (recortada nas bordas arredondadas). O conteúdo fica FORA
         deste wrapper para que os cards de prévia possam "vazar" pra cima sem corte. -->
    <div class="absolute inset-0 overflow-hidden rounded-3xl">
      <!-- Fundo PADRÃO (sem hover): floresta + udyr lado a lado. -->
      <div
        class="absolute inset-0 flex transition-opacity duration-500"
        :style="{ opacity: activeBg === 0 ? '0.6' : '0' }"
      >
        <div class="h-full w-1/2 bg-cover bg-top bg-no-repeat" :style="{ backgroundImage: `url('${HOME_UDYR_FOREST}')` }"></div>
        <div class="h-full w-1/2 bg-cover bg-top bg-no-repeat" :style="{ backgroundImage: `url('${HOME_UDYR}')` }"></div>
      </div>

      <!-- Um fundo por espírito: aparece quando o mouse está no botão correspondente. -->
      <div
        v-for="p in paths"
        :key="`bg-${p.key}`"
        class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-500"
        :style="{ opacity: activeBg === p.n ? '1' : '0', backgroundImage: `url('${p.img}')`, transform: activeBg === p.n ? 'scale(1)' : 'scale(1.06)' }"
      ></div>

      <!-- Véu escuro: bem mais leve (e em gradiente) quando um espírito está em foco,
           pra a arte do bicho aparecer atrás sem matar a legibilidade do texto. -->
      <div
        class="absolute inset-0 transition-all duration-500"
        :class="activeBg !== 0 ? 'bg-gradient-to-b from-slate-950/50 via-slate-950/45 to-slate-950/70' : 'bg-slate-950/72'"
      ></div>
    </div>

    <!-- CONTEÚDO -->
    <div class="relative z-10 flex min-h-[74vh] flex-col items-center justify-center w-full">
      <h2 class="mb-10 text-center text-3xl font-black tracking-wide text-slate-100 drop-shadow-[0_2px_16px_rgba(6,182,212,0.5)] sm:text-5xl">
        <span class="bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-500 bg-clip-text text-transparent">Selecione Seu Caminho Ancestral</span>
      </h2>

      <!-- CAIXA DE BUSCA NO CENTRO DA HOME -->
      <div data-search-morph="home" class="mb-12 w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
        <SearchBar
          buttonText="Começar Jornada"
          autocomplete
          :routeToProfile="true"
          @search-start="$emit('search-start')"
          @show-overlay="c => $emit('show-overlay', c)"
          @hide-overlay="$emit('hide-overlay')"
          @show-udyr="$emit('show-udyr')"
        />
      </div>

      <!-- OS 4 ESPÍRITOS DO UDYR -->
      <div class="grid w-full max-w-6xl gap-4 px-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        <div
          v-for="p in paths"
          :key="p.key"
          class="group relative"
          @mouseenter="setBg(p.n)"
          @mouseleave="setBg(0)"
        >
          <!-- CARD DE PRÉVIA (flutua acima do botão ao passar o mouse) -->
          <div
            class="pointer-events-none absolute bottom-full left-1/2 z-40 mb-3 w-64 max-w-[80vw] -translate-x-1/2 translate-y-2 rounded-xl border border-slate-700 bg-slate-950/95 p-3 opacity-0 shadow-2xl backdrop-blur transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <p class="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" :class="p.tagCls">
              <i class="fa-solid" :class="p.icon"></i> Prévia · {{ p.title }}
            </p>

            <!-- Mockup do Histórico (Tigre): mini cards de partida -->
            <div v-if="p.key === 'historico'" class="space-y-1.5">
              <div
                v-for="win in [true, false]"
                :key="String(win)"
                class="flex items-center gap-2 rounded-md border p-1.5"
                :class="win ? 'border-blue-800/60 bg-blue-950/30' : 'border-red-800/60 bg-red-950/30'"
              >
                <div class="h-6 w-6 shrink-0 rounded bg-slate-700"></div>
                <div class="flex-1 space-y-1">
                  <div class="h-1.5 w-12 rounded bg-slate-600"></div>
                  <div class="h-1.5 w-16 rounded bg-slate-700"></div>
                </div>
                <span class="text-[9px] font-black" :class="win ? 'text-blue-400' : 'text-red-400'">{{ win ? 'V' : 'D' }}</span>
              </div>
            </div>

            <!-- Mockup da Análise (Fênix): mini radar + barras -->
            <div v-else-if="p.key === 'analise'" class="flex items-center gap-3">
              <svg viewBox="0 0 40 40" class="h-14 w-14 shrink-0">
                <polygon points="20,3 36,15 30,36 10,36 4,15" fill="none" stroke="#7c3aed" stroke-width="1" opacity="0.6" />
                <polygon points="20,11 30,17 26,31 14,30 10,18" fill="rgba(167,139,250,0.25)" stroke="#c4b5fd" stroke-width="1" />
              </svg>
              <div class="flex-1 space-y-1.5">
                <div class="h-1.5 rounded bg-violet-500/70" style="width:82%"></div>
                <div class="h-1.5 rounded bg-violet-500/50" style="width:58%"></div>
                <div class="h-1.5 rounded bg-violet-500/60" style="width:70%"></div>
                <div class="h-1.5 rounded bg-violet-500/40" style="width:45%"></div>
              </div>
            </div>

            <!-- Mockup das Maestrias (Urso): mini tiles de monos -->
            <div v-else-if="p.key === 'maestria'" class="flex justify-center gap-3 py-1">
              <div v-for="i in 3" :key="i" class="flex flex-col items-center">
                <div class="relative h-9 w-9 rounded-full border-2 border-amber-600/60 bg-slate-700">
                  <span class="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-amber-600 px-1 text-[7px] font-black text-white">M{{ 8 - i }}</span>
                </div>
              </div>
            </div>

            <!-- Mockup da Tribo (Tartaruga): 5 vagas de rota -->
            <div v-else class="flex justify-center gap-1.5 py-1">
              <div v-for="i in 5" :key="i" class="flex h-8 w-8 items-center justify-center rounded-lg border border-lime-700/50 bg-lime-950/40">
                <i class="fa-solid fa-user text-[10px] text-lime-400/80"></i>
              </div>
            </div>

            <p class="mt-2.5 text-[10px] font-medium leading-snug text-slate-400">{{ p.previewDesc }}</p>
            <span class="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-[6px] rotate-45 border-b border-r border-slate-700 bg-slate-950"></span>
          </div>

          <!-- BOTÃO -->
          <button
            type="button"
            @click="go(p)"
            class="relative min-h-[200px] w-full overflow-hidden rounded-2xl border p-5 text-left shadow-2xl transition duration-300 group-hover:scale-[1.03]"
            :class="p.cardCls"
          >
            <div class="absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl transition-all duration-500 group-hover:opacity-90" :class="p.glowCls"></div>
            <img
              :src="p.img"
              :alt="p.title"
              class="pointer-events-none absolute -bottom-5 -right-4 h-36 w-36 object-contain opacity-30 drop-shadow-2xl transition duration-500 group-hover:scale-110 group-hover:opacity-60"
            />
            <div class="relative z-10">
              <p class="text-[10px] font-black uppercase tracking-[0.18em]" :class="p.spiritCls">{{ p.spirit }}</p>
              <p class="mt-1 text-2xl font-black drop-shadow-[0_0_12px_rgba(0,0,0,0.6)]" :class="p.bigCls">{{ p.big }}</p>
              <p class="text-xl font-black drop-shadow-[0_0_12px_rgba(0,0,0,0.6)]" :class="p.titleCls">{{ p.title }}</p>
              <p class="mt-3 text-sm font-semibold text-slate-200">{{ p.desc }}</p>
              <p class="mt-1.5 text-[10px] uppercase tracking-widest" :class="p.tagCls">{{ p.tags }}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { state } from '../store.js';
import SearchBar from './SearchBar.vue';

const router = useRouter();
const store = state;
defineEmits(['show-overlay', 'hide-overlay', 'show-udyr', 'search-start']);

// Imagens locais mostradas por padrão (lado a lado), antes de hover nos botões.
const HOME_UDYR_FOREST = '/home_udyr_forest.png';
const HOME_UDYR = '/home_udyr.png';

// Fundo ativo: 0 = padrão; 1..4 = espírito sob o mouse (casa com `n` de cada path).
const activeBg = ref(0);
function setBg(n) {
  activeBg.value = n;
}

// Os 4 caminhos = os 4 espíritos do Udyr. `n` casa com a camada de fundo no hover.
const paths = [
  {
    n: 1, key: 'historico', route: '/historico', img: '/Udyr_notudyr_tiger.png', icon: 'fa-scroll',
    spirit: 'Espírito do Tigre', big: 'UGA!', title: 'Caçadas Passadas',
    desc: 'Reviva o histórico de partidas do jogador',
    tags: 'Partidas · KDA · Confrontos',
    previewDesc: 'Últimas partidas com KDA, itens, runas e confrontos por rota.',
    cardCls: 'border-cyan-500/40 bg-gradient-to-br from-blue-900/80 via-cyan-800/40 to-slate-950 hover:shadow-[0_0_40px_rgba(6,182,212,0.35)]',
    glowCls: 'bg-cyan-400/20', spiritCls: 'text-cyan-400/70', bigCls: 'text-cyan-400', titleCls: 'text-cyan-200', tagCls: 'text-cyan-300/80'
  },
  {
    n: 2, key: 'analise', route: '/analise', img: '/Udyr_notudyr_phoenix.png', icon: 'fa-chart-simple',
    spirit: 'Espírito da Fênix', big: 'BUGA?', title: 'Olhar da Espiritual',
    desc: 'Estatísticas e tendências do jogador',
    tags: 'Gráficos · Radar · Campeões',
    previewDesc: 'Radar de desempenho, rotas, campeões e evolução sobre todo o histórico.',
    cardCls: 'border-violet-500/40 bg-gradient-to-br from-fuchsia-950/80 via-violet-800/40 to-slate-950 hover:shadow-[0_0_40px_rgba(139,92,246,0.35)]',
    glowCls: 'bg-violet-400/25', spiritCls: 'text-violet-400/70', bigCls: 'text-violet-400', titleCls: 'text-violet-200', tagCls: 'text-violet-300/80'
  },
  {
    n: 3, key: 'maestria', route: '/mastery', img: '/Udyr_notudyr_bear.png', icon: 'fa-trophy',
    spirit: 'Espírito do Urso', big: 'BUGA!', title: 'Caverna dos Monos',
    desc: 'Veja as maestrias de campeões do jogador',
    tags: 'Monos · Pontos · Ranking',
    previewDesc: 'Ranking de maestrias: nível, pontos e os campeões mais dominados.',
    cardCls: 'border-amber-700/50 bg-gradient-to-br from-red-950/90 via-orange-900/40 to-slate-950 hover:shadow-[0_0_40px_rgba(251,146,60,0.3)]',
    glowCls: 'bg-orange-500/25', spiritCls: 'text-amber-400/70', bigCls: 'text-amber-500', titleCls: 'text-amber-200', tagCls: 'text-amber-300/80'
  },
  {
    n: 4, key: 'time', route: '/synergy', img: '/Udyr_notudyr_turtle.png', icon: 'fa-people-group',
    spirit: 'Espírito da Tartaruga', big: 'UGA! BUGA!', title: 'Tribo Perfeita',
    desc: 'Monte a composição com sinergia',
    tags: 'Planejador · Sinergia · Conforto',
    previewDesc: 'Planejador de time: encaixe de 1 a 5 jogadores e ache a melhor sinergia.',
    cardCls: 'border-lime-500/40 bg-gradient-to-br from-emerald-900/80 via-teal-900/40 to-slate-950 hover:shadow-[0_0_40px_rgba(132,204,22,0.3)]',
    glowCls: 'bg-lime-400/25', spiritCls: 'text-lime-400/70', bigCls: 'text-lime-500', titleCls: 'text-lime-200', tagCls: 'text-lime-300/80'
  }
];

// Histórico e Análise dependem de um jogador. Se já há um carregado, entra direto
// nele; senão abre a rota (gate de busca da seção). Maestrias/Tribo têm busca própria.
function go(p) {
  if (p.key === 'historico' || p.key === 'analise') {
    const base = p.key === 'historico' ? '/historico' : '/analise';
    const { puuid, gameName, tagLine } = store.searchProfile;
    if (puuid && gameName && tagLine) {
      router.push(`${base}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
      return;
    }
    router.push(base);
    return;
  }
  router.push(p.route);
}
</script>
