import { MockDataConfigInput } from '../types'

const hashString = (input: string): string => {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export const computeConfigVersion = (config: MockDataConfigInput): string => {
  const serialized = JSON.stringify({
    name: config.name,
    seed: config.seed,
    targetModule: config.targetModule,
    fields: config.fields,
    generationParams: config.generationParams
  })
  return `v${hashString(serialized)}`
}

export const bumpConfigVersion = (version: string): string => {
  const match = /^v?(\d+)$/.exec(version)
  if (match) {
    const value = Number(match[1]) + 1
    return `v${value}`
  }
  return `v${version}-1`
}
