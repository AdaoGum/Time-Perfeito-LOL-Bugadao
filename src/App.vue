<template>
  <!-- Background ancestral -->
  <div class="fixed inset-0 z-0 pointer-events-none select-none">
    <div
      class="absolute inset-0 bg-cover bg-top bg-no-repeat transition-opacity duration-1000"
      :class="bgFor('historico') ? 'opacity-60' : 'opacity-0'"
      style="background-image: url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_0.jpg');"
    ></div>
    <div
      class="absolute inset-0 bg-cover bg-top bg-no-repeat transition-opacity duration-1000"
      :class="bgFor('analise') ? 'opacity-60' : 'opacity-0'"
      style="background-image: url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_2.jpg');"
    ></div>
    <div
      class="absolute inset-0 bg-cover bg-top bg-no-repeat transition-opacity duration-1000"
      :class="bgFor('mastery') ? 'opacity-60' : 'opacity-0'"
      style="background-image: url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_3.jpg');"
    ></div>
    <div
      class="absolute inset-0 bg-cover bg-top bg-no-repeat transition-opacity duration-1000"
      :class="bgFor('synergy') ? 'opacity-60' : 'opacity-0'"
      style="background-image: url('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Udyr_6.jpg');"
    ></div>
    <div class="absolute inset-0 bg-slate-950/72"></div>  
  </div>

  <!-- Card Ripple -->
  <div id="card-ripple" class="pointer-events-none fixed z-[55] hidden" style="width:10px;height:10px;border-radius:50%;transform:translate(-50%,-50%) scale(0)"></div>


  <!-- Cinematic Overlay — animação ÚNICA de busca (vale para busca normal e entrada direta por link) -->
  <div
    v-if="overlayVisible"
    class="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-slate-950/88 backdrop-blur-sm transition-all"
  >
    <span class="uga-word text-cyan-400/70"  style="top:9%;  left:7%;  font-size:1.4rem; animation-duration:2.8s; animation-delay:0s">UGA</span>
    <span class="uga-word text-fuchsia-400/70" style="top:14%; left:74%; font-size:1.1rem; animation-duration:3.2s; animation-delay:0.4s">Buga</span>
    <span class="uga-word text-lime-400/70"    style="top:28%; left:15%; font-size:1.7rem; animation-duration:2.5s; animation-delay:0.8s">BUGA</span>
    <span class="uga-word text-cyan-300/60"    style="top:22%; left:58%; font-size:0.95rem; animation-duration:3.0s; animation-delay:1.2s">Uga</span>
    <span class="uga-word text-amber-400/70"   style="top:62%; left:9%;  font-size:1.05rem; animation-duration:3.5s; animation-delay:0.6s">UGA BUGA</span>
    <span class="uga-word text-lime-300/60"    style="top:68%; left:78%; font-size:1.25rem; animation-duration:2.7s; animation-delay:1.5s">Uga</span>
    <span class="uga-word text-fuchsia-300/70" style="top:78%; left:43%; font-size:1.35rem; animation-duration:3.1s; animation-delay:0.2s">BUGA</span>
    <span class="uga-word text-cyan-400/60"    style="top:52%; left:28%; font-size:0.9rem;  animation-duration:2.9s; animation-delay:1.8s">UGA</span>
    <span class="uga-word text-amber-300/60"   style="top:42%; left:83%; font-size:1.5rem;  animation-duration:2.6s; animation-delay:2.2s">Buga</span>
    <span class="uga-word text-lime-400/70"    style="top:83%; left:63%; font-size:1.15rem; animation-duration:3.3s; animation-delay:0.9s">UGA</span>
    <div class="relative z-10 flex h-72 w-72 items-center justify-center">
      <svg class="absolute inset-0 h-full w-full animate-[spin_3s_linear_infinite] text-cyan-500" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="15 10" opacity="0.8" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="#3b82f6" stroke-width="4" stroke-dasharray="30 15" class="animate-[spin_2s_linear_infinite_reverse]" />
      </svg>
      <!-- Contagem de 4s com os números do Udyr (1→4, em loop). Cada número
           aparece por 1s: surge com pouca opacidade, fica visível e some aos poucos. -->
      <img
        :src="udyrCountImage"
        :key="countdown"
        alt="Contagem"
        class="udyr-count-img h-60 w-60 object-contain drop-shadow-[0_0_20px_rgba(6,182,212,0.85)]"
      />
    </div>

    <!-- Udyr caminhando da esquerda para a direita, logo abaixo do contador -->
    <div class="relative z-10 mt-6 h-24 w-full max-w-2xl overflow-hidden">
      <img
        src="/udyr-walking.gif"
        alt="Udyr caminhando"
        class="udyr-walker absolute bottom-0 h-24 w-auto drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]"
      />
    </div>

    <p class="relative z-10 mt-8 animate-pulse text-center text-lg font-black tracking-[0.12em] text-cyan-300 px-4">
      Buscando as informações com os espiritos ancestrais.<br /><span class="text-lime-300">UGA BUGA</span>
    </p>
  </div>

  <!-- Header -->
  <header class="fixed inset-x-0 top-0 z-[61] border-b border-slate-800/80 bg-slate-950/95 backdrop-blur">
    <div class="relative flex w-full items-center gap-4 py-3 pl-4 pr-2 md:pl-6">
      <button
        type="button"
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white lg:hidden"
        @click="store.ui.sidebarMobileOpen = !store.ui.sidebarMobileOpen"
        aria-label="Abrir menu lateral"
      >
        <i class="fa-solid fa-bars"></i>
      </button>

      <!-- Nome do site: clicável, leva para a home -->
      <button
        type="button"
        @click="router.push('/')"
        class="shrink-0 whitespace-nowrap text-sm font-extrabold tracking-tight md:text-base lg:text-lg cursor-pointer"
        title="Ir para a página inicial"
      >
        <span class="bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-500 bg-clip-text text-transparent">UGA BUGA</span>
      </button>

      <!-- Busca central: mesmo componente unificado. Invisível na Home (lá a busca
           é a central que "sobe" para cá via morph ao pesquisar). -->
      <div class="hidden min-w-0 flex-1 justify-center md:flex">
        <div
          data-search-morph="topbar"
          class="w-full max-w-sm transition-opacity duration-300"
          :class="route.path === '/' ? 'pointer-events-none opacity-0' : 'opacity-100'"
        >
          <SearchBar
            buttonText=""
            autocomplete
            context="global"
            :routeToProfile="true"
            @show-overlay="handleShowOverlay"
            @hide-overlay="handleHideOverlay"
            @show-udyr="handleShowUdyr"
          />
        </div>
      </div>

      <nav class="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
        <!-- `secondary`: atalhos que também vivem na sidebar. Somem abaixo de lg para a
             nav não quebrar linha (o header é fixed — crescer aqui cobre o conteúdo). -->
        <div v-for="tab in topTabs" :key="tab.id" class="group relative" :class="tab.secondary ? 'hidden lg:block' : ''">
          <button
            type="button"
            @click="router.push(tab.path)"
            class="px-3 py-1.5 font-cave text-xs sm:text-sm transition-all border-b-4 cursor-pointer"
            :class="isTabActive(tab.path)
              ? `${tab.border} scale-105 font-bold`
              : 'border-transparent opacity-60 hover:opacity-100'"
          >
            <span v-if="tab.gradient" class="bg-gradient-to-r from-lime-300 via-yellow-300 to-orange-500 bg-clip-text text-transparent">{{ tab.label }}</span>
            <span v-else :class="tab.text">{{ tab.label }}</span>
          </button>

          <!-- Prévia da aba (hover, desktop): mini mockup + descrição -->
          <div
            class="pointer-events-none absolute right-0 top-full z-[75] mt-2 hidden w-60 max-w-[80vw] translate-y-1 rounded-xl border border-slate-700 bg-slate-950/97 p-3 opacity-0 shadow-2xl backdrop-blur transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 md:group-hover:block"
          >
            <p class="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" :class="tab.accent">
              <i class="fa-solid" :class="tab.icon"></i> {{ tab.label }}
            </p>

            <!-- TEMPLO: 4 caminhos -->
            <div v-if="tab.preview.type === 'home'" class="grid grid-cols-4 gap-1.5">
              <div v-for="(c, i) in ['fa-scroll','fa-trophy','fa-dragon','fa-people-group']" :key="i" class="flex h-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-400">
                <i class="fa-solid text-xs" :class="c"></i>
              </div>
            </div>

            <!-- CAÇADA: mini cards de partida -->
            <div v-else-if="tab.preview.type === 'historico'" class="space-y-1.5">
              <div v-for="win in [true, false]" :key="String(win)" class="flex items-center gap-2 rounded-md border p-1.5" :class="win ? 'border-blue-800/60 bg-blue-950/30' : 'border-red-800/60 bg-red-950/30'">
                <div class="h-5 w-5 shrink-0 rounded bg-slate-700"></div>
                <div class="flex-1 space-y-1"><div class="h-1.5 w-10 rounded bg-slate-600"></div><div class="h-1.5 w-14 rounded bg-slate-700"></div></div>
                <span class="text-[9px] font-black" :class="win ? 'text-blue-400' : 'text-red-400'">{{ win ? 'V' : 'D' }}</span>
              </div>
            </div>

            <!-- VISÃO: radar + barras -->
            <div v-else-if="tab.preview.type === 'analise'" class="flex items-center gap-3">
              <svg viewBox="0 0 40 40" class="h-12 w-12 shrink-0">
                <polygon points="20,3 36,15 30,36 10,36 4,15" fill="none" stroke="#7c3aed" stroke-width="1" opacity="0.6" />
                <polygon points="20,11 30,17 26,31 14,30 10,18" fill="rgba(167,139,250,0.25)" stroke="#c4b5fd" stroke-width="1" />
              </svg>
              <div class="flex-1 space-y-1.5">
                <div class="h-1.5 rounded bg-violet-500/70" style="width:82%"></div>
                <div class="h-1.5 rounded bg-violet-500/50" style="width:58%"></div>
                <div class="h-1.5 rounded bg-violet-500/60" style="width:70%"></div>
              </div>
            </div>

            <!-- CAVERNA: pódio de maestria (ouro, prata, bronze) -->
            <div v-else-if="tab.preview.type === 'mastery'" class="flex items-end justify-center gap-1.5 py-1">
              <div
                v-for="m in [{ h: 'h-8', c: 'border-slate-400/70 bg-slate-400/10 text-slate-200', i: 'fa-medal' }, { h: 'h-11', c: 'border-yellow-400/70 bg-yellow-400/10 text-yellow-300', i: 'fa-crown' }, { h: 'h-7', c: 'border-orange-500/70 bg-orange-500/10 text-orange-300', i: 'fa-medal' }]"
                :key="m.i + m.h"
                class="flex w-8 flex-col items-center justify-end rounded border pb-1" :class="[m.h, m.c]"
              >
                <i class="fa-solid text-[10px]" :class="m.i"></i>
              </div>
            </div>

            <!-- RELÍQUIAS: grade de itens -->
            <div v-else-if="tab.preview.type === 'items'" class="grid grid-cols-6 gap-1">
              <div v-for="i in 12" :key="i" class="flex aspect-square items-center justify-center rounded border border-fuchsia-800/50 bg-fuchsia-950/30">
                <i class="fa-solid fa-gem text-[8px] text-fuchsia-400/70"></i>
              </div>
            </div>

            <!-- META: tier list S/A/B -->
            <div v-else-if="tab.preview.type === 'meta'" class="space-y-1.5">
              <div v-for="row in [{ t: 'S', c: 'text-rose-300 border-rose-500/60 bg-rose-500/10', n: 4 }, { t: 'A', c: 'text-amber-300 border-amber-500/60 bg-amber-500/10', n: 3 }, { t: 'B', c: 'text-sky-300 border-sky-500/60 bg-sky-500/10', n: 5 }]" :key="row.t" class="flex items-center gap-2">
                <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[9px] font-black" :class="row.c">{{ row.t }}</span>
                <div class="flex gap-1"><div v-for="i in row.n" :key="i" class="h-4 w-4 rounded-full border border-slate-600 bg-slate-700"></div></div>
              </div>
            </div>

            <!-- PANTEÃO: grade de campeões -->
            <div v-else-if="tab.preview.type === 'pantheon'" class="grid grid-cols-6 gap-1">
              <div v-for="i in 12" :key="i" class="aspect-square rounded border border-slate-700 bg-slate-800"></div>
            </div>

            <!-- TRIBO: 5 vagas -->
            <div v-else class="flex justify-center gap-1.5 py-1">
              <div v-for="i in 5" :key="i" class="flex h-8 w-8 items-center justify-center rounded-lg border border-lime-700/50 bg-lime-950/40">
                <i class="fa-solid fa-user text-[10px] text-lime-400/80"></i>
              </div>
            </div>

            <p class="mt-2.5 text-[10px] font-medium leading-snug text-slate-400">{{ tab.preview.desc }}</p>
            <span class="absolute right-4 top-0 h-2.5 w-2.5 -translate-y-[6px] rotate-45 border-l border-t border-slate-700 bg-slate-950"></span>
          </div>
        </div>
      </nav>
    </div>
  </header>

  <div
    v-if="store.ui.sidebarMobileOpen"
    class="fixed inset-0 z-[58] bg-slate-950/60 lg:hidden"
    @click="store.ui.sidebarMobileOpen = false"
  ></div>

  <aside
    class="fixed bottom-0 left-0 top-16 z-[60] flex flex-col overflow-hidden border-r border-slate-800 bg-slate-950/95 backdrop-blur transition-all duration-300"
    :class="[
      effectiveCollapsed ? 'w-20' : 'w-72',
      store.ui.sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    ]"
    @mouseenter="sidebarHovered = true"
    @mouseleave="sidebarHovered = false"
  >
    <div class="flex shrink-0 items-center border-b border-slate-800 px-3 py-3" :class="effectiveCollapsed ? 'justify-center' : 'justify-between'">
      <span v-if="!effectiveCollapsed" class="text-xs font-black uppercase tracking-wider text-slate-400">Spiritual Bar</span>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-700 text-slate-300 hover:text-white"
        @click="toggleSidebarCollapse"
        :aria-label="store.ui.sidebarCollapsed ? 'Fixar sidebar aberta' : 'Minimizar sidebar'"
      >
        <i class="fa-solid" :class="store.ui.sidebarCollapsed ? 'fa-thumbtack' : 'fa-angles-left'"></i>
      </button>
    </div>

    <div v-if="store.searchProfile.puuid" class="shrink-0 border-b border-slate-800 p-3">
      <div class="rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg" :class="effectiveCollapsed ? 'p-2' : 'p-3'">
        <div class="flex gap-2" :class="effectiveCollapsed ? 'flex-col items-center justify-start' : 'items-center'">
          <img
            class="rounded-lg border border-slate-700 object-cover"
            :class="effectiveCollapsed ? 'h-9 w-9' : 'h-10 w-10'"
            :src="profileIconImage(store.searchProfile.profileIconId)"
            @error="(e) => e.target.src = profileIconImage(29)"
          />
          <div class="min-w-0" :class="effectiveCollapsed ? 'w-full text-center -mt-1' : 'flex-1'">
            <p class="truncate font-black text-slate-100" :class="effectiveCollapsed ? 'text-[9px]' : 'text-[11px]'">
              {{ store.searchProfile.gameName }}<span class="font-medium text-slate-500">#{{ store.searchProfile.tagLine }}</span>
            </p>
            <p class="font-bold text-slate-400" :class="effectiveCollapsed ? 'text-[8px]' : 'text-[10px]'">Nível {{ store.searchProfile.summonerLevel }}</p>
          </div>
        </div>
        <div v-if="!effectiveCollapsed" class="mt-2 space-y-1">
          <p class="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-black uppercase text-cyan-400">
            Solo/Duo: {{ store.searchProfile.statsSolo?.tier && store.searchProfile.statsSolo?.tier !== 'UNRANKED' ? `${store.searchProfile.statsSolo.tier} ${store.searchProfile.statsSolo.rank || ''}`.trim() : 'UNRANKED' }}
          </p>
          <p class="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] font-black uppercase text-purple-400">
            Flex: {{ store.searchProfile.statsFlex?.tier && store.searchProfile.statsFlex?.tier !== 'UNRANKED' ? `${store.searchProfile.statsFlex.tier} ${store.searchProfile.statsFlex.rank || ''}`.trim() : 'UNRANKED' }}
          </p>
        </div>
      </div>
    </div>


    <nav class="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-3">
      <!-- Seções temáticas: Jogadores, Campeões e Equipes. O TÍTULO é clicável e leva
           ao hub do módulo (Equipes → Tribo). As sub-opções abaixo seguem diretas. -->
      <div v-for="section in sidebarSections" :key="`sec-${section.id}`" class="space-y-1.5">
        <button
          type="button"
          class="group flex w-full items-center gap-2 rounded-md px-1 py-0.5 transition hover:bg-slate-900/60"
          :class="[effectiveCollapsed ? 'justify-center' : '', isItemActive({ match: [section.hub] }) ? 'bg-slate-900/50' : '']"
          @click="goToTab(section.hub)"
          :title="`Abrir ${section.label}`"
        >
          <span class="inline-flex h-5 w-5 items-center justify-center text-[11px]" :class="section.labelClass">
            <i class="fa-solid" :class="section.icon"></i>
          </span>
          <span v-if="!effectiveCollapsed" class="text-[10px] font-black uppercase tracking-[0.15em]" :class="section.labelClass">{{ section.label }}</span>
          <span v-if="!effectiveCollapsed" class="ml-1 h-px flex-1 bg-slate-800 transition group-hover:bg-slate-600"></span>
          <i v-if="!effectiveCollapsed" class="fa-solid fa-chevron-right text-[8px] opacity-0 transition group-hover:opacity-60" :class="section.labelClass"></i>
        </button>
        <button
          v-for="item in section.items"
          :key="`side-${item.id}`"
          type="button"
          @click="goToTab(item.path)"
          class="flex w-full items-center rounded-lg border py-2 text-xs font-bold transition"
          :class="[
            effectiveCollapsed ? 'justify-center px-0' : 'justify-start px-2 text-left',
            isItemActive(item)
              ? item.active
              : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white'
          ]"
          :title="item.label"
        >
          <span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-950 text-sm">
            <i class="fa-solid" :class="item.icon"></i>
          </span>
          <span v-if="!effectiveCollapsed" class="ml-2 truncate">{{ item.label }}</span>
        </button>
      </div>
    </nav>

    <!-- Botão especial: Ancestralidade (última opção da sidebar, fundo laranja) -->
    <div class="shrink-0 border-t border-slate-800 px-3 pt-3">
      <button
        type="button"
        @click="goToTab(ancestralButton.path)"
        class="flex w-full items-center rounded-xl border-2 py-2.5 text-xs font-black uppercase tracking-wide transition"
        :class="[
          effectiveCollapsed ? 'justify-center px-0' : 'justify-start px-2 text-left',
          isItemActive(ancestralButton)
            ? 'border-orange-400 bg-orange-500/25 text-orange-100 shadow-[0_0_22px_rgba(249,115,22,0.35)]'
            : 'border-orange-500/70 bg-gradient-to-r from-orange-600/40 to-amber-600/25 text-orange-200 hover:border-orange-400 hover:text-orange-50'
        ]"
        :title="ancestralButton.label"
      >
        <span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-orange-500/60 bg-slate-950 text-sm text-orange-300">
          <i class="fa-solid" :class="ancestralButton.icon"></i>
        </span>
        <span v-if="!effectiveCollapsed" class="ml-2 truncate">{{ ancestralButton.label }}</span>
      </button>
    </div>

    <div class="shrink-0 p-3">
      <!-- NÍVEL TINY: uma linha mínima (também usado quando a sidebar está minimizada) -->
      <div
        v-if="telLevel === 'tiny'"
        class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 backdrop-blur-sm"
        :class="effectiveCollapsed ? 'flex-col justify-center px-1 py-1.5' : 'px-2.5 py-1.5'"
      >
        <span class="inline-flex h-2 w-2 shrink-0 rounded-full" :class="telDotClass"></span>
        <span v-if="!effectiveCollapsed" class="text-[10px] font-bold uppercase tracking-wider text-slate-500">API</span>
        <span class="text-[11px] font-black text-white">{{ telUsage }}/100</span>
        <button
          v-if="!effectiveCollapsed"
          type="button"
          class="ml-auto inline-flex h-5 w-5 items-center justify-center rounded border border-slate-700 text-slate-400 transition hover:text-white"
          @click="setTelemetryLevel('mini')"
          title="Expandir monitor da API"
        >
          <i class="fa-solid fa-chevron-up text-[9px]"></i>
        </button>
      </div>

      <!-- NÍVEL MINI (padrão) e FULL -->
      <div v-else class="rounded-xl border border-slate-700 bg-slate-900/90 p-3 backdrop-blur-sm">
        <div class="mb-2 flex items-center justify-between border-b border-slate-700/50 pb-2">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monitor da API</span>
          <div class="flex items-center gap-1">
            <button
              v-if="telLevel === 'mini'"
              type="button"
              class="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-700 text-slate-400 transition hover:text-white"
              @click="setTelemetryLevel('full')"
              title="Ver detalhes"
            ><i class="fa-solid fa-list text-[9px]"></i></button>
            <button
              v-else
              type="button"
              class="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-700 text-slate-400 transition hover:text-white"
              @click="setTelemetryLevel('mini')"
              title="Recolher detalhes"
            ><i class="fa-solid fa-chevron-up text-[9px]"></i></button>
            <button
              type="button"
              class="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-700 text-slate-400 transition hover:text-white"
              @click="setTelemetryLevel('tiny')"
              title="Diminuir ainda mais"
            ><i class="fa-solid fa-minus text-[9px]"></i></button>
          </div>
        </div>

        <div class="flex items-center justify-between text-sm font-semibold">
          <span class="text-slate-300">Uso global (2 min)</span>
          <span class="text-white">{{ telUsage }}/100</span>
        </div>
        <div class="mt-1 flex items-center justify-between text-sm font-semibold">
          <span class="text-slate-300">Disponível</span>
          <span :class="telAvailableClass">{{ telAvailable }}</span>
        </div>
        <div class="mt-2 rounded py-1 text-center text-xs font-medium" :class="telTimeClass">
          {{ telTimeText }}
        </div>

        <template v-if="telLevel === 'full'">
          <div class="mt-3 space-y-2 border-t border-slate-700/50 pt-3">
            <div
              v-for="group in telGroupSummaries"
              :key="group.key"
              class="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5"
            >
              <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide">
                <span :class="group.labelClass">{{ group.label }}</span>
                <span class="text-slate-300">{{ group.usage }} pts</span>
              </div>
              <div class="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>{{ group.requestCount }} req</span>
                <span>{{ group.timeText }}</span>
              </div>
            </div>
          </div>

          <!-- Toggle de dados brutos do worker (só nos detalhes) -->
          <button
            type="button"
            @click="showWorkerDebug = !showWorkerDebug"
            class="mt-2 flex w-full items-center justify-center gap-1 rounded border border-slate-700 bg-slate-950 py-1 text-[11px] font-bold text-slate-300 transition hover:border-slate-500 hover:text-white"
            :class="showWorkerDebug ? 'border-cyan-700 text-cyan-300' : ''"
            :title="showWorkerDebug ? 'Esconder dados brutos do worker' : 'Mostrar dados brutos do worker'"
          >
            <i class="fa-solid" :class="showWorkerDebug ? 'fa-eye-slash' : 'fa-code'"></i>{{ showWorkerDebug ? 'Esconder dados brutos' : 'Dados brutos do worker' }}
          </button>
        </template>
      </div>
    </div>
  </aside>

  <!-- Painel flutuante: Dados Brutos do Worker -->
  <div
    v-if="showWorkerDebug"
    class="fixed bottom-4 left-4 z-[62] flex max-h-[60vh] w-[min(92vw,34rem)] flex-col rounded-xl border border-slate-700 bg-[#0d1117] shadow-2xl"
  >
    <div class="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
      <span class="text-xs font-black uppercase tracking-wider text-slate-400">Dados Brutos do Worker</span>
      <button
        type="button"
        class="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-700 text-slate-400 hover:text-white"
        @click="showWorkerDebug = false"
        aria-label="Fechar dados brutos"
      ><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="overflow-auto p-4">
      <pre class="text-xs font-mono text-green-400">{{ JSON.stringify(store.searchProfile, null, 2) }}</pre>
    </div>
  </div>

  <!-- Main -->
  <main class="w-full px-4 pb-16 pt-24 transition-[margin] duration-300 md:px-6" :style="mainStyle">
    <div
      class="min-h-[80vh] rounded-3xl border-2 p-4 transition-colors duration-700 sm:p-6"
      :class="pageThemeBorder"
    >
      <router-view v-slot="{ Component }">
        <component
          :is="Component"
          @search-start="handleSearchStart"
          @show-overlay="handleShowOverlay"
          @hide-overlay="handleHideOverlay"
          @show-udyr="handleShowUdyr"
          @show-tooltip="handleShowTooltip"
          @hide-tooltip="handleHideTooltip"
        />
      </router-view>
    </div>
  </main>

  <!-- Mastery Tooltip -->
  <div
    ref="tooltipEl"
    class="pointer-events-none fixed z-50 hidden rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-2xl"
  ></div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { state } from './store.js';
import { fetchRateStatus } from './api.js';
import { profileIconImage, DDRAGON_VERSION, resolveDDragonVersion, flipMorph } from './utils.js';
import SearchBar from './components/SearchBar.vue';

const store = state;
const route = useRoute();
const router = useRouter();

const tooltipEl = ref(null);

// Animação de busca: cicla os 4 números do Udyr (1→4, 1s cada). Fica visível por
// no MÍNIMO 4s (para exibir os 4 números) mesmo que a busca termine antes; se a
// busca demorar mais, continua em loop até terminar.
const MIN_OVERLAY_MS = 4000;
const overlayVisible = ref(false);
const countdown = ref(1);
const udyrCountImage = computed(() => `/udyr%20${countdown.value}.png`);
let countInterval = null;
let hideTimeout = null;
let overlayStart = 0;
const showWorkerDebug = ref(false);
const sidebarHovered = ref(false);

function stopOverlay() {
  overlayVisible.value = false;
  clearInterval(countInterval);
  countInterval = null;
}

watch(
  () => store.searchProfile.loading,
  (isLoading) => {
    if (isLoading) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
      overlayVisible.value = true;
      overlayStart = Date.now();
      countdown.value = 1;
      clearInterval(countInterval);
      countInterval = setInterval(() => {
        countdown.value = countdown.value >= 4 ? 1 : countdown.value + 1;
      }, 1000);
    } else {
      // Segura o fechamento até completar os 4s mínimos.
      const remaining = Math.max(0, MIN_OVERLAY_MS - (Date.now() - overlayStart));
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(stopOverlay, remaining);
    }
  }
);

// No modo minimizado, a barra expande visualmente enquanto o mouse estiver sobre ela.
// O estado real (store.ui.sidebarCollapsed) continua governando o pin, a margem do main e o localStorage.
const effectiveCollapsed = computed(() => store.ui.sidebarCollapsed && !sidebarHovered.value);

// Nível do Monitor da API: quando a sidebar está minimizada, força 'tiny'; senão
// respeita a escolha do usuário (padrão 'mini'). Persistido no localStorage.
const telLevel = computed(() => (effectiveCollapsed.value ? 'tiny' : store.ui.telemetryLevel));
function setTelemetryLevel(level) {
  store.ui.telemetryLevel = level;
  localStorage.setItem('telemetry-level', level);
}
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440);

const topTabs = [
  { id: 'home', path: '/', label: 'TEMPLO', icon: 'fa-fire', gradient: true, border: 'border-orange-500', active: 'border-orange-500 bg-orange-500/10 text-orange-300', accent: 'text-orange-300', preview: { type: 'home', desc: 'Escolha seu caminho ancestral: jogador, campeões ou tribo.' } },
  { id: 'historico', path: '/historico', label: 'CAÇADA', icon: 'fa-paw', text: 'text-cyan-400', border: 'border-cyan-500', active: 'border-cyan-500 bg-cyan-500/10 text-cyan-400', accent: 'text-cyan-300', preview: { type: 'historico', desc: 'Histórico de partidas: KDA, itens e confrontos por rota.' } },
  { id: 'analise', path: '/analise', label: 'VISÃO', icon: 'fa-chart-simple', text: 'text-violet-400', border: 'border-violet-500', active: 'border-violet-500 bg-violet-500/10 text-violet-400', accent: 'text-violet-300', preview: { type: 'analise', desc: 'Estatísticas e radar de desempenho sobre todo o histórico.' } },
  { id: 'mastery', path: '/mastery', label: 'CAVERNA', icon: 'fa-trophy', text: 'text-amber-400', border: 'border-amber-500', active: 'border-amber-500 bg-amber-500/10 text-amber-400', accent: 'text-amber-300', secondary: true, preview: { type: 'mastery', desc: 'Caverna dos Monos: os campeões mais dominados, nível e pontos.' } },
  { id: 'meta', path: '/meta', label: 'META', icon: 'fa-ranking-star', text: 'text-amber-400', border: 'border-amber-500', active: 'border-amber-500 bg-amber-500/10 text-amber-400', accent: 'text-amber-300', preview: { type: 'meta', desc: 'Tier list S/A/B/C/D por rota no patch atual.' } },
  { id: 'pantheon', path: '/champions', label: 'PANTEÃO', icon: 'fa-dragon', text: 'text-sky-400', border: 'border-sky-500', active: 'border-sky-500 bg-sky-500/10 text-sky-400', accent: 'text-sky-300', preview: { type: 'pantheon', desc: 'Fichas de campeões: habilidades, perfil tático e relíquias.' } },
  { id: 'items', path: '/items', label: 'RELÍQUIAS', icon: 'fa-gem', text: 'text-fuchsia-400', border: 'border-fuchsia-500', active: 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-400', accent: 'text-fuchsia-300', secondary: true, preview: { type: 'items', desc: 'Arsenal de itens: efeitos, custo e quem se dá bem com cada um.' } },
  { id: 'sinergia', path: '/synergy', label: 'TRIBO', icon: 'fa-people-group', text: 'text-lime-400', border: 'border-lime-500', active: 'border-lime-500 bg-lime-500/10 text-lime-400', accent: 'text-lime-300', preview: { type: 'tribo', desc: 'Planejador de composição: encaixe 1 a 5 e ache a sinergia.' } },
];

// Sidebar temática: duas seções grandes (Jogadores e Campeões). `match` = prefixos
// de rota que acendem o item (cobre sub-rotas e apelidos como /historico, /analise).
const sidebarSections = [
  {
    id: 'players',
    label: 'Jogadores',
    icon: 'fa-crown',
    labelClass: 'text-cyan-300',
    hub: '/jogadores',
    items: [
      { id: 'historico', path: '/historico', match: ['/historico', '/profile'], label: 'Caçadas Passadas', icon: 'fa-paw', active: 'border-cyan-500 bg-cyan-500/10 text-cyan-300' },
      { id: 'analise', path: '/analise', match: ['/analise'], label: 'Olhar Espiritual', icon: 'fa-chart-simple', active: 'border-violet-500 bg-violet-500/10 text-violet-300' },
      { id: 'mastery', path: '/mastery', match: ['/mastery'], label: 'Caverna dos Monos', icon: 'fa-trophy', active: 'border-amber-500 bg-amber-500/10 text-amber-300' },
    ]
  },
  {
    id: 'champions',
    label: 'Campeões',
    icon: 'fa-dragon',
    labelClass: 'text-violet-300',
    hub: '/campeoes',
    items: [
      { id: 'meta', path: '/meta', match: ['/meta'], label: 'Meta & Tier List', icon: 'fa-ranking-star', active: 'border-amber-500 bg-amber-500/10 text-amber-300' },
      { id: 'pantheon', path: '/champions', match: ['/champions'], label: 'Panteão dos Campeões', icon: 'fa-dragon', active: 'border-sky-500 bg-sky-500/10 text-sky-300' },
      { id: 'items', path: '/items', match: ['/items'], label: 'Relíquias Ancestrais', icon: 'fa-gem', active: 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300' },
    ]
  },
  {
    id: 'teams',
    label: 'Equipes',
    icon: 'fa-people-group',
    labelClass: 'text-lime-300',
    hub: '/synergy',
    items: [
      { id: 'sinergia', path: '/synergy', match: ['/synergy'], label: 'Tribo Perfeita', icon: 'fa-people-group', active: 'border-lime-500 bg-lime-500/10 text-lime-300' },
      { id: 'custom', path: '/saguaoCustom', match: ['/saguaoCustom'], label: 'Customizada 5x5', icon: 'fa-shuffle', active: 'border-orange-500 bg-orange-500/10 text-orange-300' },
    ]
  }
];

// Ancestralidade (consulta avançada ao D1): botão especial ISOLADO no rodapé da
// sidebar — não aparece em nenhuma seção nem na Home.
const ancestralButton = { path: '/ancestralidade', match: ['/ancestralidade'], label: 'Ancestralidade', icon: 'fa-user-secret' };

function isItemActive(item) {
  const p = route.path;
  return (item.match || [item.path]).some((prefix) => p === prefix || p.startsWith(prefix + '/'));
}

// A animação de busca agora é única e guiada por store.searchProfile.loading.
// Os handlers são mantidos como no-op pois o evento @show-overlay/@hide-overlay
// ainda existe na árvore de componentes.
function handleShowOverlay() {}
function handleHideOverlay() {}

function goToTab(path) {
  store.ui.sidebarMobileOpen = false;
  router.push(path);
}

function toggleSidebarCollapse() {
  store.ui.sidebarCollapsed = !store.ui.sidebarCollapsed;
  localStorage.setItem('sidebar-collapsed', String(store.ui.sidebarCollapsed));
}

// Morph da busca: quando a pesquisa parte da Home, a caixa central "sobe" até a
// busca da topbar (FLIP). Nas demais rotas a topbar já está visível — sem morph.
function handleSearchStart() {
  if (route.path !== '/') return;
  const src = document.querySelector('[data-search-morph="home"]');
  const dst = document.querySelector('[data-search-morph="topbar"]');
  flipMorph(src, dst);
}

function updateViewport() {
  viewportWidth.value = window.innerWidth;
  if (window.innerWidth >= 1024) {
    store.ui.sidebarMobileOpen = false;
  }
}

const isDesktop = computed(() => viewportWidth.value >= 1024);

// Aba ativa considerando sub-rotas (ex.: /historico/Kami/BR1 acende "CAÇADA").
// '/' (Templo) só acende na home exata para não casar com tudo.
function isTabActive(path) {
  if (path === '/') return route.path === '/';
  return route.path === path || route.path.startsWith(path + '/');
}

// Qual fundo fixo mostrar. Caçada e o /profile genérico compartilham o mesmo splash.
function bgFor(section) {
  const p = route.path;
  if (section === 'historico') return p.startsWith('/historico') || p.startsWith('/profile');
  return p.startsWith('/' + section);
}

// Borda do conteúdo na cor do caminho ativo (mesma cor do botão clicado)
const pageThemeBorder = computed(() => {
  const p = route.path;
  if (p.startsWith('/historico') || p.startsWith('/profile')) return 'border-cyan-500/60';
  if (p.startsWith('/analise')) return 'border-violet-500/60';
  if (p.startsWith('/mastery')) return 'border-amber-500/60';
  if (p.startsWith('/synergy')) return 'border-lime-500/60';
  if (p.startsWith('/saguaoCustom')) return 'border-orange-500/60';
  if (p.startsWith('/ancestralidade')) return 'border-fuchsia-500/60';
  if (p.startsWith('/meta')) return 'border-amber-500/60';
  if (p.startsWith('/champions')) return 'border-sky-500/60';
  if (p.startsWith('/items')) return 'border-fuchsia-500/60';
  return 'border-transparent';
});

const mainStyle = computed(() => {
  if (!isDesktop.value) {
    return { marginLeft: '0px', width: '100%' };
  }

  // A margem do conteúdo segue o estado REAL fixado (não o hover).
  // Minimizada: reserva 80px. Ao expandir via hover, a barra fica sobreposta
  // ao conteúdo (overlay) sem empurrá-lo.
  const leftOffset = store.ui.sidebarCollapsed ? 80 : 288;
  return {
    marginLeft: `${leftOffset}px`,
    width: `calc(100% - ${leftOffset}px)`
  };
});

watch(
  () => route.path,
  () => {
    store.ui.sidebarMobileOpen = false;
  }
);

// Runner do Udyr (imagem cruzando a tela após achar o jogador) foi removido.
// Mantido como no-op para o evento @show-udyr ainda existente na árvore.
function handleShowUdyr() {}

// Mastery tooltip
function handleShowTooltip({ event, name, level, points }) {
  const el = tooltipEl.value;
  if (!el) return;
  el.innerHTML = `<p class="font-cave text-base text-orange-400">${name}</p><p class="text-[10px] uppercase text-stone-400 mt-0.5">Nível de Mestria: ${level}</p><p class="text-xs text-stone-200 mt-1 font-bold">PTS: ${Number(points || 0).toLocaleString('pt-BR')}</p>`;
  el.classList.remove('hidden');
}

function handleHideTooltip() {
  tooltipEl.value?.classList.add('hidden');
}

function onMouseMove(e) {
  const el = tooltipEl.value;
  if (el && !el.classList.contains('hidden')) {
    el.style.left = `${e.clientX + 16}px`;
    el.style.top = `${e.clientY + 12}px`;
  }
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('resize', updateViewport);
  const saved = localStorage.getItem('sidebar-collapsed');
  if (saved !== null) {
    store.ui.sidebarCollapsed = saved === 'true';
  }
  const savedTel = localStorage.getItem('telemetry-level');
  if (savedTel === 'tiny' || savedTel === 'mini' || savedTel === 'full') {
    store.ui.telemetryLevel = savedTel;
  }
  updateViewport();
});
onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('resize', updateViewport);
  clearInterval(countInterval);
  clearTimeout(hideTimeout);
});

// =========================================================
// BLOCO DE TELEMETRIA CORRIGIDO E SEGURO CONTRA UNDEFINED
// =========================================================
const telemetryTick = ref(0);
let telInterval = null;
const TELEMETRY_WINDOW_MS = 120000;
const TELEMETRY_GROUP_META = [
  { key: 'full-profile', label: 'Perfil Completo', labelClass: 'text-amber-300' },
  { key: 'light-profile', label: 'Perfil Leve', labelClass: 'text-cyan-300' },
  { key: 'masteries', label: 'Maestrias', labelClass: 'text-fuchsia-300' },
  { key: 'other', label: 'Outros', labelClass: 'text-slate-300' }
];

function formatTelemetryReset(msLeft) {
  const secsLeft = Math.max(0, Math.ceil(msLeft / 1000));
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pruneTelemetry(now = Date.now()) {
  const twoMinsAgo = now - TELEMETRY_WINDOW_MS;
  const ts = store.telemetry?.timestamps || [];
  while (ts.length > 0 && ts[0] < twoMinsAgo) ts.shift();

  const events = store.telemetry?.events || [];
  while (events.length > 0 && events[0].at < twoMinsAgo) events.shift();
}

function updateTelemetry() {
  pruneTelemetry();
  telemetryTick.value++;
}

let rateInterval = null;
onMounted(() => {
  telInterval = setInterval(updateTelemetry, 1000);
  // Contador GLOBAL: busca ao entrar e faz polling p/ todos verem o mesmo número ao vivo.
  fetchRateStatus();
  rateInterval = setInterval(fetchRateStatus, 5000);
});
onUnmounted(() => {
  if (telInterval) clearInterval(telInterval);
  if (rateInterval) clearInterval(rateInterval);
});

// Uso GLOBAL compartilhado (o mesmo p/ todos os usuários), reportado pelo worker/D1.
const telUsage = computed(() => {
  telemetryTick.value;
  return store.telemetry?.global?.used || 0;
});

const telAvailable = computed(() => {
  telemetryTick.value;
  const g = store.telemetry?.global;
  return g ? g.available : 100;
});

const telAvailableClass = computed(() => {
  const a = telAvailable.value;
  if (a > 25) return 'text-green-400';
  if (a > 10) return 'text-amber-400';
  return 'text-red-500 animate-pulse font-black';
});

// Indicador colorido (bolinha) do nível 'tiny'/cabeçalho, pelo saldo disponível.
const telDotClass = computed(() => {
  const a = telAvailable.value;
  if (a > 25) return 'bg-green-400';
  if (a > 10) return 'bg-amber-400';
  return 'bg-red-500 animate-pulse';
});

const telTimeText = computed(() => {
  telemetryTick.value;
  const g = store.telemetry?.global;
  if (!g || g.used === 0) return 'Status: Liberado';
  return `Reset geral: ${formatTelemetryReset(g.resetAt - Date.now())}`;
});

const telTimeClass = computed(() => {
  if ((store.telemetry?.global?.used || 0) === 0) {
    return 'bg-slate-950/50 text-slate-400';
  }
  return 'bg-blue-950/40 text-blue-300 border border-blue-800/50';
});

const telGroupSummaries = computed(() => {
  telemetryTick.value;
  const events = store.telemetry?.events || [];

  return TELEMETRY_GROUP_META.map((meta) => {
    const groupEvents = events.filter((event) => event.group === meta.key);
    const usage = groupEvents.reduce((sum, event) => sum + Number(event.cost || 0), 0);
    const oldest = groupEvents[0]?.at || null;
    const timeText = oldest
      ? `Reset: ${formatTelemetryReset(TELEMETRY_WINDOW_MS - (Date.now() - oldest))}`
      : 'Livre';

    return {
      ...meta,
      usage,
      requestCount: groupEvents.length,
      timeText
    };
  }).filter((group) => group.usage > 0 || group.requestCount > 0);
});

// Load static Data Dragon data on mount
onMounted(async () => {
  // Garante o patch ao vivo ANTES de baixar os dados estáticos (e antes de montar
  // URLs de assets). Em falha/timeout resolve para o fallback e segue normalmente.
  await resolveDDragonVersion();
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/pt_BR/champion.json`);
    const json = await res.json();
    store.staticData.championList = Object.values(json.data || {});
  } catch (e) {
    console.error('Erro ao carregar dados do Data Dragon:', e);
  }

  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/pt_BR/item.json`);
    const json = await res.json();
    store.staticData.items = json.data || {};
  } catch (e) {
    console.error('Erro ao carregar itens do Data Dragon:', e);
  }

  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/pt_BR/summoner.json`);
    const json = await res.json();
    const map = {};
    for (const spell of Object.values(json.data || {})) {
      map[spell.key] = { name: spell.name, image: spell.image?.full };
    }
    store.staticData.summonerSpells = map;
  } catch (e) {
    console.error('Erro ao carregar feitiços do Data Dragon:', e);
  }

  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/pt_BR/runesReforged.json`);
    const styles = await res.json();
    const map = {};
    for (const style of styles || []) {
      // O próprio estilo (árvore) também tem id/icon (usado para a árvore secundária)
      map[style.id] = { name: style.name, icon: style.icon };
      for (const slot of style.slots || []) {
        for (const rune of slot.runes || []) {
          map[rune.id] = { name: rune.name, icon: rune.icon };
        }
      }
    }
    store.staticData.runes = map;
  } catch (e) {
    console.error('Erro ao carregar runas do Data Dragon:', e);
  }
});
</script>
