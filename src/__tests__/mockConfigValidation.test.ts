import { createMockConfig, validateMockConfig } from '../mock'

describe('mock config validation', () => {
  it('rejects sensitive fields', () => {
    const config = createMockConfig({
      name: 'sensitive-check',
      version: 'v1',
      seed: 'seed-1',
      targetModule: 'html-parser',
      fields: [
        {
          fieldName: 'password',
          type: 'string',
          required: true,
          nullable: false,
          length: { min: 1, max: 12 }
        }
      ],
      generationParams: {
        sampleCount: 2,
        includeBoundarySamples: true,
        includeExceptionSamples: true
      },
      sensitiveFieldPolicy: 'reject'
    })

    const result = validateMockConfig(config.id)
    expect('conflicts' in result).toBe(true)
    if ('conflicts' in result) {
      expect(result.conflicts[0].reason).toBe('sensitive-field')
    }
  })

  it('detects range conflicts', () => {
    const config = createMockConfig({
      name: 'range-check',
      version: 'v1',
      seed: 'seed-2',
      targetModule: 'html-parser',
      fields: [
        {
          fieldName: 'count',
          type: 'number',
          required: true,
          nullable: false,
          range: { min: 10, max: 1 }
        }
      ],
      generationParams: {
        sampleCount: 1,
        includeBoundarySamples: true,
        includeExceptionSamples: false
      }
    })

    const result = validateMockConfig(config.id)
    expect('conflicts' in result).toBe(true)
    if ('conflicts' in result) {
      expect(result.conflicts[0].reason).toBe('range')
    }
  })
})
