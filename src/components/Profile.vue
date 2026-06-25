<template>
  <div class="relative min-h-[74vh] space-y-6">
    <!-- Busca sobreposta enquanto nenhum perfil foi pesquisado -->
    <SearchGate
      title="UGA! Caçadas Passadas"
      @show-overlay="c => $emit('show-overlay', c)"
      @hide-overlay="$emit('hide-overlay')"
      @show-udyr="$emit('show-udyr')"
    />

    <template v-if="store.searchProfile.loading">
      <div class="flex items-center justify-center gap-3 rounded-xl border border-cyan-800/50 bg-cyan-950/30 px-4 py-3">
        <div class="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"></div>
        <p class="animate-pulse text-sm font-bold tracking-wide text-cyan-300">Buscando as informações com os espiritos ancestrais. <span class="text-lime-300">UGA BUGA</span></p>
      </div>
      <div class="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div class="h-36 animate-pulse rounded-2xl bg-slate-800/60"></div>
        <div class="h-36 animate-pulse rounded-2xl bg-slate-800/60"></div>
      </div>
    </template>

    <template v-else-if="!hasProfile">
      <div class="grid gap-4 opacity-50 lg:grid-cols-[1.4fr_0.9fr]">
        <section class="rounded-2xl border border-slate-800/50 bg-slate-900/80 backdrop-blur-sm p-4 shadow-xl">
          <div class="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700/30 bg-slate-900/80 backdrop-blur-sm p-4">
            <div class="h-24 w-24 flex-shrink-0 rounded-2xl border-2 border-slate-700 bg-slate-800 shadow-xl"></div>
          </div>
        </section>
      </div>
    </template>

    <template v-else>
      <div class="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-tr from-slate-950/20 to-transparent pointer-events-none"></div>
          
          <div class="flex flex-col sm:flex-row items-center gap-5 rounded-xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-5 relative z-10">
            <div class="relative flex-shrink-0">
              <img 
                :src="profileIconImage(store.searchProfile.profileIconId)"
                @error="(e) => e.target.src = profileIconImage(29)"
                class="h-24 w-24 rounded-2xl border-4 border-slate-800 shadow-2xl object-cover"
              >
              <span class="absolute -bottom-2 -right-2 bg-blue-600 border-2 border-slate-800 rounded-full px-2.5 py-0.5 text-[10px] font-black text-white shadow-lg">
                Lv {{ store.searchProfile.summonerLevel || 0 }}
              </span>
            </div>

            <div class="text-center sm:text-left flex-1">
              <h2 class="text-3xl font-black text-white drop-shadow-md tracking-wide">
                {{ store.searchProfile.gameName }}<span class="ml-1.5 text-lg font-bold text-slate-500">#{{ store.searchProfile.tagLine }}</span>
              </h2>
              <p class="text-xs text-slate-400 mt-1 font-medium">Visualização tática das filas ranqueadas ativas.</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mt-4 relative z-10">
            <div class="flex flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-sm p-4 text-center">
              <img 
                :src="getLocalRankEmblem(store.searchProfile.statsSolo?.tier)" 
                class="h-28 w-28 sm:h-32 sm:w-32 object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition transform hover:scale-105 duration-300 block mb-2"
                alt="Brasão SoloQ"
              />
              <span class="text-[10px] font-black uppercase tracking-wider text-cyan-400">Solo / Duo</span>
              <span class="text-xs font-bold text-slate-200 mt-0.5">{{ labelSolo }}</span>
            </div>

            <div class="flex flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-sm p-4 text-center">
              <img 
                :src="getLocalRankEmblem(store.searchProfile.statsFlex?.tier)" 
                class="h-28 w-28 sm:h-32 sm:w-32 object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition transform hover:scale-105 duration-300 block mb-2"
                alt="Brasão Flex"
              />
              <span class="text-[10px] font-black uppercase tracking-wider text-purple-400">Ranked Flex</span>
              <span class="text-xs font-bold text-slate-200 mt-0.5">{{ labelFlex }}</span>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-xl flex flex-col justify-between">
          <h3 class="mb-3 text-center font-bold text-slate-300">Resumo Competitivo</h3>
          
          <div class="space-y-4">
            <div class="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-3 flex items-center justify-between">
              <div class="text-left">
                <span class="text-[10px] font-black uppercase tracking-wider text-cyan-400">Solo / Duo</span>
                <div class="text-2xl font-black text-amber-500 font-stone tracking-wide mt-0.5">{{ labelSolo }}</div>
              </div>
              <div class="text-right">
                <span class="text-xs font-bold text-slate-300">{{ store.searchProfile.statsSolo?.lp || 0 }} LP</span>
                <div class="text-[11px] font-medium text-slate-400 mt-0.5">{{ store.searchProfile.statsSolo?.wins || 0 }} Vitórias</div>
              </div>
            </div>

            <div class="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-3 flex items-center justify-between">
              <div class="text-left">
                <span class="text-[10px] font-black uppercase tracking-wider text-purple-400">Ranked Flex</span>
                <div class="text-lg font-black text-white leading-tight mt-0.5">{{ labelFlex }}</div>
              </div>
              <div class="text-right">
                <span class="text-xs font-bold text-slate-300">{{ store.searchProfile.statsFlex?.lp || 0 }} LP</span>
                <div class="text-[11px] font-medium text-slate-400 mt-0.5">{{ store.searchProfile.statsFlex?.wins || 0 }} Vitórias</div>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-800">
            <div class="grid grid-cols-2 gap-3 mb-4">
              <div class="rounded-xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm p-2.5 text-center">
                <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Vitórias</div>
                <div class="text-lg font-black text-blue-400">
                  {{ (store.searchProfile.statsSolo?.wins || 0) + (store.searchProfile.statsFlex?.wins || 0) }}
                </div>
              </div>
              <div class="rounded-xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm p-2.5 text-center">
                <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400">KDA (20 Partidas)</div>
                <div class="text-lg font-black text-emerald-400">{{ avgKda }}</div>
              </div>
            </div>

            <div class="text-center mb-2">
              <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-0.5">
                <span>Win Rate SoloQ:</span>
                <span class="text-slate-200">{{ winRateSolo.toFixed(1) }}%</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div class="h-full bg-cyan-500 transition-all duration-1000" :style="`width: ${winRateSolo}%`"></div>
              </div>
            </div>

            <div class="text-center">
              <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-0.5">
                <span>Win Rate Flex:</span>
                <span class="text-slate-200">{{ winRateFlex.toFixed(1) }}%</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div class="h-full bg-purple-500 transition-all duration-1000" :style="`width: ${winRateFlex}%`"></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- VISÃO ANALÍTICA + COMPANHEIROS: empilhados no mobile, lado a lado em telas grandes -->
      <div class="grid gap-4 xl:grid-cols-2 items-start">
      <!-- VISÃO ANALÍTICA: ÚLTIMOS 100 JOGOS (base leve do D1) -->
      <section v-if="analytics100" class="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-xl">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-xl font-bold text-slate-100">Visão Analítica</h3>
          <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Últimos {{ analytics100.games }} jogos</span>
        </div>

        <!-- Cards de desempenho geral -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center">
            <div class="text-2xl font-black" :class="analytics100.winRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ analytics100.winRate }}%</div>
            <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Win Rate</div>
            <div class="text-[10px] text-slate-500">{{ analytics100.wins }}V / {{ analytics100.losses }}D</div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center">
            <div class="text-2xl font-black text-emerald-400">{{ analytics100.kda }}</div>
            <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">KDA Médio</div>
            <div class="text-[10px] text-slate-500">{{ analytics100.avgKills }} / {{ analytics100.avgDeaths }} / {{ analytics100.avgAssists }}</div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center">
            <div class="text-2xl font-black text-amber-400">{{ analytics100.csMin }}</div>
            <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">CS / min</div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center">
            <div class="text-2xl font-black text-cyan-300">{{ analytics100.primaryRole }}</div>
            <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Rota Principal</div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center">
            <div class="text-2xl font-black text-slate-200">{{ analytics100.avgKills }}</div>
            <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Abates / jogo</div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center">
            <div class="text-2xl font-black text-slate-200">{{ analytics100.avgDeaths }}</div>
            <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Mortes / jogo</div>
          </div>
        </div>

        <!-- Top campeões dos últimos 100 jogos -->
        <div v-if="top100Champions.length" class="mt-5">
          <h4 class="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Top Campeões (100 jogos)</h4>
          <div class="overflow-x-auto rounded-xl border border-slate-800">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-950/60 text-[9px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th class="px-3 py-2 font-bold">Campeão</th>
                  <th class="px-3 py-2 font-bold text-center">Jogos</th>
                  <th class="px-3 py-2 font-bold text-center">Win Rate</th>
                  <th class="px-3 py-2 font-bold text-center">KDA</th>
                  <th class="px-3 py-2 font-bold text-center">CS/min</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="champ in top100Champions" :key="champ.name" class="border-t border-slate-800/60 hover:bg-slate-800/30">
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-2">
                      <img class="h-6 w-6 rounded-full border border-slate-600" :src="championImage(champ.name)" :alt="champ.name" />
                      <span class="font-bold text-slate-200">{{ champ.name }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-center font-semibold text-slate-300">{{ champ.games }}</td>
                  <td class="px-3 py-2 text-center font-black" :class="champ.winRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ champ.winRate }}%</td>
                  <td class="px-3 py-2 text-center font-bold" :class="Number(champ.kda) >= 4 ? 'text-amber-400' : 'text-slate-300'">{{ champ.kda }}</td>
                  <td class="px-3 py-2 text-center font-semibold text-slate-300">{{ champ.csMin }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- COMPANHEIROS DE BATALHA (ao lado da Visão Analítica em telas grandes) -->
      <section v-if="battleCompanions.length" class="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-xl">
        <h3 class="mb-4 text-lg font-bold text-slate-100">Companheiros de Batalha (Top 10)</h3>
        <div class="flex flex-wrap gap-3">
          <div v-for="(comp, i) in battleCompanions" :key="comp.name" class="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm px-4 py-2.5">
            <span class="text-xs font-black text-slate-500">#{{ i + 1 }}</span>
            <span class="font-bold text-cyan-300">{{ comp.name }}</span>
            <span class="text-xs font-semibold text-slate-400">{{ comp.games }} partida{{ comp.games > 1 ? 's' : '' }}</span>
          </div>
        </div>
      </section>
      </div>

      <!-- HISTÓRICO DE PARTIDAS EM FORMATO GRID FLEXÍVEL LADO A LADO -->
      <section class="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-xl">
        <div class="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 class="text-xl font-bold text-slate-100">Histórico de Partidas</h3>
          
          <div class="flex gap-2 overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-1">
            <button v-for="tab in tabs" :key="tab"
              @click="activeTab = tab"
              class="whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-bold transition-all"
              :class="activeTab === tab ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
            >
              {{ tab }}
            </button>
          </div>
        </div>

        <div v-if="filteredMatches.length" class="mb-5 grid grid-cols-1 gap-4 rounded-xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-4 sm:grid-cols-3">
          <div class="text-center sm:border-r border-slate-800">
            <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Winrate ({{ activeTab }})</p>
            <p class="text-3xl font-black mt-1" :class="recentWinRate >= 50 ? 'text-blue-400' : 'text-red-400'">{{ recentWinRate }}%</p>
            <p class="text-xs font-medium text-slate-500">{{ filteredMatches.filter(m => m.win).length }}V / {{ filteredMatches.filter(m => !m.win).length }}D</p>
          </div>

          <div class="text-center sm:border-r border-slate-800 px-2">
            <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Rotas Jogadas</p>
            <div class="flex flex-col items-center justify-center space-y-1.5">
              <div v-for="(role, index) in roleStats.slice(0, 3)" :key="role.name" 
                   class="flex w-full max-w-[130px] items-center justify-between rounded bg-slate-900/80 px-2 py-1 border border-slate-800">
                <div class="flex items-center gap-1.5">
                  <img :src="getRoleIcon(role.name)" class="h-4 w-4 brightness-200 contrast-125 opacity-90" :alt="role.name" />
                  <span class="text-xs font-bold" :class="index === 0 ? 'text-amber-400' : 'text-slate-400'">{{ role.name }}</span>
                </div>
                <span class="text-[10px] font-bold text-slate-300">{{ role.percentage }}%</span>
              </div>
            </div>
          </div>

          <div class="text-center">
            <p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Top Campeões</p>
            <div class="flex flex-wrap justify-center gap-2">
              <div v-for="champ in topChampions" :key="champ.name" class="flex items-center gap-1.5 rounded bg-slate-900/80 backdrop-blur-sm px-2 py-1 border border-slate-800">
                <img class="h-5 w-5 rounded-full border border-slate-600" :src="championImage(champ.name)" :alt="champ.name" />
                <span class="text-[10px] font-bold text-slate-200">{{ champ.name }}</span>
                <span class="text-[10px] text-slate-500">{{ champ.games }}x</span>
              </div>
            </div>
          </div>
        </div>

        <!-- CONTAINER DOS CARDS DE HISTÓRICO ATUALIZADO (1 COLUNA MOBILE, 2 COLUNAS PC) -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 relative z-10">
          <p v-if="!filteredMatches.length" class="col-span-full text-center text-slate-400 py-8 font-semibold">
            Nenhuma partida encontrada na aba <span class="text-amber-400">"{{ activeTab }}"</span>.
          </p>

          <article
            v-for="match in pagedMatches"
            :key="match.matchId || match.championName + Math.random()"
            class="rounded-2xl border p-4 bg-slate-900/40 backdrop-blur-sm transition hover:brightness-110 flex flex-col justify-between gap-4 shadow-xl"
            :class="match.win ? 'border-blue-800/50 bg-blue-950/20 text-blue-100' : 'border-red-800/50 bg-red-950/20 text-red-100'"
          >
            <!-- CABEÇALHO DO CARD: STATUS GLOBAL DA ROW -->
            <div class="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/60 pb-2.5">
              <div class="space-y-0.5">
                <p class="font-black text-sm uppercase tracking-wider" :class="match.win ? 'text-blue-400' : 'text-red-400'">
                  {{ match.win ? 'VITÓRIA' : 'DERROTA' }}
                </p>
                <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">{{ match.queueType || 'Outro Modo' }}</p>
                
                <div v-if="matchBadges(match).length" class="mt-1 flex flex-wrap gap-1">
                  <span v-for="badge in matchBadges(match)" :key="badge.label"
                    class="rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    :class="badge.color">{{ badge.label }}</span>
                </div>
              </div>
              
              <div class="text-right">
                <p class="text-[10px] font-semibold text-slate-400">{{ formatGameDate(match.gameStartTimestamp) }}</p>
                <p class="text-xs font-semibold text-slate-300 mt-0.5">{{ formatDuration(match.gameDuration) }}</p>
              </div>
            </div>

            <!-- MEIO/FUNDO DO CARD: DIVIDIDO EM 2 SUB-COLUNAS ADAPTATIVAS -->
            <div class="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-4 items-center">
              
              <!-- SUB-COLUNA ESQUERDA: CAMPEÃO, KDA, CS E ITENS GRIDS -->
              <div class="space-y-3">
                <div class="flex items-center gap-3">
                  <div class="relative flex-shrink-0">
                    <img class="h-12 w-12 rounded-xl border border-slate-700 object-cover shadow-md" :src="championImage(match.championName || 'Aatrox')" :alt="match.championName" loading="lazy" />
                    <img v-if="match.teamPosition && match.teamPosition !== 'Invalid'" :src="getMiniRoleIcon(match.teamPosition)" class="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-slate-950 p-0.5 brightness-200" :title="match.teamPosition" :alt="match.teamPosition" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-black text-slate-200 uppercase tracking-wide truncate">{{ match.championName }}</p>
                    <p class="text-sm font-black text-white tracking-widest mt-0.5">
                      {{ match.kills }} <span class="text-slate-600">/</span> {{ match.deaths }} <span class="text-slate-600">/</span> {{ match.assists }}
                    </p>
                    <p class="text-[11px] font-bold text-slate-400 truncate">
                      <span :class="Number(calculateKdaRatio(match.kills, match.deaths, match.assists)) >= 4 ? 'text-amber-400' : 'text-slate-400'">
                        {{ calculateKdaRatio(match.kills, match.deaths, match.assists) }} KDA
                      </span>
                      <span class="text-slate-600 font-normal"> • </span>{{ matchFarm(match) }} CS <span class="text-[10px] font-normal text-slate-500">({{ matchCsMin(match) }}/m)</span>
                    </p>
                    <p class="text-[10px] font-semibold text-slate-500 mt-0.5">KP: <span class="text-slate-200">{{ matchKP(match) }}</span></p>
                  </div>
                </div>

                <!-- ITEMS COMPACT GRID -->
                <div class="flex flex-wrap gap-1">
                  <template v-for="(itemId, idx) in [match.item0, match.item1, match.item2, match.item3, match.item4, match.item5, match.item6]" :key="idx">
                    <img v-if="itemId" class="h-6 w-6 rounded border border-slate-700 bg-slate-800 shadow-sm" :src="itemImage(itemId)" :title="itemName(itemId)" :alt="itemName(itemId)" loading="lazy" />
                    <div v-else class="h-6 w-6 rounded border border-slate-800/30 bg-slate-900/40"></div>
                  </template>
                </div>
              </div>

              <!-- SUB-COLUNA DIREITA: CONFRONTOS POR ROTA (ALIADO vs INIMIGO, COMO NO OP.GG) -->
              <div class="bg-slate-950/40 rounded-xl p-2 border border-slate-900/60 h-full flex flex-col justify-center gap-0.5">
                <div v-for="(lane, i) in laneMatchups(match)" :key="i" class="flex items-center gap-1">
                  <!-- ALIADO -->
                  <div class="flex items-center gap-1 flex-1 min-w-0" :title="playerLabel(lane.ally)">
                    <img class="h-4 w-4 rounded-sm border border-slate-800 flex-shrink-0 shadow-sm" :src="championImage(lane.ally?.championName || 'Aatrox')" :alt="lane.ally?.championName" loading="lazy" />
                    <span class="truncate text-[9px] font-bold" :class="isSearchedPlayer(lane.ally) ? 'text-amber-300 font-black' : 'text-blue-300/80'">
                      {{ lane.ally?.gameName || '—' }}
                    </span>
                  </div>
                  <!-- ROTA -->
                  <img v-if="lane.role" :src="getMiniRoleIcon(lane.role)" class="h-3 w-3 flex-shrink-0 opacity-60 brightness-200" :title="lane.role" :alt="lane.role" />
                  <span v-else class="text-[8px] text-slate-600 flex-shrink-0">vs</span>
                  <!-- INIMIGO -->
                  <div class="flex items-center gap-1 flex-1 min-w-0 justify-end" :title="playerLabel(lane.enemy)">
                    <span class="truncate text-right text-[9px] font-bold" :class="isSearchedPlayer(lane.enemy) ? 'text-amber-300 font-black' : 'text-red-300/80'">
                      {{ lane.enemy?.gameName || '—' }}
                    </span>
                    <img class="h-4 w-4 rounded-sm border border-slate-800 flex-shrink-0 shadow-sm" :src="championImage(lane.enemy?.championName || 'Aatrox')" :alt="lane.enemy?.championName" loading="lazy" />
                  </div>
                </div>
              </div>

            </div>
          </article>
        </div>

        <!-- PAGINAÇÃO 20/20 -->
        <div v-if="totalPages > 1" class="mt-5 flex items-center justify-center gap-2">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹ Anterior
          </button>
          <button
            v-for="p in totalPages"
            :key="p"
            @click="goToPage(p)"
            class="h-8 w-8 rounded-md border text-xs font-bold transition"
            :class="p === currentPage ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'"
          >
            {{ p }}
          </button>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próxima ›
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { state } from '../store.js';
import { championImage, profileIconImage, itemImage, calculateKdaRatio, formatDuration } from '../utils.js';
import { loadProfileIntoStore } from '../api.js';
import SearchGate from './SearchGate.vue';

const store = state;
const route = useRoute();

defineEmits(['show-overlay', 'hide-overlay', 'show-udyr']);

// Carrega automaticamente o jogador presente na URL (/profile/:gameName/:tagLine).
// Permite atualizar a página sem precisar buscar de novo.
async function loadFromRoute() {
  const gameName = route.params.gameName ? decodeURIComponent(route.params.gameName) : '';
  const tagLine = route.params.tagLine ? decodeURIComponent(route.params.tagLine) : '';
  if (!gameName || !tagLine) return;

  // Já está carregado este mesmo jogador? Não refaz.
  const sameLoaded =
    store.searchProfile.puuid &&
    (store.searchProfile.gameName || '').toLowerCase() === gameName.toLowerCase() &&
    (store.searchProfile.tagLine || '').toLowerCase() === tagLine.toLowerCase();
  if (sameLoaded) return;

  try {
    await loadProfileIntoStore(gameName, tagLine);
  } catch (e) {
    // erro já fica em store.searchProfile.error
  }
}

onMounted(loadFromRoute);
watch(() => [route.params.gameName, route.params.tagLine], loadFromRoute);

function formatGameDate(timestamp) {
  if (!timestamp) return 'Data desconhecida';
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `Há ${minutes} min`;
  if (hours < 24) return `Há ${hours} horas`;
  return `Há ${days} dias`;
}

function getMiniRoleIcon(position) {
  const map = { TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'middle', BOTTOM: 'bottom', UTILITY: 'utility' };
  const role = map[position] || 'fill';
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${role}.png`;
}

const activeTab = ref('Todas');
const tabs = ['Todas', 'Solo/Duo', 'Flex', 'Normal', 'Outros'];

const filteredMatches = computed(() => {
  const matches = store.searchProfile.matches || [];
  if (activeTab.value === 'Todas') return matches;
  
  return matches.filter(m => {
    const q = m.queueType;
    if (activeTab.value === 'Solo/Duo') return q === 'Ranked Solo';
    if (activeTab.value === 'Flex') return q === 'Ranked Flex';
    if (activeTab.value === 'Normal') return q === 'Normal Draft' || q === 'Normal Blind';
    if (activeTab.value === 'Outros') return !['Ranked Solo', 'Ranked Flex', 'Normal Draft', 'Normal Blind'].includes(q);
    return true;
  });
});

// -------- Paginação do histórico (20 por página, até 100 partidas) --------
const pageSize = 20;
const currentPage = ref(1);

const totalPages = computed(() => Math.max(1, Math.ceil(filteredMatches.value.length / pageSize)));

const pagedMatches = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredMatches.value.slice(start, start + pageSize);
});

// Volta para a 1ª página ao trocar de aba ou de jogador
watch(activeTab, () => { currentPage.value = 1; });
watch(() => store.searchProfile.puuid, () => { currentPage.value = 1; });

function goToPage(p) {
  currentPage.value = Math.min(Math.max(1, p), totalPages.value);
}

// -------- Análise dos últimos 100 jogos (base leve do D1, até 1000) --------
const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Sup' };

const last100 = computed(() => (store.searchProfile.proficiencyMatches || []).slice(0, 100));

// Top campeões dos últimos 100 jogos: jogos, winrate, KDA e CS/min
const top100Champions = computed(() => {
  const agg = {};
  for (const m of last100.value) {
    const name = m.championName;
    if (!name) continue;
    if (!agg[name]) agg[name] = { name, games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0, dur: 0 };
    const c = agg[name];
    c.games++;
    if (m.win) c.wins++;
    c.k += Number(m.kills || 0);
    c.d += Number(m.deaths || 0);
    c.a += Number(m.assists || 0);
    c.cs += Number(m.cs || 0);
    c.dur += Number(m.gameDuration || 0);
  }
  return Object.values(agg)
    .map((c) => ({
      name: c.name,
      games: c.games,
      winRate: Math.round((c.wins / c.games) * 100),
      kda: c.d === 0 ? (c.k + c.a).toFixed(2) : ((c.k + c.a) / c.d).toFixed(2),
      csMin: c.dur > 0 ? (c.cs / (c.dur / 60)).toFixed(1) : '0.0'
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 8);
});

// Resumo analítico geral dos últimos 100 jogos
const analytics100 = computed(() => {
  const ms = last100.value;
  const games = ms.length;
  if (!games) return null;
  let wins = 0, k = 0, d = 0, a = 0, cs = 0, dur = 0;
  const roles = {};
  for (const m of ms) {
    if (m.win) wins++;
    k += Number(m.kills || 0);
    d += Number(m.deaths || 0);
    a += Number(m.assists || 0);
    cs += Number(m.cs || 0);
    dur += Number(m.gameDuration || 0);
    const r = ROLE_LABELS[m.teamPosition] || 'Outro';
    roles[r] = (roles[r] || 0) + 1;
  }
  const roleStats = Object.entries(roles)
    .map(([name, count]) => ({ name, count, percentage: Math.round((count / games) * 100) }))
    .sort((x, y) => y.count - x.count);
  return {
    games,
    winRate: Math.round((wins / games) * 100),
    wins,
    losses: games - wins,
    kda: d === 0 ? (k + a).toFixed(2) : ((k + a) / d).toFixed(2),
    avgKills: (k / games).toFixed(1),
    avgDeaths: (d / games).toFixed(1),
    avgAssists: (a / games).toFixed(1),
    csMin: dur > 0 ? (cs / (dur / 60)).toFixed(1) : '0.0',
    primaryRole: roleStats[0]?.name || '—',
    roleStats
  };
});

const hasProfile = computed(() => Boolean(store.searchProfile.puuid));

const winRateSolo = computed(() => store.searchProfile.statsSolo?.winRate || 0);
const winRateFlex = computed(() => store.searchProfile.statsFlex?.winRate || 0);

const avgKda = computed(() => {
  const matches = store.searchProfile.matches || [];
  if (!matches.length) return '0.00';
  let totalKills = 0, totalDeaths = 0, totalAssists = 0;
  matches.forEach(match => {
    totalKills += Number(match.kills || 0);
    totalDeaths += Number(match.deaths || 0);
    totalAssists += Number(match.assists || 0);
  });
  const kda = totalDeaths === 0 ? (totalKills + totalAssists) : ((totalKills + totalAssists) / totalDeaths);
  return kda.toFixed(2);
});

const labelSolo = computed(() => {
  const s = store.searchProfile.statsSolo;
  return s?.tier && s?.tier !== 'UNRANKED' ? `${s.tier} ${s.rank || ''}`.trim() : 'UNRANKED';
});

const labelFlex = computed(() => {
  const f = store.searchProfile.statsFlex;
  return f?.tier && f?.tier !== 'UNRANKED' ? `${f.tier} ${f.rank || ''}`.trim() : 'UNRANKED';
});

const getLocalRankEmblem = (tier) => {
  if (!tier || tier === 'UNRANKED') {
    return 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/unranked.png';
  }
  
  const formattedTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  const fileName = `Rank=${formattedTier}.png`;
  
  return new URL(`../assets/rank-emblem/${fileName}`, import.meta.url).href;
};

const getRoleIcon = (roleName) => {
  const map = {
    'Top': 'top',
    'Jungle': 'jungle',
    'Mid': 'middle',
    'Adc': 'bottom',
    'Sup': 'utility'
  };
  const position = map[roleName] || 'fill'; 
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-parties/global/default/icon-position-${position}-priority.png`;
};

const roleStats = computed(() => {
  const matches = filteredMatches.value;
  if (!matches.length) return [];
  const counts = {};
  matches.forEach(m => {
    let role = m.teamPosition && m.teamPosition !== 'Invalid' ? m.teamPosition : 'OUTRO';
    const roleMap = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Sup' };
    role = roleMap[role] || 'Outro';
    counts[role] = (counts[role] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, count]) => ({
      name, count, percentage: Math.round((count / matches.length) * 100)
    }))
    .sort((a, b) => b.count - a.count);
});

const recentWinRate = computed(() => {
  const matches = filteredMatches.value;
  if (!matches.length) return 0;
  return Math.round(matches.filter((m) => m.win).length / matches.length * 100);
});

const topChampions = computed(() => {
  const matches = filteredMatches.value;
  const counts = {};
  for (const m of matches) {
    if (m.championName) counts[m.championName] = (counts[m.championName] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, games]) => ({ name, games }));
});

const battleCompanions = computed(() => {
  const matches = filteredMatches.value;
  const myName = (store.searchProfile.gameName || '').toLowerCase().trim();
  const counts = {};
  
  for (const match of matches) {
    if (!Array.isArray(match.players)) continue;
    
    const me = match.players.find((p) => (p?.championName || '').toLowerCase() === (match.championName || '').toLowerCase());
    const myTeamId = me?.teamId;
    if (!myTeamId) continue;
    
    const allies = match.players.filter((p) => {
      const pName = (p?.gameName || '').toLowerCase().trim();
      return p?.teamId === myTeamId && pName !== myName && pName !== '';
    });
    
    for (const ally of allies) {
      const key = ally.gameName || 'Desconhecido';
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, games]) => ({ name, games }));
});

const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];

function isSearchedPlayer(p) {
  return (p?.gameName || '').toLowerCase().trim() === (store.searchProfile.gameName || '').toLowerCase().trim();
}

// Monta os confrontos por rota: cada linha pareia 1 aliado x 1 inimigo da mesma role.
// Se as roles não estiverem disponíveis (dados antigos), pareia pela ordem.
function laneMatchups(match) {
  const participants = Array.isArray(match.players) ? match.players : [];
  const me = participants.find((p) => p?.championName === match.championName);
  const myTeamId = me?.teamId;
  const allies = participants.filter((p) => p?.teamId === myTeamId);
  const enemies = participants.filter((p) => p?.teamId !== myTeamId);

  const pickByRole = (arr, role, used) => arr.find((p) => !used.has(p) && (p?.role || '').toUpperCase() === role);

  const rows = [];
  const usedAlly = new Set();
  const usedEnemy = new Set();

  for (const role of ROLE_ORDER) {
    const ally = pickByRole(allies, role, usedAlly);
    const enemy = pickByRole(enemies, role, usedEnemy);
    if (ally) usedAlly.add(ally);
    if (enemy) usedEnemy.add(enemy);
    if (ally || enemy) rows.push({ role, ally, enemy });
  }

  // Fallback: quem ficou sem role pareado entra por ordem
  const restAlly = allies.filter((p) => !usedAlly.has(p));
  const restEnemy = enemies.filter((p) => !usedEnemy.has(p));
  const maxRest = Math.max(restAlly.length, restEnemy.length);
  for (let i = 0; i < maxRest; i++) {
    rows.push({ role: null, ally: restAlly[i], enemy: restEnemy[i] });
  }

  return rows.slice(0, 5);
}

// Nome completo do jogador com a tag (ex.: "Kami#BR1") para o tooltip
function playerLabel(p) {
  const name = p?.gameName || 'Desconhecido';
  return p?.tagLine ? `${name}#${p.tagLine}` : name;
}

// Nome do item a partir do mapa estático do Data Dragon (para o tooltip)
function itemName(itemId) {
  return store.staticData.items?.[itemId]?.name || `Item ${itemId}`;
}

function matchFarm(match) {
  return (match.totalMinionsKilled || 0) + (match.neutralMinionsKilled || 0);
}

function matchCsMin(match) {
  const duration = match.gameDuration || 1;
  return (matchFarm(match) / (duration / 60)).toFixed(1);
}

function matchKP(match) {
  const participants = Array.isArray(match.players) ? match.players : [];
  const playerEntry = participants.find((p) => p?.championName === match.championName);
  const myTeamId = playerEntry?.teamId;
  const teamKills = participants
    .filter((p) => p?.teamId === myTeamId)
    .reduce((sum, p) => sum + (p.kills || 0), 0);
  if (!teamKills) return '0%';
  return Math.round(((match.kills || 0) + (match.assists || 0)) / teamKills * 100) + '%';
}

function matchBadges(match) {
  const badges = [];
  if (match.deaths === 0) badges.push({ label: 'Imortal', color: 'text-yellow-300 border-yellow-600 bg-yellow-950/50' });
  if (match.firstBloodKill) badges.push({ label: 'First Blood', color: 'text-red-400 border-red-700 bg-red-950/50' });
  if ((match.visionWardsBoughtInGame || 0) >= 3) badges.push({ label: 'Visão+', color: 'text-purple-300 border-purple-700 bg-purple-950/50' });
  return badges;
}

</script>