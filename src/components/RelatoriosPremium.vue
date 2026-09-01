<!--
  RelatoriosPremium — a área de Relatórios Premium (seção Equipes).

  UM registro de rota, param opcional, igual ao `/champions/:championId?`:
    /relatorios                        -> este grid de cards
    /relatorios/:gameName/:tagLine     -> a ficha em tela cheia (RelatorioJogador)

  Por que um registro só e não uma rota separada: o `scrollBehavior` do router
  devolve `false` quando `to.matched[0] === from.matched[0]`, então fechar no "X"
  volta para a lista EXATAMENTE na posição em que ela estava. De quebra, o link
  é compartilhável e sobrevive ao F5 — nada de modal com `position: fixed`
  calculando a largura da sidebar.

  A tela cheia é `defineAsyncComponent`: ela carrega o banco de frases inteiro
  (shared/relatorio-prosa.js) e não tem por que pesar no bundle de quem só passou
  pelo grid.
-->
<template>
  <div class="min-h-[74vh]">
    <!-- TELA CHEIA de um jogador (o param na URL manda) -->
    <RelatorioJogador
      v-if="alvo"
      :key="`${alvo.gameName}#${alvo.tagLine}`"
      :game-name="alvo.gameName"
      :tag-line="alvo.tagLine"
      :jogador="jogadorSelecionado"
      @close="fechar"
    />

    <!-- LISTA -->
    <template v-else>
      <header class="mb-6 flex flex-col gap-1">
        <h1 class="flex items-center gap-2 text-2xl font-black text-white sm:text-3xl">
          <i class="fa-solid fa-file-invoice text-emerald-400"></i>
          <span class="bg-gradient-to-r from-emerald-300 via-teal-300 to-lime-400 bg-clip-text text-transparent">
            Relatórios Premium
          </span>
        </h1>
        <p class="text-sm text-slate-400">
          O relatório do Cronista, que todo dia cai no Discord, agora com filtro de período aqui dentro.
          Clique num jogador para abrir o relatório dele.
        </p>
      </header>

      <AsyncState
        :loading="loading"
        :error="error"
        accent="emerald"
        loading-text="Consultando os arquivos da tribo..."
        error-title="Não deu para listar os jogadores premium"
        @retry="carregar"
      >
        <!-- Vazio: ninguém marcado como premium ainda. -->
        <div v-if="!jogadores.length" class="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
          <i class="fa-solid fa-user-slash mb-3 text-2xl text-slate-600"></i>
          <p class="text-sm font-bold text-slate-300">Nenhum jogador premium cadastrado.</p>
          <p class="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Só quem tem a marca premium é sincronizado toda madrugada — e só quem é sincronizado tem
            relatório. A promoção é feita na aba "Jogadores" da Ancestralidade.
          </p>
        </div>

        <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="j in jogadores"
            :key="j.puuid"
            type="button"
            class="group relative flex flex-col overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-900/50 via-teal-900/25 to-slate-950 p-4 text-left shadow-xl transition duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(16,185,129,0.28)]"
            @click="abrir(j)"
          >
            <div class="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl transition-all duration-500 group-hover:opacity-90"></div>

            <!-- Identidade -->
            <div class="relative z-10 flex items-center gap-3">
              <img
                :src="profileIconImage(j.profile_icon_id || 29)"
                :alt="j.game_name"
                class="h-12 w-12 shrink-0 rounded-lg border border-emerald-600/60 object-cover"
                @error="(e) => (e.target.src = profileIconImage(29))"
              />
              <div class="min-w-0">
                <p class="truncate text-base font-black text-emerald-100">{{ j.game_name }}</p>
                <p class="truncate text-[11px] font-bold text-slate-400">
                  #{{ j.tag_line }}<span v-if="j.summoner_level"> · nível {{ j.summoner_level }}</span>
                </p>
              </div>
            </div>

            <!-- Elo das duas filas -->
            <div class="relative z-10 mt-3 grid grid-cols-2 gap-2">
              <div v-for="f in FILA_ORDEM" :key="f" class="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                <p class="text-[9px] font-black uppercase tracking-wider text-slate-500">{{ FILAS[f].label }}</p>
                <p class="mt-0.5 truncate text-[11px] font-bold text-slate-200">{{ eloDe(j, f) }}</p>
              </div>
            </div>

            <!-- Atividade: é o que diz se vale abrir o relatório e em qual recorte. -->
            <div class="relative z-10 mt-3 flex flex-wrap gap-1.5">
              <span
                v-for="p in PRESETS_CARD"
                :key="p.chave"
                class="rounded-md border px-2 py-1 text-[10px] font-bold"
                :class="totalNoPreset(j, p.campo) ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300' : 'border-slate-800 bg-slate-950/50 text-slate-600'"
              >
                {{ p.label }}: {{ totalNoPreset(j, p.campo) }}j
              </span>
            </div>

            <p class="relative z-10 mt-3 text-[10px] text-slate-500">
              <template v-if="j.ultimaPartida">
                Última ranqueada em <span class="font-bold text-slate-400">{{ fmtDia(j.ultimaPartida) }}</span>
                · {{ j.totalPartidas }} no banco
              </template>
              <template v-else>Nenhuma partida ranqueada registrada.</template>
            </p>

            <span class="relative z-10 mt-3 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-300">
              Abrir relatório <i class="fa-solid fa-arrow-right transition-transform group-hover:translate-x-1"></i>
            </span>
          </button>
        </div>
      </AsyncState>
    </template>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchPremiumPlayers } from '../api.js';
import { profileIconImage } from '../utils.js';
import { FILAS } from '../../shared/relatorio-metricas.js';
import AsyncState from './AsyncState.vue';

// Chunk à parte: a tela cheia arrasta o banco de frases inteiro junto.
const RelatorioJogador = defineAsyncComponent(() => import('./RelatorioJogador.vue'));

const route = useRoute();
const router = useRouter();

const FILA_ORDEM = ['solo', 'flex'];
// Os mesmos recortes dos chips da tela cheia — aqui só como prévia de volume.
const PRESETS_CARD = [
  { chave: 'semana', label: '7d', campo: 'j7' },
  { chave: 'quinzena', label: '15d', campo: 'j15' },
  { chave: 'mes', label: '30d', campo: 'j30' }
];

const jogadores = ref([]);
const loading = ref(false);
const error = ref(null);

// O alvo vem da URL — refresh e link direto funcionam sem depender da lista.
const alvo = computed(() => {
  const { gameName, tagLine } = route.params;
  if (!gameName || !tagLine) return null;
  return { gameName: decodeURIComponent(gameName), tagLine: decodeURIComponent(tagLine) };
});

// A linha do jogador (com puuid e atividade) quando a lista já carregou. Pode ser
// null num link direto: a tela cheia sabe se virar carregando a lista por conta.
const jogadorSelecionado = computed(() => {
  if (!alvo.value) return null;
  const { gameName, tagLine } = alvo.value;
  return jogadores.value.find(
    (j) => j.game_name?.toLowerCase() === gameName.toLowerCase() && String(j.tag_line).toLowerCase() === tagLine.toLowerCase()
  ) || null;
});

async function carregar() {
  loading.value = true;
  error.value = null;
  try {
    jogadores.value = await fetchPremiumPlayers();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(carregar);

function abrir(j) {
  router.push(`/relatorios/${encodeURIComponent(j.game_name)}/${encodeURIComponent(j.tag_line)}`);
}

function fechar() {
  router.push('/relatorios');
}

// Elo da fila: solo usa tier/rank/lp; flex usa as colunas flex_*.
const TIER_LABEL = {
  IRON: 'Ferro', BRONZE: 'Bronze', SILVER: 'Prata', GOLD: 'Ouro', PLATINUM: 'Platina',
  EMERALD: 'Esmeralda', DIAMOND: 'Diamante', MASTER: 'Mestre', GRANDMASTER: 'Grão-Mestre',
  CHALLENGER: 'Desafiante'
};
const SEM_DIVISAO = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

function eloDe(j, fila) {
  const tier = fila === 'flex' ? j.flex_tier : j.tier;
  const rank = fila === 'flex' ? j.flex_rank : j.rank;
  const lp = fila === 'flex' ? j.flex_lp : j.lp;
  if (!tier) return 'Sem elo';
  const T = String(tier).toUpperCase();
  const div = SEM_DIVISAO.has(T) || !rank ? '' : ` ${rank}`;
  return `${TIER_LABEL[T] || tier}${div}${lp == null ? '' : ` · ${lp} PDL`}`;
}

// Soma as duas filas no recorte do chip (o card é um resumo, não o relatório).
function totalNoPreset(j, campo) {
  return FILA_ORDEM.reduce((soma, f) => soma + (Number(j.atividade?.[f]?.[campo]) || 0), 0);
}

function fmtDia(ms) {
  return new Date(Number(ms)).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
</script>
