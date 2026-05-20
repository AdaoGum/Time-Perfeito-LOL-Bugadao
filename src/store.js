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
    gameName: null,
    tagLine: null,
    profileIconId: null,
    summonerLevel: null,
    stats: { wins: 0, losses: 0, winRate: 0 },
    matches: []
  },
  masteryDashboard: {
    loading: false,
    error: null,
    allMasteries: []
  },
  teamPlanner: {
    queueType: 'solo_duo',
    playerCount: 2,
    analysisLoading: false,
    analysisResult: null,
    slots: [
      { id: 1, type: 'anonymous', championSelected: '', searchedData: null, loading: false, error: null, query: '', gameName: '', tagLine: '', suggestions: [], masteryChoices: [] },
      { id: 2, type: 'anonymous', championSelected: '', searchedData: null, loading: false, error: null, query: '', gameName: '', tagLine: '', suggestions: [], masteryChoices: [] },
      { id: 3, type: 'anonymous', championSelected: '', searchedData: null, loading: false, error: null, query: '', gameName: '', tagLine: '', suggestions: [], masteryChoices: [] },
      { id: 4, type: 'anonymous', championSelected: '', searchedData: null, loading: false, error: null, query: '', gameName: '', tagLine: '', suggestions: [], masteryChoices: [] },
      { id: 5, type: 'anonymous', championSelected: '', searchedData: null, loading: false, error: null, query: '', gameName: '', tagLine: '', suggestions: [], masteryChoices: [] }
    ]
  },
  staticData: {
    championsById: {},
    championList: []
  }
});
