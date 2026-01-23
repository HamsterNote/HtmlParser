import { createMockConfig, generateMockDataset } from '../mock'

describe('mock dataset generation', () => {
  it('includes boundary and exception samples', () => {
    const config = createMockConfig({
      name: 'dataset-check',
      version: 'v1',
      seed: 'seed-3',
      targetModule: 'html-parser',
      fields: [
        {
          fieldName: 'pageCount',
          type: 'number',
          required: true,
          nullable: false,
          range: { min: 1, max: 3 },
          boundaryValues: [1, 3],
          exceptionValues: [-1]
        },
        {
          fieldName: 'title',
          type: 'string',
          required: true,
          nullable: false,
          length: { min: 1, max: 5 }
        }
      ],
      generationParams: {
        sampleCount: 2,
        includeBoundarySamples: true,
        includeExceptionSamples: true
      }
    })

    const result = generateMockDataset({ configId: config.id })
    expect(result.dataset).toBeDefined()
    const dataset = result.dataset
    if (!dataset) return

    expect(dataset.stats.boundaryCount).toBeGreaterThan(0)
    expect(dataset.stats.exceptionCount).toBeGreaterThan(0)

    const hasBoundary = dataset.samples.some((sample) =>
      sample.tags.includes('boundary')
    )
    const hasException = dataset.samples.some((sample) =>
      sample.tags.includes('exception')
    )

    expect(hasBoundary).toBe(true)
    expect(hasException).toBe(true)
  })
})
