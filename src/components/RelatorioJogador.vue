<!--
  RelatorioJogador — o Relatório Premium de UM jogador, em tela cheia.
  Renderizado pela rota /relatorios/:gameName/:tagLine (dentro de RelatoriosPremium).

  Divisão de trabalho, que é o ponto todo desta tela:
    • o Worker devolve só NÚMEROS (shared/relatorio-metricas.js agregando o D1);
    • a NARRAÇÃO é montada aqui no browser (shared/relatorio-prosa.js), o mesmo
      banco de frases que o Cronista usa no Discord — só que sem embed no meio.

  Solo/Duo e Flex NUNCA se misturam num número (são elos e metas diferentes), então
  a busca traz as duas filas de uma vez e a aba só troca qual delas está na tela —
  alternar aba não custa uma nova ida ao servidor.

  Estado (aba + período) vive na QUERY STRING, não no store: recarregar a página
  ou mandar o link para alguém devolve exatamente o mesmo relatório.
-->
<template>
  <div class="min-h-[74vh]">
    <!-- ---------------------------------------------------------------- -->
    <!-- CABEÇALHO: identidade + o "X" que volta para a lista              -->
    <!-- ---------------------------------------------------------------- -->
    <header class="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 via-teal-900/20 to-slate-950 p-4">
      <img
        :src="profileIconImage(iconId)"
        :alt="gameName"
        class="h-14 w-14 shrink-0 rounded-lg border border-emerald-600/60 object-cover"
        @error="(e) => (e.target.src = profileIconImage(29))"
      />
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Relatório Premium</p>
        <h1 class="truncate text-xl font-black text-white sm:text-2xl">
          {{ gameName }}<span class="text-slate-500">#{{ tagLine }}</span>
        </h1>
        <p class="mt-0.5 text-xs font-bold text-slate-400">
          {{ FILAS[fila].emoji }} Ranked {{ FILAS[fila].label }}
          <span v-if="eloAtual" class="text-slate-500">· {{ eloAtual }}</span>
        </p>
      </div>
      <button
        type="button"
        aria-label="Fechar relatório"
        title="Voltar para a lista"
        class="shrink-0 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-slate-400 transition hover:border-red-500 hover:text-red-300"
        @click="$emit('close')"
      >
        <i class="fa-solid fa-xmark text-lg"></i>
      </button>
    </header>

    <!-- ---------------------------------------------------------------- -->
    <!-- CONTROLES: abas de fila + presets de período + intervalo livre    -->
    <!-- ---------------------------------------------------------------- -->
    <div class="mb-5 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
      <!-- Abas Solo/Flex -->
      <div class="flex gap-2" role="tablist">
        <button
          v-for="f in FILA_ORDEM"
          :key="f"
          type="button"
          role="tab"
          :aria-selected="fila === f"
          class="flex-1 rounded-lg border px-3 py-2 text-sm font-black uppercase tracking-wide transition"
          :class="fila === f ? ABA_ATIVA[f] : 'border-slate-800 bg-slate-950/60 text-slate-500 hover:text-slate-300'"
          @click="fila = f"
        >
          {{ FILAS[f].emoji }} {{ FILAS[f].label }}
          <span class="ml-1 text-[11px] font-bold opacity-70">({{ jogosDaFila(f) }}j)</span>
        </button>
      </div>

      <!-- Presets. A contagem no chip é do jogador, das DUAS filas somadas — é a
           prévia que responde "vale abrir esse recorte?" antes de clicar. -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="p in PRESETS"
          :key="p.chave"
          type="button"
          class="rounded-lg border px-3 py-1.5 text-xs font-black uppercase tracking-wide transition"
          :class="preset === p.chave
            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
            : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'"
          @click="preset = p.chave"
        >
          {{ p.label }}
          <span v-if="p.campo" class="ml-1 text-[10px] font-bold opacity-70">{{ previaDoPreset(p.campo) }}j</span>
        </button>
      </div>

      <!-- Intervalo livre: só aparece no "Outro período" para não poluir o resto. -->
      <div v-if="preset === 'outro'" class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <label class="flex flex-col gap-1">
          <span class="text-[10px] font-black uppercase tracking-wider text-slate-500">Data inicial</span>
          <input
            v-model="deManual"
            type="date"
            :max="ateManual || hojeIso"
            class="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-emerald-500"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-[10px] font-black uppercase tracking-wider text-slate-500">Data final</span>
          <input
            v-model="ateManual"
            type="date"
            :min="deManual"
            :max="hojeIso"
            class="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-emerald-500"
          />
        </label>
        <p v-if="limiteHistorico" class="text-[10px] text-slate-500">
          Há partidas no banco desde <span class="font-bold text-slate-400">{{ limiteHistorico }}</span>.
        </p>
      </div>

      <p class="text-[11px] text-slate-500">
        <i class="fa-solid fa-calendar-days mr-1"></i>
        Período: <span class="font-bold text-slate-400">{{ rotuloPeriodo }}</span>
        <span v-if="dadosPeriodo"> · {{ dadosPeriodo }}</span>
      </p>
    </div>

    <!-- ---------------------------------------------------------------- -->
    <!-- O RELATÓRIO                                                       -->
    <!-- ---------------------------------------------------------------- -->
    <AsyncState
      :loading="loading"
      :error="error"
      accent="emerald"
      loading-text="O Cronista está lendo os registros..."
      error-title="Não deu para montar o relatório"
      @retry="carregar"
    >
      <!-- Fila sem partida no recorte: degrada, não quebra. -->
      <div v-if="!analise" class="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
        <i class="fa-solid fa-ghost mb-3 text-2xl text-slate-600"></i>
        <p class="text-sm font-bold text-slate-300">
          Nenhuma partida de {{ FILAS[fila].label }} no período escolhido.
        </p>
        <p class="mt-1 text-xs text-slate-500">
          Tente outro recorte, ou a aba
          <button type="button" class="font-bold text-emerald-400 underline" @click="fila = outraFila">
            {{ FILAS[outraFila].label }}
          </button>.
        </p>
      </div>

      <div v-else class="space-y-5">
        <!-- KPIs do recorte -->
        <section>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            <KpiCard :value="analise.jogos" label="Jogos" :sub="`${analise.vitorias}V-${analise.derrotas}D`" value-class="text-slate-100" />
            <KpiCard :value="`${analise.wr}%`" label="Vitórias" :sub="subTendencia('wr', '%')" :value-class="corWr(analise.wr)" />
            <KpiCard :value="analise.met.kda.toFixed(2)" label="KDA" :sub="`${analise.med.k}/${analise.med.d}/${analise.med.a}`" :value-class="corClasse(analise.classe.kda)" />
            <KpiCard :value="analise.met.csMin" label="CS/min" :sub="subTendencia('csMin')" :value-class="corClasse(analise.classe.csMin)" />
            <KpiCard :value="analise.met.visMin" label="Visão/min" :value-class="corClasse(analise.classe.visMin)" />
            <KpiCard :value="`${Math.round(analise.met.kp * 100)}%`" label="Part. abates" :value-class="corClasse(analise.classe.kp)" />
            <KpiCard :value="analise.met.gpm" label="Ouro/min" value-class="text-amber-300" />
            <KpiCard :value="fmtMilhar(analise.met.dmg)" label="Dano/jogo" value-class="text-rose-300" />
          </div>
          <p class="mt-2 text-[11px] text-slate-500">
            Régua da rota principal ({{ analise.rotaLabel }}): verde = acima do esperado, âmbar = na média, vermelho = a melhorar.
          </p>
        </section>

        <!-- Narração: gerada AQUI, no browser, a partir dos números acima. -->
        <section class="rounded-2xl border border-emerald-500/30 bg-slate-900/60 p-4">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-emerald-300">
            <i class="fa-solid fa-feather-pointed"></i> O que o Cronista viu
          </h2>
          <div class="space-y-3 text-sm leading-relaxed text-slate-300">
            <p v-for="(par, i) in paragrafos" :key="i" v-html="par"></p>
          </div>
        </section>

        <!-- Série diária: o "acumulado no período" em forma de barra. -->
        <section v-if="serie.length" class="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 class="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
            <i class="fa-solid fa-chart-column text-emerald-400"></i> Dia a dia
          </h2>
          <p class="mb-3 text-[11px] text-slate-500">
            {{ serie.length }} dia(s) com ranqueada no recorte · barra cheia = jogos, verde = vitórias.
          </p>
          <div class="overflow-x-auto">
            <div class="flex min-w-max items-end gap-1.5" :style="{ height: '132px' }">
              <div
                v-for="d in serie"
                :key="d.dia"
                class="group/dia flex w-7 shrink-0 flex-col items-center justify-end gap-1"
                :title="`${fmtDiaCurto(d.dia)} — ${d.jogos}j · ${d.vitorias}V-${d.jogos - d.vitorias}D`"
              >
                <span class="text-[9px] font-bold text-slate-500 opacity-0 transition group-hover/dia:opacity-100">{{ d.jogos }}</span>
                <div class="flex w-full flex-col justify-end rounded-t bg-rose-500/40" :style="{ height: alturaBarra(d) }">
                  <div class="w-full rounded-t bg-emerald-500/80" :style="{ height: fatiaVitorias(d) }"></div>
                </div>
                <span class="text-[8px] font-bold leading-none text-slate-600">{{ fmtDiaCurto(d.dia) }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Evolução + radar: os dois gráficos que respondem "melhorei?" e "onde
             estou fora da régua da rota?" - o mesmo par da aba de Análise. -->
        <div class="grid gap-5 lg:grid-cols-2">
          <section v-if="evolucao" class="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 class="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
                <i class="fa-solid fa-chart-line text-cyan-400"></i> Evolução no período
              </h2>
              <div class="flex items-center gap-3 text-[10px] font-bold">
                <span class="flex items-center gap-1"><span class="h-2 w-4 rounded-sm bg-cyan-500"></span>WR acumulada</span>
                <span class="flex items-center gap-1"><span class="h-0 w-4 border-t-2 border-dashed border-amber-400"></span>KDA do dia</span>
              </div>
            </div>
            <p class="mb-3 text-[11px] text-slate-500">
              A WR é acumulada (como o elo sente); o KDA é do dia. Do início (esq.) ao fim (dir.) do recorte.
            </p>
            <svg :viewBox="`0 0 ${evolucao.W} ${evolucao.H}`" class="h-auto w-full">
              <line :x1="0" :x2="evolucao.W" :y1="evolucao.y50" :y2="evolucao.y50" stroke="#475569" stroke-width="1" stroke-dasharray="3 3" />
              <text :x="2" :y="evolucao.y50 - 3" class="fill-slate-500" style="font-size:7px;font-weight:700">50%</text>
              <path :d="evolucao.wrArea" fill="#06b6d426" />
              <path :d="evolucao.wrPath" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linejoin="round" />
              <path :d="evolucao.kdaPath" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round" stroke-dasharray="4 3" />
              <circle v-for="(pt, i) in evolucao.wrPts" :key="'w' + i" :cx="pt.x" :cy="pt.y" r="2.5" fill="#06b6d4">
                <title>{{ pt.rotulo }} - {{ pt.wr }}% acumulada ({{ pt.jogos }} jogos no dia)</title>
              </circle>
              <circle v-for="(pt, i) in evolucao.kdaPts" :key="'k' + i" :cx="pt.x" :cy="pt.y" r="2.5" fill="#f59e0b">
                <title>{{ pt.rotulo }} - KDA {{ pt.kda }}</title>
              </circle>
            </svg>
          </section>

          <section class="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 class="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
              <i class="fa-solid fa-chart-pie text-violet-400"></i> Régua da rota ({{ analise.rotaLabel }})
            </h2>
            <p class="mb-2 text-[11px] text-slate-500">
              100 = o topo do esperado para a rota. Quanto mais cheio o polígono, melhor.
            </p>
            <RadarChart :axes="radarRota" :size="220" color="#8b5cf6" />
            <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <div v-for="e in radarRota" :key="e.label" class="flex items-center justify-between">
                <span class="text-slate-400">{{ e.label }}</span>
                <span class="font-black" :class="corClasse(e.classe)">{{ e.bruto }}</span>
              </div>
            </div>
          </section>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
          <!-- Distribuição por rota (rosca), igual a da aba de Análise -->
          <section v-if="rotaDonut.total" class="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 class="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
              <i class="fa-solid fa-compass text-amber-400"></i> Distribuição por rota
            </h2>
            <p class="mb-3 text-[11px] text-slate-500">Quantas partidas e a WR de cada posição no recorte.</p>
            <div class="flex flex-col items-center gap-3 sm:flex-row">
              <svg viewBox="0 0 140 140" class="h-36 w-36 shrink-0">
                <g transform="rotate(-90 70 70)">
                  <circle v-for="sg in rotaDonut.segmentos" :key="sg.rota"
                    cx="70" cy="70" r="54" fill="none" :stroke="sg.cor" stroke-width="18"
                    :stroke-dasharray="`${sg.dash.toFixed(2)} ${sg.gap.toFixed(2)}`"
                    :stroke-dashoffset="sg.offset.toFixed(2)" />
                </g>
                <text x="70" y="66" text-anchor="middle" class="fill-white" style="font-size:20px;font-weight:800">{{ rotaDonut.total }}</text>
                <text x="70" y="83" text-anchor="middle" class="fill-slate-400" style="font-size:8px;font-weight:700">JOGOS</text>
              </svg>
              <div class="w-full space-y-1.5">
                <div v-for="l in rotaDonut.lista" :key="l.rota" class="flex items-center gap-2 text-[11px]">
                  <span class="h-3 w-3 shrink-0 rounded-sm" :style="{ background: l.cor }"></span>
                  <img :src="roleIconImage(l.rota)" :alt="l.label" class="h-4 w-4 shrink-0" />
                  <span class="w-14 font-bold text-slate-200">{{ l.label }}</span>
                  <span class="text-slate-500">{{ l.n }}j ({{ l.pct }}%)</span>
                  <span class="ml-auto font-black" :class="corWr(l.wr)">{{ l.wr }}%</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Mapa de calor: quando joga e quando GANHA -->
          <section v-if="mapaCalor.temDados" class="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 class="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
              <i class="fa-solid fa-calendar-week text-lime-400"></i> Quando você joga
            </h2>
            <p class="mb-3 text-[11px] text-slate-500">
              Opacidade = volume de jogos, cor = taxa de vitória. Vazio = não jogou nessa faixa.
            </p>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[290px] border-separate" style="border-spacing: 3px">
                <thead>
                  <tr>
                    <th class="w-12"></th>
                    <th v-for="d in DIAS_CURTOS" :key="d" class="text-[9px] font-black uppercase text-slate-500">{{ d }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(faixa, fi) in FAIXAS_LABEL" :key="faixa">
                    <td class="pr-1 text-right text-[9px] font-bold uppercase text-slate-500">{{ faixa }}</td>
                    <td v-for="(d, di) in DIAS_CURTOS" :key="d + fi" class="p-0">
                      <div
                        class="flex h-8 items-center justify-center rounded text-[9px] font-black text-slate-100"
                        :style="mapaCalor.celula(di, fi).estilo"
                        :title="mapaCalor.celula(di, fi).titulo"
                      >{{ mapaCalor.celula(di, fi).texto }}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="mt-2 flex items-center justify-end gap-1.5 text-[9px] font-bold text-slate-500">
              <span>WR baixa</span>
              <span class="h-3 w-5 rounded-sm" style="background:#f43f5ecc"></span>
              <span class="h-3 w-5 rounded-sm" style="background:#f59e0bcc"></span>
              <span class="h-3 w-5 rounded-sm" style="background:#10b981cc"></span>
              <span>WR alta</span>
            </div>
          </section>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
          <!-- Top campeões -->
          <section v-if="analise.topPlayed.length" class="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 class="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
              <i class="fa-solid fa-dragon text-sky-400"></i> Campeões do período
            </h2>
            <ul class="space-y-2">
              <li
                v-for="(c, i) in analise.topPlayed"
                :key="c.nome"
                class="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-2"
              >
                <span class="w-5 shrink-0 text-center text-xs font-black text-slate-500">{{ MEDALHAS[i] || '·' }}</span>
                <img
                  v-if="champDoNome(c.nome)"
                  :src="championImage(champDoNome(c.nome).id)"
                  :alt="c.nome"
                  class="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-slate-700 transition hover:border-sky-500"
                  @click="abrirFicha(champDoNome(c.nome))"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-black text-slate-200">{{ c.nome }}</p>
                  <p class="text-[10px] font-bold text-slate-500">{{ c.n }}j · KDA {{ c.kda.toFixed(2) }}</p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-black" :class="corWr(c.wr)">{{ c.wr }}%</p>
                  <p class="text-[10px] font-bold text-slate-600">{{ c.v }}V-{{ c.derrotas }}D</p>
                </div>
              </li>
            </ul>
          </section>

          <div class="space-y-5">
            <!-- Rotas -->
            <section v-if="analise.lanes.length" class="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <h2 class="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
                <i class="fa-solid fa-compass text-amber-400"></i> Rotas
              </h2>
              <ul class="space-y-2">
                <li v-for="l in analise.lanes.slice(0, 5)" :key="l.rota" class="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                  <img :src="roleIconImage(l.rota)" :alt="l.label" class="h-6 w-6 shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-black text-slate-200">{{ l.label }}</p>
                    <p v-if="l.melhorChamp" class="truncate text-[10px] font-bold text-slate-500">
                      melhor: {{ l.melhorChamp.nome }} ({{ l.melhorChamp.wr }}%)
                    </p>
                  </div>
                  <div class="shrink-0 text-right">
                    <p class="text-xs font-black" :class="corWr(l.wr)">{{ l.wr }}%</p>
                    <p class="text-[10px] font-bold text-slate-600">{{ l.n }}j</p>
                  </div>
                </li>
              </ul>
            </section>

            <!-- Destaques -->
            <section class="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <h2 class="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
                <i class="fa-solid fa-star text-violet-400"></i> Destaques
              </h2>
              <ul class="space-y-1.5 text-xs text-slate-300">
                <li v-if="analise.seq?.maiorV">🔥 Melhor sequência: <b class="text-emerald-300">{{ analise.seq.maiorV }} vitórias</b> seguidas</li>
                <li v-if="analise.seq?.maiorD">🧊 Pior sequência: <b class="text-rose-300">{{ analise.seq.maiorD }} derrotas</b> seguidas</li>
                <li v-if="analise.seq?.atual">
                  📍 Terminou com <b :class="analise.seq.atual.vitoria ? 'text-emerald-300' : 'text-rose-300'">
                    {{ analise.seq.atual.tam }}{{ analise.seq.atual.vitoria ? 'V' : 'D' }}
                  </b> em fila
                </li>
                <li>🎭 <b class="text-slate-100">{{ analise.pool }}</b> campeão(ões) diferente(s) · o mais jogado concentra <b class="text-slate-100">{{ analise.concentracao }}%</b></li>
                <li v-if="analise.horarios?.dia">
                  🕹️ Joga mais <b class="text-slate-100">{{ analise.horarios.dia.label }} {{ analise.horarios.faixa?.label }}</b>
                </li>
                <li v-if="analise.janela.tempoTotal">
                  ⏱️ <b class="text-slate-100">{{ fmtDuracao(analise.janela.tempoTotal) }}</b> na Fenda ·
                  {{ analise.janela.diasAtivos }} dia(s) ativo(s) · média de {{ fmtDuracao(analise.janela.durMedia) }}/jogo
                </li>
                <li v-if="analise.sugestaoMeta">
                  🎯 O meta do patch pede <b class="text-amber-300">{{ analise.sugestaoMeta.nome }}</b> (tier {{ analise.sugestaoMeta.tier }}) {{ pRota(analise.rotaPrinc, 'em') }} {{ analise.rotaLabel }}
                </li>
              </ul>
            </section>
          </div>
        </div>

        <!-- Tendência vs. o período anterior de MESMO tamanho -->
        <section v-if="tendencias.length" class="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h2 class="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
            <i class="fa-solid fa-arrow-trend-up text-cyan-400"></i> Contra o período anterior
          </h2>
          <p class="mb-3 text-[11px] text-slate-500">
            Comparado com os {{ diasDoPeriodo }} dia(s) imediatamente antes deste recorte.
          </p>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div v-for="t in tendencias" :key="t.label" class="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
              <p class="text-[9px] font-black uppercase tracking-wider text-slate-500">{{ t.label }}</p>
              <p class="mt-1 text-lg font-black text-slate-100">{{ t.agora }}</p>
              <p class="text-[10px] font-bold" :class="t.delta > 0 ? 'text-emerald-400' : t.delta < 0 ? 'text-rose-400' : 'text-slate-500'">
                {{ t.delta > 0 ? '▲' : t.delta < 0 ? '▼' : '=' }} {{ t.antes }} antes
              </p>
            </div>
          </div>
        </section>

        <p class="pb-2 text-center text-[10px] text-slate-600">
          Números agregados do banco da tribo (partidas ranqueadas sincronizadas). Nenhuma chamada à API da Riot foi feita para montar esta tela.
        </p>
      </div>
    </AsyncState>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchPremiumPlayers, fetchRelatorioPremium } from '../api.js';
import { state, abrirFicha } from '../store.js';
import { championImage, profileIconImage, roleIconImage } from '../utils.js';
import { championByName } from '../utils/championCatalog.js';
import {
  BENCH, DIA, FILAS, fmtDuracao, fmtElo, fmtMilhar, pRota, parseMetaTiers, sugerirDoMeta
} from '../../shared/relatorio-metricas.js';
import { gerarProsa } from '../../shared/relatorio-prosa.js';
import metaCsvRaw from '../data/meta-tiers.csv?raw';
import AsyncState from './AsyncState.vue';
import KpiCard from './KpiCard.vue';
import RadarChart from './RadarChart.vue';

const props = defineProps({
  gameName: { type: String, required: true },
  tagLine: { type: String, required: true },
  // Linha do jogador vinda da lista (traz puuid e a atividade dos chips). Pode ser
  // null num link direto — nesse caso a gente busca a lista aqui mesmo.
  jogador: { type: Object, default: null }
});
defineEmits(['close']);

const store = state;
const route = useRoute();
const router = useRouter();

const FILA_ORDEM = ['solo', 'flex'];
const ABA_ATIVA = {
  solo: 'border-violet-500 bg-violet-500/15 text-violet-200',
  flex: 'border-sky-500 bg-sky-500/15 text-sky-200'
};
const MEDALHAS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

// `dias` alimenta tanto o cálculo das datas quanto o rótulo; `campo` liga o chip
// ao contador que a lista já trouxe (prévia sem ida ao servidor).
const PRESETS = [
  { chave: 'semana', label: 'Semana', dias: 7, campo: 'j7' },
  { chave: 'quinzena', label: 'Quinzena', dias: 15, campo: 'j15' },
  { chave: 'mes', label: 'Mês', dias: 30, campo: 'j30' },
  { chave: 'outro', label: 'Outro período', dias: null, campo: null }
];

// meta-tiers.csv do repo: o Worker não lê arquivo, então a sugestão do meta é
// calculada aqui (mesma função que o cron usa).
const metaTable = parseMetaTiers(metaCsvRaw).table;

// -------------------------------------------------------------------------
// Datas em fuso local (o usuário está em BRT, e é o fuso do relatório).
// `toISOString()` seria UTC e erraria o dia depois das 21h.
// -------------------------------------------------------------------------
function paraIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const hojeIso = paraIso(new Date());
function isoHaDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return paraIso(d);
}

// -------------------------------------------------------------------------
// Estado na URL: aba + período sobrevivem ao refresh e viajam no link.
// -------------------------------------------------------------------------
const fila = ref(FILA_ORDEM.includes(route.query.fila) ? route.query.fila : 'solo');
const preset = ref(PRESETS.some((p) => p.chave === route.query.preset) ? route.query.preset : 'semana');
const deManual = ref(route.query.de || isoHaDias(6));
const ateManual = ref(route.query.ate || hojeIso);

// O intervalo efetivo: preset calcula, "outro" usa o que o usuário digitou.
// `ate` é INCLUSIVO — o worker é quem empurra para o fim do dia.
const intervalo = computed(() => {
  const p = PRESETS.find((x) => x.chave === preset.value);
  if (!p || !p.dias) {
    return { de: deManual.value, ate: ateManual.value };
  }
  return { de: isoHaDias(p.dias - 1), ate: hojeIso };
});

const intervaloValido = computed(() => {
  const { de, ate } = intervalo.value;
  return !!de && !!ate && de <= ate;
});

watch([fila, preset, deManual, ateManual], () => {
  const q = { fila: fila.value, preset: preset.value };
  if (preset.value === 'outro') { q.de = deManual.value; q.ate = ateManual.value; }
  router.replace({ query: q });
});

// -------------------------------------------------------------------------
// Busca. Traz SEMPRE as duas filas: trocar de aba é instantâneo e de graça.
// -------------------------------------------------------------------------
const loading = ref(false);
const error = ref(null);
const resposta = ref(null);
const puuid = ref(props.jogador?.puuid || null);
const jogadorLocal = ref(props.jogador);

watch(() => props.jogador, (j) => {
  if (j) { jogadorLocal.value = j; puuid.value = j.puuid; }
});

// Link direto para /relatorios/Nome/TAG: a lista ainda não carregou, então o puuid
// vem de uma consulta própria (a mesma leitura leve do grid).
async function resolverPuuid() {
  if (puuid.value) return puuid.value;
  const players = await fetchPremiumPlayers();
  const achado = players.find(
    (p) => p.game_name?.toLowerCase() === props.gameName.toLowerCase() &&
           String(p.tag_line).toLowerCase() === props.tagLine.toLowerCase()
  );
  if (!achado) throw new Error('Jogador não encontrado entre os premium.');
  jogadorLocal.value = achado;
  puuid.value = achado.puuid;
  return achado.puuid;
}

// Trocar de preset (ou digitar no campo de data) dispara uma busca nova ANTES de
// a anterior voltar. Sem o token, quem chega por último vence: a resposta lenta
// de um recorte já abandonado sobrescreve o recorte que o usuário acabou de
// pedir. Mesma guarda do autocomplete da SearchBar.
let buscaToken = 0;

async function carregar() {
  if (!intervaloValido.value) {
    error.value = 'A data final precisa ser igual ou posterior à inicial.';
    resposta.value = null;
    return;
  }
  const token = ++buscaToken;
  loading.value = true;
  error.value = null;
  try {
    const id = await resolverPuuid();
    const { de, ate } = intervalo.value;
    const dados = await fetchRelatorioPremium({ puuid: id, de, ate, fila: 'ambas' });
    if (token !== buscaToken) return;   // resposta obsoleta
    resposta.value = dados;
  } catch (e) {
    if (token !== buscaToken) return;   // erro de uma busca já descartada
    error.value = e.message;
    resposta.value = null;
  } finally {
    // Só a busca mais recente desliga o spinner — senão a primeira a voltar diria
    // "pronto" com a tela ainda esperando o recorte novo.
    if (token === buscaToken) loading.value = false;
  }
}

// `intervalo` é um computed que devolve um objeto novo a cada avaliação, e só
// reavalia quando preset/datas mudam: comparar por referência já basta (o
// `deep: true` daqui era percorrer duas strings à toa).
watch(intervalo, carregar, { immediate: true });

// -------------------------------------------------------------------------
// Derivados da resposta
// -------------------------------------------------------------------------
const analise = computed(() => {
  const a = resposta.value?.relatorios?.[fila.value]?.analise;
  if (!a) return null;
  // A dica do meta entra aqui: o Worker manda `jogados`, o CSV mora no front.
  return { ...a, sugestaoMeta: a.sugestaoMeta || sugerirDoMeta(a.rotaPrinc, a.jogados, a.puuid, metaTable) };
});

const serie = computed(() => resposta.value?.relatorios?.[fila.value]?.serie || []);
const outraFila = computed(() => (fila.value === 'solo' ? 'flex' : 'solo'));
const iconId = computed(() => jogadorLocal.value?.profile_icon_id || 29);

const eloAtual = computed(() => {
  const j = jogadorLocal.value;
  if (!j) return null;
  return fila.value === 'flex'
    ? fmtElo(j.flex_tier, j.flex_rank, j.flex_lp)
    : fmtElo(j.tier, j.rank, j.lp);
});

// A data mais antiga com partida no banco — diz até onde o filtro pode ir.
const limiteHistorico = computed(() => {
  const ms = jogadorLocal.value?.primeiraPartida;
  return ms ? new Date(Number(ms)).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null;
});

const diasDoPeriodo = computed(() => {
  const p = resposta.value?.periodo;
  if (!p) return 0;
  return Math.max(1, Math.round((p.ate - p.desde) / DIA));
});

// Duas leituras do mesmo recorte, porque servem a coisas diferentes:
//   `rotuloPeriodo` = as datas, para o usuário conferir o filtro;
//   `janelaProsa`   = a expressão de período que o banco de frases encaixa depois
//                     de "nos" ("nos últimos 7 dias"), montada pelo motor.
const rotuloPeriodo = computed(() => {
  const { de, ate } = intervalo.value;
  return de === ate ? fmtDiaBr(de) : `${fmtDiaBr(de)} a ${fmtDiaBr(ate)}`;
});
const janelaProsa = computed(() => resposta.value?.periodo?.janela || rotuloPeriodo.value);

// '2026-08-04' -> '04/08/2026' (a string já está no fuso certo; Date.parse seria UTC).
function fmtDiaBr(iso) {
  const p = String(iso || '').split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

const dadosPeriodo = computed(() => {
  if (!resposta.value) return '';
  const total = FILA_ORDEM.reduce((s, f) => s + (resposta.value.relatorios?.[f]?.resumo?.partidas || 0), 0);
  return `${total} jogo(s) no total · ${diasDoPeriodo.value} dia(s)`;
});

// Jogos de cada fila no recorte ATUAL (o número que vai na aba).
function jogosDaFila(f) {
  return resposta.value?.relatorios?.[f]?.resumo?.partidas || 0;
}

// Prévia do chip: vem da lista (7/15/30 dias), somando as duas filas.
function previaDoPreset(campo) {
  const at = jogadorLocal.value?.atividade;
  if (!at) return 0;
  return FILA_ORDEM.reduce((s, f) => s + (Number(at[f]?.[campo]) || 0), 0);
}

// -------------------------------------------------------------------------
// NARRAÇÃO — o mesmo banco de frases do Discord, rodando no browser.
// O gerador devolve markdown leve (`**negrito**`); escapamos o HTML ANTES de
// converter, porque nome de campeão e nick vêm do banco.
// -------------------------------------------------------------------------
function escaparHtml(txt) {
  return String(txt)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const paragrafos = computed(() => {
  if (!analise.value) return [];
  const texto = gerarProsa(analise.value, janelaProsa.value, FILAS[fila.value]);
  return texto.split('\n\n').map((par) => escaparHtml(par).replace(/\*\*(.+?)\*\*/g, '<b class="text-slate-100">$1</b>'));
});

// -------------------------------------------------------------------------
// Apresentação
// -------------------------------------------------------------------------
const ROTULO_TENDENCIA = { wr: 'Vitórias', kda: 'KDA', csMin: 'CS/min', jogos: 'Jogos', ouro10: 'Ouro aos 10' };

const tendencias = computed(() => {
  const t = analise.value?.tend || {};
  return Object.keys(ROTULO_TENDENCIA)
    .filter((k) => t[k])
    .map((k) => ({
      label: ROTULO_TENDENCIA[k],
      agora: k === 'wr' ? `${t[k].agora}%` : t[k].agora,
      antes: k === 'wr' ? `${t[k].antes}%` : t[k].antes,
      delta: t[k].delta
    }));
});

// Subtítulo do KpiCard com a variação, quando existe período anterior.
function subTendencia(chave, sufixo = '') {
  const t = analise.value?.tend?.[chave];
  if (!t) return '';
  const sinal = t.delta > 0 ? '+' : '';
  return `${sinal}${t.delta}${sufixo} vs. anterior`;
}

function corWr(wr) {
  if (wr >= 55) return 'text-emerald-400';
  if (wr >= 48) return 'text-amber-300';
  return 'text-rose-400';
}
// `classificar` do motor devolve forte/mediano/fraco/na contra o benchmark da rota.
const COR_CLASSE = { forte: 'text-emerald-400', mediano: 'text-amber-300', fraco: 'text-rose-400', na: 'text-slate-400' };
function corClasse(c) {
  return COR_CLASSE[c] || 'text-slate-200';
}

// Nome pt-BR -> objeto do campeão (para a arte e para abrir a ficha única).
function champDoNome(nome) {
  const c = championByName(store.staticData.championList, nome);
  return c?.id ? c : null;
}

// ---------------------------------------------------------------------------
// GRÁFICOS
// Tudo abaixo deriva do que o Worker já mandou (série diária, lanes, met/classe e
// a grade de horarios). Nenhum gráfico custa uma requisição a mais.
// ---------------------------------------------------------------------------

// 1) Evolução: WR ACUMULADA (a que o elo sente) + KDA do dia. Mesma linguagem
// visual da aba de Análise (PlayerAnalysis), so que o eixo aqui é o calendário.
const evolucao = computed(() => {
  const dias = serie.value;
  if (dias.length < 2) return null;

  let jogos = 0;
  let vitorias = 0;
  const pontos = dias.map((d) => {
    jogos += d.jogos;
    vitorias += d.vitorias;
    return {
      rotulo: fmtDiaCurto(d.dia),
      jogos: d.jogos,
      wr: Math.round((vitorias / Math.max(1, jogos)) * 100),
      kda: Number(((d.k + d.a) / Math.max(1, d.d)).toFixed(2))
    };
  });

  const W = 320;
  const H = 168;
  const padX = 10;
  const padY = 14;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  // Folga de 15% no topo: sem isso um KDA constante (ou o maior do período) fica
  // colado na borda de cima e parece um bug de renderizacao.
  const maxKda = Math.max(3, ...pontos.map((p) => p.kda)) * 1.15;
  const xAt = (i) => (pontos.length === 1 ? W / 2 : padX + (i / (pontos.length - 1)) * innerW);
  const yWr = (v) => padY + (1 - v / 100) * innerH;
  const yKda = (v) => padY + (1 - v / maxKda) * innerH;

  const wrPts = pontos.map((p, i) => ({ ...p, x: xAt(i), y: yWr(p.wr) }));
  const kdaPts = pontos.map((p, i) => ({ ...p, x: xAt(i), y: yKda(p.kda) }));
  const linha = (pts) => pts.map((pt, i) => `${i ? 'L' : 'M'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
  const base = H - padY;

  return {
    W, H, y50: padY + 0.5 * innerH,
    wrPts, kdaPts,
    wrPath: linha(wrPts), kdaPath: linha(kdaPts),
    wrArea: `${linha(wrPts)} L${wrPts[wrPts.length - 1].x.toFixed(1)} ${base} L${wrPts[0].x.toFixed(1)} ${base} Z`
  };
});

// 2) Radar contra o BENCH da rota principal - a MESMA régua que classifica as
// métricas na prosa e colore os KPIs, agora em forma de polígono.
// Normalização: 100 = topo da faixa "forte" da rota; o eixo satura em 130 para um
// outlier não achatar os outros. csMin some no suporte (BENCH.csMin = null).
const radarRota = computed(() => {
  const a = analise.value;
  if (!a) return [];
  const bench = BENCH[a.rotaPrinc] || BENCH.MIDDLE;
  const eixo = (label, valor, faixa, bruto) => {
    const teto = Array.isArray(faixa) ? faixa[1] : faixa;
    return { label, value: Math.min(130, Math.round((valor / (teto || 1)) * 100)), bruto };
  };
  const eixos = [];
  if (bench.csMin) eixos.push({ ...eixo('Farm', a.met.csMin, bench.csMin, `${a.met.csMin}/min`), classe: a.classe.csMin });
  eixos.push({ ...eixo('Visão', a.met.visMin, bench.visMin, `${a.met.visMin}/min`), classe: a.classe.visMin });
  eixos.push({ ...eixo('Participação', a.met.kp, bench.kp, `${Math.round(a.met.kp * 100)}%`), classe: a.classe.kp });
  eixos.push({ ...eixo('KDA', a.met.kda, bench.kda, a.met.kda.toFixed(2)), classe: a.classe.kda });
  // Sem régua própria: escalonados contra referências tipicas de SoloQ.
  eixos.push({ ...eixo('Ouro/min', a.met.gpm, 420, String(a.met.gpm)), classe: 'na' });
  eixos.push({ ...eixo('Dano', a.met.dmg, 22000, fmtMilhar(a.met.dmg)), classe: 'na' });
  return eixos;
});

// 3) Rosca de distribuição por rota (mesmo desenho da aba de Análise).
const COR_ROTA = { TOP: '#f59e0b', JUNGLE: '#10b981', MIDDLE: '#8b5cf6', BOTTOM: '#06b6d4', UTILITY: '#f43f5e' };
const rotaDonut = computed(() => {
  const lanes = analise.value?.lanes || [];
  const total = lanes.reduce((soma, l) => soma + l.n, 0);
  if (!total) return { total: 0, lista: [], segmentos: [] };

  const CIRC = 2 * Math.PI * 54;
  let acumulado = 0;
  const lista = lanes.map((l) => ({ ...l, cor: COR_ROTA[l.rota] || '#64748b', pct: Math.round((l.n / total) * 100) }));
  const segmentos = lista.map((l) => {
    const dash = (l.n / total) * CIRC;
    const seg = { rota: l.rota, cor: l.cor, dash, gap: CIRC - dash, offset: -acumulado };
    acumulado += dash;
    return seg;
  });
  return { total, lista, segmentos };
});

// 4) Mapa de calor dia da semana x faixa do dia. A grade vem crua do Worker
// (horariosGrade); aqui vira cor (WR) + opacidade (volume).
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const FAIXAS_LABEL = ['Madrug.', 'Manhã', 'Tarde', 'Noite'];
const mapaCalor = computed(() => {
  const grade = analise.value?.horariosGrade || [];
  const porCelula = new Map(grade.map((g) => [`${g.dia}|${g.faixa}`, g]));
  const maxN = Math.max(1, ...grade.map((g) => g.n));

  const celula = (dia, faixa) => {
    const c = porCelula.get(`${dia}|${faixa}`);
    if (!c || !c.n) {
      return { estilo: { background: 'rgb(30 41 59 / 0.5)' }, texto: '', titulo: `${DIAS_CURTOS[dia]} ${FAIXAS_LABEL[faixa]}: sem jogos` };
    }
    const wr = Math.round((c.v / c.n) * 100);
    // Cor pela WR, opacidade pelo volume (piso de 0.35 para 1 jogo não sumir).
    const cor = wr >= 55 ? '16 185 129' : wr >= 45 ? '245 158 11' : '244 63 94';
    const alpha = 0.35 + 0.65 * (c.n / maxN);
    return {
      estilo: { background: `rgb(${cor} / ${alpha.toFixed(2)})` },
      texto: String(c.n),
      titulo: `${DIAS_CURTOS[dia]} ${FAIXAS_LABEL[faixa]}: ${c.n} jogo(s), ${wr}% de vitória`
    };
  };
  return { temDados: grade.length > 0, celula };
});

// Barras do dia a dia, proporcionais ao dia mais cheio do recorte.
const maxJogosDia = computed(() => Math.max(1, ...serie.value.map((d) => d.jogos)));
function alturaBarra(d) {
  return `${Math.max(6, Math.round((d.jogos / maxJogosDia.value) * 100))}px`;
}
function fatiaVitorias(d) {
  return d.jogos ? `${Math.round((d.vitorias / d.jogos) * 100)}%` : '0%';
}
// '2026-08-04' -> '04/08' (a string já vem fechada no fuso certo pelo SQL).
function fmtDiaCurto(iso) {
  const p = String(iso).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso;
}
</script>
