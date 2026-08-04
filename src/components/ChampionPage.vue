<!--
  ChampionPage — TELA CHEIA do campeão (rota /ficha/:championId).
  É a versão "maximizada" da ficha: SUBSTITUI a tela anterior (Panteão, Meta, Caverna,
  Histórico…) em vez de flutuar por cima dela, e volta para ela pelo botão "Voltar".
  De onde veio fica em `store.championSheet.origem` (gravado no App.vue ao expandir);
  sem origem (link direto/refresh) a volta cai no Panteão.

  A ficha em si é o MESMO ChampionSheet do modal, só com `mode="pagina"`.
-->
<template>
  <div>
    <ChampionSheet
      v-if="champ"
      :champ="champ"
      mode="pagina"
      :back-label="backLabel"
      @close="voltar"
      @open-item="goToItem"
      @open-champion="trocarCampeao"
    />

    <!-- Lista do Data Dragon ainda carregando (F5 direto nesta rota) -->
    <AsyncState v-else-if="!listaPronta" loading accent="cyan" loading-text="Invocando a ficha..." :retryable="false" />

    <!-- Id que não existe no patch atual: degrada, não quebra. -->
    <div v-else class="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
      <p class="text-sm text-slate-400">Campeão não encontrado neste patch.</p>
      <button
        type="button"
        class="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-300 transition hover:border-cyan-500 hover:text-white"
        @click="voltar"
      >
        <i class="fa-solid fa-arrow-left"></i> {{ backLabel }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { state } from '../store.js';
import { getChampionIdFromName } from '../utils.js';
import ChampionSheet from './ChampionSheet.vue';
import AsyncState from './AsyncState.vue';

const store = state;
const route = useRoute();
const router = useRouter();

const listaPronta = computed(() => (store.staticData.championList || []).length > 0);

// :championId é o id do DDragon (MonkeyKing, Chogath…), como no deep-link do Panteão.
const champ = computed(() => {
  const id = route.params.championId;
  if (!id) return null;
  return (store.staticData.championList || []).find(
    (c) => c.id === id || getChampionIdFromName(c.name) === id
  ) || null;
});

// Nome amigável da tela de origem — o botão diz para onde volta, não só "voltar".
const TELAS = [
  { prefixo: '/meta', label: 'o Meta' },
  { prefixo: '/champions', label: 'o Panteão' },
  { prefixo: '/campeoes', label: 'Campeões' },
  { prefixo: '/mastery', label: 'a Caverna' },
  { prefixo: '/historico', label: 'as Caçadas' },
  { prefixo: '/analise', label: 'a Visão' },
  { prefixo: '/profile', label: 'o Perfil' },
  { prefixo: '/items', label: 'as Relíquias' },
  { prefixo: '/synergy', label: 'a Tribo' },
  { prefixo: '/saguaoCustom', label: 'a Customizada' },
  { prefixo: '/jogadores', label: 'Jogadores' }
];

const origem = computed(() => store.championSheet.origem || '/champions');
const backLabel = computed(() => {
  const tela = TELAS.find((t) => origem.value === t.prefixo || origem.value.startsWith(`${t.prefixo}/`));
  return tela ? `Voltar para ${tela.label}` : 'Voltar';
});

function voltar() {
  const destino = origem.value;
  store.championSheet.origem = '';
  router.push(destino);
}

// Counter/sugestão dentro da ficha: troca o campeão SEM empilhar histórico, para o
// Voltar continuar levando à tela de origem em vez de percorrer a cadeia de fichas.
function trocarCampeao(outro) {
  if (!outro) return;
  router.replace(`/ficha/${outro.id || getChampionIdFromName(outro.name)}`);
}

function goToItem(itemId) {
  router.push(`/items/${itemId}`);
}
</script>
