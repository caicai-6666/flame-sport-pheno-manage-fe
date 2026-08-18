const FULL_TURN = Math.PI * 2

function hashSeed(value) {
  const text = String(value)
  let hash = 2166136261

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0 || 1
}

function createSeededRandom(seed) {
  let state = hashSeed(seed)

  return () => {
    state += 0x6d2b79f5
    let result = state
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

export function createProjectGalaxyProfile(seed) {
  const random = createSeededRandom(`project-galaxy:${seed}`)
  const direction = random() > 0.5 ? 1 : -1

  return {
    phase: random() * FULL_TURN,
    direction,
    tilt: -0.22 + random() * 0.44,
    speed: 0.21 + random() * 0.09,
    bandWidth: 0.13 + random() * 0.055,
    waveAmplitude: 0.035 + random() * 0.035,
    waveFrequency: 1.25 + random() * 0.65,
    paletteOffset: Math.floor(random() * 5),
    nebulae: Array.from({ length: 5 }, (_, index) => ({
      colorIndex: index,
      lane: -0.76 + index * 0.38 + (random() - 0.5) * 0.12,
      width: 0.54 + random() * 0.38,
      speed: 0.32 + random() * 0.3,
      phase: random() * FULL_TURN,
      anchor: random(),
      radiusX: 0.11 + random() * 0.1,
      radiusY: 0.075 + random() * 0.075,
    })),
    stars: Array.from({ length: 48 }, (_, index) => {
      const depth = 0.34 + random() * 0.88
      const lane = (random() + random() - 1) * 1.08

      return {
        position: -0.2 + random() * 1.4,
        lane,
        depth,
        size: 0.45 + random() * 1.45,
        speed: 0.52 + random() * 0.9,
        colorIndex: index % 5,
        twinklePhase: random() * FULL_TURN,
        twinkleSpeed: 0.55 + random() * 1.25,
        trail: random() > 0.73,
      }
    }),
  }
}
