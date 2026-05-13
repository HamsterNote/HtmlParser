import {
  computeScale,
  measureTextBaseline,
  resetPretextAdapter,
  setPretextAdapter,
  type PretextAdapter
} from '../textMeasurement.js'

describe('textMeasurement - Pretext scale computation', () => {
  describe('computeScale', () => {
    it('returns scale(2, 2) when baseline 50x20 targets 100x40', () => {
      const result = computeScale(50, 20, 100, 40)
      expect(result.scaleX).toBeCloseTo(2)
      expect(result.scaleY).toBeCloseTo(2)
    })

    it('returns scale(1.5, 1.5) when baseline 100x80 targets 150x120', () => {
      const result = computeScale(100, 80, 150, 120)
      expect(result.scaleX).toBeCloseTo(1.5)
      expect(result.scaleY).toBeCloseTo(1.5)
    })

    it('returns scale(1, 1) when baseline matches target', () => {
      const result = computeScale(100, 50, 100, 50)
      expect(result.scaleX).toBeCloseTo(1)
      expect(result.scaleY).toBeCloseTo(1)
    })

    it('throws descriptive error for zero-width baseline', () => {
      expect(() => computeScale(0, 20, 100, 40)).toThrow(
        'Baseline width cannot be zero'
      )
    })

    it('throws descriptive error for zero-height baseline', () => {
      expect(() => computeScale(50, 0, 100, 40)).toThrow(
        'Baseline height cannot be zero'
      )
    })

    it('throws descriptive error for negative baseline dimensions', () => {
      expect(() => computeScale(-50, 20, 100, 40)).toThrow(
        'Baseline width must be greater than zero'
      )
      expect(() => computeScale(50, -20, 100, 40)).toThrow(
        'Baseline height must be greater than zero'
      )
    })
  })

  describe('measureTextBaseline', () => {
    afterEach(() => {
      resetPretextAdapter()
    })

    it('delegates to the configured Pretext adapter', () => {
      const calls: Array<{
        text: string
        font: string
        maxWidth: number
        lineHeight: number
      }> = []
      const adapter: PretextAdapter = {
        measure: (text, font, maxWidth, lineHeight) => {
          calls.push({ text, font, maxWidth, lineHeight })
          return { width: 48, height: 24 }
        }
      }

      setPretextAdapter(adapter)

      const result = measureTextBaseline('Hello world', 16, 'Inter', 400, false, 120, 20)

      expect(result).toEqual({ width: 48, height: 24 })
      expect(calls).toEqual([
        {
          text: 'Hello world',
          font: '400 16px Inter',
          maxWidth: 120,
          lineHeight: 20
        }
      ])
    })

    it('falls back to sans-serif when font family is empty', () => {
      const adapter: PretextAdapter = {
        measure: (text, font) => {
          expect(text).toBe('Fallback')
          expect(font).toBe('400 16px sans-serif')
          return { width: 32, height: 16 }
        }
      }

      setPretextAdapter(adapter)

      expect(measureTextBaseline('Fallback', 16, '', 400, false, 200, 18)).toEqual({
        width: 32,
        height: 16
      })
    })

    it('includes italic and bold in font string', () => {
      const adapter: PretextAdapter = {
        measure: (_text, font) => {
          expect(font).toBe('italic 700 16px Inter')
          return { width: 32, height: 16 }
        }
      }

      setPretextAdapter(adapter)

      expect(measureTextBaseline('Bold italic', 16, 'Inter', 700, true, 200, 18)).toEqual({
        width: 32,
        height: 16
      })
    })
  })
})
