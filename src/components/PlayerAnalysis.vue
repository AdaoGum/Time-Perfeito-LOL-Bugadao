<template>
  <div class="space-y-5">

    <!-- ============================ FILTROS ============================ -->
    <section class="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-4 shadow-xl">
      <div class="flex flex-col gap-3">

        <!-- Quantidade de partidas -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Amostra</span>
          <div class="flex gap-1 rounded-lg border border-slate-700 bg-slate-950 p-0.5">
            <button v-for="s in SAMPLE_SIZES" :key="s"
              type="button"
              @click="sampleSize = s"
              :disabled="!sizeEnabled(s)"
              :title="sizeEnabled(s) ? `Analisar ${s === 'all' ? 'todas as' : 'as últimas ' + s} partidas filtradas` : 'Sem partidas suficientes'"
              class="rounded-md px-3 py-1 text-[11px] font-bold transition"
              :class="sampleSize === s ? 'bg-blue-600 text-white' : (sizeEnabled(s) ? 'text-slate-400 hover:text-slate-200' : 'cursor-not-allowed text-slate-600 opacity-40')"
            >{{ s === 'all' ? 'Todas' : s }}</button>
          </div>
          <span class="text-[11px] font-semibold text-slate-500">{{ sample.length }} de {{ filteredAll.length }} jogos analisados</span>
        </div>

        <!-- Rota -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Rota</span>
          <div class="flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-950 p-0.5">
            <button v-for="r in ROLE_BUTTONS" :key="r.value"
              type="button"
              @click="roleFilter = r.value"
              class="flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-bold transition"
              :class="roleFilter === r.value ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'"
            >
              <img v-if="r.icon" :src="r.icon" class="h-3.5 w-3.5 brightness-200" :alt="r.label" />
              {{ r.label }}
            </button>
          </div>
        </div>

        <!-- Fila + Campeão -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Fila</span>
            <select v-model="queueFilter"
              class="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-bold text-slate-200 focus:border-blue-500 focus:outline-none">
              <option value="ALL">Todas as filas</option>
              <option value="SOLO">Ranqueada Solo/Duo</option>
              <option value="FLEX">Ranqueada Flex</option>
              <option value="NORMAL">Normais</option>
              <option value="ARAM">ARAM</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Campeão</span>
            <select v-model="championFilter"
              class="max-w-[180px] rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-bold text-slate-200 focus:border-blue-500 focus:outline-none">
              <option value="ALL">Todos os campeões</option>
              <option v-for="c in championOptions" :key="c.name" :value="c.name">{{ c.name }} ({{ c.games }})</option>
            </select>
          </div>

          <button v-if="hasActiveFilters" type="button" @click="resetFilters"
            class="rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] font-bold text-amber-300 transition hover:bg-slate-800">
            <i class="fa-solid fa-xmark mr-1"></i> Limpar filtros
          </button>
        </div>
      </div>
    </section>

    <!-- ===================== ESTADO VAZIO ===================== -->
    <div v-if="!agg" class="rounded-2xl border border-slate-800 bg-slate-900/80 p-10 text-center">
      <p class="mb-2 text-3xl text-slate-500"><i class="fa-solid fa-bone"></i></p>
      <p class="font-bold text-slate-300">Nenhuma partida para os filtros selecionados.</p>
      <p class="text-xs text-slate-500 mt-1">Os ancestrais ainda estão sincronizando o histórico — ele se enche durante a busca da madrugada.</p>
    </div>

    <template v-else>
      <!-- ===================== CARDS DE RESUMO (5 em cima, 5 embaixo) ===================== -->
      <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black" :class="agg.winRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ agg.winRate }}%</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Win Rate</div>
          <div class="text-[10px] text-slate-500">{{ agg.wins }}V / {{ agg.losses }}D</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-emerald-400">{{ agg.kda }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">KDA</div>
          <div class="text-[10px] text-slate-500">{{ agg.avgKills }}/{{ agg.avgDeaths }}/{{ agg.avgAssists }}</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-amber-400">{{ agg.csMin }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">CS / min</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-cyan-300">{{ agg.primaryRole }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Rota Principal</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-teal-300">{{ agg.kp }}%</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Participação</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-slate-200">{{ agg.avgKills }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Abates / jogo</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-slate-200">{{ agg.avgDeaths }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Mortes / jogo</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-indigo-300">{{ agg.avgVision }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Visão / jogo</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-yellow-300">{{ agg.goldPerMin }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Ouro / min</div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-center">
          <div class="text-2xl font-black text-rose-300">{{ formatK(agg.avgDmg) }}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Dano / jogo</div>
        </div>
      </section>

      <!-- ===================== ROTAS & CAMPEÕES (segue os filtros do topo) ===================== -->
      <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
        <h3 class="mb-1 flex items-center gap-2 text-sm font-bold text-slate-100"><i class="fa-solid fa-crown text-yellow-400"></i> Rotas &amp; Campeões</h3>
        <p class="mb-3 text-[11px] text-slate-500">Top rotas e melhores campeões por função — <b class="text-slate-300">{{ queueLabel }}</b>, {{ sample.length }} jogos na amostra (segue os filtros acima).</p>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">

          <!-- Card 1: TOP 3 ROTAS na amostra filtrada -->
          <div class="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div class="mb-2 flex items-center gap-2 border-b border-slate-800 pb-2">
              <i class="fa-solid fa-ranking-star text-emerald-400"></i>
              <span class="text-xs font-black uppercase tracking-wide text-emerald-300">Top Rotas</span>
              <span class="ml-auto text-[10px] font-semibold text-slate-500">{{ laneBreakdown.total }} jogos</span>
            </div>
            <div v-if="laneBreakdown.roles.length" class="space-y-2">
              <div v-for="r in laneBreakdown.roles" :key="r.role" class="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                <div class="mb-2 flex items-center gap-2">
                  <img :src="miniRoleIcon(r.role)" class="h-4 w-4 brightness-200" :alt="r.label" />
                  <span class="text-sm font-bold text-slate-200">{{ r.label }}</span>
                  <span class="ml-auto text-[10px] text-slate-500">{{ r.games }}j · {{ r.wins }}V/{{ r.losses }}D</span>
                </div>
                <div class="grid grid-cols-4 gap-1 text-center">
                  <div><div class="text-sm font-black" :class="r.winRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ r.winRate }}%</div><div class="text-[8px] font-bold uppercase tracking-wide text-slate-500">WR</div></div>
                  <div><div class="text-sm font-black text-emerald-400">{{ r.kda }}</div><div class="text-[8px] font-bold uppercase tracking-wide text-slate-500">KDA</div></div>
                  <div><div class="text-sm font-black text-amber-400">{{ r.csMin }}</div><div class="text-[8px] font-bold uppercase tracking-wide text-slate-500">CS/m</div></div>
                  <div><div class="text-sm font-black text-teal-300">{{ r.kp }}%</div><div class="text-[8px] font-bold uppercase tracking-wide text-slate-500">KP</div></div>
                </div>
              </div>
            </div>
            <p v-else class="py-6 text-center text-xs text-slate-500">Sem partidas com rota definida na amostra.</p>
          </div>

          <!-- Cards 2..6: um por função presente na amostra, com os top 3 campeões (dados ricos) -->
          <div v-for="fn in roleChampionBreakdown" :key="fn.role" class="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div class="mb-2 flex items-center gap-2 border-b border-slate-800 pb-2">
              <img :src="miniRoleIcon(fn.role)" class="h-4 w-4 brightness-200" :alt="fn.label" />
              <span class="text-xs font-black uppercase tracking-wide" :style="{ color: fn.color }">{{ fn.label }}</span>
              <span class="ml-auto text-[10px] font-semibold text-slate-500">{{ fn.games }} jogos</span>
            </div>
            <div class="space-y-2">
              <div v-for="c in fn.champions" :key="c.name" class="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                <div class="mb-1.5 flex items-center gap-2">
                  <img :src="championImage(c.name)" class="h-8 w-8 flex-shrink-0 rounded-full border border-slate-600" :alt="c.name" loading="lazy" />
                  <span class="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">{{ c.name }}</span>
                  <span class="flex-shrink-0 text-sm font-black" :class="c.winRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ c.winRate }}%</span>
                </div>
                <div class="grid grid-cols-3 gap-1 text-center">
                  <div><div class="text-[11px] font-black text-slate-300">{{ c.games }}</div><div class="text-[7px] font-bold uppercase tracking-wide text-slate-500">Jogos</div></div>
                  <div><div class="text-[11px] font-black text-emerald-400">{{ c.kda }}</div><div class="text-[7px] font-bold uppercase tracking-wide text-slate-500">KDA</div></div>
                  <div><div class="text-[11px] font-black text-amber-400">{{ c.csMin }}</div><div class="text-[7px] font-bold uppercase tracking-wide text-slate-500">CS/m</div></div>
                  <div><div class="text-[11px] font-black text-rose-300">{{ formatK(c.avgDmg) }}</div><div class="text-[7px] font-bold uppercase tracking-wide text-slate-500">Dano</div></div>
                  <div><div class="text-[11px] font-black text-teal-300">{{ c.kp }}%</div><div class="text-[7px] font-bold uppercase tracking-wide text-slate-500">KP</div></div>
                  <div><div class="text-[11px] font-black text-yellow-300">{{ c.goldPerMin }}</div><div class="text-[7px] font-bold uppercase tracking-wide text-slate-500">Ouro/m</div></div>
                </div>
                <div class="mt-1 text-center text-[9px] text-slate-500">{{ c.wins }}V/{{ c.losses }}D · KDA {{ c.avgKills }}/{{ c.avgDeaths }}/{{ c.avgAssists }} · Visão {{ c.avgVision }}</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <!-- ===== LINHA A: TOP ROTAS | DISTRIBUIÇÃO POR ROTA | EVOLUÇÃO ===== -->
      <div class="grid gap-4 lg:grid-cols-3 items-stretch">

        <!-- Top Rotas (vitórias x derrotas por rota) -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <h3 class="mb-1 flex items-center gap-2 text-sm font-bold text-slate-100"><i class="fa-solid fa-route text-emerald-400"></i> Top Rotas</h3>
          <p class="mb-3 text-[11px] text-slate-500">Vitórias x derrotas por posição na amostra.</p>
          <div v-if="roleBars.length">
            <div class="flex h-32 items-stretch justify-around gap-2 px-2">
              <div v-for="r in roleBars" :key="r.role" class="flex h-full flex-1 items-end justify-center gap-1">
                <div class="w-3 rounded-t bg-emerald-500" :style="{ height: `${Math.max(4, (r.wins / maxRoleGames) * 100)}%` }" :title="`${r.wins} vitórias`"></div>
                <div class="w-3 rounded-t bg-rose-500" :style="{ height: `${Math.max(4, (r.losses / maxRoleGames) * 100)}%` }" :title="`${r.losses} derrotas`"></div>
              </div>
            </div>
            <div class="mt-1 flex justify-around gap-2 border-t border-dashed border-slate-700 px-2 pt-2">
              <div v-for="r in roleBars" :key="r.role" class="flex flex-1 flex-col items-center gap-0.5">
                <img :src="miniRoleIcon(r.role)" class="h-4 w-4 opacity-90 brightness-200" :alt="r.label" :title="r.label" />
                <span class="text-[10px] font-bold text-slate-300">{{ r.games }}</span>
                <span class="text-[10px] font-black" :class="r.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'">{{ r.winRate }}%</span>
              </div>
            </div>
          </div>
          <p v-else class="py-8 text-center text-xs text-slate-500">Sem partidas com rota definida (ex.: ARAM) na amostra.</p>
        </section>

        <!-- Donut de rotas -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <h3 class="mb-1 flex items-center gap-2 text-sm font-bold text-slate-100"><i class="fa-solid fa-compass text-amber-400"></i> Distribuição por Rota</h3>
          <p class="mb-3 text-[11px] text-slate-500">Partidas e win rate por posição na amostra.</p>
          <div v-if="roleData.total" class="flex flex-col items-center gap-3">
            <svg viewBox="0 0 140 140" class="h-36 w-36 flex-shrink-0">
              <g transform="rotate(-90 70 70)">
                <circle v-for="s in roleData.segments" :key="s.role"
                  cx="70" cy="70" r="54" fill="none" :stroke="s.color" stroke-width="18"
                  :stroke-dasharray="`${s.dash.toFixed(2)} ${s.gap.toFixed(2)}`"
                  :stroke-dashoffset="s.offset.toFixed(2)" />
              </g>
              <text x="70" y="66" text-anchor="middle" class="fill-white" style="font-size:20px;font-weight:800">{{ roleData.total }}</text>
              <text x="70" y="83" text-anchor="middle" class="fill-slate-400" style="font-size:8px;font-weight:700">JOGOS C/ ROTA</text>
            </svg>
            <div class="w-full space-y-1.5">
              <div v-for="r in roleData.list" :key="r.role" class="flex items-center gap-2 text-[11px]">
                <span class="h-3 w-3 flex-shrink-0 rounded-sm" :style="{ background: r.color }"></span>
                <span class="font-bold text-slate-200 w-10">{{ r.label }}</span>
                <span class="text-slate-500">{{ r.games }}j ({{ r.pct }}%)</span>
                <span class="ml-auto font-black" :class="r.winRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ r.winRate }}%</span>
              </div>
            </div>
          </div>
          <p v-else class="py-8 text-center text-xs text-slate-500">Sem partidas com rota definida (ex.: ARAM) na amostra.</p>
        </section>

        <!-- Linha de evolução (compacta) -->
        <section v-if="trend" class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 class="flex items-center gap-2 text-sm font-bold text-slate-100"><i class="fa-solid fa-chart-line text-blue-400"></i> Evolução ao Longo do Tempo</h3>
            <div class="flex items-center gap-3 text-[10px] font-bold">
              <span class="flex items-center gap-1"><span class="h-2 w-4 rounded-sm bg-blue-500"></span>WR</span>
              <span class="flex items-center gap-1"><span class="h-0 w-4 border-t-2 border-dashed border-amber-400"></span>KDA</span>
            </div>
          </div>
          <p class="mb-3 text-[11px] text-slate-500">Da mais antiga (esq.) à mais recente (dir.), em {{ trend.blocks.length }} blocos.</p>
          <svg :viewBox="`0 0 ${trend.W} ${trend.H}`" class="h-auto w-full">
            <line :x1="0" :x2="trend.W" :y1="trend.y50" :y2="trend.y50" stroke="#475569" stroke-width="1" stroke-dasharray="3 3" />
            <text :x="2" :y="trend.y50 - 3" class="fill-slate-500" style="font-size:7px;font-weight:700">50%</text>
            <path :d="trend.wrArea" fill="#3b82f626" />
            <path :d="trend.wrPath" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" />
            <path :d="trend.kdaPath" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round" stroke-dasharray="4 3" />
            <circle v-for="(p, i) in trend.wrPts" :key="'w' + i" :cx="p.x" :cy="p.y" r="2.5" fill="#3b82f6">
              <title>Bloco {{ i + 1 }}: {{ p.wr }}% WR ({{ p.games }} jogos)</title>
            </circle>
            <circle v-for="(p, i) in trend.kdaPts" :key="'k' + i" :cx="p.x" :cy="p.y" r="2.5" fill="#f59e0b">
              <title>Bloco {{ i + 1 }}: {{ p.kda }} KDA</title>
            </circle>
          </svg>
        </section>
      </div>

      <!-- ===== LINHA B: PERFIL DE JOGO (GPI) | GPI DETALHADO | DESTAQUES DE COMBATE ===== -->
      <div class="grid gap-4 lg:grid-cols-3 items-stretch">

        <!-- Radar GPI clássico (Perfil de Jogo) -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <h3 class="mb-1 flex items-center gap-2 text-sm font-bold text-slate-100"><i class="fa-solid fa-chart-pie text-amber-400"></i> Perfil de Jogo (GPI)</h3>
          <p class="mb-3 text-[11px] text-slate-500">Win rate, KDA, farm, agressão, sobrevivência, participação e versatilidade.</p>
          <div class="mx-auto w-full max-w-[220px]">
            <RadarChart :axes="radarProfile" :size="220" color="#f59e0b" />
          </div>
        </section>

        <!-- Radar GPI detalhado (combate & recursos) -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <h3 class="mb-1 flex items-center gap-2 text-sm font-bold text-slate-100"><i class="fa-solid fa-satellite-dish text-cyan-400"></i> GPI — Combate & Recursos</h3>
          <p class="mb-3 text-[11px] text-slate-500">Inclui visão e ouro/min, normalizados de 0 a 100 na amostra atual.</p>
          <div class="mx-auto w-full max-w-[220px]">
            <RadarChart :axes="radar" :size="220" color="#38bdf8" />
          </div>
        </section>

        <!-- Multikills (Destaques de Combate) -->
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
          <h3 class="mb-1 flex items-center gap-2 text-sm font-bold text-slate-100"><i class="fa-solid fa-burst text-rose-400"></i> Destaques de Combate</h3>
          <p class="mb-3 text-[11px] text-slate-500">Total de abates especiais acumulados na amostra.</p>
          <div class="flex h-36 items-end justify-around gap-3 border-b border-slate-800 px-2 pb-1">
            <div v-for="b in multiBars" :key="b.label" class="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span class="text-[11px] font-black text-slate-200">{{ b.value }}</span>
              <div class="w-full max-w-[34px] rounded-t transition-all duration-700" :class="b.color" :style="{ height: `${Math.max(2, b.pct)}%` }"></div>
            </div>
          </div>
          <div class="mt-1 flex justify-around gap-3 px-2">
            <span v-for="b in multiBars" :key="b.label" class="flex-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-400">{{ b.label }}</span>
          </div>
        </section>
      </div>

      <!-- ===================== TABELA: BARRAS DE CAMPEÕES ===================== -->
      <section class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
        <h3 class="mb-1 flex items-center gap-2 text-sm font-bold text-slate-100"><i class="fa-solid fa-hand-fist text-red-400"></i> Desempenho por Campeão</h3>
        <p class="mb-3 text-[11px] text-slate-500">Top {{ champBars.length }} campeões mais jogados na amostra — barra azul = % de vitórias.</p>
        <div class="space-y-2.5">
          <div v-for="c in champBars" :key="c.name">
            <div class="mb-1 flex items-center justify-between text-[11px]">
              <div class="flex min-w-0 items-center gap-2">
                <img :src="championImage(c.name)" class="h-6 w-6 flex-shrink-0 rounded-full border border-slate-600" :alt="c.name" loading="lazy" />
                <span class="truncate font-bold text-slate-200">{{ c.name }}</span>
                <span class="flex-shrink-0 text-slate-500">{{ c.games }}j</span>
              </div>
              <div class="flex flex-shrink-0 items-center gap-3">
                <span class="hidden sm:inline text-slate-400">{{ c.csMin }} cs/m</span>
                <span class="font-bold" :class="c.kda >= 4 ? 'text-amber-400' : 'text-slate-300'">{{ c.kda }} KDA</span>
                <span class="w-9 text-right font-black" :class="c.winRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ c.winRate }}%</span>
              </div>
            </div>
            <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-rose-900/40">
              <div class="h-full bg-blue-500 transition-all duration-700" :style="{ width: c.winRate + '%' }"></div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { state } from '../store.js';
import { championImage } from '../utils.js';
import RadarChart from './RadarChart.vue';

const store = state;
const num = (v) => Number(v || 0);
const formatK = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v)));

const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Sup' };
const ROLE_COLORS = { TOP: '#f59e0b', JUNGLE: '#22c55e', MIDDLE: '#06b6d4', BOTTOM: '#f43f5e', UTILITY: '#a855f7' };
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
const SAMPLE_SIZES = [20, 50, 100, 200, 'all'];

const miniRoleIcon = (pos) => {
  const map = { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'middle', BOTTOM: 'bottom', UTILITY: 'utility' };
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${map[pos]}.png`;
};
const ROLE_BUTTONS = [
  { value: 'ALL', label: 'Todas', icon: null },
  ...ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r], icon: miniRoleIcon(r) }))
];

// -------------------- Filtros --------------------
const sampleSize = ref(50);
const roleFilter = ref('ALL');
const championFilter = ref('ALL');
const queueFilter = ref('ALL');

const proficiency = computed(() => store.searchProfile.proficiencyMatches || []);

const hasActiveFilters = computed(() =>
  roleFilter.value !== 'ALL' || championFilter.value !== 'ALL' || queueFilter.value !== 'ALL'
);
function resetFilters() {
  roleFilter.value = 'ALL';
  championFilter.value = 'ALL';
  queueFilter.value = 'ALL';
}

// Habilita uma amostra somente quando há jogos suficientes no total (mantém 'all' e o menor sempre)
const sizeEnabled = (s) => s === 'all' || s === SAMPLE_SIZES[0] || proficiency.value.length >= s;

// Ao trocar de jogador: zera filtros e escolhe a maior amostra preset disponível
watch(() => store.searchProfile.puuid, () => {
  resetFilters();
  const n = proficiency.value.length;
  sampleSize.value = n >= 100 ? 100 : n >= 50 ? 50 : n >= 20 ? 20 : 'all';
}, { immediate: true });

const queuePredicate = (m) => {
  const q = num(m.queueId);
  switch (queueFilter.value) {
    case 'SOLO': return q === 420;
    case 'FLEX': return q === 440;
    case 'NORMAL': return q === 400 || q === 430;
    case 'ARAM': return q === 450;
    default: return true;
  }
};

const byRoleQueue = computed(() => proficiency.value.filter((m) => {
  if (!queuePredicate(m)) return false;
  if (roleFilter.value !== 'ALL' && m.teamPosition !== roleFilter.value) return false;
  return true;
}));

const championOptions = computed(() => {
  const counts = {};
  for (const m of byRoleQueue.value) {
    if (m.championName) counts[m.championName] = (counts[m.championName] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, games]) => ({ name, games }));
});

// Se o campeão selecionado some ao mudar rota/fila, volta para "Todos"
watch([roleFilter, queueFilter], () => {
  if (championFilter.value !== 'ALL' && !championOptions.value.some((c) => c.name === championFilter.value)) {
    championFilter.value = 'ALL';
  }
});

const filteredAll = computed(() =>
  byRoleQueue.value.filter((m) => championFilter.value === 'ALL' || m.championName === championFilter.value)
);

// Amostra final (proficiency já vem ordenada da mais recente para a mais antiga)
const sample = computed(() => sampleSize.value === 'all' ? filteredAll.value : filteredAll.value.slice(0, sampleSize.value));

// -------------------- Agregados --------------------
const agg = computed(() => {
  const ms = sample.value;
  const n = ms.length;
  if (!n) return null;
  let wins = 0, k = 0, d = 0, a = 0, cs = 0, dur = 0, gold = 0, dmg = 0, vision = 0, control = 0, timeDead = 0;
  let dbl = 0, tpl = 0, qd = 0, pt = 0, solo = 0;
  let gpmSum = 0, gpmCnt = 0, kpSum = 0, kpCnt = 0;
  const roles = {};
  for (const m of ms) {
    if (m.win) wins++;
    k += num(m.kills); d += num(m.deaths); a += num(m.assists);
    cs += num(m.cs); dur += num(m.gameDuration);
    gold += num(m.goldEarned); dmg += num(m.damageChampions);
    vision += num(m.visionScore); control += num(m.controlWards); timeDead += num(m.totalTimeSpentDead);
    dbl += num(m.doubleKills); tpl += num(m.tripleKills); qd += num(m.quadraKills); pt += num(m.pentaKills); solo += num(m.soloKills);
    if (m.goldPerMin) { gpmSum += num(m.goldPerMin); gpmCnt++; }
    if (m.killParticipation != null) { kpSum += num(m.killParticipation); kpCnt++; }
    if (ROLES.includes(m.teamPosition)) roles[m.teamPosition] = (roles[m.teamPosition] || 0) + 1;
  }
  const kda = d === 0 ? (k + a) : (k + a) / d;
  const csMin = dur > 0 ? cs / (dur / 60) : 0;
  const topRole = Object.entries(roles).sort((x, y) => y[1] - x[1])[0]?.[0];
  return {
    games: n, wins, losses: n - wins, winRate: Math.round(wins / n * 100),
    kda: +kda.toFixed(2),
    avgKills: +(k / n).toFixed(1), avgDeaths: +(d / n).toFixed(1), avgAssists: +(a / n).toFixed(1),
    primaryRole: topRole ? ROLE_LABELS[topRole] : '—',
    csMin: +csMin.toFixed(1),
    goldPerMin: gpmCnt ? Math.round(gpmSum / gpmCnt) : (dur > 0 ? Math.round(gold / (dur / 60)) : 0),
    avgDmg: Math.round(dmg / n),
    avgVision: +(vision / n).toFixed(1),
    avgControl: +(control / n).toFixed(1),
    kp: kpCnt ? Math.round(kpSum / kpCnt * 100) : 0,
    multi: { double: dbl, triple: tpl, quadra: qd, penta: pt, solo },
    distinctChamps: new Set(ms.map((m) => m.championName).filter(Boolean)).size
  };
});

// -------------------- Radar GPI --------------------
const radar = computed(() => {
  const a = agg.value;
  if (!a) return [];
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  return [
    { label: 'Win Rate', value: clamp(a.winRate) },
    { label: 'KDA', value: clamp(a.kda / 5 * 100) },
    { label: 'Farm', value: clamp(a.csMin / 10 * 100) },
    { label: 'Agressão', value: clamp(a.avgKills / 12 * 100) },
    { label: 'Sobrevivência', value: clamp(100 - a.avgDeaths / 12 * 100) },
    { label: 'Visão', value: clamp(a.avgVision / 60 * 100) },
    { label: 'Ouro/min', value: clamp(a.goldPerMin / 500 * 100) },
    { label: 'Participação', value: clamp(a.kp) }
  ];
});

// -------------------- Radar GPI clássico (Perfil de Jogo) --------------------
const radarProfile = computed(() => {
  const a = agg.value;
  if (!a) return [];
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  return [
    { label: 'Win Rate', value: clamp(a.winRate) },
    { label: 'KDA', value: clamp(a.kda / 5 * 100) },
    { label: 'Farm', value: clamp(a.csMin / 10 * 100) },
    { label: 'Agressão', value: clamp(a.avgKills / 12 * 100) },
    { label: 'Sobrevivência', value: clamp(100 - a.avgDeaths / 12 * 100) },
    { label: 'Participação', value: clamp(a.avgAssists / 15 * 100) },
    { label: 'Versatilidade', value: clamp(a.distinctChamps / 15 * 100) }
  ];
});

// -------------------- Barras de campeões --------------------
const champBars = computed(() => {
  const map = {};
  for (const m of sample.value) {
    const name = m.championName;
    if (!name) continue;
    const c = map[name] || (map[name] = { name, games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0, dur: 0 });
    c.games++; if (m.win) c.wins++;
    c.k += num(m.kills); c.d += num(m.deaths); c.a += num(m.assists);
    c.cs += num(m.cs); c.dur += num(m.gameDuration);
  }
  return Object.values(map).map((c) => ({
    name: c.name, games: c.games, wins: c.wins, losses: c.games - c.wins,
    winRate: Math.round(c.wins / c.games * 100),
    kda: +(c.d === 0 ? (c.k + c.a) : (c.k + c.a) / c.d).toFixed(2),
    csMin: +(c.dur > 0 ? c.cs / (c.dur / 60) : 0).toFixed(1)
  })).sort((a, b) => b.games - a.games).slice(0, 10);
});

// -------------------- Donut de rotas --------------------
const roleData = computed(() => {
  const counts = {};
  let total = 0;
  for (const m of sample.value) {
    const r = m.teamPosition;
    if (!ROLES.includes(r)) continue;
    counts[r] = (counts[r] || 0) + 1;
    total++;
  }
  if (!total) return { total: 0, segments: [], list: [] };
  const C = 2 * Math.PI * 54;
  const list = ROLES.filter((r) => counts[r]).map((r) => {
    const games = counts[r];
    const wins = sample.value.filter((m) => m.teamPosition === r && m.win).length;
    return { role: r, label: ROLE_LABELS[r], color: ROLE_COLORS[r], games, wins, winRate: Math.round(wins / games * 100), pct: Math.round(games / total * 100) };
  }).sort((a, b) => b.games - a.games);
  let offset = 0;
  const segments = list.map((item) => {
    const dash = (item.games / total) * C;
    const seg = { ...item, dash, gap: C - dash, offset: -offset };
    offset += dash;
    return seg;
  });
  return { total, segments, list };
});

// -------------------- Top Rotas (barras vitória/derrota por rota) --------------------
const roleBars = computed(() => roleData.value.list.map((r) => ({ ...r, losses: r.games - r.wins })));
const maxRoleGames = computed(() => Math.max(1, ...roleBars.value.map((r) => r.games)));

// -------------------- Linha de evolução --------------------
const trend = computed(() => {
  const ms = [...sample.value].reverse(); // mais antiga -> mais recente
  const n = ms.length;
  if (n < 2) return null;
  const buckets = Math.min(12, n);
  const per = Math.ceil(n / buckets);
  const blocks = [];
  for (let i = 0; i < n; i += per) {
    const chunk = ms.slice(i, i + per);
    let wins = 0, k = 0, d = 0, a = 0;
    for (const m of chunk) { if (m.win) wins++; k += num(m.kills); d += num(m.deaths); a += num(m.assists); }
    const kda = d === 0 ? (k + a) : (k + a) / d;
    blocks.push({ wr: Math.round(wins / chunk.length * 100), kda: +kda.toFixed(2), games: chunk.length });
  }
  const W = 320, H = 130, padX = 10, padY = 14;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const maxKda = Math.max(3, ...blocks.map((b) => b.kda));
  const xAt = (i) => blocks.length === 1 ? W / 2 : padX + (i / (blocks.length - 1)) * innerW;
  const yWr = (v) => padY + (1 - v / 100) * innerH;
  const yKda = (v) => padY + (1 - v / maxKda) * innerH;
  const wrPts = blocks.map((b, i) => ({ x: xAt(i), y: yWr(b.wr), ...b }));
  const kdaPts = blocks.map((b, i) => ({ x: xAt(i), y: yKda(b.kda), ...b }));
  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const baseY = H - padY;
  const wrArea = `${line(wrPts)} L${wrPts[wrPts.length - 1].x.toFixed(1)} ${baseY} L${wrPts[0].x.toFixed(1)} ${baseY} Z`;
  return { W, H, y50: padY + 0.5 * innerH, wrPts, kdaPts, wrPath: line(wrPts), kdaPath: line(kdaPts), wrArea, blocks };
});

// -------------------- Multikills --------------------
const multiBars = computed(() => {
  const a = agg.value;
  if (!a) return [];
  const m = a.multi;
  const items = [
    { label: 'Solo', value: m.solo, color: 'bg-cyan-500' },
    { label: 'Double', value: m.double, color: 'bg-emerald-500' },
    { label: 'Triple', value: m.triple, color: 'bg-amber-500' },
    { label: 'Quadra', value: m.quadra, color: 'bg-orange-500' },
    { label: 'Penta', value: m.penta, color: 'bg-rose-500' }
  ];
  const max = Math.max(1, ...items.map((i) => i.value));
  return items.map((i) => ({ ...i, pct: Math.round(i.value / max * 100) }));
});

// -------------------- Rotas & campeões (seguem os filtros do topo via `sample`) --------------------
// Rankeiam por nº de jogos (mais representativo) dentro da amostra filtrada.
function aggregateStats(matches) {
  const n = matches.length;
  let wins = 0, k = 0, d = 0, a = 0, cs = 0, dur = 0, dmg = 0, vision = 0, control = 0;
  let gpmSum = 0, gpmCnt = 0, kpSum = 0, kpCnt = 0;
  for (const m of matches) {
    if (m.win) wins++;
    k += num(m.kills); d += num(m.deaths); a += num(m.assists);
    cs += num(m.cs); dur += num(m.gameDuration);
    dmg += num(m.damageChampions); vision += num(m.visionScore); control += num(m.controlWards);
    if (m.goldPerMin) { gpmSum += num(m.goldPerMin); gpmCnt++; }
    if (m.killParticipation != null) { kpSum += num(m.killParticipation); kpCnt++; }
  }
  const kda = d === 0 ? (k + a) : (k + a) / d;
  return {
    games: n, wins, losses: n - wins, winRate: Math.round(wins / n * 100),
    kda: +kda.toFixed(2),
    avgKills: +(k / n).toFixed(1), avgDeaths: +(d / n).toFixed(1), avgAssists: +(a / n).toFixed(1),
    csMin: +(dur > 0 ? cs / (dur / 60) : 0).toFixed(1),
    avgDmg: Math.round(dmg / n),
    avgVision: +(vision / n).toFixed(1),
    avgControl: +(control / n).toFixed(1),
    goldPerMin: gpmCnt ? Math.round(gpmSum / gpmCnt) : 0,
    kp: kpCnt ? Math.round(kpSum / kpCnt * 100) : 0
  };
}

// Rótulo da fila atualmente selecionada no filtro (aparece no subtítulo do card).
const QUEUE_LABELS = { ALL: 'Todas as filas', SOLO: 'Ranqueada Solo/Duo', FLEX: 'Ranqueada Flex', NORMAL: 'Normais', ARAM: 'ARAM' };
const queueLabel = computed(() => QUEUE_LABELS[queueFilter.value] || 'Todas as filas');

// Card 1: as 3 rotas mais jogadas na AMOSTRA FILTRADA (respeita todos os filtros do topo).
const laneBreakdown = computed(() => {
  const matches = sample.value.filter((m) => ROLES.includes(m.teamPosition));
  const byRole = {};
  for (const m of matches) (byRole[m.teamPosition] || (byRole[m.teamPosition] = [])).push(m);
  const roles = Object.entries(byRole)
    .map(([role, ms]) => ({ role, label: ROLE_LABELS[role], color: ROLE_COLORS[role], ...aggregateStats(ms) }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);
  return { roles, total: matches.length };
});

// Cards 2..6: por função presente na amostra, os 3 campeões mais jogados (respeita os filtros).
// Se o filtro de rota isola uma função, só aparece o card dela.
const roleChampionBreakdown = computed(() => {
  const byRole = {};
  for (const m of sample.value) {
    if (!ROLES.includes(m.teamPosition) || !m.championName) continue;
    (byRole[m.teamPosition] || (byRole[m.teamPosition] = [])).push(m);
  }
  return ROLES.filter((r) => byRole[r]?.length).map((role) => {
    const champMap = {};
    for (const m of byRole[role]) (champMap[m.championName] || (champMap[m.championName] = [])).push(m);
    const champions = Object.entries(champMap)
      .map(([name, ms]) => ({ name, ...aggregateStats(ms) }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 3);
    return { role, label: ROLE_LABELS[role], color: ROLE_COLORS[role], games: byRole[role].length, champions };
  });
});
</script>
