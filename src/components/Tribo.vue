<template>
  <div class="space-y-6 text-white">
    <section class="rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-5 shadow-xl">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-black tracking-wide text-cyan-300">Tribo PERFEITO</h2>
          <p class="text-xs text-slate-400">Escolha o modo da fila e monte seu time sem perder o estilo raiz.</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="viewMode === 'ranked'"
            type="button"
            @click="toggleQueueType"
            class="flex items-center gap-1.5 rounded-lg border border-cyan-700/60 bg-slate-950 px-3 py-1.5 text-xs font-bold text-cyan-300 transition hover:border-cyan-500 hover:text-white"
            :title="`Trocar para ${isSoloDuo ? 'Flex' : 'Solo/Duo'}`"
          >
            <i class="fa-solid fa-right-left"></i>
            <span>{{ isSoloDuo ? 'Solo/Duo' : 'Flex' }}</span>
          </button>
          <button
            v-if="viewMode !== 'selection'"
            type="button"
            @click="goBackToSelection"
            class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white"
          >Voltar</button>
        </div>
      </div>
    </section>

    <section
      v-if="viewMode === 'selection'"
      class="rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-6 shadow-xl"
    >
      <FilaSelecao
        mode-label="Lobby"
        title="Escolha da Fila"
        description="Selecione o tipo de partida para montar seu time com fluxo ranqueado ou custom 5x5."
        :mode-options="lobbyModeOptions"
        @selecionar="onSelectLobbyMode"
      />
    </section>

    <section
      v-if="viewMode === 'ranked'"
      class="space-y-4 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-slate-800/80 p-5 shadow-xl"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-col gap-1 border-b border-slate-800/60 pb-2">
          <div class="flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-400">
            <div class="w-3 h-3 bg-cyan-500 rotate-45 border border-slate-950"></div>
            <span>SR • RANQUEADA {{ rankedQueueLabel }} • LOBBY</span>
          </div>
          <p class="text-[10px] text-slate-500">
            Meta: patch <span class="font-bold text-slate-300">{{ META_DATA.patch }}</span> • atualizado em {{ META_DATA.updatedAt }}
          </p>
          <p v-if="metaStale" class="text-[10px] font-bold text-amber-400">
            ⚠ Meta possivelmente desatualizado — gere um CSV novo (ver README)
          </p>
          <p v-if="isSoloDuo" class="text-[10px] font-bold" :class="soloDuoLocked ? 'text-amber-300' : 'text-slate-500'">
            {{ soloDuoLocked ? '🔒 Lobby Solo/Duo travado em 2 jogadores' : 'Solo/Duo: preencha 2 cards para travar o lobby' }}
          </p>
        </div>

        <button
          type="button"
          @click="findPerfectTribe"
          class="rounded-md bg-gradient-to-b from-cyan-600 to-cyan-800 border border-cyan-400/50 px-5 py-2 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:brightness-110"
        >Encontrar Tribo Perfeito</button>
      </div>

      <div v-if="synergyResult" class="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-3 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-black uppercase tracking-wider text-emerald-300">Sinergia do Time</p>
          <p class="font-black text-emerald-200">{{ synergyResult.score }}/100</p>
        </div>
        <p class="mt-1 text-sm font-black text-cyan-200">
          Seu time é {{ synergyResult.arquetipoAderencia }}% {{ synergyResult.arquetipo }}
        </p>
        <p class="mt-0.5 text-[11px] text-slate-400">
          Gerado às {{ synergyResult.generatedAt }} • encaixe de rota: {{ synergyResult.roleMatch }}/{{ synergyResult.recommendations.length }}
          <span class="text-slate-600">• {{ synergyResult.combos }} combinações em {{ synergyResult.durationMs }}ms</span>
        </p>

        <!-- Chips de pares sinérgicos -->
        <div v-if="synergyResult.pares.length" class="mt-2 flex flex-wrap gap-1">
          <span
            v-for="(par, i) in synergyResult.pares"
            :key="`par-${i}`"
            class="rounded border border-fuchsia-700/40 bg-fuchsia-950/30 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300"
          >🔗 {{ par.a }} + {{ par.b }} <span class="text-fuchsia-400/70">({{ par.tag }})</span></span>
        </div>

        <!-- Picks automáticos com tier de meta e breakdown -->
        <div v-if="synergyResult.recommendations.length" class="mt-3 space-y-1 rounded border border-slate-700/60 bg-slate-900/40 p-2">
          <p class="text-[10px] font-black uppercase tracking-wider text-slate-300">Picks recomendados</p>
          <div
            v-for="rec in synergyResult.recommendations"
            :key="`rec-${rec.slotId}`"
            class="text-[11px] text-slate-200"
          >
            <span class="text-slate-500">{{ rec.role }}:</span>
            <span class="font-black text-amber-300">{{ rec.champion }}</span>
            <span v-if="metaTierOf(rec.champion, rec.role)" class="ml-1 rounded bg-slate-800 px-1 text-[9px] font-black text-cyan-300">{{ metaTierOf(rec.champion, rec.role) }}</span>
            <span class="ml-1 text-slate-500">score {{ rec.score }}</span>
            <span v-if="rec.usedFallback" class="ml-1 text-amber-400">(sem dados do jogador)</span>
          </div>
        </div>

        <!-- Planos A/B/C -->
        <div v-if="synergyResult.planos.length > 1" class="mt-3 grid gap-2 sm:grid-cols-3">
          <div
            v-for="plano in synergyResult.planos"
            :key="`plano-${plano.rotulo}`"
            class="rounded border border-slate-700/60 bg-slate-950/50 p-2"
          >
            <p class="text-[10px] font-black text-cyan-300">Plano {{ plano.rotulo }} • {{ plano.arquetipo }} ({{ plano.aderencia }}%)</p>
            <p
              v-for="pk in plano.picks"
              :key="`plano-${plano.rotulo}-${pk.slotId}`"
              class="text-[10px] text-slate-300"
            >{{ pk.role }}: <span class="font-bold text-slate-100">{{ pk.champion }}</span></p>
          </div>
        </div>
      </div>

      <!-- Lanes fixas (Top → Jungle → Mid → ADC → Supp). Arraste um card para outro para trocar de rota. -->
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article
          v-for="(slot, slotIndex) in rankedSlots"
          :key="slot.id"
          class="relative flex min-h-[360px] flex-col rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-3 transition"
          :class="[
            isSlotFrozen(slot) ? 'opacity-50 grayscale' : '',
            draggedRankedId && slot.gameName ? 'ring-1 ring-cyan-500/40' : ''
          ]"
          :draggable="Boolean(slot.gameName) && !isSlotFrozen(slot)"
          @dragstart="onRankedDragStart(slot.id)"
          @dragend="onRankedDragEnd"
          @dragover.prevent
          @drop.prevent="onRankedDrop(slot.id)"
        >
          <!-- Freeze visual do lobby Solo/Duo: bloqueia interação nos cards travados -->
          <div
            v-if="isSlotFrozen(slot)"
            class="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-slate-950/50"
          >
            <span class="rounded border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              🔒 Lobby travado
            </span>
          </div>

          <!-- Cabeçalho da lane: ícone + rótulo fixos da posição -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-700/60 bg-slate-950 shadow-[0_0_12px_rgba(8,145,178,0.25)]">
                <img class="h-4 w-4 object-contain" :src="roles[slotIndex].icon" :alt="roles[slotIndex].label" />
              </span>
              <div class="leading-tight">
                <p class="text-[10px] font-black uppercase tracking-widest text-cyan-200">{{ roles[slotIndex].label }}</p>
                <p class="text-[9px] font-bold uppercase tracking-wider text-slate-500">Slot {{ slotIndex + 1 }}</p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button
                v-if="slot.gameName"
                type="button"
                @click="findCompanionsForSlot(slot.id)"
                class="rounded border border-cyan-700/60 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 hover:text-white"
                title="Buscar amigos frequentes"
              >Amigos</button>
              <button
                v-if="slot.gameName"
                type="button"
                @click="resetRankedSlot(slot.id)"
                class="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-white"
              >Limpar</button>
            </div>
          </div>

          <div class="mt-3 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-center">
            <template v-if="!slot.gameName">
              <button
                type="button"
                @click="slot.showSearch = !slot.showSearch"
                class="flex h-16 w-16 items-center justify-center rounded-full border border-amber-700 bg-slate-900 text-3xl font-black text-amber-400 hover:bg-slate-800"
              >+</button>

              <div v-if="slot.showSearch" class="w-full">
                <SearchBar
                  buttonText=""
                  :load-masteries="false"
                  :sync-global-store="false"
                  @search-start="onRankedSearchStart(slot.id)"
                  @search-success="(data) => onRankedSearchSuccess(slot.id, data)"
                  @search-error="(msg) => onRankedSearchError(slot.id, msg)"
                />
              </div>

              <p v-if="slot.loading" class="text-[11px] font-bold text-amber-300">Carregando invocador...</p>
              <p v-if="slot.error" class="text-[10px] font-bold text-red-400">{{ slot.error }}</p>

              <button
                type="button"
                @click="setAnonymous(slot.id)"
                class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white"
              >Anônimo</button>
            </template>

            <template v-else>
              <img
                class="h-16 w-16 cursor-grab rounded-full border-2 border-slate-700 object-cover"
                :src="profileIconImage(slot.profileIconId || 29)"
                @error="(e) => e.target.src = profileIconImage(29)"
                alt="Icone"
              />
              <p class="text-sm font-black text-slate-100">{{ slot.gameName }}</p>
              <p class="text-[10px] font-bold text-slate-500">#{{ slot.tagLine || 'BR1' }}</p>
              <p v-if="slot.masteriesLoading" class="text-[10px] font-bold text-amber-400 animate-pulse">Sincronizando maestrias...</p>
              <p
                v-if="slot.mainRoles?.length"
                class="rounded border border-emerald-800/50 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
              >rota principal: {{ slot.mainRoles[0].rota }} ({{ slot.mainRoles[0].pct }}%)</p>
              <p v-if="degradacaoSlot(slot)" class="rounded border border-amber-800/50 bg-amber-950/30 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                {{ degradacaoSlot(slot) }}
              </p>

              <div class="grid w-full gap-1 text-[10px]">
                <p class="rounded border border-slate-800 bg-slate-900/70 px-2 py-1 font-bold text-cyan-300">
                  Solo: {{ slot.statsSolo?.tier && slot.statsSolo?.tier !== 'UNRANKED' ? `${slot.statsSolo.tier} ${slot.statsSolo.rank || ''}`.trim() : 'UNRANKED' }}
                </p>
                <p class="rounded border border-slate-800 bg-slate-900/70 px-2 py-1 font-bold text-purple-300">
                  Flex: {{ slot.statsFlex?.tier && slot.statsFlex?.tier !== 'UNRANKED' ? `${slot.statsFlex.tier} ${slot.statsFlex.rank || ''}`.trim() : 'UNRANKED' }}
                </p>
              </div>

              <button
                type="button"
                @click="openChampionModal(slot.id)"
                class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-amber-500"
              >
                {{ slot.championLocked ? `Pick: ${slot.championLocked}` : 'Selecionar Campeão' }}
              </button>

              <!-- Ao carregar o jogador: maior maestria + meta sugerido (fora os da maestria) -->
              <div v-if="slot.masteries?.length" class="grid w-full gap-2 sm:grid-cols-2">
                <div class="rounded-lg border border-amber-900/40 bg-slate-900/50 p-2 text-left">
                  <p class="text-[9px] font-black uppercase tracking-wider text-amber-300">Maior maestria</p>
                  <button
                    v-for="m in masteriaTop5(slot)"
                    :key="`maes-${slot.id}-${m.name}`"
                    type="button"
                    @click="slot.championLocked = m.name"
                    class="mt-1 flex w-full items-center gap-1 text-[9px] text-slate-300 hover:text-white"
                  >
                    <img class="h-4 w-4 rounded" :src="championImage(m.name)" @error="onChampionImageError" :alt="m.name" />
                    <span class="truncate flex-1 text-left">{{ m.name }}</span>
                    <span class="text-slate-500">{{ (m.pontos / 1000).toFixed(0) }}k</span>
                  </button>
                </div>
                <div class="rounded-lg border border-cyan-900/40 bg-slate-900/50 p-2 text-left">
                  <p class="text-[9px] font-black uppercase tracking-wider text-cyan-300">Meta sugerido</p>
                  <button
                    v-for="m in metaSugerido(slot)"
                    :key="`metasug-${slot.id}-${m.name}`"
                    type="button"
                    @click="slot.championLocked = m.name"
                    class="mt-1 flex w-full items-center gap-1 text-[9px] text-slate-300 hover:text-white"
                  >
                    <img class="h-4 w-4 rounded" :src="championImage(m.name)" @error="onChampionImageError" :alt="m.name" />
                    <span class="truncate flex-1 text-left">{{ m.name }}</span>
                    <span class="text-cyan-400">{{ m.tier }} {{ m.role }}</span>
                  </button>
                </div>
              </div>

              <!-- Sugestões de Sinergia: estritamente filtradas para a lane fixa deste card ({{ roles[slotIndex].label }}) -->
              <div class="w-full rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                <p class="text-[10px] font-black uppercase tracking-wider text-emerald-300">Top 5 por Sinergia • {{ roles[slotIndex].label }}</p>
                <p class="mt-1 text-[10px] text-slate-500">Clique para travar campeão rapidamente.</p>
                <div class="mt-2 space-y-1" v-if="slot.synergyTop5.length">
                  <button
                    v-for="(option, optionIndex) in slot.synergyTop5"
                    :key="`syn-${slot.id}-${option.name}`"
                    type="button"
                    @click="slot.championLocked = option.name"
                    class="flex w-full items-center gap-2 rounded border border-emerald-800/40 bg-slate-950 px-2 py-1 text-left hover:border-emerald-500/70"
                  >
                    <span class="w-4 text-[10px] font-black text-emerald-300">{{ optionIndex + 1 }}</span>
                    <img class="h-6 w-6 rounded" :src="championImage(option.name)" @error="onChampionImageError" :alt="option.name" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-[10px] font-black text-slate-100">{{ option.name }}</p>
                      <p class="truncate text-[9px] text-slate-400">{{ option.summary }}</p>
                    </div>
                    <span class="text-[10px] font-black text-emerald-200">{{ option.score }}</span>
                  </button>
                </div>
                <p v-else class="mt-2 text-[10px] text-slate-500">Clique em Encontrar Tribo Perfeito para gerar as 5 opções.</p>
              </div>

              <!-- Conforto vs Expandir pool -->
              <div v-if="slot.conforto?.length || slot.expandir?.length" class="grid w-full gap-2 sm:grid-cols-2">
                <div v-if="slot.conforto?.length" class="rounded-lg border border-cyan-900/40 bg-slate-900/50 p-2 text-left">
                  <p class="text-[9px] font-black uppercase tracking-wider text-cyan-300">Conforto</p>
                  <button
                    v-for="c in slot.conforto"
                    :key="`conf-${slot.id}-${c.name}`"
                    type="button"
                    @click="slot.championLocked = c.name"
                    class="mt-1 flex w-full items-center gap-1 text-[9px] text-slate-300 hover:text-white"
                  >
                    <img class="h-4 w-4 rounded" :src="championImage(c.name)" @error="onChampionImageError" :alt="c.name" />
                    <span class="truncate flex-1 text-left">{{ c.name }}</span>
                    <span v-if="c.metaTier !== '-'" class="text-cyan-400">{{ c.metaTier }}</span>
                    <span class="text-slate-500">{{ Math.round(c.proficiencia * 100) }}%</span>
                  </button>
                </div>
                <div v-if="slot.expandir?.length" class="rounded-lg border border-fuchsia-900/40 bg-slate-900/50 p-2 text-left">
                  <p class="text-[9px] font-black uppercase tracking-wider text-fuchsia-300">Expandir pool</p>
                  <button
                    v-for="c in slot.expandir"
                    :key="`exp-${slot.id}-${c.name}`"
                    type="button"
                    @click="slot.championLocked = c.name"
                    class="mt-1 flex w-full items-center gap-1 text-[9px] text-slate-300 hover:text-white"
                  >
                    <img class="h-4 w-4 rounded" :src="championImage(c.name)" @error="onChampionImageError" :alt="c.name" />
                    <span class="truncate flex-1 text-left">{{ c.name }}</span>
                    <span v-if="c.metaTier !== '-'" class="text-fuchsia-400">{{ c.metaTier }}</span>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </article>
      </div>

      <!-- Encontrar amigos: igual ao "Reservas / Espectadores" do Saguão Custom, preenchido em background -->
      <div class="rounded-xl border border-cyan-900/40 bg-slate-950/60 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-[11px] font-black uppercase tracking-widest text-cyan-300">Encontrar amigos</p>
          <p v-if="statusMessage" class="rounded border border-amber-700/40 bg-amber-950/40 px-2 py-1 text-[10px] font-bold text-amber-200">
            {{ statusMessage }}<span v-if="companionLoading"> • carregando companheiros...</span>
          </p>
        </div>
        <p class="mt-1 text-[10px] text-slate-500">
          Clique em <span class="font-bold text-cyan-300">Amigos</span> num jogador para puxar os 5 companheiros mais frequentes dele.
        </p>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div
            v-for="friend in friendSlots"
            :key="`friend-${friend.id}`"
            class="rounded border border-slate-800 bg-slate-900/50 p-2"
          >
            <div class="flex items-center gap-2">
              <img
                class="h-7 w-7 rounded border border-cyan-700/50 object-cover"
                :src="profileIconImage(friend.profileIconId || 29)"
                @error="(e) => e.target.src = profileIconImage(29)"
                alt="Icone"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-[10px] font-bold text-slate-200">{{ friend.gameName || 'Vazio' }}</p>
                <p class="truncate text-[9px] text-slate-400">{{ friend.tagLine ? `#${friend.tagLine}` : 'Aguardando jogador' }}</p>
              </div>
              <img
                v-if="friend.gameName"
                class="h-4 w-4 object-contain"
                :src="companionRoleIcon(friend.role)"
                :alt="friend.role"
              />
            </div>
            <p class="mt-1 truncate text-[10px] font-black text-cyan-300">
              {{ formatRankLabel(friend) }}<span v-if="friend.gameName"> • {{ mmrWeight(friend) }} pts</span>
            </p>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="viewMode === 'custom'"
      class="space-y-4 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-slate-800 p-5 shadow-2xl"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs font-black uppercase tracking-wider text-slate-400">Saguão Custom 5v5</p>
          <p class="text-[11px] text-slate-500">Use os blocos [+] para adicionar jogadores, buscar perfil ou preencher anônimo com elo manual.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            @click="drawBalancedTeams"
            class="rounded-md bg-gradient-to-b from-yellow-600 to-yellow-700 border border-yellow-500/50 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.15)] hover:brightness-110"
          >Festa da Fogueira (Sortear)</button>
          <button
            type="button"
            @click="drawRandomTeams"
            class="rounded-md bg-slate-900 border border-slate-700 px-4 py-2 text-xs font-black uppercase tracking-wider text-yellow-500 hover:bg-slate-800"
          >Fogueira Maluca (Sorteio Raiz)</button>
        </div>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1fr_auto_1fr]">
        <div class="space-y-2 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-3">
          <p class="text-xs font-black tracking-widest text-blue-400 uppercase mb-1">Lado Azul (Time 1)</p>
          <div class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 divide-y divide-slate-900 xl:max-h-none xl:overflow-visible">
            <div v-for="slot in blueSlots" :key="slot.id">
              <CustomSlotCard
                :slot="slot"
                @search="searchCustomSlot"
                @clear="clearCustomSlot"
                @anonymous="setCustomAnonymous"
                @dragstart="onDragStart"
                @drop="onDropToSlot"
              />
            </div>
          </div>
        </div>

        <div class="hidden w-px bg-slate-700/70 xl:block"></div>

        <div class="space-y-2 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-slate-800 p-3">
          <p class="text-xs font-black tracking-widest text-red-400 uppercase mb-1">Lado Vermelho (Time 2)</p>
          <div class="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 divide-y divide-slate-900 xl:max-h-none xl:overflow-visible">
            <div v-for="slot in redSlots" :key="slot.id">
              <CustomSlotCard
                :slot="slot"
                @search="searchCustomSlot"
                @clear="clearCustomSlot"
                @anonymous="setCustomAnonymous"
                @dragstart="onDragStart"
                @drop="onDropToSlot"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-xl bg-slate-950/60 border border-slate-900 p-4">
        <p class="mb-2 text-[11px] font-black tracking-widest text-slate-400 uppercase">Banco de Reservas / Espectadores</p>
        <div class="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <div v-for="slot in reserveSlots" :key="slot.id">
            <CustomSlotCard
              :slot="slot"
              @search="searchCustomSlot"
              @clear="clearCustomSlot"
              @anonymous="setCustomAnonymous"
              @dragstart="onDragStart"
              @drop="onDropToSlot"
            />
          </div>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-xl border border-slate-900 bg-slate-950/70 p-3 text-xs">
          <p class="font-black text-cyan-300">MMR Time Azul: {{ blueMmr }}</p>
          <p class="text-slate-400">Jogadores: {{ blueFilledCount }}/5</p>
        </div>
        <div class="rounded-xl border border-slate-900 bg-slate-950/70 p-3 text-xs">
          <p class="font-black text-red-300">MMR Time Vermelho: {{ redMmr }}</p>
          <p class="text-slate-400">Jogadores: {{ redFilledCount }}/5</p>
        </div>
      </div>
      <p class="text-center text-xs font-bold" :class="mmrDiff <= 120 ? 'text-emerald-400' : 'text-amber-400'">
        Diferença de MMR: {{ mmrDiff }}
      </p>
    </section>

    <div
      v-if="championModal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      @click.self="closeChampionModal"
    >
      <div class="max-h-[85vh] w-full max-w-4xl rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-lg font-black text-amber-300">Escolher Campeão</h3>
          <button type="button" class="rounded border border-slate-700 px-2 py-1 text-xs font-bold" @click="closeChampionModal">Fechar</button>
        </div>
        <input
          v-model="championModal.query"
          class="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          placeholder="Filtrar campeão..."
        />
        <div class="max-h-[64vh] overflow-y-auto">
          <p v-if="currentModalSynergyTop5.length" class="mb-2 text-xs font-black uppercase tracking-wider text-emerald-300">Top 5 por Sinergia (Prioridade)</p>
          <div class="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <button
              v-for="option in filteredSynergyTop5"
              :key="`top-${option.name}`"
              type="button"
              @click="lockChampionFromModal(option.name)"
              class="flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-slate-950 px-2 py-1.5 text-left text-xs font-semibold hover:border-emerald-400"
            >
              <img class="h-7 w-7 rounded" :src="championImage(option.name)" @error="onChampionImageError" :alt="option.name" />
              <div class="min-w-0">
                <p class="truncate font-black text-emerald-100">{{ option.name }}</p>
                <p class="truncate text-[10px] text-slate-400">{{ option.summary }}</p>
              </div>
            </button>
          </div>

          <p class="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Lista Completa</p>
          <div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <button
              v-for="champ in filteredAllChampions"
              :key="champ"
              type="button"
              @click="lockChampionFromModal(champ)"
              class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-left text-xs font-semibold hover:border-cyan-500"
            >
              <img class="h-7 w-7 rounded" :src="championImage(champ)" @error="onChampionImageError" :alt="champ" />
              <span class="truncate">{{ champ }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import SearchBar from './SearchBar.vue';
import CustomSlotCard from './CustomSlotCard.vue';
import FilaSelecao from './FilaSelecao.vue';
import { state } from '../store.js';
import { workerRequest } from '../api.js';
import { championImage, profileIconImage, getChampionIdFromName, DDRAGON_VERSION } from '../utils.js';
import { getChampionMetrics, roleFitScore, scoreToPercent, sinergiaDePares, avaliarTime, scoreIndividual, similaridadeDeEstilo, metaScore, metaTierOf, metaIsStale, topMetaChampions, META_DATA, SCORE_WEIGHTS } from '../utils/sinergiaMotor.js';
import { calcularProficiencia, rotasPrincipais } from '../utils/proficiencia.js';

const store = state;
const router = useRouter();
const viewMode = ref('selection');
const queueType = ref('solo_duo');
const rerollSeed = ref(0);
const draggedSlotId = ref(null);
const draggedRankedId = ref(null);
const synergyResult = ref(null);

const lobbyModeOptions = [
  { id: 'solo_duo', titulo: 'Ranked Solo/Duo', subtitulo: 'Abra o lobby ranqueado para até 2 jogadores.' },
  { id: 'flex', titulo: 'Ranked Flex', subtitulo: 'Abra o lobby ranqueado para composição completa.' },
  { id: 'custom_5x5', titulo: 'Customizada 5x5', subtitulo: 'Monte dois times, reservas e faça sorteio balanceado.' }
];

const rankedQueueLabel = computed(() => (queueType.value === 'solo_duo' ? 'SOLO/DUO' : 'FLEX'));
const isSoloDuo = computed(() => queueType.value === 'solo_duo');
const metaStale = computed(() => metaIsStale());

const roles = [
  { value: 'TOP', label: 'Top', icon: roleIcon('top') },
  { value: 'JUNGLE', label: 'Jungle', icon: roleIcon('jungle') },
  { value: 'MID', label: 'Mid', icon: roleIcon('middle') },
  { value: 'ADC', label: 'ADC', icon: roleIcon('bottom') },
  { value: 'SUP', label: 'Sup', icon: roleIcon('utility') }
];

const rankedSlots = reactive(Array.from({ length: 5 }, (_, i) => createRankedSlot(i + 1)));
const customSlots = reactive(Array.from({ length: 15 }, (_, i) => createCustomSlot(i + 1)));
const friendSlots = reactive(Array.from({ length: 5 }, (_, i) => createFriendSlot(i + 1)));

// Estado da seção "Encontrar amigos" (portado do saguaoCustom.vue).
const statusMessage = ref('');
const companionLoading = ref(false);
const companionProfileCache = new Map();

const championModal = reactive({
  open: false,
  slotId: null,
  query: ''
});

// Slots ranqueados preenchidos com jogador real/anônimo.
const filledRankedSlots = computed(() => rankedSlots.filter((slot) => slot.gameName));
// Solo/Duo trava quando EXATAMENTE 2 cards estão preenchidos: os demais congelam.
const soloDuoLocked = computed(() => isSoloDuo.value && filledRankedSlots.value.length >= 2);

// Slots considerados pelo motor: Flex usa os 5; Solo/Duo usa apenas os preenchidos.
const activeRankedSlots = computed(() => {
  if (!isSoloDuo.value) return rankedSlots.slice(0, 5);
  return filledRankedSlots.value.length ? filledRankedSlots.value : rankedSlots.slice(0, 2);
});

const blueSlots = computed(() => customSlots.slice(0, 5));
const redSlots = computed(() => customSlots.slice(5, 10));
const reserveSlots = computed(() => customSlots.slice(10, 15));

const blueFilledCount = computed(() => blueSlots.value.filter((slot) => slot.gameName).length);
const redFilledCount = computed(() => redSlots.value.filter((slot) => slot.gameName).length);
const blueMmr = computed(() => blueSlots.value.reduce((sum, slot) => sum + mmrWeight(slot), 0));
const redMmr = computed(() => redSlots.value.reduce((sum, slot) => sum + mmrWeight(slot), 0));
const mmrDiff = computed(() => Math.abs(blueMmr.value - redMmr.value));

const currentModalSlot = computed(() => rankedSlots.find((slot) => slot.id === championModal.slotId) || null);
const currentModalSynergyTop5 = computed(() => {
  const slot = currentModalSlot.value;
  if (!slot) return [];
  return (slot.synergyTop5 || []).slice(0, 5);
});

const currentModalAllChampions = computed(() => {
  const slot = currentModalSlot.value;
  const allNames = (store.staticData.championList || []).map((champ) => champ.name).sort((a, b) => a.localeCompare(b));
  if (!slot) return allNames;
  const topSet = new Set(currentModalSynergyTop5.value.map((option) => option.name));
  return allNames.filter((name) => !topSet.has(name));
});

const filteredSynergyTop5 = computed(() => {
  const q = championModal.query.trim().toLowerCase();
  return q
    ? currentModalSynergyTop5.value.filter((option) => option.name.toLowerCase().includes(q))
    : currentModalSynergyTop5.value;
});

const filteredAllChampions = computed(() => {
  const q = championModal.query.trim().toLowerCase();
  return q ? currentModalAllChampions.value.filter((name) => name.toLowerCase().includes(q)) : currentModalAllChampions.value;
});

function createRankedSlot(id) {
  return {
    id,
    type: 'empty',
    showSearch: false,
    loading: false,
    masteriesLoading: false,
    error: null,
    gameName: '',
    tagLine: '',
    profileIconId: 29,
    statsSolo: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    statsFlex: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    // Rota fixa pela posição do slot (1=TOP, 2=JUNGLE, 3=MID, 4=ADC, 5=SUP).
    role: roles[id - 1]?.value || 'MID',
    championLocked: '',
    masteries: [],
    partidas: [],
    proficiencia: {},
    mainRoles: [],
    synergyTop5: [],
    conforto: [],
    expandir: [],
    companions: { solo: [], flex: [] }
  };
}

function createCustomSlot(id) {
  return {
    id,
    rawInput: '',
    showSearch: false,
    loading: false,
    error: null,
    gameName: '',
    tagLine: '',
    profileIconId: 29,
    statsSolo: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    statsFlex: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    manualTier: '',
    manualRank: '',
    manualLp: '',
    manualWinRate: ''
  };
}

function createFriendSlot(id) {
  return {
    id,
    gameName: '',
    tagLine: '',
    summonerLevel: 0,
    profileIconId: 29,
    statsSolo: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    statsFlex: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    manualTier: '',
    manualRank: '',
    manualLp: '',
    role: 'AUTOFILL'
  };
}

function roleIcon(roleKey) {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${roleKey}.png`;
}

// Ícone de rota para os companheiros (aceita posições do match-history e fallback FILL).
function companionRoleIcon(role) {
  const map = {
    TOP: 'top',
    JUNGLE: 'jungle',
    MID: 'middle',
    MIDDLE: 'middle',
    ADC: 'bottom',
    BOTTOM: 'bottom',
    SUP: 'utility',
    SUPPORT: 'utility',
    UTILITY: 'utility',
    AUTOFILL: 'fill'
  };
  return roleIcon(map[String(role || '').toUpperCase()] || 'fill');
}

// Card congelado: lobby Solo/Duo travado e este slot está vazio.
function isSlotFrozen(slot) {
  return soloDuoLocked.value && !slot.gameName;
}

function onSelectLobbyMode(mode) {
  synergyResult.value = null;

  if (mode === 'custom_5x5') {
    router.push('/saguaoCustom');
    return;
  }

  queueType.value = mode === 'flex' ? 'flex' : 'solo_duo';
  viewMode.value = 'ranked';
}

function goBackToSelection() {
  closeChampionModal();
  viewMode.value = 'selection';
}

// Alterna o lobby ranqueado entre Solo/Duo e Flex sem voltar para a seleção.
function toggleQueueType() {
  queueType.value = isSoloDuo.value ? 'flex' : 'solo_duo';
  synergyResult.value = null;
}

function resetRankedSlot(slotId) {
  const idx = rankedSlots.findIndex((slot) => slot.id === slotId);
  if (idx === -1) return;
  const role = rankedSlots[idx].role;
  rankedSlots[idx] = { ...createRankedSlot(slotId), role };
}

function setAnonymous(slotId) {
  const slot = rankedSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.type = 'anonymous';
  slot.showSearch = false;
  slot.loading = false;
  slot.masteriesLoading = false;
  slot.error = null;
  slot.gameName = 'Invocador Anonimo';
  slot.tagLine = 'OFFLINE';
  slot.profileIconId = 29;
  slot.championLocked = '';
  slot.masteries = [];
  slot.synergyTop5 = [];
}

function onRankedSearchStart(slotId) {
  const slot = rankedSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.loading = true;
  slot.error = null;
  slot.showSearch = true;
  slot.synergyTop5 = [];
}

async function onRankedSearchSuccess(slotId, profileData) {
  const slot = rankedSlots.find((item) => item.id === slotId);
  if (!slot) return;

  slot.loading = false;
  slot.error = null;
  slot.showSearch = false;
  slot.type = 'real';
  slot.gameName = profileData?.gameName || store.searchProfile.gameName;
  slot.tagLine = profileData?.tagLine || store.searchProfile.tagLine;
  slot.profileIconId = profileData?.profileIconId || store.searchProfile.profileIconId || 29;
  slot.statsSolo = profileData?.statsSolo || store.searchProfile.statsSolo;
  slot.statsFlex = profileData?.statsFlex || store.searchProfile.statsFlex;
  slot.partidas = Array.isArray(profileData?.proficiencyMatches) ? profileData.proficiencyMatches : [];
  slot.companions = profileData?.companions || { solo: [], flex: [] };
  slot.masteriesLoading = true;
  slot.synergyTop5 = [];

  loadRankedMasteries(slot, profileData)
    .finally(() => {
      slot.masteriesLoading = false;
      atualizarProficienciaDoSlot(slot);
    });
}

// FASE 1.3: proficiência por campeão + inferência das rotas mais jogadas (apenas informativo:
// a rota do card é FIXA pela posição do slot, então não sobrescrevemos slot.role).
function atualizarProficienciaDoSlot(slot) {
  slot.proficiencia = calcularProficiencia({ masteries: slot.masteries, partidas: slot.partidas });
  slot.mainRoles = rotasPrincipais(slot.proficiencia).slice(0, 2);
}

function onRankedSearchError(slotId, message) {
  const slot = rankedSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.loading = false;
  slot.masteriesLoading = false;
  slot.showSearch = true;
  slot.error = message;
}

async function loadRankedMasteries(slot, profileData) {
  try {
    const masteryData = await withTimeout(
      workerRequest('masteries', {
        puuid: profileData?.puuid || store.searchProfile.puuid,
        gameName: slot.gameName,
        tagLine: slot.tagLine
      }),
      7000
    );
    slot.masteries = normalizeMasteries(masteryData?.masteries || []);
  } catch (error) {
    slot.masteries = [];
    console.warn('Masteries do slot nao carregaram a tempo:', error?.message || error);
  }
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout ao carregar maestrias.')), timeoutMs);
    })
  ]);
}

// ---- Drag and drop dos cards ranqueados: troca jogadores mantendo a rota da POSIÇÃO ----
function onRankedDragStart(slotId) {
  const slot = rankedSlots.find((item) => item.id === slotId);
  if (!slot?.gameName || isSlotFrozen(slot)) return;
  draggedRankedId.value = slotId;
}

function onRankedDragEnd() {
  draggedRankedId.value = null;
}

function onRankedDrop(targetSlotId) {
  const from = draggedRankedId.value;
  draggedRankedId.value = null;
  if (!from || from === targetSlotId) return;

  const fromIdx = rankedSlots.findIndex((slot) => slot.id === from);
  const toIdx = rankedSlots.findIndex((slot) => slot.id === targetSlotId);
  if (fromIdx === -1 || toIdx === -1) return;
  if (isSlotFrozen(rankedSlots[toIdx])) return;

  // Troca o conteúdo do jogador, preservando id, role e sugestões zeradas (rota mudou).
  const fromRole = rankedSlots[fromIdx].role;
  const toRole = rankedSlots[toIdx].role;
  const tmp = { ...rankedSlots[fromIdx] };

  rankedSlots[fromIdx] = { ...rankedSlots[toIdx], id: rankedSlots[fromIdx].id, role: fromRole, synergyTop5: [], conforto: [], expandir: [] };
  rankedSlots[toIdx] = { ...tmp, id: rankedSlots[toIdx].id, role: toRole, synergyTop5: [], conforto: [], expandir: [] };
}

function openChampionModal(slotId) {
  championModal.open = true;
  championModal.slotId = slotId;
  championModal.query = '';
}

function closeChampionModal() {
  championModal.open = false;
  championModal.slotId = null;
  championModal.query = '';
}

function lockChampionFromModal(championName) {
  const slot = rankedSlots.find((item) => item.id === championModal.slotId);
  if (!slot) return;
  slot.championLocked = championName;
  closeChampionModal();
}

function normalizeMasteries(list) {
  return (list || []).map((entry) => {
    const staticEntry = (store.staticData.championList || []).find((champ) => Number(champ.key) === Number(entry?.championId));
    return {
      championId: entry?.championId,
      championName: entry?.championName || staticEntry?.name || 'Aatrox',
      championLevel: Number(entry?.championLevel || 1),
      championPoints: Number(entry?.championPoints || 0),
      lastPlayTime: Number(entry?.lastPlayTime || 0)
    };
  });
}

function championTags(name) {
  const champ = (store.staticData.championList || []).find((entry) => entry.name === name);
  return champ?.tags || [];
}

function candidateMatchesSlotRole(championName, slotRole, tags = []) {
  const metrics = getChampionMetrics(championName, tags);
  const rolesFromSheet = Array.isArray(metrics?.roles) ? metrics.roles : [];
  if (rolesFromSheet.length) return rolesFromSheet.includes(String(slotRole || '').toUpperCase());
  return roleFitScore(slotRole, tags) >= 0.45;
}

function buildCandidatePool(slot, pickedChampions) {
  const pickedSet = new Set(pickedChampions || []);
  const list = [];

  // Proficiência do jogador deste slot (anônimo / sem dados => fallback 0.35)
  const profMap = slot.proficiencia || {};
  const profDe = (nome) => Number(profMap[nome]?.proficiencia ?? 0.35);

  if (slot.type === 'real' && (slot.masteries || []).length) {
    for (const entry of slot.masteries.slice(0, 30)) {
      if (!entry?.championName || pickedSet.has(entry.championName)) continue;
      const tags = championTags(entry.championName);
      // Sugestões de sinergia estritamente filtradas para a lane fixa deste card.
      if (!candidateMatchesSlotRole(entry.championName, slot.role, tags)) continue;
      list.push({
        name: entry.championName,
        masteryPoints: Number(entry.championPoints || 0),
        proficiencia: profDe(entry.championName),
        tags,
        metrics: getChampionMetrics(entry.championName, tags),
        usedFallback: false
      });
    }
  }

  if (!list.length) {
    const fallback = (store.staticData.championList || [])
      .map((champ) => ({
        name: champ.name,
        masteryPoints: 0,
        proficiencia: profDe(champ.name),
        tags: champ.tags || [],
        metrics: getChampionMetrics(champ.name, champ.tags || []),
        usedFallback: true
      }))
      .filter((candidate) => !pickedSet.has(candidate.name))
      .filter((candidate) => candidateMatchesSlotRole(candidate.name, slot.role, candidate.tags))
      .sort((a, b) => a.name.localeCompare(b.name));

    return fallback;
  }

  return list;
}

const DIMENSION_LABELS = {
  engage: 'engage',
  poke: 'poke',
  frontline: 'frontline',
  burst: 'burst',
  disengage: 'desengage',
  utility: 'utilidade',
  peel: 'peel',
  waveclear: 'waveclear'
};

function damageTypeLabel(type) {
  if (type === 'AP') return 'dano AP';
  if (type === 'MIXED') return 'dano misto';
  return 'dano AD';
}

function describePickTraits(championName, slotRole) {
  const tags = championTags(championName);
  const metrics = getChampionMetrics(championName, tags);
  const roleScore = Math.round(roleFitScore(slotRole, tags) * 100);

  const topDimensions = ['engage', 'poke', 'frontline', 'burst', 'disengage', 'utility', 'peel', 'waveclear']
    .map((key) => ({ key, value: Number(metrics?.[key] || 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((item) => DIMENSION_LABELS[item.key] || item.key);

  const mech = (metrics?.mechTags || []).slice(0, 2).join(', ');
  return `${damageTypeLabel(metrics?.damageType)} • forte em ${topDimensions.join(' + ')} • rota ${roleScore}%${mech ? ' • ' + mech : ''}`;
}

const round2 = (v) => Math.round(v * 100) / 100;

// 5 campeões de maior maestria do slot (continuam considerados independentemente da lane).
function masteriaTop5(slot) {
  return (slot.masteries || [])
    .slice()
    .sort((a, b) => Number(b.championPoints || 0) - Number(a.championPoints || 0))
    .slice(0, 5)
    .map((m) => ({ name: m.championName, pontos: Number(m.championPoints || 0) }));
}

// Top 5 do meta da LANE fixa do card que o jogador ainda NÃO domina (fora os de maior maestria).
function metaSugerido(slot) {
  const jaTem = new Set(masteriaTop5(slot).map((m) => m.name));
  return topMetaChampions([...jaTem], 5, slot.role);
}

// Aviso de degradação de dados por slot (FASE 5.4).
function degradacaoSlot(slot) {
  if (slot.type === 'anonymous') return 'sem dados — usando meta + rota';
  if (slot.type === 'real' && !(slot.partidas || []).length) return 'sem partidas recentes — usando só maestria';
  return '';
}

// Pool de top K candidatos de um slot, ranqueado pelo score individual.
function poolDoSlot(slot, K) {
  if (slot.championLocked) {
    const tags = championTags(slot.championLocked);
    const cand = {
      name: slot.championLocked,
      proficiencia: Number((slot.proficiencia || {})[slot.championLocked]?.proficiencia ?? 0.35),
      tags,
      usedFallback: false
    };
    return [{ ...cand, scoreInd: scoreIndividual(cand, slot.role) }];
  }
  return buildCandidatePool(slot, [])
    .map((c) => ({ ...c, scoreInd: scoreIndividual(c, slot.role) }))
    .sort((a, b) => b.scoreInd - a.scoreInd)
    .slice(0, K);
}

// Top campeões do jogador por proficiência (para a similaridade de estilo).
function topChampsDoSlot(slot) {
  return Object.entries(slot.proficiencia || {})
    .map(([name, d]) => ({ name, proficiencia: Number(d?.proficiencia ?? 0) }))
    .sort((a, b) => b.proficiencia - a.proficiencia)
    .slice(0, 5);
}

// FASE 4 — Otimização global: top K por slot, produto cartesiano, score de time.
function findPerfectTribe() {
  const t0 = performance.now();
  const slots = activeRankedSlots.value;
  if (!slots.length) {
    synergyResult.value = null;
    return;
  }
  const { W_TIME } = SCORE_WEIGHTS;

  let K = 8;
  let pools = slots.map((s) => poolDoSlot(s, K));
  let totalCombos = pools.reduce((acc, p) => acc * Math.max(1, p.length), 1);
  if (totalCombos > 200000) {
    K = 6;
    pools = slots.map((s) => poolDoSlot(s, K));
    totalCombos = pools.reduce((acc, p) => acc * Math.max(1, p.length), 1);
  }

  // Produto cartesiano (descartando campeão repetido), avaliando o time completo
  const avaliados = [];
  const atual = [];
  (function recurse(idx, somaInd) {
    if (idx === pools.length) {
      const nomes = atual.map((p) => p.name);
      const aval = avaliarTime(nomes);
      const score = round2(somaInd + W_TIME * aval.componente);
      avaliados.push({ picks: atual.slice(), nomes, score, arquetipo: aval.arquetipo, aderencia: aval.aderencia });
      return;
    }
    for (const cand of pools[idx]) {
      if (atual.some((p) => p.name === cand.name)) continue;
      atual.push(cand);
      recurse(idx + 1, somaInd + cand.scoreInd);
      atual.pop();
    }
  })(0, 0);

  if (!avaliados.length) {
    synergyResult.value = null;
    return;
  }
  // Desempate determinístico: ordem dos slots não altera o time recomendado
  avaliados.sort((a, b) => b.score - a.score || [...a.nomes].sort().join().localeCompare([...b.nomes].sort().join()));
  const vencedor = avaliados[0];

  // Planos A/B/C com arquétipos distintos (quando possível)
  const planos = [vencedor];
  for (const av of avaliados) {
    if (planos.length >= 3) break;
    if (av === vencedor) continue;
    if (!planos.some((p) => p.arquetipo === av.arquetipo)) planos.push(av);
  }

  // Aplica o time vencedor aos slots não travados
  slots.forEach((slot, idx) => {
    if (!slot.championLocked) slot.championLocked = vencedor.picks[idx].name;
  });

  // Por slot: synergyTop5 (melhor score de time em que cada candidato aparece) + Conforto/Expandir
  slots.forEach((slot, idx) => {
    const melhorPorCand = new Map();
    for (const av of avaliados) {
      const nome = av.picks[idx]?.name;
      if (!nome) continue;
      if (!melhorPorCand.has(nome) || av.score > melhorPorCand.get(nome)) melhorPorCand.set(nome, av.score);
    }
    slot.synergyTop5 = [...melhorPorCand.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, scoreTime]) => ({ name, score: round2(scoreTime), summary: describePickTraits(name, slot.role) }));

    const fullPool = buildCandidatePool(slot, []);
    const topChamps = topChampsDoSlot(slot);
    slot.conforto = fullPool
      .filter((c) => Number(c.proficiencia ?? 0) >= 0.45)
      .sort((a, b) => Number(b.proficiencia) - Number(a.proficiencia))
      .slice(0, 8)
      .map((c) => ({ name: c.name, proficiencia: round2(Number(c.proficiencia)), metaTier: metaTierOf(c.name, slot.role) || '-' }));
    slot.expandir = fullPool
      .filter((c) => Number(c.proficiencia ?? 0) < 0.45)
      .map((c) => ({ name: c.name, valor: similaridadeDeEstilo(c.name, topChamps) * metaScore(c.name, slot.role), metaTier: metaTierOf(c.name, slot.role) || '-' }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  });

  const ms = Math.round(performance.now() - t0);
  if (import.meta.env.DEV) {
    console.log(`[Tribo v2] K=${K} combos=${totalCombos} tempo=${ms}ms vencedor=${vencedor.arquetipo}`);
  }

  let roleMatch = 0;
  for (const slot of slots) {
    if (slot.championLocked && roleFitScore(slot.role, championTags(slot.championLocked)) >= 0.7) roleMatch += 1;
  }

  const rotulos = ['A', 'B', 'C'];
  synergyResult.value = {
    score: scoreToPercent(vencedor.nomes),
    arquetipo: vencedor.arquetipo,
    arquetipoAderencia: Math.round(vencedor.aderencia * 100),
    pares: sinergiaDePares(vencedor.nomes).pares,
    roleMatch,
    durationMs: ms,
    combos: totalCombos,
    planos: planos.map((p, i) => ({
      rotulo: rotulos[i],
      arquetipo: p.arquetipo,
      aderencia: Math.round(p.aderencia * 100),
      score: round2(p.score),
      picks: p.picks.map((pk, idx) => ({ slotId: slots[idx].id, role: slots[idx].role, champion: pk.name }))
    })),
    recommendations: vencedor.picks.map((pk, idx) => ({
      slotId: slots[idx].id,
      role: slots[idx].role,
      champion: pk.name,
      score: round2(pk.scoreInd),
      usedFallback: Boolean(pk.usedFallback)
    })),
    slotOptions: slots.map((slot) => ({
      slotId: slot.id,
      player: slot.gameName || `Slot ${slot.id}`,
      role: slot.role,
      options: slot.synergyTop5 || []
    })),
    generatedAt: new Date().toLocaleTimeString('pt-BR')
  };
  store.teamPlanner.analysisResult = synergyResult.value;
}

// ============ "Encontrar amigos" (portado do saguaoCustom.vue) ============
function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function slotKey(gameName, tagLine) {
  return `${normalizeText(gameName)}#${normalizeText(tagLine || 'BR1')}`;
}

function formatRankLabel(slot) {
  const tier = String(slot.manualTier || slot.statsSolo?.tier || 'UNRANKED').toUpperCase();
  const rank = String(slot.manualRank || slot.statsSolo?.rank || '').toUpperCase();
  const lp = Number(slot.manualLp || slot.statsSolo?.lp || 0);

  if (!tier || tier === 'UNRANKED') return 'UNRANKED';
  return `${tier} ${rank || ''}${lp ? ` • ${lp} LP` : ''}`.trim();
}

function findMyEntry(match, profileData) {
  const participants = Array.isArray(match?.players) ? match.players : [];
  const myGameName = normalizeText(profileData?.gameName || profileData?.game_name);
  const myTagLine = normalizeText(profileData?.tagLine || profileData?.tag_line || 'BR1');

  const direct = participants.find((participant) => {
    const pGameName = normalizeText(participant?.gameName);
    const pTagLine = normalizeText(participant?.tagLine || 'BR1');
    return pGameName && pGameName === myGameName && pTagLine === myTagLine;
  });

  if (direct) return direct;

  const sameName = participants.find((participant) => normalizeText(participant?.gameName) === myGameName);
  if (sameName) return sameName;

  const championFallback = participants.find((participant) => {
    return normalizeText(participant?.championName) === normalizeText(match?.championName);
  });

  return championFallback || null;
}

function extractCompanions(profileData) {
  const matches = Array.isArray(profileData?.matches) ? profileData.matches.slice(0, 20) : [];
  const counts = new Map();

  for (const match of matches) {
    const participants = Array.isArray(match?.players) ? match.players : [];
    const me = findMyEntry(match, profileData);
    if (!me?.teamId) continue;

    const allies = participants.filter((participant) => {
      const sameTeam = participant?.teamId === me.teamId;
      const sameName = normalizeText(participant?.gameName) === normalizeText(profileData?.gameName);
      return sameTeam && !sameName && participant?.gameName;
    });

    for (const ally of allies) {
      const key = slotKey(ally.gameName, ally.tagLine || 'BR1');
      const current = counts.get(key) || { gameName: ally.gameName, tagLine: ally.tagLine || 'BR1', games: 0, role: ally.role || 'AUTOFILL' };
      current.games += 1;
      if (!current.role || current.role === 'AUTOFILL') {
        current.role = ally.teamPosition || ally.role || 'AUTOFILL';
      }
      counts.set(key, current);
    }
  }

  return [...counts.values()].sort((a, b) => b.games - a.games);
}

async function loadCompanionProfile(companion) {
  const cacheKey = slotKey(companion.gameName, companion.tagLine || 'BR1');
  if (companionProfileCache.has(cacheKey)) {
    return companionProfileCache.get(cacheKey);
  }

  try {
    const data = await workerRequest('profile_brief', { gameName: companion.gameName, tagLine: companion.tagLine || 'BR1' });
    const profile = {
      gameName: data?.gameName || companion.gameName,
      tagLine: data?.tagLine || companion.tagLine || 'BR1',
      summonerLevel: Number(data?.summonerLevel || 0),
      profileIconId: data?.profileIconId || 29,
      role: companion.role || 'AUTOFILL',
      statsSolo: data?.statsSolo || { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
      statsFlex: data?.statsFlex || { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 }
    };
    companionProfileCache.set(cacheKey, profile);
    return profile;
  } catch (error) {
    const fallbackProfile = {
      gameName: companion.gameName,
      tagLine: companion.tagLine || 'BR1',
      summonerLevel: 0,
      profileIconId: 29,
      role: companion.role || 'AUTOFILL',
      statsSolo: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
      statsFlex: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 }
    };
    companionProfileCache.set(cacheKey, fallbackProfile);
    console.warn('Falha ao carregar companheiro:', error?.message || error);
    return fallbackProfile;
  }
}

async function loadPlannerSeedProfile(slot) {
  return workerRequest('profile_overview', {
    gameName: slot?.gameName,
    tagLine: slot?.tagLine || 'BR1'
  });
}

async function findCompanionsForSlot(slotId) {
  const slot = rankedSlots.find((entry) => entry.id === slotId);
  if (!slot?.gameName || slot.type === 'anonymous') {
    statusMessage.value = 'Selecione um jogador real antes de procurar os amigos.';
    return;
  }

  companionLoading.value = true;
  statusMessage.value = `Buscando amigos de ${slot.gameName}...`;

  try {
    const fullProfile = await loadPlannerSeedProfile(slot);
    await autofillCompanionsFromProfile(fullProfile);
  } catch (error) {
    console.warn('Falha ao buscar amigos do slot:', error?.message || error);
    statusMessage.value = `Nao foi possível buscar os amigos de ${slot.gameName} agora.`;
  } finally {
    companionLoading.value = false;
  }
}

async function autofillCompanionsFromProfile(profileData) {
  const companions = extractCompanions(profileData).slice(0, 5);
  if (!companions.length) {
    statusMessage.value = 'Nenhum companheiro de batalha encontrado para autopreenchimento.';
    return;
  }

  statusMessage.value = 'Buscando os 5 companheiros mais frequentes...';

  try {
    // Preenche as vagas secundárias em background.
    const profiles = await Promise.all(companions.map((companion) => loadCompanionProfile(companion)));

    profiles.forEach((profile, index) => {
      const slot = friendSlots[index];
      if (!slot) return;

      slot.gameName = profile.gameName;
      slot.tagLine = profile.tagLine;
      slot.summonerLevel = profile.summonerLevel;
      slot.profileIconId = profile.profileIconId;
      slot.statsSolo = profile.statsSolo;
      slot.statsFlex = profile.statsFlex;
      slot.manualTier = profile.statsSolo?.tier || 'UNRANKED';
      slot.manualRank = profile.statsSolo?.rank || 'IV';
      slot.manualLp = String(profile.statsSolo?.lp || 0);
      slot.role = profile.role || 'AUTOFILL';
    });

    statusMessage.value = `Encontramos os ${profiles.length} companheiros mais frequentes.`;
  } catch (error) {
    console.warn('Falha ao preencher companheiros:', error?.message || error);
    statusMessage.value = 'Nao foi possível preencher os companheiros agora.';
  }
}

// ============ Saguão Custom 5v5 ============
async function searchCustomSlot(slotId) {
  const slot = customSlots.find((item) => item.id === slotId);
  if (!slot) return;

  const query = slot.rawInput?.trim() || '';
  const [nameRaw, tagRaw] = query.split('#');
  const gameName = (nameRaw || '').trim();
  const tagLine = (tagRaw || '').trim();
  if (!gameName || !tagLine) {
    slot.error = 'Use Nome#TAG.';
    slot.showSearch = true;
    return;
  }

  slot.loading = true;
  slot.error = null;
  try {
    const data = await workerRequest('profile_overview', { gameName, tagLine });
    slot.gameName = data?.gameName || gameName;
    slot.tagLine = data?.tagLine || tagLine;
    slot.profileIconId = data?.profileIconId || 29;
    slot.statsSolo = data?.statsSolo || slot.statsSolo;
    slot.statsFlex = data?.statsFlex || slot.statsFlex;
    slot.manualTier = slot.manualTier || slot.statsSolo?.tier || 'UNRANKED';
    slot.manualRank = slot.manualRank || slot.statsSolo?.rank || 'IV';
    slot.manualLp = String(slot.statsSolo?.lp || 0);
    slot.manualWinRate = String(slot.statsSolo?.winRate || 0);
    slot.showSearch = false;
  } catch (error) {
    slot.error = error?.message || 'Erro ao buscar jogador.';
    slot.showSearch = true;
  } finally {
    slot.loading = false;
  }
}

function clearCustomSlot(slotId) {
  const idx = customSlots.findIndex((item) => item.id === slotId);
  if (idx === -1) return;
  customSlots[idx] = createCustomSlot(slotId);
}

function setCustomAnonymous(slotId) {
  const slot = customSlots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.showSearch = false;
  slot.loading = false;
  slot.error = null;
  slot.gameName = 'Invocador Anonimo';
  slot.tagLine = 'OFFLINE';
  slot.profileIconId = 29;
  slot.manualTier = slot.manualTier || 'UNRANKED';
  slot.manualRank = slot.manualRank || 'IV';
  slot.manualLp = slot.manualLp || '0';
}

function onDragStart(slotId) {
  draggedSlotId.value = slotId;
}

function onDropToSlot(targetSlotId) {
  const from = draggedSlotId.value;
  if (!from || from === targetSlotId) return;

  const fromIdx = customSlots.findIndex((slot) => slot.id === from);
  const toIdx = customSlots.findIndex((slot) => slot.id === targetSlotId);
  if (fromIdx === -1 || toIdx === -1) return;

  const tmp = { ...customSlots[fromIdx] };
  customSlots[fromIdx] = { ...customSlots[toIdx], id: customSlots[fromIdx].id };
  customSlots[toIdx] = { ...tmp, id: customSlots[toIdx].id };
  draggedSlotId.value = null;
}

function mmrWeight(slot) {
  if (!slot.gameName) return 0;
  const tierWeights = {
    IRON: 100,
    BRONZE: 300,
    SILVER: 500,
    GOLD: 700,
    PLATINUM: 900,
    EMERALD: 1100,
    DIAMOND: 1300,
    MASTER: 1600,
    GRANDMASTER: 1800,
    CHALLENGER: 2000,
    UNRANKED: 400
  };
  const rankBonus = { I: 75, II: 50, III: 25, IV: 0 };

  const tier = String(slot.manualTier || slot.statsSolo?.tier || 'UNRANKED').toUpperCase();
  const rank = String(slot.manualRank || slot.statsSolo?.rank || 'IV').toUpperCase();
  const lp = Number(slot.manualLp || slot.statsSolo?.lp || 0);

  return (tierWeights[tier] || 400) + (rankBonus[rank] || 0) + lp;
}

function teamMmr(slots) {
  return slots.reduce((sum, slot) => sum + mmrWeight(slot), 0);
}

function combinations(items, choose, start = 0, prefix = [], output = []) {
  if (prefix.length === choose) {
    output.push([...prefix]);
    return output;
  }
  for (let i = start; i < items.length; i += 1) {
    prefix.push(items[i]);
    combinations(items, choose, i + 1, prefix, output);
    prefix.pop();
  }
  return output;
}

function drawBalancedTeams() {
  rerollSeed.value += 1;
  const allFilled = customSlots.filter((slot) => slot.gameName);
  if (allFilled.length < 2) return;

  const shuffled = [...allFilled]
    .map((slot) => ({ slot, seed: Math.random() + rerollSeed.value * 0.01 }))
    .sort((a, b) => a.seed - b.seed)
    .map((item) => item.slot);

  const selectedTen = shuffled.slice(0, 10);
  const reserves = shuffled.slice(10);

  const combos = combinations(selectedTen, Math.floor(selectedTen.length / 2));
  let bestBlue = [];
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const blueCandidate of combos) {
    const blueSet = new Set(blueCandidate.map((slot) => slot.id));
    const redCandidate = selectedTen.filter((slot) => !blueSet.has(slot.id));
    if (redCandidate.length !== blueCandidate.length) continue;

    const diff = Math.abs(teamMmr(blueCandidate) - teamMmr(redCandidate));
    const randomNudge = Math.random() * 10;
    if (diff + randomNudge < bestDiff) {
      bestDiff = diff + randomNudge;
      bestBlue = blueCandidate;
    }
  }

  const blueSet = new Set(bestBlue.map((slot) => slot.id));
  const bestRed = selectedTen.filter((slot) => !blueSet.has(slot.id)).slice(0, 5);
  const blueFinal = bestBlue.slice(0, 5);
  const reserveFinal = [...reserves].slice(0, 5);

  const ordered = [...blueFinal, ...bestRed, ...reserveFinal];
  while (ordered.length < 15) {
    ordered.push(createCustomSlot(ordered.length + 1));
  }

  for (let i = 0; i < 15; i += 1) {
    const base = ordered[i] || createCustomSlot(i + 1);
    customSlots[i] = { ...createCustomSlot(i + 1), ...base, id: i + 1 };
  }
}

function drawRandomTeams() {
  rerollSeed.value += 1;
  const allFilled = customSlots.filter((slot) => slot.gameName);
  if (allFilled.length < 2) return;

  const shuffled = [...allFilled]
    .map((slot) => ({ slot, seed: Math.random() + rerollSeed.value * 0.01 }))
    .sort((a, b) => a.seed - b.seed)
    .map((item) => item.slot);

  const blueFinal = shuffled.slice(0, 5);
  const redFinal = shuffled.slice(5, 10);
  const reserveFinal = shuffled.slice(10, 15);

  const ordered = [...blueFinal, ...redFinal, ...reserveFinal];
  while (ordered.length < 15) {
    ordered.push(createCustomSlot(ordered.length + 1));
  }

  for (let i = 0; i < 15; i += 1) {
    const base = ordered[i] || createCustomSlot(i + 1);
    customSlots[i] = { ...createCustomSlot(i + 1), ...base, id: i + 1 };
  }
}

function fallbackChampionUrl() {
  const fallbackId = encodeURIComponent(getChampionIdFromName('Aatrox'));
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${fallbackId}.png`;
}

function onChampionImageError(event) {
  const target = event?.target;
  if (!target) return;
  target.src = fallbackChampionUrl();
}
</script>
