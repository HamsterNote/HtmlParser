import {
  decodeSerializedDocumentToHtml,
  parseSerializedDocument,
  serializeIntermediate
} from '../../demo/demoDocumentSerialization.js'
import {
  resetPretextAdapter,
  setPretextAdapter
} from '../textMeasurement.js'

describe('demo document serialization', () => {
  beforeEach(() => {
    setPretextAdapter({
      measure: (text) => ({ width: text.length * 10, height: 20 })
    })
  })

  afterEach(() => {
    resetPretextAdapter()
  })

  it('preserves outline during serialize/parse round-trip and still decodes to HTML', async () => {
    const outline = [
      {
        id: 'outline-1',
        content: 'Demo outline',
        fontSize: 16,
        fontFamily: '',
        fontWeight: 400,
        italic: false,
        color: '#000000',
        width: 120,
        height: 20,
        lineHeight: 20,
        x: 0,
        y: 0,
        ascent: 12,
        descent: 4,
        vertical: false,
        dir: 'ltr',
        rotate: 0,
        skew: 0,
        isEOL: true,
        dest: 'page-1'
      }
    ]

    const intermediate = {
      id: 'demo-document',
      title: 'Demo Document',
      getOutline: () => outline,
      pages: Promise.resolve([
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 200,
          texts: [
            {
              id: 'text-1',
              content: 'Hello demo',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 80,
              height: 20,
              polygon: [[0, 0], [80, 0], [80, 20], [0, 20]],
              lineHeight: 20,
              x: 0,
              y: 0,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true
            }
          ],
          getTexts: async function () {
            return this.texts
          },
          getThumbnail: async () => undefined
        }
      ])
    }

    const serialized = await serializeIntermediate(intermediate)
    expect(serialized.outline).toEqual(outline)

    const parsed = parseSerializedDocument(serialized)
    expect(parsed.outline).toEqual(outline)

    const html = await decodeSerializedDocumentToHtml(serialized)
    expect(html).toContain('hamster-note-document')
    expect(html).toContain('Hello demo')
  })

  it('serializes empty page text arrays without requiring getTexts', async () => {
    const intermediate = {
      id: 'empty-page-document',
      title: 'Empty Page Document',
      pages: Promise.resolve([
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 200,
          texts: []
        }
      ])
    }

    const serialized = await serializeIntermediate(intermediate)

    expect(serialized.pages).toHaveLength(1)
    expect(serialized.pages[0]?.texts).toEqual([])
  })

  it('decodes demo-style special text cases into previewable html', async () => {
    const serialized = {
      id: 'special-demo-document',
      title: 'Special Demo Document',
      outline: [],
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 320,
          height: 260,
          texts: [
            {
              id: 'text-br-1',
              content: 'First line',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 64,
              height: 20,
              lineHeight: 20,
              x: 0,
              y: 0,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [[0, 0], [64, 0], [64, 20], [0, 20]]
            },
            {
              id: 'text-br-2',
              content: 'Second line',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 88,
              height: 20,
              lineHeight: 20,
              x: 0,
              y: 28,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [[0, 28], [88, 28], [88, 48], [0, 48]]
            },
            {
              id: 'text-rotate',
              content: 'Rotate me',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 80,
              height: 20,
              lineHeight: 20,
              x: 24,
              y: 72,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [
                [24, 72],
                [80.5685424949238, 128.5685424949238],
                [66.42640687119285, 142.71067811865476],
                [9.857864376269049, 86.14213562373095]
              ]
            },
            {
              id: 'text-scale',
              content: 'Scale me',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 104,
              height: 17,
              lineHeight: 20,
              x: 120,
              y: 72,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [[120, 72], [224, 72], [224, 89], [120, 89]]
            },
            {
              id: 'text-translate',
              content: 'Translate me',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 96,
              height: 20,
              lineHeight: 20,
              x: 158,
              y: 118,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [[158, 118], [254, 118], [254, 138], [158, 138]]
            },
            {
              id: 'text-shadow',
              content: 'Shadow me',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#1e3a8a',
              width: 86,
              height: 20,
              lineHeight: 20,
              x: 24,
              y: 164,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [[24, 164], [110, 164], [110, 184], [24, 184]]
            },
            {
              id: 'text-vertical',
              content: '原生竖排文字',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 20,
              height: 96,
              lineHeight: 20,
              x: 260,
              y: 24,
              ascent: 12,
              descent: 4,
              vertical: true,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [[260, 24], [280, 24], [280, 120], [260, 120]]
            }
          ]
        }
      ]
    }

    const html = await decodeSerializedDocumentToHtml(serialized)

    expect(html).toContain('First line')
    expect(html).toContain('Second line')
    expect(html).toContain('Rotate me')
    expect(html).toContain('Scale me')
    expect(html).toContain('Translate me')
    expect(html).toContain('Shadow me')
    expect(html).toContain('原生竖排文字')
    expect(html).toContain('rotate(45deg)')
    expect(html).toContain('left: 158px')
    expect(html).toContain('writing-mode: vertical-rl')
  })

  it('serializeIntermediate preserves populated page thumbnail after lazy capture', async () => {
    const intermediate = {
      id: 'thumbnail-doc',
      title: 'Thumbnail Document',
      getOutline: () => [],
      pages: Promise.resolve([
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 200,
          texts: [
            {
              id: 'text-1',
              content: 'Hello thumbnail',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 120,
              height: 20,
              polygon: [[0, 0], [120, 0], [120, 20], [0, 20]],
              lineHeight: 20,
              x: 0,
              y: 0,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true
            }
          ],
          thumbnail: undefined,
          getTexts: async function () {
            return this.texts
          },
          getThumbnail: async () => 'data:image/png;base64,STORED'
        }
      ])
    }

    const serialized = await serializeIntermediate(intermediate)
    expect(serialized.pages[0].thumbnail).toBe('data:image/png;base64,STORED')

    const parsed = parseSerializedDocument(serialized)
    const resolvedPages = await parsed.pages
    const page = resolvedPages[0]
    const thumbnail = await page.getThumbnail(0.3)
    expect(thumbnail).toBe('data:image/png;base64,STORED')
  })

  it('forwards textControl to injected decodeToHtml when serialized JSON has top-level textControl', async () => {
    const serialized = {
      id: 'tc-doc',
      title: 'TC Document',
      outline: [],
      textControl: { color: '#e11d48', fontSize: 24 },
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 200,
          texts: [
            {
              id: 'text-1',
              content: 'Override me',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 80,
              height: 20,
              lineHeight: 20,
              x: 0,
              y: 0,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [[0, 0], [80, 0], [80, 20], [0, 20]]
            }
          ]
        }
      ]
    }

    const receivedArgs: unknown[] = []
    const fakeDecodeToHtml = (...args: unknown[]) => {
      receivedArgs.push(...args)
      return Promise.resolve('<html>fake</html>')
    }

    await decodeSerializedDocumentToHtml(serialized, fakeDecodeToHtml)

    expect(receivedArgs).toHaveLength(2)
    const doc = receivedArgs[0] as Record<string, unknown>
    expect(doc.id).toBe('tc-doc')
    const opts = receivedArgs[1] as Record<string, unknown>
    expect(opts).toEqual({ textControl: { color: '#e11d48', fontSize: 24 } })
  })

  it('applies textControl overrides in real decode output', async () => {
    const serialized = {
      id: 'tc-real-doc',
      title: 'TC Real Document',
      outline: [],
      textControl: { color: '#e11d48', fontSize: 24 },
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 200,
          texts: [
            {
              id: 'text-1',
              content: 'Override me',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 80,
              height: 20,
              lineHeight: 20,
              x: 0,
              y: 0,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [[0, 0], [80, 0], [80, 20], [0, 20]]
            }
          ]
        }
      ]
    }

    const html = await decodeSerializedDocumentToHtml(serialized)
    expect(html).toContain('Override me')
    expect(html).toContain('color: #e11d48')
    expect(html).toContain('font-size: 24px')
  })

  it('passes only document to injected decodeToHtml when textControl is absent', async () => {
    const serialized = {
      id: 'no-tc-doc',
      title: 'No TC Document',
      outline: [],
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 200,
          texts: [
            {
              id: 'text-1',
              content: 'No override',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 80,
              height: 20,
              lineHeight: 20,
              x: 0,
              y: 0,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [[0, 0], [80, 0], [80, 20], [0, 20]]
            }
          ]
        }
      ]
    }

    const receivedArgs: unknown[] = []
    const fakeDecodeToHtml = (...args: unknown[]) => {
      receivedArgs.push(...args)
      return Promise.resolve('<html>fake</html>')
    }

    await decodeSerializedDocumentToHtml(serialized, fakeDecodeToHtml)

    expect(receivedArgs).toHaveLength(1)
    const doc = receivedArgs[0] as Record<string, unknown>
    expect(doc.id).toBe('no-tc-doc')
  })

  it('ignores non-object textControl without throwing', async () => {
    const serialized = {
      id: 'bad-tc-doc',
      title: 'Bad TC Document',
      outline: [],
      textControl: 'bad',
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 200,
          texts: [
            {
              id: 'text-1',
              content: 'Bad tc',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 80,
              height: 20,
              lineHeight: 20,
              x: 0,
              y: 0,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true,
              polygon: [[0, 0], [80, 0], [80, 20], [0, 20]]
            }
          ]
        }
      ]
    }

    const receivedArgs: unknown[] = []
    const fakeDecodeToHtml = (...args: unknown[]) => {
      receivedArgs.push(...args)
      return Promise.resolve('<html>fake</html>')
    }

    await expect(
      decodeSerializedDocumentToHtml(serialized, fakeDecodeToHtml)
    ).resolves.toBe('<html>fake</html>')

    expect(receivedArgs).toHaveLength(1)
    const doc = receivedArgs[0] as Record<string, unknown>
    expect(doc.id).toBe('bad-tc-doc')
  })
})
