import type { EncodeOptions } from '../index.js'
import { HtmlParser } from '../index.js'

describe('package entry type exports', () => {
  it('exports EncodeOptions for a strict TypeScript encode signature', () => {
    const options: EncodeOptions = { excludeSelectors: ['.ad', '#chrome'] }
    const encodeWithOptions: (
      input: ArrayBuffer,
      options?: EncodeOptions
    ) => ReturnType<typeof HtmlParser.encode> = HtmlParser.encode

    expect(typeof encodeWithOptions).toBe('function')
    expect(options.excludeSelectors).toEqual(['.ad', '#chrome'])
  })

  it('EncodeOptions accepts snapshotWidth optional number', () => {
    const options: EncodeOptions = { snapshotWidth: 640 }
    expect(options.snapshotWidth).toBe(640)
  })
})
