import { MockDataset } from '../types'

export type ReproducibilityResult = {
  reproducible: boolean
  mismatches: string[]
}

const comparePayloads = (
  left: Record<string, unknown>,
  right: Record<string, unknown>
): boolean => JSON.stringify(left) === JSON.stringify(right)

export const checkReproducibility = (
  left: MockDataset,
  right: MockDataset
): ReproducibilityResult => {
  const mismatches: string[] = []

  if (left.seed !== right.seed) {
    mismatches.push('seed mismatch')
  }

  if (left.configVersion !== right.configVersion) {
    mismatches.push('configVersion mismatch')
  }

  if (left.samples.length !== right.samples.length) {
    mismatches.push('sample count mismatch')
  }

  const minSamples = Math.min(left.samples.length, right.samples.length)
  for (let i = 0; i < minSamples; i += 1) {
    if (!comparePayloads(left.samples[i].payload, right.samples[i].payload)) {
      mismatches.push(`payload mismatch at index ${i}`)
      break
    }
  }

  return { reproducible: mismatches.length === 0, mismatches }
}
