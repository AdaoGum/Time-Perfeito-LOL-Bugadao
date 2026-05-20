<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useUgaStore } from '../store/ugaStore'
import StoneCard from '../components/ui/StoneCard.vue'
import ErrorBanner from '../components/ui/ErrorBanner.vue'
import ProfileSearchForm from '../components/profile/ProfileSearchForm.vue'
import PodiumCard from '../components/mastery/PodiumCard.vue'
import SecondaryGrid from '../components/mastery/SecondaryGrid.vue'
import MasteryMosaic from '../components/mastery/MasteryMosaic.vue'

const store = useUgaStore()
const { searchProfile, masteryDashboard } = storeToRefs(store)
const searchInput = ref('')

watch(
  () => [searchProfile.value.gameName, searchProfile.value.tagLine],
  ([gameName, tagLine]) => {
    searchInput.value = gameName && tagLine ? `${gameName}#${tagLine}` : searchInput.value
  },
  { immediate: true },
)

const top20 = computed(() => masteryDashboard.value.allMasteries.slice(0, 20))
const top5 = computed(() => top20.value.slice(0, 5))
const top15 = computed(() => top20.value.slice(5, 20))
const remainder = computed(() => masteryDashboard.value.allMasteries.slice(20))
const maxPoints = computed(() => top20.value[0]?.championPoints || 1)
</script>

<template>
  <div class="space-y-6">
    <StoneCard class-name="p-5">
      <ProfileSearchForm v-model="searchInput" :loading="masteryDashboard.loading" button-label="Invocar maestrias" accent-class="from-orange-600 to-amber-500" @submit="store.searchByRiotId(searchInput)" />
    </StoneCard>

    <ErrorBanner :message="masteryDashboard.error || ''" @close="store.clearMasteryError" />

    <template v-if="top20.length">
      <StoneCard class-name="p-5">
        <h2 class="text-center font-cavern text-2xl text-orange-100">Esses são seus Uga Monos, seu Buga</h2>
        <p class="mt-2 text-center text-xs uppercase tracking-[0.28em] text-stone-400">Top 5 de maestria com destaque competitivo</p>
        <div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <PodiumCard v-for="(entry, index) in top5" :key="entry.championName" :entry="entry" :index="index" :max-points="maxPoints" />
        </div>
      </StoneCard>

      <StoneCard class-name="p-5">
        <h3 class="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-stone-300">Conselho do Top 6 ao 20</h3>
        <SecondaryGrid :entries="top15" :max-points="maxPoints" />
      </StoneCard>

      <StoneCard class-name="p-5">
        <h3 class="mb-4 text-lg font-bold text-white">Mosaico Ancestral ({{ remainder.length }})</h3>
        <MasteryMosaic :entries="remainder" />
      </StoneCard>
    </template>

    <StoneCard v-else class-name="p-8 text-center opacity-80">
      <p class="font-ritual text-2xl text-amber-200">A caverna está silenciosa</p>
      <p class="mt-3 text-stone-300">Busque um invocador para popular o pódio, o conselho e o mosaico de maestria.</p>
    </StoneCard>
  </div>
</template>
