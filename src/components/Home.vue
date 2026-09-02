<!--
  Home — o Templo: os 4 espíritos do Udyr como portais do sistema.

  A caixa de busca saiu daqui: ela vive permanentemente na topbar, então repeti-la
  no meio da tela só roubava a altura dos portais. O que a Home faz agora é uma
  coisa só, e faz grande: mostrar os quatro caminhos.

  A árvore (quais pilares existem, o que tem dentro de cada um e de que cor) vem
  de `src/navegacao.js` — a MESMA que desenha a topbar, a sidebar e os hubs.
-->
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
        v-for="p in PILARES"
        :key="`bg-${p.id}`"
        class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-500"
        :style="{ opacity: activeBg === p.n ? '1' : '0', backgroundImage: `url('${p.arte}')`, transform: activeBg === p.n ? 'scale(1)' : 'scale(1.06)' }"
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
      <div class="mb-8 text-center">
        <p class="mb-1 text-[11px] font-black uppercase tracking-[0.35em] text-slate-400/80">bUGAdão Analytics</p>
        <h2 class="text-3xl font-black tracking-wide text-slate-100 drop-shadow-[0_2px_16px_rgba(6,182,212,0.5)] sm:text-5xl">
          <span class="bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-500 bg-clip-text text-transparent">Escolha Seu Caminho Ancestral</span>
        </h2>
        <p class="mx-auto mt-2 max-w-xl text-sm text-slate-300/90">
          Invocador, meta, campeão ou tribo — passe o espírito do Udyr sobre cada portal e siga a trilha.
          A busca por <span class="font-bold text-slate-400">Nome#TAG</span> ou campeão fica sempre ali em cima.
        </p>
      </div>

      <!-- OS 4 PORTAIS = OS 4 ESPÍRITOS DO UDYR -->
      <div class="grid w-full max-w-7xl gap-5 px-2 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="p in PILARES"
          :key="p.id"
          class="group relative min-h-[22rem] overflow-hidden rounded-3xl border shadow-2xl transition duration-300 hover:scale-[1.02]"
          :class="p.cardCls"
          @mouseenter="setBg(p.n)"
          @mouseleave="setBg(0)"
        >
          <!-- Glow + arte do espírito (decorativa) -->
          <div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl transition-all duration-500 group-hover:opacity-90" :class="p.glowCls"></div>
          <img
            :src="p.arte"
            :alt="p.label"
            class="pointer-events-none absolute -bottom-8 -right-8 h-56 w-56 select-none object-contain opacity-25 drop-shadow-2xl transition duration-500 group-hover:scale-110 group-hover:opacity-55"
          />

          <div class="relative z-10 flex h-full flex-col p-6">
            <!-- Cabeçalho clicável: leva ao hub da categoria -->
            <button type="button" class="text-left" @click="irParaHub(p)">
              <p class="text-[11px] font-black uppercase tracking-[0.18em]" :class="p.spiritCls">{{ p.espirito }}</p>
              <p class="mt-1.5 flex items-center gap-2.5 text-3xl font-black drop-shadow-[0_0_12px_rgba(0,0,0,0.6)]" :class="p.titleCls">
                <i class="fa-solid text-2xl" :class="[p.icon, p.spiritCls]"></i>{{ p.label }}
              </p>
              <p class="mt-3 text-[15px] font-semibold leading-snug text-slate-200/90">{{ p.desc }}</p>
            </button>

            <!-- Sub-links diretos para as páginas da categoria -->
            <div class="mt-5 flex flex-1 flex-col justify-end gap-2">
              <button
                v-for="pagina in p.paginas"
                :key="pagina.path"
                type="button"
                class="flex items-center gap-2 rounded-xl border bg-slate-950/50 px-2.5 py-2.5 text-left text-[13px] font-bold text-slate-200 backdrop-blur-sm transition hover:text-white"
                :class="p.chipCls"
                @click.stop="router.push(pagina.path)"
              >
                <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center" :class="p.spiritCls">
                  <i class="fa-solid text-xs" :class="pagina.icon"></i>
                </span>
                <span class="truncate">{{ pagina.label }}</span>
                <i class="fa-solid fa-chevron-right ml-auto text-[10px] opacity-50"></i>
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
import { PILARES } from '../navegacao.js';

const router = useRouter();
const store = state;
defineEmits(['show-overlay', 'hide-overlay', 'show-udyr']);

// Fundo PADRÃO: a roda de fogo do Udyr nas duas versões (mantido).
const HOME_UDYR_FOREST = '/home_udyr_forest.webp';
const HOME_UDYR = '/home_udyr.webp';

// Fundo ativo: 0 = padrão (roda de fogo); 1..4 = espírito sob o mouse (casa com `n`).
const activeBg = ref(0);
function setBg(n) {
  activeBg.value = n;
}

// Clique no cabeçalho do portal: vai ao hub. O Jogador entra direto no perfil já
// carregado (se houver); senão abre o hub da seção.
function irParaHub(p) {
  if (p.id === 'jogador') {
    const { puuid, gameName, tagLine } = store.searchProfile;
    if (puuid && gameName && tagLine) {
      router.push(`/profile/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
      return;
    }
  }
  router.push(p.hub);
}
</script>
