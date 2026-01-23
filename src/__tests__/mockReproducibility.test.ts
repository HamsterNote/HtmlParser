import { checkReproducibility, createMockConfig, generateMockDataset } from '../mock'

describe('mock reproducibility', () => {
  it('generates deterministic datasets with the same seed', () => {
    const config = createMockConfig({
      name: 'repro-check',
      version: 'v1',
      seed: 'fixed-seed',
      targetModule: 'html-parser',
      fields: [
        {
          fieldName: 'title',
          type: 'string',
          required: true,
          nullable: false,
          length: { min: 1, max: 5 }
        }
      ],
      generationParams: {
        sampleCount: 3,
        includeBoundarySamples: false,
        includeExceptionSamples: false
      }
    })

    const first = generateMockDataset({ configId: config.id }).dataset
    const second = generateMockDataset({ configId: config.id }).dataset

    if (!first || !second) {
      throw new Error('Failed to generate datasets')
    }

    const result = checkReproducibility(first, second)
    expect(result.reproducible).toBe(true)
    expect(result.mismatches.length).toBe(0)
  })
})
