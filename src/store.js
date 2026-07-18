import { reactive } from 'vue';

export const state = reactive({
  // Monitor de Telemetria da API da Riot (Evita o erro de undefined no App.vue)
  telemetry: {
    timestamps: [],
    events: [],
    // Contador GLOBAL compartilhado (vindo do worker/D1): o mesmo número para
    // todos os usuários. `loaded` só vira true após a primeira resposta do worker.
    global: { used: 0, limit: 100, available: 100, resetAt: 0, windowMs: 120000, loaded: false }
  },

  // Dados do perfil unificado buscado (Jogador Global Ativo)
  searchProfile: {
    loading: false,
    error: null,
    puuid: null,
    gameName: '',
    tagLine: '',
    profileIconId: 29,
    summonerLevel: 0,
    stats: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    statsSolo: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    statsFlex: { wins: 0, losses: 0, winRate: 0, tier: 'UNRANKED', rank: '', lp: 0 },
    matches: [],
    // Histórico leve vindo do D1 (até 1000 partidas) usado pelo cálculo de proficiência
    proficiencyMatches: [],
    // Companheiros por fila (quem mais jogou com ele): { solo: [], flex: [] }
    companions: { solo: [], flex: [] },
    // Premium = sincronizado toda madrugada pelo trator (chega "tudo montado")
    hasPremium: false,
    // Partidas ranqueadas recentes que ainda NÃO estão no banco (o worker informa)
    pendingCount: 0,
    // True enquanto o botão "buscar últimos 10 jogos" está trabalhando
    fetchingMatches: false
  },

  // Painel de maestrias que as outras telas consultam
  masteryDashboard: {
    allMasteries: [],
    error: null
  },

  ui: {
    sidebarCollapsed: false,
    sidebarMobileOpen: false
  },

  // Planeador de equipes (Página da Tribo)
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

  staticData: {
    championList: [],
    // Mapa de itens do Data Dragon, indexado pelo id (string) -> { name, ... }
    items: {},
    // Feitiços de invocador indexados pelo id numérico -> { name, image }
    summonerSpells: {},
    // Runas indexadas pelo id do perk -> { name, icon }
    runes: {}
  }
});