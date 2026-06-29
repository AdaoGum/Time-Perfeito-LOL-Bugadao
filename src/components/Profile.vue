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
      <!-- LINHA 1: PERFIL (2/3) + COMPANHEIROS DE BATALHA (1/3) — mesma altura -->
      <div class="grid gap-4 xl:grid-cols-3 items-stretch">
      <section class="xl:col-span-2 h-full rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-xl relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-tr from-slate-950/20 to-transparent pointer-events-none"></div>

        <!-- 1) CABEÇALHO: ÍCONE (COM NÍVEL) + NOME -->
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

        <!-- 2) TÍTULO + TOTAL DE VITÓRIAS -->
        <h3 class="mt-5 mb-3 text-center font-bold text-slate-300 relative z-10">
          Resumo Competitivo
          <span class="text-slate-600">·</span>
          <span class="text-slate-400">Total de Vitórias:</span>
          <span class="font-black text-blue-400">{{ totalWins }}</span>
        </h3>

        <!-- 3) RANKS: EMBLEMA + LABEL + LP + VITÓRIAS + WIN RATE (Solo | Flex) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
          <div class="flex items-center gap-4 rounded-xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-sm p-4">
            <img
              :src="getLocalRankEmblem(store.searchProfile.statsSolo?.tier)"
              class="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition transform hover:scale-105 duration-300"
              alt="Brasão SoloQ"
            />
            <div class="min-w-0 flex-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-cyan-400">Solo / Duo</span>
              <div class="text-xl font-black text-amber-500 font-stone tracking-wide leading-tight mt-0.5 truncate">{{ labelSolo }}</div>
              <div class="mt-1 flex items-center gap-2 text-[11px] font-medium">
                <span class="font-bold text-slate-200">{{ store.searchProfile.statsSolo?.lp || 0 }} LP</span>
                <span class="text-slate-600">•</span>
                <span class="text-slate-400">{{ store.searchProfile.statsSolo?.wins || 0 }} Vitórias</span>
              </div>
              <div class="mt-2">
                <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-0.5">
                  <span>Win Rate</span>
                  <span class="text-slate-200">{{ winRateSolo.toFixed(1) }}%</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div class="h-full bg-cyan-500 transition-all duration-1000" :style="`width: ${winRateSolo}%`"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4 rounded-xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-sm p-4">
            <img
              :src="getLocalRankEmblem(store.searchProfile.statsFlex?.tier)"
              class="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition transform hover:scale-105 duration-300"
              alt="Brasão Flex"
            />
            <div class="min-w-0 flex-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-purple-400">Ranked Flex</span>
              <div class="text-xl font-black text-white tracking-wide leading-tight mt-0.5 truncate">{{ labelFlex }}</div>
              <div class="mt-1 flex items-center gap-2 text-[11px] font-medium">
                <span class="font-bold text-slate-200">{{ store.searchProfile.statsFlex?.lp || 0 }} LP</span>
                <span class="text-slate-600">•</span>
                <span class="text-slate-400">{{ store.searchProfile.statsFlex?.wins || 0 }} Vitórias</span>
              </div>
              <div class="mt-2">
                <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-0.5">
                  <span>Win Rate</span>
                  <span class="text-slate-200">{{ winRateFlex.toFixed(1) }}%</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div class="h-full bg-purple-500 transition-all duration-1000" :style="`width: ${winRateFlex}%`"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4) FORMA RECENTE (substitui o KDA; cabe embaixo dos emblemas) -->
        <div class="mt-4 rounded-xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm p-3 relative z-10">
          <h4 class="mb-2 flex items-center gap-2 text-sm font-bold text-slate-100">
            <i class="fa-solid fa-fire text-orange-400"></i> Forma Recente
          </h4>
          <div v-if="formRecent.recent.length" class="mb-3 flex flex-wrap gap-1.5">
            <span v-for="(m, i) in formRecent.recent" :key="i"
              class="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-black"
              :class="m.win ? 'bg-blue-600/80 text-white' : 'bg-red-600/80 text-white'"
              :title="`${m.championName} — ${m.win ? 'Vitória' : 'Derrota'}`">
              {{ m.win ? 'V' : 'D' }}
            </span>
          </div>
          <p v-else class="mb-3 text-[11px] text-slate-500">Sem partidas recentes para exibir.</p>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div class="text-lg font-black" :class="formRecent.streakType ? 'text-blue-400' : 'text-red-400'">{{ formRecent.streak }}{{ formRecent.streakType ? 'V' : 'D' }}</div>
              <div class="text-[9px] font-bold uppercase tracking-wide text-slate-400">Sequência atual</div>
            </div>
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div class="text-lg font-black text-blue-400">{{ formRecent.bestWin }}V</div>
              <div class="text-[9px] font-bold uppercase tracking-wide text-slate-400">Melhor sequência</div>
            </div>
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
              <div class="text-lg font-black text-red-400">{{ formRecent.bestLoss }}D</div>
              <div class="text-[9px] font-bold uppercase tracking-wide text-slate-400">Pior sequência</div>
            </div>
          </div>
        </div>
      </section>

      <!-- COMPANHEIROS DE BATALHA (1/3 — clicável: ao clicar, busca aquele jogador) -->
      <section v-if="companionsList.length" class="xl:col-span-1 h-full rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-xl">
        <h3 class="mb-4 text-lg font-bold text-slate-100">Companheiros de Batalha</h3>
        <div class="space-y-2">
          <button
            v-for="(comp, i) in companionsList"
            :key="comp.name"
            type="button"
            @click="searchCompanion(comp)"
            :disabled="!comp.tagLine"
            :title="comp.tagLine ? `Buscar ${comp.gameName}#${comp.tagLine}` : 'Sem tag disponível para buscar'"
            class="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm px-3 py-2 text-left transition hover:border-cyan-500/60 hover:bg-slate-800/60 disabled:cursor-default disabled:opacity-70 disabled:hover:border-slate-700 disabled:hover:bg-slate-900/80"
          >
            <span class="w-5 flex-shrink-0 text-xs font-black text-slate-500">#{{ i + 1 }}</span>
            <span class="min-w-0 flex-1 truncate font-bold text-cyan-300">
              {{ comp.gameName }}<span v-if="comp.tagLine" class="font-medium text-slate-500">#{{ comp.tagLine }}</span>
            </span>
            <span class="flex-shrink-0 text-[11px] font-semibold text-slate-400">{{ comp.games }} partida{{ comp.games > 1 ? 's' : '' }}</span>
          </button>
        </div>
      </section>
      </div>
      <!-- FIM DA LINHA 1 -->

      <!-- SELETOR DE VISÃO: HISTÓRICO DE PARTIDAS x ANÁLISE DO JOGADOR -->
      <div class="flex gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-1.5 shadow-xl">
        <button
          type="button"
          @click="profileView = 'historico'"
          class="flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all"
          :class="profileView === 'historico' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
        >
          <i class="fa-solid fa-scroll mr-1.5"></i> Histórico de Partidas
        </button>
        <button
          type="button"
          @click="profileView = 'analise'"
          class="flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all"
          :class="profileView === 'analise' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
        >
          <i class="fa-solid fa-chart-simple mr-1.5"></i> Análise do Jogador
        </button>
      </div>

      <!-- ABA: ANÁLISE DO JOGADOR (gráficos, radar, tags e filtros) -->
      <PlayerAnalysis v-if="profileView === 'analise'" />

      <!-- HISTÓRICO DE PARTIDAS EM FORMATO GRID FLEXÍVEL LADO A LADO -->
      <section v-show="profileView === 'historico'" class="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-5 shadow-xl">
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

                  <!-- Feitiços de invocador + runa principal (quando houver dados) -->
                  <div v-if="match.summoner1Id || match.perkKeystone" class="flex flex-shrink-0 items-center gap-1">
                    <div class="flex flex-col gap-0.5">
                      <img v-if="spellImg(match.summoner1Id)" :src="spellImg(match.summoner1Id)" :title="spellName(match.summoner1Id)" :alt="spellName(match.summoner1Id)" class="h-5 w-5 rounded border border-slate-700 bg-slate-800" />
                      <img v-if="spellImg(match.summoner2Id)" :src="spellImg(match.summoner2Id)" :title="spellName(match.summoner2Id)" :alt="spellName(match.summoner2Id)" class="h-5 w-5 rounded border border-slate-700 bg-slate-800" />
                    </div>
                    <img v-if="runeImg(match.perkKeystone)" :src="runeImg(match.perkKeystone)" :title="runeName(match.perkKeystone)" :alt="runeName(match.perkKeystone)" class="h-6 w-6 rounded-full border border-slate-700 bg-slate-950" />
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
                    <p class="text-[10px] font-semibold text-slate-500 mt-0.5">
                      KP: <span class="text-slate-200">{{ matchKP(match) }}</span>
                      <template v-if="match.visionScore != null">
                        <span class="text-slate-600"> • </span>Visão: <span class="text-slate-200">{{ match.visionScore }}</span>
                      </template>
                    </p>
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
import { useRoute, useRouter } from 'vue-router';
import { state } from '../store.js';
import { championImage, profileIconImage, itemImage, calculateKdaRatio, formatDuration, summonerSpellImage, runeImage } from '../utils.js';
import { loadProfileIntoStore } from '../api.js';
import SearchGate from './SearchGate.vue';
import PlayerAnalysis from './PlayerAnalysis.vue';

const store = state;

// Visão de nível superior do perfil: histórico de partidas x análise aprofundada
const profileView = ref('historico');
const route = useRoute();
const router = useRouter();

// Lista de companheiros clicáveis (mescla solo+flex do worker, que inclui a #TAG).
// Cai para battleCompanions (sem tag, não-clicável) se o worker não trouxe nada.
const companionsList = computed(() => {
  const merged = {};
  const add = (arr) => {
    for (const c of arr || []) {
      const [gn, tl] = String(c.name || '').split('#');
      const key = c.name;
      if (!key) continue;
      if (!merged[key]) merged[key] = { name: c.name, gameName: gn, tagLine: tl || '', games: 0 };
      merged[key].games += Number(c.games || 0);
    }
  };
  add(store.searchProfile.companions?.solo);
  add(store.searchProfile.companions?.flex);
  const list = Object.values(merged).sort((a, b) => b.games - a.games).slice(0, 10);
  if (list.length) return list;
  // Fallback: somente exibição (sem #TAG → não dá pra buscar)
  return (battleCompanions.value || []).map((c) => ({ name: c.name, gameName: c.name, tagLine: '', games: c.games }));
});

function searchCompanion(comp) {
  if (!comp?.tagLine) return; // sem tag não conseguimos buscar com segurança
  router.push(`/profile/${encodeURIComponent(comp.gameName)}/${encodeURIComponent(comp.tagLine)}`);
}

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

// -------- Base de partidas (D1, até 1000 jogos) para a Forma Recente --------
const ROLE_LABELS = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Sup' };
// Só conta como rota quando a Riot devolveu uma posição válida de Summoner's Rift.
// ARAM/Arena (sem lane) e dados antigos sem position retornam vazio/Invalid → ficam
// fora das estatísticas de rota em vez de cair num balde "Outro".
const roleLabelOf = (m) => ROLE_LABELS[m && m.teamPosition] || null;

const proficiency = computed(() => store.searchProfile.proficiencyMatches || []);

// Total de vitórias ranqueadas (Solo + Flex), exibido no título do Resumo Competitivo
const totalWins = computed(() =>
  (store.searchProfile.statsSolo?.wins || 0) + (store.searchProfile.statsFlex?.wins || 0)
);

// Forma recente: sequência de resultados + melhores/piores streaks.
// Usa a base analítica do D1 e cai para o histórico recente quando não há D1.
const formRecent = computed(() => {
  const base = proficiency.value.length ? proficiency.value : (store.searchProfile.matches || []);
  const recent = base.slice(0, 20); // mais recente primeiro
  let streakType = null, streak = 0;
  for (const m of recent) {
    if (streakType === null) { streakType = !!m.win; streak = 1; }
    else if (!!m.win === streakType) streak++;
    else break;
  }
  const chrono = [...base].reverse();
  let bestWin = 0, curW = 0, bestLoss = 0, curL = 0;
  for (const m of chrono) {
    if (m.win) { curW++; curL = 0; } else { curL++; curW = 0; }
    bestWin = Math.max(bestWin, curW);
    bestLoss = Math.max(bestLoss, curL);
  }
  return { recent, streakType, streak, bestWin, bestLoss };
});

const hasProfile = computed(() => Boolean(store.searchProfile.puuid));

const winRateSolo = computed(() => store.searchProfile.statsSolo?.winRate || 0);
const winRateFlex = computed(() => store.searchProfile.statsFlex?.winRate || 0);

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
    'ADC': 'bottom',
    'Sup': 'utility'
  };
  const position = map[roleName] || 'fill'; 
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-parties/global/default/icon-position-${position}-priority.png`;
};

const roleStats = computed(() => {
  const matches = filteredMatches.value;
  if (!matches.length) return [];
  const counts = {};
  let comRota = 0;
  matches.forEach(m => {
    const role = roleLabelOf(m);
    if (!role) return; // ARAM/Arena ou sem rota não entram na contagem
    counts[role] = (counts[role] || 0) + 1;
    comRota++;
  });
  if (!comRota) return [];
  return Object.entries(counts)
    .map(([name, count]) => ({
      name, count, percentage: Math.round((count / comRota) * 100)
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

// Feitiços de invocador (ícone + nome) a partir do id numérico
function spellImg(id) {
  const s = store.staticData.summonerSpells?.[id];
  return s?.image ? summonerSpellImage(s.image) : '';
}
function spellName(id) {
  return store.staticData.summonerSpells?.[id]?.name || '';
}

// Runa (ícone + nome) a partir do id do perk
function runeImg(id) {
  const r = store.staticData.runes?.[id];
  return r?.icon ? runeImage(r.icon) : '';
}
function runeName(id) {
  return store.staticData.runes?.[id]?.name || '';
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