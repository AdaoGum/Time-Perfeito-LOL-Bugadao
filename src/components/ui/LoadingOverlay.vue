<script setup>
import { storeToRefs } from 'pinia'
import { useUgaStore } from '../../store/ugaStore'

const store = useUgaStore()
const { loadingOverlay } = storeToRefs(store)
</script>

<template>
  <transition name="fade">
    <div v-if="loadingOverlay.visible" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.18),_transparent_35%)]" />
      <div class="relative flex h-40 w-40 items-center justify-center">
        <div class="absolute inset-0 rounded-full border border-cyan-500/40" />
        <div class="absolute inset-3 animate-spin rounded-full border-4 border-dashed border-orange-400/60 border-t-transparent" />
        <span class="font-ritual text-6xl text-cyan-300">{{ loadingOverlay.countdown }}</span>
      </div>
      <p class="relative mt-8 px-4 text-center font-cavern text-base text-orange-200 sm:text-lg">
        Buscando as informações com os espíritos ancestrais.<br />
        <span class="font-eldritch text-3xl text-lime-300">UGA BUGA</span>
      </p>
    </div>
  </transition>
</template>
