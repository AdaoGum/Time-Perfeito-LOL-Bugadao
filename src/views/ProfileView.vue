<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useUgaStore } from '../store/ugaStore'
import StoneCard from '../components/ui/StoneCard.vue'
import ErrorBanner from '../components/ui/ErrorBanner.vue'
import ProfileSearchForm from '../components/profile/ProfileSearchForm.vue'
import ProfileHeader from '../components/profile/ProfileHeader.vue'
import MatchRow from '../components/profile/MatchRow.vue'
import { buildAverageKda } from '../utils/helpers'

const store = useUgaStore()
const { searchProfile } = storeToRefs(store)
const searchInput = ref('')

watch(
  () => [searchProfile.value.gameName, searchProfile.value.tagLine],
  ([gameName, tagLine]) => {
    searchInput.value = gameName && tagLine ? `${gameName}#${tagLine}` : searchInput.value
  },
  { immediate: true },
)

const hasProfile = computed(() => Boolean(searchProfile.value.puuid))
const averageKda = computed(() => buildAverageKda(searchProfile.value.matches || []))
</script>

<template>
  <div class="space-y-6">
    <StoneCard class-name="p-5">
      <ProfileSearchForm v-model="searchInput" :loading="searchProfile.loading" button-label="Caçar perfil" @submit="store.searchByRiotId(searchInput)" />
    </StoneCard>

    <ErrorBanner :message="searchProfile.error || ''" @close="store.clearProfileError" />

    <template v-if="searchProfile.loading && !hasProfile">
      <StoneCard class-name="p-8 text-center">
        <p class="font-cavern text-xl text-cyan-200">Os xamãs estão rastreando o invocador...</p>
      </StoneCard>
    </template>

    <template v-else-if="hasProfile">
      <ProfileHeader :profile="searchProfile" :average-kda="averageKda" />
      <StoneCard class-name="p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-xl font-black text-white">Últimas {{ searchProfile.matches.length }} partidas</h3>
          <span class="lava-chip">Histórico real</span>
        </div>
        <div class="space-y-3">
          <MatchRow v-for="(match, index) in searchProfile.matches" :key="`${match.championName}-${index}`" :match="match" />
        </div>
      </StoneCard>
    </template>

    <StoneCard v-else class-name="p-8 text-center opacity-80">
      <p class="font-ritual text-2xl text-orange-200">Caçada vazia</p>
      <p class="mt-3 text-stone-300">Digite um Riot ID para revelar elo, win rate e as partidas mais recentes do invocador.</p>
    </StoneCard>
  </div>
</template>
