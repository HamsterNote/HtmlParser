const fnv1a = (seed: string): number => {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export type Prng = {
  next: () => number
  nextInt: (min: number, max: number) => number
  pick: <T>(values: T[]) => T
}

export const createPrng = (seed: string): Prng => {
  let state = fnv1a(seed)
  const next = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
  const nextInt = (min: number, max: number): number => {
    if (max <= min) return min
    const value = next()
    return Math.floor(min + value * (max - min + 1))
  }
  const pick = <T>(values: T[]): T => {
    if (values.length === 0) {
      throw new Error('Cannot pick from empty array')
    }
    return values[nextInt(0, values.length - 1)]
  }

  return { next, nextInt, pick }
}
