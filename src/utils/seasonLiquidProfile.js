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

function randomBetween(random, minimum, maximum) {
  return minimum + (maximum - minimum) * random()
}

export function createSeasonLiquidProfile(seed) {
  const random = createSeededRandom(seed)

  // 同一赛季始终取得同一组参数，既保留卡片差异，也避免重挂载后视觉突然跳变。
  return {
    direction: random() > 0.5 ? 1 : -1,
    speed: randomBetween(random, 0.17, 0.34),
    phase: randomBetween(random, 0, Math.PI * 2),
    tilt: randomBetween(random, -0.28, 0.28),
    blobs: Array.from({ length: 7 }, (_, index) => ({
      x: randomBetween(random, 0.04, 0.96),
      y: randomBetween(random, 0.03, 0.97),
      radiusX: randomBetween(random, 0.085, 0.2),
      radiusY: randomBetween(random, 0.11, 0.25),
      amplitudeX: randomBetween(random, 0.055, 0.18),
      amplitudeY: randomBetween(random, 0.045, 0.17),
      phase: randomBetween(random, 0, Math.PI * 2),
      speed: randomBetween(random, 0.56, 1.34),
      colorIndex: index % 4,
      stretch: randomBetween(random, 0.78, 1.34),
    })),
  }
}
