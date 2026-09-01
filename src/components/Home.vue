<template>
  <div
    class="relative mx-auto w-full rounded-3xl min-h-[80vh] p-4 sm:p-8 border transition-colors duration-500"
    :class="activeBg !== 0 ? 'border-slate-800' : 'border-transparent'"
  >
    <!-- CAMADA DE FUNDO (recortada nas bordas arredondadas). O conteúdo fica FORA
         deste wrapper para que os portais possam "vazar" pra cima sem corte. -->
    <div class="absolute inset-0 overflow-hidden rounded-3xl">
      <!-- Fundo PADRÃO (sem hover): a roda de fogo do Udyr nas duas versões (floresta + udyr). -->
      <div
        class="absolute inset-0 flex transition-opacity duration-500"
        :style="{ opacity: activeBg === 0 ? '0.6' : '0' }"
      >
        <div class="h-full w-1/2 bg-cover bg-top bg-no-repeat" :style="{ backgroundImage: `url('${HOME_UDYR_FOREST}')` }"></div>
        <div class="h-full w-1/2 bg-cover bg-top bg-no-repeat" :style="{ backgroundImage: `url('${HOME_UDYR}')` }"></div>
      </div>

      <!-- Um fundo por espírito: aparece quando o mouse está no portal correspondente. -->
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
        :class="activeBg !== 0 ? 'bg-gradient-to-b from-slate-950/55 via-slate-950/50 to-slate-950/75' : 'bg-slate-950/72'"
      ></div>
    </div>

    <!-- CONTEÚDO -->
    <div class="relative z-10 flex min-h-[74vh] flex-col items-center justify-center w-full">
      <!-- Marca + subtítulo -->
      <div class="mb-6 text-center">
        <p class="mb-1 text-[11px] font-black uppercase tracking-[0.35em] text-slate-400/80">bUGAdão Analytics</p>
        <h2 class="text-3xl font-black tracking-wide text-slate-100 drop-shadow-[0_2px_16px_rgba(6,182,212,0.5)] sm:text-5xl">
          <span class="bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-500 bg-clip-text text-transparent">Escolha Seu Caminho Ancestral</span>
        </h2>
        <p class="mx-auto mt-2 max-w-lg text-sm text-slate-300/90">
          Invocador, campeão ou tribo — passe o espírito do Udyr sobre cada portal e siga a trilha.
        </p>
      </div>

      <!-- CAIXA DE BUSCA (híbrida: jogador ou campeão) -->
      <div data-search-morph="home" class="mb-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/85 p-5 shadow-2xl backdrop-blur">
        <SearchBar
          buttonText="Começar Jornada"
          autocomplete
          context="global"
          :routeToProfile="true"
          @search-start="$emit('search-start')"
          @show-overlay="c => $emit('show-overlay', c)"
          @hide-overlay="$emit('hide-overlay')"
          @show-udyr="$emit('show-udyr')"
        />
        <p class="mt-2 text-center text-[11px] text-slate-500">
          Digite <span class="font-bold text-slate-400">Nome#TAG</span> para um jogador ou o nome de um <span class="font-bold text-slate-400">campeão</span>.
        </p>
      </div>

      <!-- OS 4 PORTAIS = OS 4 ESPÍRITOS DO UDYR -->
      <div class="grid w-full max-w-6xl gap-4 px-2 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="p in paths"
          :key="p.key"
          class="group relative overflow-hidden rounded-2xl border shadow-2xl transition duration-300 hover:scale-[1.02]"
          :class="p.cardCls"
          @mouseenter="setBg(p.n)"
          @mouseleave="setBg(0)"
        >
          <!-- Glow + arte do espírito (decorativa) -->
          <div class="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl transition-all duration-500 group-hover:opacity-90" :class="p.glowCls"></div>
          <img
            :src="p.img"
            :alt="p.title"
            class="pointer-events-none absolute -bottom-6 -right-5 h-40 w-40 select-none object-contain opacity-25 drop-shadow-2xl transition duration-500 group-hover:scale-110 group-hover:opacity-55"
          />

          <div class="relative z-10 flex h-full flex-col p-5">
            <!-- Cabeçalho clicável: leva ao hub da categoria -->
            <button type="button" class="text-left" @click="goPrimary(p)">
              <p class="text-[10px] font-black uppercase tracking-[0.18em]" :class="p.spiritCls">{{ p.spirit }}</p>
              <p class="mt-1 flex items-center gap-2 text-2xl font-black drop-shadow-[0_0_12px_rgba(0,0,0,0.6)]" :class="p.titleCls">
                <i class="fa-solid text-lg" :class="[p.icon, p.spiritCls]"></i>{{ p.title }}
              </p>
              <p class="mt-2 text-sm font-semibold leading-snug text-slate-200/90">{{ p.desc }}</p>
            </button>

            <!-- Sub-links diretos para as páginas da categoria -->
            <div class="mt-4 flex flex-1 flex-col justify-end gap-1.5">
              <button
                v-for="link in p.links"
                :key="link.to"
                type="button"
                class="flex items-center gap-2 rounded-lg border bg-slate-950/50 px-2.5 py-1.5 text-left text-xs font-bold text-slate-200 backdrop-blur-sm transition hover:text-white"
                :class="p.chipCls"
                @click.stop="goTo(link.to)"
              >
                <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center" :class="p.spiritCls">
                  <i class="fa-solid text-[11px]" :class="link.icon"></i>
                </span>
                <span class="truncate">{{ link.label }}</span>
                <i class="fa-solid fa-chevron-right ml-auto text-[9px] opacity-50"></i>
              </button>
            </div>
          </div>
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

// Fundo PADRÃO: a roda de fogo do Udyr nas duas versões (mantido).
const HOME_UDYR_FOREST = '/home_udyr_forest.webp';
const HOME_UDYR = '/home_udyr.webp';

// Fundo ativo: 0 = padrão (roda de fogo); 1..4 = espírito sob o mouse (casa com `n`).
const activeBg = ref(0);
function setBg(n) {
  activeBg.value = n;
}

// Os 4 portais = os 4 espíritos do Udyr, agora mapeados aos PILARES da nova arquitetura.
// Cada portal tem um hub (clique no cabeçalho) e sub-links diretos às páginas.
const paths = [
  {
    n: 1, key: 'jogador', img: '/Udyr_notudyr_tiger.webp', icon: 'fa-user-astronaut', primary: '/profile',
    spirit: 'Espírito do Tigre', title: 'Jogador',
    desc: 'Perfil, histórico de caçadas e o olhar espiritual sobre o invocador.',
    links: [
      { label: 'Caçada (Histórico)', to: '/historico', icon: 'fa-scroll' },
      { label: 'Olhar Espiritual (Estatísticas)', to: '/analise', icon: 'fa-chart-simple' }
    ],
    cardCls: 'border-cyan-500/40 bg-gradient-to-br from-blue-900/80 via-cyan-800/40 to-slate-950 hover:shadow-[0_0_40px_rgba(6,182,212,0.35)]',
    glowCls: 'bg-cyan-400/20', spiritCls: 'text-cyan-400', titleCls: 'text-cyan-100', chipCls: 'border-cyan-800/50 hover:border-cyan-500'
  },
  {
    n: 2, key: 'maestria', img: '/Udyr_notudyr_bear.webp', icon: 'fa-trophy', primary: '/mastery',
    spirit: 'Espírito do Urso', title: 'Maestrias',
    desc: 'A caverna dos monos: os campeões mais dominados e seus pontos.',
    links: [
      { label: 'Caverna dos Monos (Maestrias)', to: '/mastery', icon: 'fa-trophy' }
    ],
    cardCls: 'border-amber-700/50 bg-gradient-to-br from-red-950/90 via-orange-900/40 to-slate-950 hover:shadow-[0_0_40px_rgba(251,146,60,0.3)]',
    glowCls: 'bg-orange-500/25', spiritCls: 'text-amber-400', titleCls: 'text-amber-100', chipCls: 'border-amber-800/50 hover:border-amber-500'
  },
  {
    n: 3, key: 'campeoes', img: '/Udyr_notudyr_phoenix.webp', icon: 'fa-dragon', primary: '/meta',
    spirit: 'Espírito da Fênix', title: 'Campeões',
    desc: 'Tier list do patch, fichas do panteão e o arsenal de relíquias.',
    links: [
      { label: 'Meta & Tier List', to: '/meta', icon: 'fa-ranking-star' },
      { label: 'Panteão dos Campeões', to: '/champions', icon: 'fa-dragon' },
      { label: 'Relíquias Ancestrais', to: '/items', icon: 'fa-gem' }
    ],
    cardCls: 'border-violet-500/40 bg-gradient-to-br from-fuchsia-950/80 via-violet-800/40 to-slate-950 hover:shadow-[0_0_40px_rgba(139,92,246,0.35)]',
    glowCls: 'bg-violet-400/25', spiritCls: 'text-violet-400', titleCls: 'text-violet-100', chipCls: 'border-violet-800/50 hover:border-violet-500'
  },
  {
    n: 4, key: 'equipes', img: '/Udyr_notudyr_turtle.webp', icon: 'fa-people-group', primary: '/synergy',
    spirit: 'Espírito da Tartaruga', title: 'Equipes',
    desc: 'Monte a tribo perfeita por sinergia e equilibre partidas customizadas.',
    links: [
      { label: 'Tribo Perfeita', to: '/synergy', icon: 'fa-people-group' },
      { label: 'Customizada 5x5', to: '/saguaoCustom', icon: 'fa-shuffle' },
      { label: 'Relatórios Premium', to: '/relatorios', icon: 'fa-file-invoice' }
    ],
    cardCls: 'border-lime-500/40 bg-gradient-to-br from-emerald-900/80 via-teal-900/40 to-slate-950 hover:shadow-[0_0_40px_rgba(132,204,22,0.3)]',
    glowCls: 'bg-lime-400/25', spiritCls: 'text-lime-400', titleCls: 'text-lime-100', chipCls: 'border-lime-800/50 hover:border-lime-500'
  }
];

// Navegação direta para uma página (sub-link).
function goTo(to) {
  router.push(to);
}

// Clique no cabeçalho do portal: vai ao hub. O Jogador entra direto no perfil já
// carregado (se houver); senão abre o gate de busca da seção.
function goPrimary(p) {
  if (p.key === 'jogador') {
    const { puuid, gameName, tagLine } = store.searchProfile;
    if (puuid && gameName && tagLine) {
      router.push(`/profile/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
      return;
    }
  }
  router.push(p.primary);
}
</script>
