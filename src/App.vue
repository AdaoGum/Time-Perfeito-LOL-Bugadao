<script setup>
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUgaStore } from './store/ugaStore'
import TelemetryWidget from './components/ui/TelemetryWidget.vue'
import LoadingOverlay from './components/ui/LoadingOverlay.vue'
import HomeView from './views/HomeView.vue'
import ProfileView from './views/ProfileView.vue'
import MasteryView from './views/MasteryView.vue'
import SynergyView from './views/SynergyView.vue'

const store = useUgaStore()
const { currentTab } = storeToRefs(store)
const tabs = [
  { id: 'home', label: '🛡️ Templo' },
  { id: 'profile', label: '⚔️ Caçada' },
  { id: 'mastery', label: '🌋 Caverna' },
  { id: 'synergy', label: '👥 Tribo' },
]
const views = {
  home: HomeView,
  profile: ProfileView,
  mastery: MasteryView,
  synergy: SynergyView,
}
const currentView = computed(() => views[currentTab.value] || HomeView)

onMounted(() => {
  store.initializeApp()
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.15),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.10),_transparent_20%)]" />
    <header class="fixed inset-x-0 top-0 z-40 border-b border-stone-800/80 bg-slate-950/90 backdrop-blur">
      <div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="font-eldritch text-2xl text-orange-300 sm:text-3xl">UGA BUGA</p>
          <h1 class="font-cavern text-sm text-stone-100 sm:text-base">Infos + Caverna dos Monos + Tribo Perfeita</h1>
        </div>
        <nav class="flex flex-wrap gap-2">
          <button v-for="tab in tabs" :key="tab.id" type="button" class="rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition sm:text-sm" :class="currentTab === tab.id ? 'border-orange-400 bg-orange-500/15 text-orange-200' : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-white'" @click="store.setCurrentTab(tab.id)">
            {{ tab.label }}
          </button>
        </nav>
      </div>
    </header>

    <TelemetryWidget />
    <LoadingOverlay />

    <main class="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-36 sm:px-6 lg:px-8">
      <component :is="currentView" />
    </main>
  </div>
</template>
