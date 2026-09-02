<!--
  AbasJogador — o alternador de telas do jogador, no canto superior direito.
  Histórico ↔ Estatísticas ↔ Caverna dos Monos ↔ Relatório, mais a seta que volta
  ao seletor. São as MESMAS quatro opções do seletor de /profile — a barra é o
  seletor depois que você já escolheu.

  Vive FORA do Profile porque o Relatório Premium mora em outra rota
  (/relatorios/:gameName/:tagLine, dentro do RelatoriosPremium) e precisa
  exatamente do mesmo controle: quem entra pelo card do relatório tem que
  conseguir pular para o histórico do mesmo jogador sem voltar pela busca.

  Cada aba tem rota própria (não é estado interno de tela nenhuma), então trocar
  de aba é uma navegação de verdade — o link continua compartilhável e o F5 cai
  onde estava. O `scrollBehavior` do Router só evita o pulo quando o registro de
  rota é o mesmo; aqui ele muda, e subir ao topo é o certo.

  A aba de Relatório só faz sentido para jogador premium — é quem o coletor
  sincroniza toda madrugada, e portanto o único que TEM relatório. Para os
  outros ela aparece apagada, com o motivo no title, em vez de sumir sem
  explicação.
-->
<template>
  <div class="sticky top-2 z-40 -mb-3 flex justify-end">
    <div class="flex gap-1 rounded-xl border border-slate-700 bg-slate-950/95 p-1 shadow-2xl backdrop-blur">
      <button
        type="button"
        title="Voltar ao seletor do perfil"
        class="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 transition hover:text-slate-200"
        @click="ir('seletor')"
      ><i class="fa-solid fa-arrow-left"></i></button>

      <button
        v-for="aba in ABAS"
        :key="aba.chave"
        type="button"
        :disabled="bloqueada(aba)"
        :title="bloqueada(aba) ? MOTIVO_BLOQUEIO : aba.label"
        class="rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
        :class="view === aba.chave ? aba.ativo : 'text-slate-400 hover:text-slate-200'"
        @click="ir(aba.chave)"
      >
        <i class="fa-solid mr-1" :class="aba.icone"></i>
        <span class="hidden sm:inline">{{ aba.label }}</span>
        <span class="sm:hidden">{{ aba.curto }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';

const props = defineProps({
  // Aba ligada: 'historico' | 'estatisticas' | 'maestria' | 'relatorio'
  // (qualquer outra = nenhuma acesa).
  view: { type: String, default: '' },
  gameName: { type: String, default: '' },
  tagLine: { type: String, default: '' },
  // Só premium tem relatório. Default false: quem não sabe não promete a aba.
  premium: { type: Boolean, default: false }
});

const route = useRoute();
const router = useRouter();

// A cor do "ligado" é a da tela de destino: azul do perfil, âmbar da Caverna,
// verde do relatório — as mesmas do resto do sistema (ver src/navegacao.js).
const ABAS = [
  { chave: 'historico', label: 'Histórico', curto: 'Hist.', icone: 'fa-scroll', ativo: 'bg-blue-600 text-white shadow' },
  { chave: 'estatisticas', label: 'Estatísticas', curto: 'Stats', icone: 'fa-chart-simple', ativo: 'bg-blue-600 text-white shadow' },
  { chave: 'maestria', label: 'Maestrias', curto: 'Maest.', icone: 'fa-trophy', ativo: 'bg-amber-600 text-white shadow' },
  { chave: 'relatorio', label: 'Relatório', curto: 'Relat.', icone: 'fa-file-invoice', ativo: 'bg-emerald-600 text-white shadow' }
];

const MOTIVO_BLOQUEIO =
  'Só jogador premium tem Relatório — é quem o coletor sincroniza toda madrugada.';

function bloqueada(aba) {
  return aba.chave === 'relatorio' && !props.premium;
}

// Cada aba tem a SUA rota dedicada (as mesmas que a sidebar e a Home usam).
const CAMINHO = {
  historico: 'historico',
  estatisticas: 'analise',
  maestria: 'mastery',
  relatorio: 'relatorios',
  seletor: 'profile'
};

function ir(chave) {
  // O jogador vem do pai; a URL é o retrato de segurança (link direto, F5).
  const gn = props.gameName || (route.params.gameName ? decodeURIComponent(route.params.gameName) : '');
  const tl = props.tagLine || (route.params.tagLine ? decodeURIComponent(route.params.tagLine) : '');
  if (!gn || !tl || chave === props.view) return;
  router.push(`/${CAMINHO[chave]}/${encodeURIComponent(gn)}/${encodeURIComponent(tl)}`);
}
</script>
