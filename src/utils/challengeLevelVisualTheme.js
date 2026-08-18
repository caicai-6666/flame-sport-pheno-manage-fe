const challengeLevelThemes = [
  {
    key: 'bronze',
    base: '#2f1d17',
    deep: '#563323',
    primary: '#b96940',
    secondary: '#d89662',
    accent: '#82452c',
    ink: '#59321f',
    text: '#f2d4bd',
  },
  {
    key: 'silver',
    base: '#24313a',
    deep: '#465662',
    primary: '#7f99aa',
    secondary: '#afbdc5',
    accent: '#5c7689',
    ink: '#40525f',
    text: '#dde8ed',
  },
  {
    key: 'gold',
    base: '#36290f',
    deep: '#654a19',
    primary: '#c78f22',
    secondary: '#e2b94e',
    accent: '#9d6819',
    ink: '#624516',
    text: '#f2dda6',
  },
  {
    key: 'sapphire',
    base: '#182b49',
    deep: '#294f7b',
    primary: '#3979bc',
    secondary: '#5ca4cf',
    accent: '#315d99',
    ink: '#284d77',
    text: '#d6e9f2',
  },
  {
    key: 'amethyst',
    base: '#2d2247',
    deep: '#523a72',
    primary: '#7656a9',
    secondary: '#a477bd',
    accent: '#5c4089',
    ink: '#4d376c',
    text: '#eadcf0',
  },
  {
    key: 'jade',
    base: '#17362f',
    deep: '#285e50',
    primary: '#34836d',
    secondary: '#63aa8d',
    accent: '#276754',
    ink: '#285b4c',
    text: '#d8ebe3',
  },
]

function hashSeed(seed) {
  const value = String(seed)
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createSeededRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function resolveChallengeLevelTheme(level) {
  const normalizedName = String(level?.name ?? '').trim().toLocaleLowerCase()
  if (normalizedName.includes('青铜') || normalizedName.includes('bronze')) {
    return challengeLevelThemes[0]
  }
  if (normalizedName.includes('白银') || normalizedName.includes('silver')) {
    return challengeLevelThemes[1]
  }
  if (normalizedName.includes('黄金') || normalizedName.includes('gold')) {
    return challengeLevelThemes[2]
  }

  const numericId = Number(level?.id)
  const fallbackOffset = Number.isInteger(numericId) && numericId > 0 ? numericId - 1 : 0
  return challengeLevelThemes[3 + fallbackOffset % 3]
}

export function createChallengeLevelLiquidProfile(seed) {
  const random = createSeededRandom(seed)
  return {
    phase: random() * Math.PI * 2,
    speed: 0.36 + random() * 0.16,
    lobes: 4 + Math.floor(random() * 3),
    twist: 0.18 + random() * 0.2,
    driftX: 0.018 + random() * 0.025,
    driftY: 0.014 + random() * 0.022,
  }
}
