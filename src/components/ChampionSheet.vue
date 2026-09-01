<!--
  ChampionSheet — Ficha completa de um campeão. Componente ÚNICO do sistema: existe
  em UMA instância por vez, nunca uma cópia por tela.

  Dois modos (`mode`):
    • 'modal'  — card central sobre a tela atual. É o host global do App.vue, aberto
                 por store.abrirFicha() a partir de qualquer card de campeão.
    • 'pagina' — TELA CHEIA (rota /ficha/:championId, ChampionPage.vue): substitui a
                 tela anterior e volta para ela pelo botão "Voltar". Aqui entram o
                 splash da skin ao fundo, a coluna do card 3D e o carrossel de skins.

  Emite `close` (fechar no modal / voltar na página), `expand` (só no modal → abre a
  tela cheia), `open-item(id)` e `open-champion(champ)`.
-->
<template>
  <div
    :class="isPagina
      ? 'relative'
      : 'fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6'"
    @click.self="!isPagina && $emit('close')"
  >
    <div
      :class="isPagina
        ? 'relative overflow-hidden rounded-3xl border border-cyan-500/25 bg-slate-950'
        : 'relative w-full max-w-4xl overflow-hidden rounded-3xl border-2 border-cyan-500/40 bg-slate-950 shadow-[0_0_60px_rgba(6,182,212,0.25)]'"
    >
      <!-- Controles do MODAL (expandir + fechar) — canto superior direito. Na página
           quem manda voltar é o botão do cabeçalho, não um X flutuante. -->
      <div v-if="!isPagina" class="absolute right-3 top-3 z-20 flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-950/80 text-slate-300 transition hover:text-white"
          @click="$emit('expand')"
          title="Abrir em tela cheia"
          aria-label="Abrir a ficha em tela cheia"
        >
          <i class="fa-solid fa-expand"></i>
        </button>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-950/80 text-slate-300 transition hover:text-white"
          @click="$emit('close')"
          aria-label="Fechar ficha"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- CABEÇALHO: strip com splash (modal) ou barra compacta com "Voltar" (página).
           Os selos (classe, tipo de dano, rotas) são os mesmos nos dois — só mudam de
           tamanho, então o bloco é um só. -->
      <div
        class="shrink-0"
        :class="isPagina
          ? 'flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 p-3'
          : 'relative h-40 overflow-hidden rounded-t-3xl sm:h-52'"
      >
        <template v-if="!isPagina">
          <img :src="championSplashImage(champ.name)" :alt="champ.name" class="absolute inset-0 h-full w-full object-cover object-top opacity-60" @error="(e) => e.target.style.display = 'none'" />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>
        </template>

        <button
          v-else
          type="button"
          class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-300 transition hover:border-cyan-500 hover:text-white"
          @click="$emit('close')"
          :title="backLabel"
        >
          <i class="fa-solid fa-arrow-left"></i>
          <span class="hidden sm:inline">{{ backLabel }}</span>
        </button>

        <div :class="isPagina ? 'flex min-w-0 items-center gap-3' : 'absolute bottom-0 left-0 flex items-end gap-3 p-4 sm:gap-4 sm:p-5'">
          <img
            :src="championImage(champ.name)"
            :alt="champ.name"
            class="shrink-0 border-2 border-cyan-500/60"
            :class="isPagina ? 'h-11 w-11 rounded-lg' : 'h-16 w-16 rounded-xl shadow-lg sm:h-20 sm:w-20'"
          />
          <div class="min-w-0">
            <h2
              class="truncate font-black text-white"
              :class="isPagina ? 'flex items-center gap-2 text-lg sm:text-xl' : 'text-2xl drop-shadow sm:text-3xl'"
            >
              {{ champ.name }}
              <span v-if="isPagina" class="truncate text-xs font-semibold uppercase tracking-wider text-cyan-300">{{ champ.title }}</span>
            </h2>
            <p v-if="!isPagina" class="truncate text-xs font-semibold uppercase tracking-wider text-cyan-300 sm:text-sm">{{ champ.title }}</p>
            <div class="flex flex-wrap items-center" :class="isPagina ? 'mt-0.5 gap-1' : 'mt-1.5 gap-1.5'">
              <span class="rounded border border-slate-600 bg-slate-900/80 px-1.5 py-0.5 font-black uppercase text-slate-300" :class="selo" v-for="tag in champ.tags || []" :key="tag">{{ TAG_LABELS[tag] || tag }}</span>
              <span class="rounded border border-fuchsia-600/60 bg-fuchsia-950/40 px-1.5 py-0.5 font-black uppercase text-fuchsia-300" :class="selo">{{ damageLabel }}</span>
              <span v-for="role in roles" :key="role" class="inline-flex items-center gap-1 rounded border border-cyan-700/50 bg-cyan-950/30 px-1.5 py-0.5 font-black uppercase text-cyan-300" :class="selo">
                <img :src="roleIconImage(role)" :alt="role" class="h-3 w-3" />{{ roleLabel(role) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- CORPO: (página) splash da skin ao fundo + info + carrossel; (modal) só a info.
           Na página o scroll é o da PRÓPRIA tela — nada de painel com rolagem interna. -->
      <div class="flex flex-col">
        <div class="relative">
          <!-- Splash da skin como FUNDO da tela inteira (modo página) -->
          <template v-if="isPagina">
            <img :key="selectedSkinSplash" :src="selectedSkinSplash" :alt="skinName(selectedSkin)" class="absolute inset-0 h-full w-full animate-[skinFade_0.4s_ease] object-cover object-center" @error="markSkinBroken(selectedSkin?.num)" />
            <!-- Véu bem mais leve que antes: a arte precisa aparecer. O gradiente ainda
                 escurece o lado esquerdo, onde fica o texto. -->
            <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-950/60 to-slate-950/35"></div>
          </template>

          <!-- Bloco de informações (único; POR CIMA do fundo na página) -->
          <div class="relative">
            <!-- Duplo clique numa área vazia traz a arte da skin para a frente (.self =
                 só quando o clique cai na própria grade, não em cima de um card). -->
            <div
              class="grid gap-5 p-4 sm:p-6"
              :class="isPagina ? 'md:grid-cols-2 xl:grid-cols-[1.1fr_1.1fr_17rem] xl:gap-6 xl:p-6' : 'lg:grid-cols-2'"
              @dblclick.self="isPagina && (artFullscreen = true)"
            >
              <!-- Coluna 1: meta + radar + lore -->
              <div class="space-y-5">
                <!-- Meta no patch -->
                <section>
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                    <i class="fa-solid fa-ranking-star"></i> Meta no Patch {{ metaPatch }}
                  </h3>
                  <!-- Uma rota do lado da outra: cada bloco é curto, não precisa de linha inteira. -->
                  <div v-if="metaEntries.length" class="grid gap-1.5 sm:grid-cols-2">
                    <div v-for="entry in metaEntries" :key="entry.role" class="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" :class="TIER_STYLES[entry.tier].row">
                      <span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border text-xs font-black" :class="TIER_STYLES[entry.tier].badge">{{ entry.tier }}</span>
                      <span class="inline-flex shrink-0 items-center gap-1 text-xs font-black text-slate-200"><img :src="roleIconImage(entry.role)" :alt="entry.role" class="h-4 w-4" />{{ roleLabel(entry.role) }}</span>
                      <!-- `whitespace-nowrap` prende cada rótulo ao seu número: sem
                           isso o bloco aperta e quebra no espaço do "WR 53.1%",
                           jogando os valores para a linha de baixo. Faltando largura,
                           quem quebra é o grupo inteiro (flex-wrap), nunca o par. -->
                      <div class="ml-auto flex flex-wrap justify-end gap-x-1.5 gap-y-0.5 text-[10px] font-bold">
                        <span class="whitespace-nowrap text-slate-400">WR <span class="text-slate-200">{{ formatPct(entry.winrate) }}</span></span>
                        <span class="whitespace-nowrap text-slate-400">PR <span class="text-slate-200">{{ formatPct(entry.pickrate) }}</span></span>
                        <span class="whitespace-nowrap text-slate-400">BR <span class="text-slate-200">{{ formatPct(entry.banrate) }}</span></span>
                      </div>
                    </div>
                  </div>
                  <p v-else class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">Sem classificação no meta atual para este campeão.</p>
                </section>

                <!-- Counters (matchups por rota) -->
                <section v-if="counterEntries.length">
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-300">
                    <i class="fa-solid fa-hand-fist"></i> Counters
                  </h3>
                  <!-- Forte/Fraco lado a lado dentro da rota: cabem em meia largura e
                       sobra espaço para ícone e nome maiores. -->
                  <div class="space-y-2">
                    <div v-for="entry in counterEntries" :key="entry.role" class="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
                      <p class="mb-2 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-300">
                        <img :src="roleIconImage(entry.role)" :alt="entry.role" class="h-4 w-4" /> {{ roleLabel(entry.role) }}
                      </p>
                      <div class="grid gap-2 sm:grid-cols-2">
                        <div v-if="entry.strongAgainst.length">
                          <p class="mb-1.5 text-[11px] font-black text-emerald-400"><i class="fa-solid fa-arrow-up"></i> Forte contra</p>
                          <div class="flex flex-wrap gap-2">
                            <button v-for="c in entry.strongAgainst" :key="`s-${c.id}`" type="button" class="group flex w-14 flex-col items-center" :title="c.name" @click="$emit('open-champion', c)">
                              <img :src="championImage(c.name)" :alt="c.name" class="h-12 w-12 rounded-md border-2 border-emerald-700/50 transition group-hover:scale-110 group-hover:border-emerald-400" />
                              <span class="mt-1 w-full truncate text-center text-[10px] font-semibold text-slate-300 group-hover:text-white">{{ c.name }}</span>
                            </button>
                          </div>
                        </div>
                        <div v-if="entry.counteredBy.length">
                          <p class="mb-1.5 text-[11px] font-black text-rose-400"><i class="fa-solid fa-arrow-down"></i> Fraco contra</p>
                          <div class="flex flex-wrap gap-2">
                            <button v-for="c in entry.counteredBy" :key="`w-${c.id}`" type="button" class="group flex w-14 flex-col items-center" :title="c.name" @click="$emit('open-champion', c)">
                              <img :src="championImage(c.name)" :alt="c.name" class="h-12 w-12 rounded-md border-2 border-rose-700/50 transition group-hover:scale-110 group-hover:border-rose-400" />
                              <span class="mt-1 w-full truncate text-center text-[10px] font-semibold text-slate-300 group-hover:text-white">{{ c.name }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <!-- Radar tático -->
                <section>
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-300">
                    <i class="fa-solid fa-chart-area"></i> Perfil Tático
                  </h3>
                  <div class="flex justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
                    <RadarChart :axes="radarAxes" color="#22d3ee" :size="150" />
                  </div>
                </section>

                <!-- Lore -->
                <section v-if="detail?.lore">
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
                    <i class="fa-solid fa-book-open"></i> Lenda
                  </h3>
                  <p class="overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-400" :class="isPagina ? 'max-h-56' : 'max-h-32'">{{ loreShort }}</p>
                </section>
              </div>

              <!-- Coluna 2: habilidades + builds -->
              <div class="space-y-5">
                <!-- Habilidades -->
                <section>
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-violet-300">
                    <i class="fa-solid fa-hat-wizard"></i> Habilidades
                  </h3>
                  <AsyncState :loading="loadingDetail" :error="detailError" accent="fuchsia" loading-text="Consultando os pergaminhos..." @retry="loadDetail">
                    <div v-if="detail" class="space-y-2">
                      <div v-for="ability in abilities" :key="ability.key" class="flex gap-2.5 rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                        <div class="relative shrink-0">
                          <img :src="ability.icon" :alt="ability.name" class="h-11 w-11 rounded-md border border-slate-700" @error="(e) => e.target.style.visibility = 'hidden'" />
                          <span class="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded bg-violet-600 text-[9px] font-black text-white">{{ ability.key }}</span>
                        </div>
                        <div class="min-w-0">
                          <p class="text-xs font-black text-slate-100">{{ ability.name }}</p>
                          <p class="mt-0.5 whitespace-pre-line text-[11px] leading-snug text-slate-400" :class="isPagina ? '' : 'line-clamp-3'">{{ ability.desc }}</p>
                        </div>
                      </div>
                    </div>
                  </AsyncState>
                </section>

                <!-- Build do Meta (meta-builds.json): itens reais + WR + situacionais + skills -->
                <section v-if="metaRoles.length">
                  <h3 class="mb-2 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wider text-lime-300">
                    <span class="flex items-center gap-2"><i class="fa-solid fa-gem"></i> Build do Meta</span>
                    <span v-if="Number.isFinite(activeMetaBuild?.buildWr)" class="rounded border border-lime-600/50 bg-lime-950/40 px-1.5 py-0.5 text-[10px] font-black text-lime-300">WR {{ activeMetaBuild.buildWr }}%</span>
                  </h3>

                  <!-- Seletor de rota (campeão com build em mais de uma) -->
                  <div v-if="metaRoles.length > 1" class="mb-2 flex flex-wrap gap-1">
                    <button
                      v-for="r in metaRoles"
                      :key="r"
                      type="button"
                      class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wide transition"
                      :class="r === activeMetaRole ? 'border-lime-500/60 bg-lime-500/10 text-lime-300' : 'border-slate-800 bg-slate-950/60 text-slate-500 hover:text-slate-300'"
                      @click="activeMetaRole = r"
                    >
                      <img :src="roleIconImage(r)" :alt="r" class="h-3 w-3" /> {{ roleLabel(r) }}
                    </button>
                  </div>

                  <!-- Abas de build: trocam JUNTOS os itens finais e a página de runas
                       (a build 2 não roda com as runas da build 1). -->
                  <div v-if="activeMetaBuild && metaVariants.length > 1" class="flex gap-1">
                    <button
                      v-for="(v, i) in metaVariants"
                      :key="`mv-${i}`"
                      type="button"
                      class="relative -mb-px min-w-0 flex-1 truncate rounded-t-lg border border-b-0 px-2 py-1.5 text-[10px] font-black uppercase tracking-wide transition"
                      :class="i === activeVariant ? 'border-lime-500/60 bg-slate-900/70 text-lime-300' : 'border-slate-800 bg-slate-950/60 text-slate-500 hover:text-slate-300'"
                      :title="v.exata ? 'Caminho completo do lolalytics' : 'Caminho parcial — algum slot não tinha opção nesta posição'"
                      @click="activeVariant = i"
                    >
                      Build {{ i + 1 }}<span v-if="!v.exata" class="ml-0.5 text-slate-600">*</span>
                    </button>
                  </div>

                  <div
                    v-if="activeMetaBuild"
                    class="flex flex-col gap-3 border border-lime-500/40 bg-slate-900/40 p-3"
                    :class="metaVariants.length > 1 ? 'rounded-b-2xl rounded-tr-2xl' : 'rounded-2xl'"
                  >
                    <!-- Itens: iniciais → NÚCLEO (com borda) → FINALIZAÇÃO ao lado -->
                    <div>
                      <p class="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-lime-300">
                        <i class="fa-solid fa-shield-halved"></i> Itens
                      </p>
                      <div class="flex flex-wrap items-stretch gap-2">
                        <!-- Iniciais -->
                        <div v-if="(activeMetaBuild.start || []).length" class="flex items-center gap-1 self-center">
                          <template v-for="id in activeMetaBuild.start" :key="`mst-${id}`">
                            <button v-if="itemsMap[id]" type="button" class="group" :title="`Inicial: ${itemsMap[id]?.name}`" @click="$emit('open-item', id)">
                              <img :src="itemImage(id)" :alt="itemsMap[id]?.name" class="h-8 w-8 rounded-md border border-slate-700 opacity-80 transition group-hover:border-lime-500" />
                            </button>
                          </template>
                          <i class="fa-solid fa-chevron-right text-[9px] text-slate-600"></i>
                        </div>

                        <!-- Núcleo: os primeiros itens + botas, cercados -->
                        <div class="rounded-xl border-2 border-lime-500/50 bg-lime-950/20 p-1.5">
                          <p class="mb-1 text-center text-[8px] font-black uppercase tracking-wider text-lime-300">Núcleo</p>
                          <div class="flex items-center gap-1.5">
                            <button
                              v-for="(id, i) in (activeMetaBuild.core || [])"
                              :key="`mco-${id}-${i}`"
                              type="button"
                              class="group relative"
                              :title="itemsMap[id]?.name"
                              @click="$emit('open-item', id)"
                            >
                              <img :src="itemImage(id)" :alt="itemsMap[id]?.name" class="h-11 w-11 rounded-md border border-slate-700 transition group-hover:scale-110 group-hover:border-lime-500" />
                              <span class="absolute -left-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-lime-600 text-[9px] font-black text-white">{{ i + 1 }}</span>
                            </button>
                            <button v-if="activeMetaBuild.boots && itemsMap[activeMetaBuild.boots]" type="button" class="group relative" :title="`Botas: ${itemsMap[activeMetaBuild.boots]?.name}`" @click="$emit('open-item', activeMetaBuild.boots)">
                              <img :src="itemImage(activeMetaBuild.boots)" :alt="itemsMap[activeMetaBuild.boots]?.name" class="h-11 w-11 rounded-md border border-sky-700/60 transition group-hover:scale-110 group-hover:border-sky-400" />
                              <span class="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[8px] text-white"><i class="fa-solid fa-shoe-prints"></i></span>
                            </button>
                          </div>
                        </div>

                        <i class="fa-solid fa-chevron-right self-center text-[9px] text-slate-600"></i>

                        <!-- Finalização: os 3 últimos slots, com WR e amostra -->
                        <div class="rounded-xl border-2 border-amber-500/40 bg-amber-950/15 p-1.5">
                          <p class="mb-1 text-center text-[8px] font-black uppercase tracking-wider text-amber-300">Situacionais</p>
                          <div class="flex items-start gap-1.5">
                            <!-- Caminho da build ativa (Item 4 → 5 → 6) -->
                            <template v-if="metaVariants.length">
                              <button
                                v-for="(o, i) in (metaVariants[activeVariant]?.items || [])"
                                :key="`mvi-${o.id}-${i}`"
                                type="button"
                                class="group flex w-11 flex-col items-center"
                                :title="itemsMap[o.id]?.name"
                                @click="$emit('open-item', o.id)"
                              >
                                <img v-if="itemsMap[o.id]" :src="itemImage(o.id)" :alt="itemsMap[o.id]?.name" class="h-11 w-11 rounded-md border border-slate-700 transition group-hover:scale-110 group-hover:border-amber-400" />
                                <span v-if="Number.isFinite(o.wr)" class="mt-0.5 text-[9px] font-black text-amber-400">{{ o.wr }}%</span>
                                <span v-if="o.games" class="text-[8px] font-semibold text-slate-500">{{ fmtGames(o.games) }}</span>
                              </button>
                            </template>
                            <!-- JSON antigo, sem os slots agrupados: lista achatada -->
                            <template v-else>
                              <button
                                v-for="s in (activeMetaBuild.situational || [])"
                                :key="`msi-${s.id}`"
                                type="button"
                                class="group flex w-11 flex-col items-center"
                                :title="itemsMap[s.id]?.name"
                                @click="$emit('open-item', s.id)"
                              >
                                <img v-if="itemsMap[s.id]" :src="itemImage(s.id)" :alt="itemsMap[s.id]?.name" class="h-11 w-11 rounded-md border border-slate-700 transition group-hover:scale-110 group-hover:border-amber-400" />
                                <span v-if="Number.isFinite(s.wr)" class="mt-0.5 text-[9px] font-black text-amber-400">{{ s.wr }}%</span>
                              </button>
                            </template>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Runas DESTA build (preset curado — o scrape do lolalytics não pega runa) -->
                    <div v-if="runesForVariant">
                      <p class="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-300">
                        <i class="fa-solid fa-scroll"></i> Runas
                        <span v-if="metaVariants.length > 1" class="font-bold normal-case tracking-normal text-slate-500">— da build {{ activeVariant + 1 }}</span>
                      </p>
                      <div class="flex flex-wrap items-center gap-3">
                        <div class="flex items-center gap-1.5">
                          <img v-if="runeSrc(runesForVariant.primary)" :src="runeSrc(runesForVariant.primary)" :alt="runeInfo(runesForVariant.primary)?.name" class="h-5 w-5 opacity-80" :title="runeInfo(runesForVariant.primary)?.name" />
                          <img v-if="runeSrc(runesForVariant.keystone)" :src="runeSrc(runesForVariant.keystone)" :alt="runeInfo(runesForVariant.keystone)?.name" class="h-10 w-10 rounded-full border-2 border-violet-500/70 bg-slate-950" :title="runeInfo(runesForVariant.keystone)?.name" />
                          <div class="flex gap-1">
                            <template v-for="pid in runesForVariant.primaryPicks" :key="`mpp-${pid}`">
                              <img v-if="runeSrc(pid)" :src="runeSrc(pid)" :alt="runeInfo(pid)?.name" class="h-7 w-7 rounded-full border border-slate-700 bg-slate-950" :title="runeInfo(pid)?.name" />
                            </template>
                          </div>
                        </div>
                        <div class="flex items-center gap-1.5 border-l border-slate-700 pl-3">
                          <img v-if="runeSrc(runesForVariant.secondary)" :src="runeSrc(runesForVariant.secondary)" :alt="runeInfo(runesForVariant.secondary)?.name" class="h-5 w-5 opacity-80" :title="runeInfo(runesForVariant.secondary)?.name" />
                          <div class="flex gap-1">
                            <template v-for="sid in runesForVariant.secondaryPicks" :key="`msp-${sid}`">
                              <img v-if="runeSrc(sid)" :src="runeSrc(sid)" :alt="runeInfo(sid)?.name" class="h-7 w-7 rounded-full border border-slate-700 bg-slate-950" :title="runeInfo(sid)?.name" />
                            </template>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Ordem de skills -->
                    <div v-if="(activeMetaBuild.skillMax || []).length">
                      <p class="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-300">
                        <i class="fa-solid fa-list-ol"></i> Ordem de skills
                      </p>
                      <div class="mb-1.5 flex items-center gap-1">
                        <span class="mr-1 text-[10px] font-bold text-slate-400">Max</span>
                        <template v-for="(k, i) in activeMetaBuild.skillMax" :key="`msm-${k}`">
                          <span class="inline-flex h-5 w-5 items-center justify-center rounded bg-violet-600/80 text-[10px] font-black text-white">{{ k }}</span>
                          <i v-if="i < activeMetaBuild.skillMax.length - 1" class="fa-solid fa-chevron-right text-[8px] text-slate-600"></i>
                        </template>
                      </div>
                      <div class="space-y-0.5">
                        <template v-for="k in ['Q', 'W', 'E', 'R']" :key="`msl-${k}`">
                          <div v-if="(activeMetaBuild.skillLevels?.[k] || []).length" class="flex items-center gap-1.5">
                            <span class="inline-flex h-4 w-4 items-center justify-center rounded bg-slate-800 text-[9px] font-black text-slate-300">{{ k }}</span>
                            <span class="text-[10px] text-slate-400">{{ activeMetaBuild.skillLevels[k].join(' · ') }}</span>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                </section>

                <!-- Builds recomendadas (fallback: campeão fora do meta): runas + relíquias -->
                <section v-else>
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-lime-300">
                    <i class="fa-solid fa-gem"></i> Builds Recomendadas
                  </h3>

                  <div v-if="builds.length">
                    <!-- Mini abas: o NOME de cada build fica em cima, conectado ao painel -->
                    <div class="flex gap-1">
                      <button
                        v-for="(b, i) in builds"
                        :key="b.key"
                        type="button"
                        class="relative -mb-px min-w-0 flex-1 truncate rounded-t-lg border border-b-0 px-2 py-1.5 text-[10px] font-black uppercase tracking-wide transition"
                        :class="i === activeBuildIndex
                          ? 'border-lime-500/60 bg-slate-900/70 text-lime-300'
                          : 'border-slate-800 bg-slate-950/60 text-slate-500 hover:text-slate-300'"
                        :title="b.label"
                        @click="activeBuildIndex = i"
                      >
                        {{ b.label }}
                      </button>
                    </div>

                    <!-- Painel da aba ativa: altura estável (ocupa o mesmo espaço trocando de aba) -->
                    <div v-if="activeBuild" class="flex min-h-[190px] flex-col gap-3 rounded-b-2xl rounded-tr-2xl border border-lime-500/40 bg-slate-900/40 p-3">
                      <!-- Runas -->
                      <div v-if="activeBuild.runes">
                        <p class="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-300">
                          <i class="fa-solid fa-scroll"></i> Runas
                        </p>
                        <div class="flex flex-wrap items-center gap-3">
                          <div class="flex items-center gap-1.5">
                            <img v-if="runeSrc(activeBuild.runes.primary)" :src="runeSrc(activeBuild.runes.primary)" :alt="runeInfo(activeBuild.runes.primary)?.name" class="h-5 w-5 opacity-80" :title="runeInfo(activeBuild.runes.primary)?.name" />
                            <img v-if="runeSrc(activeBuild.runes.keystone)" :src="runeSrc(activeBuild.runes.keystone)" :alt="runeInfo(activeBuild.runes.keystone)?.name" class="h-10 w-10 rounded-full border-2 border-violet-500/70 bg-slate-950" :title="runeInfo(activeBuild.runes.keystone)?.name" />
                            <span v-else class="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-950 text-slate-600"><i class="fa-solid fa-gem"></i></span>
                            <div class="flex gap-1">
                              <template v-for="pid in activeBuild.runes.primaryPicks" :key="`pp-${pid}`">
                                <img v-if="runeSrc(pid)" :src="runeSrc(pid)" :alt="runeInfo(pid)?.name" class="h-7 w-7 rounded-full border border-slate-700 bg-slate-950" :title="runeInfo(pid)?.name" />
                              </template>
                            </div>
                          </div>
                          <div class="flex items-center gap-1.5 border-l border-slate-700 pl-3">
                            <img v-if="runeSrc(activeBuild.runes.secondary)" :src="runeSrc(activeBuild.runes.secondary)" :alt="runeInfo(activeBuild.runes.secondary)?.name" class="h-5 w-5 opacity-80" :title="runeInfo(activeBuild.runes.secondary)?.name" />
                            <div class="flex gap-1">
                              <template v-for="sid in activeBuild.runes.secondaryPicks" :key="`sp-${sid}`">
                                <img v-if="runeSrc(sid)" :src="runeSrc(sid)" :alt="runeInfo(sid)?.name" class="h-7 w-7 rounded-full border border-slate-700 bg-slate-950" :title="runeInfo(sid)?.name" />
                              </template>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Itens -->
                      <div>
                        <p class="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-lime-300">
                          <i class="fa-solid fa-shield-halved"></i> Ordem de itens
                        </p>
                        <div v-if="activeBuild.items.length" class="flex flex-wrap gap-2">
                          <button
                            v-for="(id, i) in activeBuild.items"
                            :key="`${id}-${i}`"
                            type="button"
                            class="group relative"
                            :title="itemsMap[id]?.name"
                            @click="$emit('open-item', id)"
                          >
                            <img :src="itemImage(id)" :alt="itemsMap[id]?.name" class="h-11 w-11 rounded-md border border-slate-700 transition group-hover:border-lime-500 group-hover:scale-110" />
                            <span class="absolute -left-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-lime-600 text-[9px] font-black text-white">{{ i + 1 }}</span>
                          </button>
                        </div>
                        <p v-else class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">Relíquias ainda carregando ou indisponíveis neste patch.</p>
                      </div>
                    </div>
                  </div>
                  <p v-else class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">Builds ainda carregando ou indisponíveis neste patch.</p>
                </section>
              </div>

              <!-- Coluna 3 (só na página): o campeão com a skin escolhida, no MESMO
                   card de campeão das outras telas (giro 3D no hover). -->
              <div v-if="isPagina" class="hidden xl:block">
                <!-- Sem `sticky`: o container da ficha é `overflow-hidden` (cantos
                     arredondados), e dentro dele o sticky vira estático. -->
                <section>
                  <h3 class="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                    <i class="fa-solid fa-user-astronaut"></i> {{ skinName(selectedSkin) }}
                  </h3>
                  <ChampionCard
                    :champ="champ"
                    :skin-num="selectedSkin?.num ?? 0"
                    :label="skinName(selectedSkin)"
                    tilt="hover"
                    :show-roles="false"
                    :popover="false"
                    frame-class="border-amber-600/40 shadow-[0_0_20px_rgba(217,119,6,0.25)]"
                    @open="artFullscreen = true"
                    @img-error="markSkinBroken"
                  >
                    <template #overlay>
                      <span class="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 rounded-full border border-slate-600 bg-slate-950/85 px-2.5 py-1 text-[10px] font-bold text-slate-300 opacity-0 transition group-hover:opacity-100">
                        <i class="fa-solid fa-expand"></i> Arte inteira
                      </span>
                    </template>
                  </ChampionCard>

                  <!-- 3D: o Khada não permite embed, então abre em outra aba. Fica FORA
                       do card porque o card é um <button> (âncora dentro seria inválida). -->
                  <a
                    v-if="skin3dUrl"
                    :href="skin3dUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-1.5 flex items-center justify-center gap-2 rounded-lg border border-amber-600/30 bg-amber-950/30 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-900/40 hover:text-amber-200"
                    title="Abre o modelo 3D desta skin no Khada (site de fãs), com rotação, cromas e animações"
                  >
                    <i class="fa-solid fa-cube"></i> Ver modelo 3D
                    <i class="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-70"></i>
                  </a>
                  <!-- Navegador compacto: setas + anterior · atual · próxima, logo abaixo
                       do card da skin selecionada (substitui a tira larga no rodapé). -->
                  <div v-if="skins.length > 1" class="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      class="inline-flex h-8 w-6 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-amber-500 hover:text-white"
                      @click="prevSkin"
                      aria-label="Skin anterior"
                    ><i class="fa-solid fa-chevron-left text-[10px]"></i></button>

                    <div class="flex flex-1 justify-center gap-1.5">
                      <button
                        v-for="t in skinTrio"
                        :key="t.skin.id"
                        type="button"
                        class="group relative overflow-hidden rounded-md border-2 transition"
                        :class="t.atual ? 'border-amber-400/80 shadow-[0_0_10px_rgba(251,191,36,0.4)]' : 'border-slate-700/70 opacity-60 hover:opacity-100'"
                        :title="skinName(t.skin)"
                        @click="selectSkin(t.i)"
                      >
                        <img
                          :src="championLoadingImage(champ.name, t.skin.num)"
                          :alt="skinName(t.skin)"
                          loading="lazy"
                          class="h-16 w-[2.6rem] object-cover object-top"
                          @error="markSkinBroken(t.skin.num)"
                        />
                      </button>
                    </div>

                    <button
                      type="button"
                      class="inline-flex h-8 w-6 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-amber-500 hover:text-white"
                      @click="nextSkin"
                      aria-label="Próxima skin"
                    ><i class="fa-solid fa-chevron-right text-[10px]"></i></button>
                  </div>
                  <p class="mt-1 text-center text-[9px] text-slate-500">
                    {{ selectedSkinIndex + 1 }} de {{ skins.length }} skins
                  </p>

                  <p class="mt-1.5 text-center text-[9px] leading-snug text-slate-500">
                    O 3D abre no Khada, projeto de fãs — a Riot não publica os modelos em formato web.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </div>

        <!-- CARROSSEL DE SKINS (expandido). Some a partir de xl, onde o navegador
             compacto do card da direita assume — senão ficariam dois controles. -->
        <div v-if="isPagina" class="shrink-0 border-t border-slate-800 bg-slate-950/95 p-3 xl:hidden">
          <div class="mb-1.5 flex items-center justify-between">
            <p class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">
              <i class="fa-solid fa-images"></i> Skins ({{ skins.length }})
            </p>
          </div>
          <div v-if="skins.length" class="flex items-center gap-2">
            <button type="button" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-500 hover:text-white" @click="prevSkin" aria-label="Skin anterior">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <div ref="carouselEl" class="flex flex-1 gap-2.5 overflow-x-auto scroll-smooth pb-1">
              <button
                v-for="(skin, i) in skins"
                :key="skin.id"
                type="button"
                class="group relative shrink-0 rounded-md border-2 p-0.5 transition"
                :class="i === selectedSkinIndex ? 'border-amber-400/80 shadow-[0_0_16px_rgba(251,191,36,0.45)]' : 'border-amber-800/40 hover:border-amber-500/70'"
                :title="skinName(skin)"
                @click="selectSkin(i)"
              >
                <div class="relative overflow-hidden rounded-sm border border-amber-600/30">
                  <img :src="championLoadingImage(champ.name, skin.num)" :alt="skinName(skin)" loading="lazy" class="h-36 w-[5.25rem] object-cover object-top transition duration-500 group-hover:scale-105" @error="markSkinBroken(skin.num)" />
                  <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent"></div>
                  <span class="absolute inset-x-0 bottom-0 truncate px-1 pb-1 pt-3 text-center text-[9px] font-bold text-white drop-shadow">{{ skinName(skin) }}</span>
                </div>
              </button>
            </div>
            <button type="button" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-500 hover:text-white" @click="nextSkin" aria-label="Próxima skin">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
          <p v-else class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            {{ loadingDetail ? 'Carregando as skins...' : 'Skins indisponíveis para este campeão.' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Arte da skin ampliada: `object-contain` mostra a splash INTEIRA (o fundo da
         ficha usa object-cover e corta as laterais). O fundo fica só velado — a ficha
         continua visível atrás. Fecha no X, no fundo ou no Esc. -->
    <div
      v-if="artFullscreen"
      class="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[3px] sm:p-8"
      @click.self="artFullscreen = false"
    >
      <!-- Moldura da arte. O giro é medido contra ELA e só acontece com o ponteiro
           pressionado: segure e arraste para girar, solte para voltar ao lugar. -->
      <figure
        :style="artTiltStyle"
        class="group w-fit max-w-full touch-none cursor-grab overflow-hidden rounded-[1.75rem] border border-amber-500/40 bg-slate-950/80 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/10 transition-transform duration-200 ease-out will-change-transform active:cursor-grabbing"
        @pointerdown="onArtTiltDown"
        @pointermove="onArtTiltMove"
        @pointerup="onArtTiltUp"
        @pointercancel="onArtTiltUp"
      >
        <!-- A altura máxima da arte já desconta o respiro da tela e a legenda abaixo,
             então a moldura inteira cabe sem cortar nada. -->
        <div class="relative">
          <img
            :src="selectedSkinSplash"
            :alt="skinName(selectedSkin)"
            class="block max-h-[calc(100vh_-_10rem)] w-auto max-w-full select-none object-contain"
            draggable="false"
          />
          <!-- Brilho que segue o ponteiro enquanto a arte está sendo girada. -->
          <span
            class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-active:opacity-100"
            style="background: radial-gradient(circle at var(--brilho-x, 50%) var(--brilho-y, 50%), rgba(255,255,255,0.16), transparent 55%)"
          ></span>
          <!-- Vinheta: casa a arte com a moldura em vez de cortar seco na borda. -->
          <span class="pointer-events-none absolute inset-0 shadow-[inset_0_0_5rem_rgba(2,6,23,0.7)]"></span>
        </div>

        <figcaption class="flex items-center gap-3 border-t border-amber-500/25 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-slate-950/95 px-4 py-2.5">
          <i class="fa-solid fa-user-astronaut text-sm text-amber-400"></i>
          <span class="min-w-0 flex-1 truncate text-sm font-black text-amber-100">{{ skinName(selectedSkin) }}</span>
          <span class="hidden shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:inline-flex">
            <i class="fa-solid fa-hand-pointer"></i> Segure e arraste para girar
          </span>
        </figcaption>
      </figure>

      <button
        type="button"
        class="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-950/85 text-slate-300 shadow-lg transition hover:border-amber-500 hover:text-white sm:right-6 sm:top-6"
        @click="artFullscreen = false"
        aria-label="Fechar arte"
      >
        <i class="fa-solid fa-xmark text-lg"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { state } from '../store.js';
import {
  championImage, championSplashImage, championLoadingImage, championSpellImage, championPassiveImage,
  itemImage, runeImage, roleIconImage, fetchChampionDetail
} from '../utils.js';
import {
  TAG_LABELS, DAMAGE_LABELS, TACTICAL_DIMENSIONS, TIER_STYLES, ROLES,
  rolesWithMeta, metaEntriesOf, metaInfo, formatPct, sanitizeDDragonText
} from '../utils/championCatalog.js';
// As builds moram à parte porque arrastam `meta-builds.json` junto — e a ficha,
// que é carregada sob demanda, é justamente quem pode pagar por esse peso.
import { buildsFor, metaBuildFor, metaBuildVariants, countersEntriesOf } from '../utils/championBuilds.js';
import { getChampionMetrics } from '../utils/sinergiaMotor.js';
import RadarChart from './RadarChart.vue';
import ChampionCard from './ChampionCard.vue';
import { useTilt3d } from '../utils/tilt3d.js';
import AsyncState from './AsyncState.vue';

const props = defineProps({
  champ: { type: Object, required: true },
  // 'modal' (host global do App.vue) | 'pagina' (tela cheia /ficha/:championId)
  mode: { type: String, default: 'modal' },
  // Rótulo do botão de voltar da página ("Voltar para o Meta", …)
  backLabel: { type: String, default: 'Voltar' }
});
const emit = defineEmits(['close', 'expand', 'open-item', 'open-champion']);

const isPagina = computed(() => props.mode === 'pagina');
// Selos (classe/dano/rota): mesmo bloco nos dois modos, só o corpo da letra muda.
const selo = computed(() => (isPagina.value ? 'text-[9px]' : 'text-[10px]'));

const store = state;
const itemsMap = computed(() => store.staticData.items || {});

const detail = ref(null);
const loadingDetail = ref(false);
const detailError = ref(null);

const metrics = computed(() => getChampionMetrics(props.champ?.name, props.champ?.tags || []));
const roles = computed(() => rolesWithMeta(props.champ));
const builds = computed(() => buildsFor(props.champ, itemsMap.value));
const activeBuildIndex = ref(0);
const activeBuild = computed(() => builds.value[activeBuildIndex.value] || builds.value[0] || null);
const runesMap = computed(() => state.staticData.runes || {});

// Resolve um perk (runa ou árvore) pelo id → { name, icon } do runesReforged.
function runeInfo(id) {
  return runesMap.value[id] || null;
}
function runeSrc(id) {
  const info = runeInfo(id);
  return info?.icon ? runeImage(info.icon) : '';
}

// ---- Skins (Data Dragon) ----
// Chromas vêm no champion.json nomeados "Skin (Cor)" mas NÃO têm splash/loading
// próprios → 404. Filtra-os pelo nome e, como rede de segurança, remove qualquer
// skin cuja arte falhar ao carregar (@error → markSkinBroken).
const brokenSkins = ref(new Set());
function markSkinBroken(num) {
  if (num == null || brokenSkins.value.has(num)) return;
  const next = new Set(brokenSkins.value);
  next.add(num);
  brokenSkins.value = next;
}
const skins = computed(() =>
  (detail.value?.skins || []).filter((s) => !s.name.includes('(') && !brokenSkins.value.has(s.num))
);
const selectedSkinIndex = ref(0);
const selectedSkin = computed(() => skins.value[selectedSkinIndex.value] || skins.value[0] || null);
const selectedSkinSplash = computed(() => championSplashImage(props.champ.name, selectedSkin.value?.num ?? 0));
const carouselEl = ref(null);

function skinName(skin) {
  return !skin || skin.name === 'default' ? props.champ?.name : skin.name;
}

// Arte da skin em tela cheia (duplo clique no fundo ou clique no card da direita).
// O giro 3D do card da skin mora no próprio ChampionCard (`tilt="hover"`).
const artFullscreen = ref(false);

// Na arte ABERTA o gesto é outro: gira só com o ponteiro pressionado, como se
// estivesse segurando a imagem. Ângulo menor e sem escala — a arte já ocupa o
// máximo da tela, e escalar cortaria as bordas.
const {
  style: artTiltStyle, onMove: onArtTiltMove, onDown: onArtTiltDown, onUp: onArtTiltUp
} = useTilt3d({ max: 8, scale: 1, brilho: true, gesto: 'arrasto' });

// Trio do navegador compacto (card da direita): anterior · atual · próxima, com volta
// no fim da lista. Com 1 ou 2 skins mostra só o que existe, sem repetir.
const skinTrio = computed(() => {
  const n = skins.value.length;
  if (!n) return [];
  const atual = selectedSkinIndex.value;
  const idx = n === 1 ? [atual] : n === 2 ? [atual, (atual + 1) % n] : [(atual - 1 + n) % n, atual, (atual + 1) % n];
  return idx.map((i) => ({ i, skin: skins.value[i], atual: i === atual }));
});

// Modelo 3D: o Khada usa o skinId do LoL (chave do campeão × 1000 + nº da skin), o
// mesmo id do Data Dragon. Não dá para embutir o visualizador (sem API/iframe), então
// abrimos em outra aba — é o único caminho legal e sem peso para o 3D com animações.
const KHADA_URL = 'https://modelviewer.lol/model-viewer?id=';
const skin3dUrl = computed(() => {
  const key = Number(props.champ?.key);
  if (!Number.isFinite(key) || !key) return '';
  return `${KHADA_URL}${key * 1000 + Number(selectedSkin.value?.num || 0)}`;
});
function scrollThumbIntoView(i) {
  nextTick(() => {
    const child = carouselEl.value?.children?.[i];
    child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
}
function selectSkin(i) {
  if (i < 0 || i >= skins.value.length) return;
  selectedSkinIndex.value = i;
  scrollThumbIntoView(i);
}
function prevSkin() {
  const n = skins.value.length;
  if (n) selectSkin((selectedSkinIndex.value - 1 + n) % n);
}
function nextSkin() {
  const n = skins.value.length;
  if (n) selectSkin((selectedSkinIndex.value + 1) % n);
}

const metaEntries = computed(() => metaEntriesOf(props.champ?.name));
const metaPatch = computed(() => metaInfo().patch);

// Counters (meta-builds): resolve os IDs do DDragon para o campeão da lista (ícone/nome/clique).
const champById = computed(() => {
  const map = {};
  for (const c of store.staticData.championList || []) map[c.id] = c;
  return map;
});
const counterEntries = computed(() =>
  countersEntriesOf(props.champ?.name)
    .map((e) => ({
      role: e.role,
      strongAgainst: e.strongAgainst.map((id) => champById.value[id]).filter(Boolean),
      counteredBy: e.counteredBy.map((id) => champById.value[id]).filter(Boolean)
    }))
    .filter((e) => e.strongAgainst.length || e.counteredBy.length)
);

// Build do meta (meta-builds.json), por rota. Runas continuam vindo do preset por classe
// (o scrape não captura runa). Sem entrada de meta → cai na build recomendada (fallback).
const metaRoles = computed(() => rolesWithMeta(props.champ).filter((r) => metaBuildFor(props.champ?.name, r)));
const activeMetaRole = ref(null);
const activeMetaBuild = computed(() => (activeMetaRole.value ? metaBuildFor(props.champ?.name, activeMetaRole.value) : null));
watch(metaRoles, (roles) => {
  if (!roles.includes(activeMetaRole.value)) activeMetaRole.value = roles[0] || null;
}, { immediate: true });

// Caminhos de finalização (Item 4/5/6): até 3 por rota, cada slot com WR e amostra.
// JSON gerado antes do campo `slots` devolve [] e a ficha cai nos situacionais soltos.
const metaVariants = computed(() => (activeMetaRole.value ? metaBuildVariants(props.champ?.name, activeMetaRole.value) : []));
const activeVariant = ref(0);

// Cada build tem SUA página de runas: a build 2 não roda com as runas da build 1.
// As runas continuam vindo dos presets curados (`builds-champs.json`) porque o scrape
// do lolalytics não captura runa — por isso o rótulo diz "preset".
const runesForVariant = computed(() => {
  const lista = builds.value;
  if (!lista.length) return null;
  return lista[Math.min(activeVariant.value, lista.length - 1)]?.runes || lista[0]?.runes || null;
});
watch(metaVariants, (v) => { if (activeVariant.value >= v.length) activeVariant.value = 0; });
watch(activeMetaRole, () => { activeVariant.value = 0; });

// 126934 -> "127k jogos" (a amostra é o que separa build sólida de ruído).
function fmtGames(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}
const damageLabel = computed(() => DAMAGE_LABELS[metrics.value?.damageType] || DAMAGE_LABELS.AD);

const radarAxes = computed(() =>
  TACTICAL_DIMENSIONS.map((dim) => ({ label: dim.label, value: (Number(metrics.value?.[dim.key]) || 0) * 20 }))
);

const loreShort = computed(() => {
  const text = sanitizeDDragonText(detail.value?.lore || '');
  return text.length > 600 ? `${text.slice(0, 600)}…` : text;
});

const abilities = computed(() => {
  if (!detail.value) return [];
  const list = [];
  if (detail.value.passive) {
    list.push({
      key: 'P',
      name: detail.value.passive.name,
      desc: sanitizeDDragonText(detail.value.passive.description),
      icon: championPassiveImage(detail.value.passive.image?.full)
    });
  }
  const keys = ['Q', 'W', 'E', 'R'];
  (detail.value.spells || []).forEach((spell, i) => {
    list.push({
      key: keys[i] || '·',
      name: spell.name,
      desc: sanitizeDDragonText(spell.description),
      icon: championSpellImage(spell.image?.full)
    });
  });
  return list;
});

function roleLabel(role) {
  return ROLES.find((r) => r.key === role)?.label || role;
}

async function loadDetail() {
  loadingDetail.value = true;
  detailError.value = null;
  try {
    detail.value = await fetchChampionDetail(props.champ.name);
  } catch (e) {
    detailError.value = e.message || 'Falha ao carregar a ficha.';
  } finally {
    loadingDetail.value = false;
  }
}

// Esc fecha a arte em tela cheia primeiro; só depois fecha a ficha (no modal — na
// página quem sai é o botão Voltar, para não perder a tela de baixo sem querer).
function onKeydown(e) {
  if (e.key !== 'Escape') return;
  if (artFullscreen.value) {
    e.stopPropagation();
    artFullscreen.value = false;
    return;
  }
  if (!isPagina.value) emit('close');
}

onMounted(() => {
  loadDetail();
  window.addEventListener('keydown', onKeydown);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});

watch(() => props.champ?.name, (novo, antigo) => {
  if (novo && novo !== antigo) {
    detail.value = null;
    activeBuildIndex.value = 0;
    selectedSkinIndex.value = 0;
    brokenSkins.value = new Set();
    loadDetail();
  }
});
</script>

<style>
/* Não-scoped e com nome único: a classe utilitária do Tailwind animate-[skinFade_...]
   referencia este keyframe globalmente (scoped renomearia o keyframe e quebraria o match). */
@keyframes skinFade {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
