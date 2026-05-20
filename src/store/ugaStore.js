import { defineStore } from 'pinia'
import { workerRequest } from '../utils/api'
import {
  DDRAGON_VERSION,
  createPlayerSlot,
  parseRiotId,
  normalizeMasteryEntry,
  filterChampionSuggestions,
  computeCompositionAnalysis,
} from '../utils/helpers'

const initialSearchProfile = () => ({
  loading: false,
  error: null,
  puuid: null,
  gameName: '',
  tagLine: '',
  profileIconId: 29,
  summonerLevel: 0,
  stats: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
  matches: [],
})

const initialMasteryDashboard = () => ({
  loading: false,
  error: null,
  allMasteries: [],
})

const initialTeamPlanner = () => ({
  queueType: 'solo_duo',
  playerCount: 2,
  analysisLoading: false,
  analysisResult: null,
  slots: Array.from({ length: 5 }, (_, index) => createPlayerSlot(index + 1)),
})

export const useUgaStore = defineStore('uga', {
  state: () => ({
    currentTab: 'home',
    searchProfile: initialSearchProfile(),
    masteryDashboard: initialMasteryDashboard(),
    teamPlanner: initialTeamPlanner(),
    telemetry: {
      timestamps: [],
      maxRequests: 100,
      windowMs: 120000,
    },
    loadingOverlay: {
      visible: false,
      countdown: 3,
    },
    staticData: {
      championList: [],
      championMap: {},
      loaded: false,
    },
    telemetryTimer: null,
    overlayTimer: null,
  }),
  getters: {
    activeSlots: (state) => state.teamPlanner.slots.slice(0, state.teamPlanner.playerCount),
    championOptions: (state) => state.staticData.championList.map((champion) => champion.name).sort((a, b) => a.localeCompare(b)),
  },
  actions: {
    async initializeApp() {
      if (!this.staticData.loaded) {
        await this.loadStaticData()
      }
      this.startTelemetryLoop()
    },
    async loadStaticData() {
      try {
        const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/pt_BR/champion.json`)
        const json = await response.json()
        this.staticData.championList = Object.values(json.data || {})
        this.staticData.championMap = Object.values(json.data || {}).reduce((accumulator, champion) => {
          accumulator[Number(champion.key)] = champion
          return accumulator
        }, {})
        this.staticData.loaded = true
      } catch (error) {
        this.searchProfile.error = 'Falha ao carregar os dados estáticos do Data Dragon.'
      }
    },
    startTelemetryLoop() {
      if (this.telemetryTimer) return
      this.telemetryTimer = window.setInterval(() => this.pruneTelemetry(), 1000)
    },
    pruneTelemetry() {
      const threshold = Date.now() - this.telemetry.windowMs
      this.telemetry.timestamps = this.telemetry.timestamps.filter((timestamp) => timestamp >= threshold)
    },
    recordTelemetry(cost = 1) {
      const now = Date.now()
      for (let index = 0; index < cost; index += 1) {
        this.telemetry.timestamps.push(now)
      }
      this.pruneTelemetry()
    },
    setCurrentTab(tab) {
      this.currentTab = tab
    },
    clearProfileError() {
      this.searchProfile.error = null
    },
    clearMasteryError() {
      this.masteryDashboard.error = null
    },
    clearSlotError(slotId) {
      const slot = this.teamPlanner.slots.find((entry) => entry.id === slotId)
      if (slot) slot.error = null
    },
    async startLoadingOverlay(seconds = 3) {
      window.clearInterval(this.overlayTimer)
      this.loadingOverlay.visible = true
      this.loadingOverlay.countdown = seconds
      await new Promise((resolve) => {
        let remaining = seconds
        this.overlayTimer = window.setInterval(() => {
          remaining -= 1
          if (remaining > 0) {
            this.loadingOverlay.countdown = remaining
            return
          }
          window.clearInterval(this.overlayTimer)
          resolve()
        }, 1000)
      })
    },
    stopLoadingOverlay() {
      window.clearInterval(this.overlayTimer)
      this.loadingOverlay.visible = false
      this.loadingOverlay.countdown = 3
    },
    async searchByRiotId(riotId) {
      const { gameName, tagLine, valid } = parseRiotId(riotId)
      if (!valid) {
        this.searchProfile.error = 'Formato inválido. Use Nome#TAG.'
        return
      }

      this.searchProfile.loading = true
      this.masteryDashboard.loading = true
      this.searchProfile.error = null
      this.masteryDashboard.error = null

      const overlayPromise = this.startLoadingOverlay(3)

      try {
        const profile = await workerRequest('profile_overview', { gameName, tagLine })
        this.searchProfile = {
          ...initialSearchProfile(),
          puuid: profile.puuid || null,
          gameName: profile.gameName || gameName,
          tagLine: profile.tagLine || tagLine,
          profileIconId: profile.profileIconId || 29,
          summonerLevel: profile.summonerLevel || 0,
          stats: {
            wins: Number(profile.stats?.wins || 0),
            losses: Number(profile.stats?.losses || 0),
            winRate: Number(profile.stats?.winRate || 0),
            tier: profile.stats?.tier || 'UNRANKED',
            rank: profile.stats?.rank || '',
            lp: Number(profile.stats?.lp || 0),
          },
          matches: Array.isArray(profile.matches) ? profile.matches : [],
        }

        const masteryData = await workerRequest('masteries', {
          puuid: profile.puuid,
          gameName,
          tagLine,
        })
        this.masteryDashboard.allMasteries = (masteryData.masteries || []).map((entry) =>
          normalizeMasteryEntry(entry, this.staticData.championMap),
        )
        this.currentTab = this.currentTab === 'home' ? 'profile' : this.currentTab
      } catch (error) {
        this.searchProfile.error = error.message
        this.masteryDashboard.error = error.message
      } finally {
        await overlayPromise
        this.stopLoadingOverlay()
        this.searchProfile.loading = false
        this.masteryDashboard.loading = false
      }
    },
    setQueueType(queueType) {
      this.teamPlanner.queueType = queueType
    },
    setPlayerCount(playerCount) {
      this.teamPlanner.playerCount = playerCount
      this.teamPlanner.analysisResult = null
    },
    setSlotType(slotId, type) {
      const index = this.teamPlanner.slots.findIndex((slot) => slot.id === slotId)
      if (index === -1) return
      this.teamPlanner.slots[index] = createPlayerSlot(slotId, type)
      this.teamPlanner.analysisResult = null
    },
    updateSlotQuery(slotId, value) {
      const slot = this.teamPlanner.slots.find((entry) => entry.id === slotId)
      if (!slot) return
      slot.query = value
      slot.suggestions = filterChampionSuggestions(value, this.staticData.championList)
      this.teamPlanner.analysisResult = null
    },
    selectSlotSuggestion(slotId, championName) {
      const slot = this.teamPlanner.slots.find((entry) => entry.id === slotId)
      if (!slot) return
      slot.query = championName
      slot.championSelected = championName
      slot.suggestions = []
      this.teamPlanner.analysisResult = null
    },
    updateSlotRiotId(slotId, value) {
      const slot = this.teamPlanner.slots.find((entry) => entry.id === slotId)
      if (!slot) return
      const [gameName = '', tagLine = ''] = value.split('#')
      slot.gameName = gameName.trim()
      slot.tagLine = tagLine.trim()
      this.teamPlanner.analysisResult = null
    },
    selectSlotChampion(slotId, championName) {
      const slot = this.teamPlanner.slots.find((entry) => entry.id === slotId)
      if (!slot) return
      slot.championSelected = championName
      this.teamPlanner.analysisResult = null
    },
    clearSlot(slotId) {
      const index = this.teamPlanner.slots.findIndex((slot) => slot.id === slotId)
      if (index === -1) return
      this.teamPlanner.slots[index] = createPlayerSlot(slotId, 'profile')
      this.teamPlanner.analysisResult = null
    },
    async fetchSlotProfile(slotId) {
      const slot = this.teamPlanner.slots.find((entry) => entry.id === slotId)
      if (!slot) return
      if (!slot.gameName || !slot.tagLine) {
        slot.error = 'Preencha nome e tag.'
        return
      }

      slot.loading = true
      slot.error = null
      try {
        const data = await workerRequest('masteries', {
          gameName: slot.gameName,
          tagLine: slot.tagLine,
        })
        slot.searchedData = data
        slot.masteryChoices = (data.masteries || [])
          .map((entry) => normalizeMasteryEntry(entry, this.staticData.championMap))
          .slice(0, 15)
      } catch (error) {
        slot.error = error.message
      } finally {
        slot.loading = false
      }
    },
    async analyzeTeamComposition() {
      this.teamPlanner.analysisLoading = true
      this.teamPlanner.analysisResult = null
      const champions = this.activeSlots.map((slot) => slot.championSelected).filter(Boolean)
      await new Promise((resolve) => window.setTimeout(resolve, 1200))
      this.teamPlanner.analysisResult = computeCompositionAnalysis(
        champions,
        this.teamPlanner.playerCount,
        this.staticData.championList,
      )
      this.teamPlanner.analysisLoading = false
    },
  },
})
