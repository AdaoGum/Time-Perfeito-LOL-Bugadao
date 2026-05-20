export const WORKER_URL = 'https://lol-riotgames-api-bridge.adaojmsantos.workers.dev/'
export const DDRAGON_VERSION = '14.22.1'

const CHAMPION_KEY_OVERRIDES = {
  Wukong: 'MonkeyKing',
  "Cho'Gath": 'Chogath',
  'Dr. Mundo': 'DrMundo',
  'Nunu & Willump': 'Nunu',
  "K'Sante": 'KSante',
  "Kai'Sa": 'Kaisa',
  "Kha'Zix": 'Khazix',
  "Bel'Veth": 'Belveth',
  "Rek'Sai": 'RekSai',
  "Vel'Koz": 'Velkoz',
  LeBlanc: 'Leblanc',
}

export function createPlayerSlot(id, type = 'anonymous') {
  return {
    id,
    type,
    championSelected: '',
    searchedData: null,
    loading: false,
    error: null,
    query: '',
    gameName: '',
    tagLine: '',
    suggestions: [],
    masteryChoices: [],
  }
}

export function parseRiotId(value) {
  const [gameNameRaw, tagLineRaw] = String(value || '').split('#')
  const gameName = (gameNameRaw || '').trim()
  const tagLine = (tagLineRaw || '').trim()
  return { gameName, tagLine, valid: Boolean(gameName && tagLine) }
}

export function getChampionIdFromName(name) {
  return CHAMPION_KEY_OVERRIDES[name] || name?.replace(/[\s'.]/g, '') || ''
}

export function championImage(name) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${encodeURIComponent(getChampionIdFromName(name))}.png`
}

export function profileIconImage(id) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${id}.png`
}

export function itemImage(itemId) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${itemId}.png`
}

export function calculateKdaRatio(kills, deaths, assists) {
  return ((Number(kills || 0) + Number(assists || 0)) / Math.max(1, Number(deaths || 0))).toFixed(2)
}

export function formatDuration(seconds) {
  const totalSeconds = Number(seconds || 0)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`
}

export function normalizeWorkerError(status) {
  if (status === 404) return 'Erro: Invocador não encontrado. Verifique a ortografia do nome e a tag.'
  if (status === 429) return 'A plataforma está recebendo muitas consultas simultâneas. Por favor, aguarde.'
  if (status === 401 || status === 403) return 'Erro de Chave: A API Key da Riot expirou no Cloudflare.'
  return 'Falha crítica amigável: não foi possível completar a operação agora.'
}

export function normalizeMasteryEntry(entry, championMap) {
  const championFromStatic = championMap?.[Number(entry?.championId)]
  return {
    championName: entry?.championName || championFromStatic?.name || 'Aatrox',
    championLevel: Number(entry?.championLevel || 1),
    championPoints: Number(entry?.championPoints || 0),
  }
}

export function filterChampionSuggestions(query, championList) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return []
  return (championList || [])
    .filter((champion) => champion.name.toLowerCase().includes(needle))
    .slice(0, 6)
    .map((champion) => champion.name)
}

export function buildAverageKda(matches) {
  if (!matches?.length) return '0.00'
  const totalKillsAndAssists = matches.reduce(
    (accumulator, match) => accumulator + Number(match.kills || 0) + Number(match.assists || 0),
    0,
  )
  const totalDeaths = matches.reduce((accumulator, match) => accumulator + Number(match.deaths || 0), 0)
  return (totalKillsAndAssists / Math.max(1, totalDeaths)).toFixed(2)
}

export function computeCompositionAnalysis(champions, playerCount, championList) {
  const uniqueCount = new Set(champions).size
  const hasDuplicates = uniqueCount < champions.length
  const completeness = Math.round((champions.length / Math.max(1, playerCount)) * 100)
  const championMeta = champions
    .map((name) => championList.find((champion) => champion.name === name))
    .filter(Boolean)
  const tags = championMeta.flatMap((champion) => champion.tags || [])
  const adLike = tags.filter((tag) => ['Fighter', 'Marksman', 'Assassin'].includes(tag)).length
  const apLike = tags.filter((tag) => ['Mage', 'Support'].includes(tag)).length
  const ccLike = tags.filter((tag) => ['Tank', 'Support'].includes(tag)).length
  const frontlineLike = tags.filter((tag) => ['Tank', 'Fighter'].includes(tag)).length
  const totalTagBase = Math.max(1, tags.length)
  const damageBalance = 100 - Math.min(100, Math.abs(adLike - apLike) * 18)
  const ccScore = Math.min(100, Math.round((ccLike / totalTagBase) * 100) + 25)
  const frontline = Math.min(100, Math.round((frontlineLike / totalTagBase) * 100) + 20)
  const tempo = Math.max(20, Math.min(100, 60 + champions.length * 6 - (hasDuplicates ? 25 : 0)))

  let grade = 'D'
  if (completeness >= 100 && !hasDuplicates) grade = 'S'
  else if (completeness >= 80 && !hasDuplicates) grade = 'A'
  else if (completeness >= 60) grade = 'B'
  else if (completeness >= 40) grade = 'C'

  let coach = 'A composição está incompleta. Preencha todos os slots para um feedback tático preciso.'
  if (champions.includes('Yasuo') && champions.includes('Malphite')) {
    coach = 'Combo devastador detectado (Malphite + Yasuo). Foquem em lutar por objetivos em áreas fechadas do mapa.'
  } else if (hasDuplicates) {
    coach = 'Campeões repetidos detectados! Lembre-se que no Rift só pode haver um de cada.'
  } else if (frontline < 45 && completeness > 80) {
    coach = 'Alerta: Linha de frente extremamente frágil. Vocês sofrerão contra iniciações pesadas (Hard Engage). Um tanque faz falta.'
  } else if (damageBalance < 45 && completeness > 80) {
    coach = 'Dano muito concentrado em um único tipo (AD ou AP). O time inimigo vai construir armadura/resistência mágica barata e anular vocês.'
  } else if (completeness === 100) {
    coach = 'Composição sólida com boas condições de vitória. Respeitem o tempo de pico de cada campeão e controlem a visão.'
  }

  return { grade, metrics: { damageBalance, ccScore, frontline, tempo }, coach }
}
