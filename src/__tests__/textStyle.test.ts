import { TextDir, type IntermediateText } from '@hamster-note/types'

import { computeTextStyle } from '../textStyle.js'
import {
  resetPretextAdapter,
  setPretextAdapter,
  type PretextAdapter
} from '../textMeasurement.js'

describe('textStyle - combined geometry and measurement', () => {
  const adapter: PretextAdapter = {
    measure: () => ({ width: 50, height: 20 })
  }

  beforeEach(() => {
    setPretextAdapter(adapter)
  })

  afterEach(() => {
    resetPretextAdapter()
  })

  it('computes a style payload with rotate and scale transforms', () => {
    const text = {
      id: 'text-1',
      content: 'Hello world',
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      color: '#000000',
      polygon: [[10, 20], [110, 20], [110, 60], [10, 60]],
      lineHeight: 20,
      ascent: 12,
      descent: 4,
      vertical: false,
      dir: TextDir.LTR,
      skew: 0,
      isEOL: true
    } as IntermediateText

    const style = computeTextStyle(text)

    expect(style.transform).toBe('rotate(0deg) scale(2, 2)')
    expect(style.transformOrigin).toBe('0 0')
    expect(style.rotationDeg).toBeCloseTo(0)
    expect(style.scaleX).toBeCloseTo(2)
    expect(style.scaleY).toBeCloseTo(2)
    expect(style.left).toBe(10)
    expect(style.top).toBe(20)
  })

  it('uses the first polygon point as the anchor point', () => {
    const text = {
      id: 'text-2',
      content: 'Anchor test',
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: true,
      color: '#ff0000',
      polygon: [[24, 48], [124, 48], [124, 88], [24, 88]],
      lineHeight: 20,
      ascent: 12,
      descent: 4,
      vertical: false,
      dir: TextDir.LTR,
      skew: 0,
      isEOL: true
    } as IntermediateText

    const style = computeTextStyle(text)

    expect(style.left).toBe(24)
    expect(style.top).toBe(48)
    expect(style.transform).toContain('rotate(')
    expect(style.transform).toContain('scale(')
  })
})
