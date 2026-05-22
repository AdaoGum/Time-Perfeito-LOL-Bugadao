import { reactive } from 'vue';

export const state = reactive({
  currentTab: 'home',
  telemetry: {
    timestamps: []
  },
  searchProfile: {
    loading: false,
    error: null,
    puuid: null,
    gameName: '',
    tagLine: '',
    profileIconId: 29,
    summonerLevel: 0,
    stats: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    matches: []
  },
  masteryDashboard: {
    allMasteries: [],
    error: null
  },
  teamPlanner: {
    queueType: 'solo_duo',
    playerCount: 5,
    analysisLoading: false,
    analysisResult: null,
    slots: Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      type: 'profile',
      gameName: '',
      tagLine: '',
      query: '',
      loading: false,
      error: null,
      searchedData: null,
      championSelected: '',
      suggestions: [],
      masteryChoices: [],
      role: i === 0 ? 'Jungle' : i === 1 ? 'Top' : i === 2 ? 'Mid' : i === 3 ? 'ADC' : 'Sup'
    }))
  },
  fogueira: {
    players: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      rawInput: '',
      name: '',
      tag: '',
      elo: 'UNRANKED',
      eloWeight: 100,
      loading: false,
      data: null
    })),
    team1: [],
    team2: []
  },
  staticData: {
    championList: []
  }
});
