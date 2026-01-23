import { createMockId } from '../store/mockStores'
import { MockDataConfig, MockDataset, MockSample } from '../types'
import { createPrng } from './prng'
import {
  generateNormalValue,
  getBoundaryValues,
  getExceptionValues
} from './fieldValueGenerator'

const buildBasePayload = (config: MockDataConfig, seed: string): Record<string, unknown> => {
  const prng = createPrng(seed)
  return config.fields.reduce<Record<string, unknown>>((acc, field) => {
    acc[field.fieldName] = generateNormalValue(field, prng)
    return acc
  }, {})
}

const buildSample = (
  payload: Record<string, unknown>,
  tags: Array<'boundary' | 'exception' | 'normal'>,
  valid: boolean,
  violations: string[]
): MockSample => ({
  id: createMockId('sample'),
  payload,
  tags,
  valid,
  violations
})

export const buildDataset = (
  config: MockDataConfig,
  overrideSeed?: string
): MockDataset => {
  const seed = overrideSeed ?? config.seed
  const samples: MockSample[] = []

  for (let i = 0; i < config.generationParams.sampleCount; i += 1) {
    const payload = buildBasePayload(config, `${seed}-${i}`)
    samples.push(buildSample(payload, ['normal'], true, []))
  }

  if (config.generationParams.includeBoundarySamples) {
    config.fields.forEach((field) => {
      const prng = createPrng(`${seed}-${field.fieldName}-boundary`)
      getBoundaryValues(field, prng).forEach((value) => {
        const payload = buildBasePayload(config, `${seed}-boundary-${field.fieldName}`)
        payload[field.fieldName] = value
        samples.push(buildSample(payload, ['boundary'], true, []))
      })
    })
  }

  if (config.generationParams.includeExceptionSamples) {
    config.fields.forEach((field) => {
      getExceptionValues(field).forEach((value) => {
        const payload = buildBasePayload(config, `${seed}-exception-${field.fieldName}`)
        payload[field.fieldName] = value
        samples.push(
          buildSample(payload, ['exception'], false, [
            `Field ${field.fieldName} violates constraint`
          ])
        )
      })
    })
  }

  const validCount = samples.filter((sample) => sample.valid).length
  const invalidCount = samples.length - validCount
  const boundaryCount = samples.filter((sample) => sample.tags.includes('boundary')).length
  const exceptionCount = samples.filter((sample) => sample.tags.includes('exception')).length
  const constraintPassRate = samples.length === 0 ? 0 : validCount / samples.length

  return {
    id: createMockId('dataset'),
    configId: config.id,
    configVersion: config.version,
    seed,
    samples,
    stats: {
      total: samples.length,
      validCount,
      invalidCount,
      boundaryCount,
      exceptionCount,
      constraintPassRate
    },
    generatedAt: new Date().toISOString()
  }
}
