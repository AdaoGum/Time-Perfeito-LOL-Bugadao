export const state = {
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
};

let onChangeCallback = () => {};

export function onStateChange(callback) {
  onChangeCallback = callback;
}

export function updateState(path, newValue) {
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce((acc, key) => {
    const numeric = Number(key);
    const parsed = Number.isInteger(numeric) && String(numeric) === key ? numeric : key;
    return acc[parsed];
  }, state);
  const lastNumeric = Number(last);
  const parsedLast = Number.isInteger(lastNumeric) && String(lastNumeric) === last ? lastNumeric : last;
  parent[parsedLast] = newValue;
  onChangeCallback();
}
