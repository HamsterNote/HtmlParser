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

  // ---- T7: image roundtrip + mixed content order tests ----

  it('image roundtrip preserves src, polygon, opacity, and clip through serialize→parse→decode', async () => {
    const imagePayload = {
      id: 'img-1',
      src: 'data:image/png;base64,AAAA',
      polygon: [[10, 20], [110, 20], [110, 80], [10, 80]],
      opacity: 0.8,
      clip: { x: 5, y: 5, width: 90, height: 50 }
    }

    const intermediate = {
      id: 'img-roundtrip-doc',
      title: 'Image Roundtrip',
      getOutline: () => [],
      pages: Promise.resolve([
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 1024,
          content: [imagePayload],
          getContent: async function () {
            return this.content
          },
          getThumbnail: async () => undefined
        }
      ])
    }

    const serialized = await serializeIntermediate(intermediate)
    // 序列化后 content 数组应保留图片项
    expect(serialized.pages[0].content).toBeDefined()
    expect(serialized.pages[0].content).toHaveLength(1)

    const parsed = parseSerializedDocument(serialized)
    const pages = await parsed.pages
    const content = await pages[0].getContent()

    expect(content).toHaveLength(1)
    // 验证 roundtrip 后字段完整
    const img = content[0] as Record<string, unknown>
    expect(img.id).toBe('img-1')
    expect(img.src).toBe('data:image/png;base64,AAAA')
    expect(img.polygon).toEqual([[10, 20], [110, 20], [110, 80], [10, 80]])
    expect(img.opacity).toBe(0.8)
    expect(img.clip).toEqual({ x: 5, y: 5, width: 90, height: 50 })

    // decode 输出包含 foreground <img>
    const html = await decodeSerializedDocumentToHtml(serialized)
    expect(html).toContain('<img class="hamster-note-image"')
    expect(html).toContain('data:image/png;base64,AAAA')
  })

  it('mixed text+image content order preserved across serialize→parse→getContent', async () => {
    // 构建 DOM 顺序: text → image → text
    const textA = {
      id: 'text-a',
      content: 'Before image',
      fontSize: 16,
      fontFamily: '',
      fontWeight: 400,
      italic: false,
      color: '#000000',
      width: 96,
      height: 20,
      polygon: [[0, 0], [96, 0], [96, 20], [0, 20]],
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
    const img = {
      id: 'img-mid',
      src: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
      polygon: [[100, 0], [200, 0], [200, 60], [100, 60]],
      opacity: 1
    }
    const textB = {
      id: 'text-b',
      content: 'After image',
      fontSize: 16,
      fontFamily: '',
      fontWeight: 400,
      italic: false,
      color: '#000000',
      width: 80,
      height: 20,
      polygon: [[0, 70], [80, 70], [80, 90], [0, 90]],
      lineHeight: 20,
      x: 0,
      y: 70,
      ascent: 12,
      descent: 4,
      vertical: false,
      dir: 'ltr',
      rotate: 0,
      skew: 0,
      isEOL: true
    }

    const intermediate = {
      id: 'mixed-order-doc',
      title: 'Mixed Order',
      getOutline: () => [],
      pages: Promise.resolve([
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 1024,
          content: [textA, img, textB],
          getContent: async function () {
            return this.content
          },
          getThumbnail: async () => undefined
        }
      ])
    }

    const serialized = await serializeIntermediate(intermediate)
    // 序列化后 content 数组应保留 text → image → text 顺序
    const pageContent = serialized.pages[0].content!
    expect(pageContent).toBeDefined()
    expect(pageContent).toHaveLength(3)
    // 第一项是 text (有 content 字段)，第二项是 image (有 src 字段)，第三项是 text
    expect(pageContent[0]).toHaveProperty('content', 'Before image')
    expect(pageContent[1]).toHaveProperty('src')
    expect(pageContent[2]).toHaveProperty('content', 'After image')

    // parse 后 getContent 也保持顺序
    const parsed = parseSerializedDocument(serialized)
    const pages = await parsed.pages
    const resolvedContent = await pages[0].getContent()
    expect(resolvedContent).toHaveLength(3)
    expect((resolvedContent[0] as Record<string, unknown>).id).toBe('text-a')
    expect((resolvedContent[1] as Record<string, unknown>).id).toBe('img-mid')
    expect((resolvedContent[2] as Record<string, unknown>).id).toBe('text-b')
  })

  it('decodeSerializedDocumentToHtml produces <img class="hamster-note-image"> for image content', async () => {
    const serialized = {
      id: 'decode-img-doc',
      title: 'Decode Image',
      outline: [],
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 1024,
          content: [
            {
              id: 'text-before',
              content: 'Text before',
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
            },
            {
              id: 'fg-img',
              src: 'data:image/png;base64,iVBORw0KGgo=',
              polygon: [[100, 0], [200, 0], [200, 60], [100, 60]],
              opacity: 0.9
            },
            {
              id: 'text-after',
              content: 'Text after',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 72,
              height: 20,
              polygon: [[0, 70], [72, 70], [72, 90], [0, 90]],
              lineHeight: 20,
              x: 0,
              y: 70,
              ascent: 12,
              descent: 4,
              vertical: false,
              dir: 'ltr',
              rotate: 0,
              skew: 0,
              isEOL: true
            }
          ]
        }
      ]
    }

    const html = await decodeSerializedDocumentToHtml(serialized)
    // 验证 foreground <img> 输出（与缩略图/背景图不同）
    expect(html).toContain('<img class="hamster-note-image"')
    expect(html).toContain('fg-img')
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=')
    // 验证 opacity 在 style 中
    expect(html).toContain('opacity: 0.9')
    // 验证 text 仍然存在
    expect(html).toContain('Text before')
    expect(html).toContain('Text after')
  })

  it('invalid image payload (missing polygon) throws error through decodeSerializedDocumentToHtml', async () => {
    const serialized = {
      id: 'bad-img-doc',
      title: 'Bad Image',
      outline: [],
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 1024,
          content: [
            {
              id: 'bad-img',
              src: 'data:image/png;base64,AAAA',
              // polygon 缺失 — IntermediateImage 构造时应抛错
              opacity: 1
            }
          ]
        }
      ]
    }

    // 无效 image payload 经由 IntermediateImage 构造抛错传递到 decode
    await expect(decodeSerializedDocumentToHtml(serialized)).rejects.toThrow()
  })

  it('backward compat: old serialized format with texts+images arrays (no content) still works', async () => {
    const serialized = {
      id: 'compat-doc',
      title: 'Compat Document',
      outline: [],
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 1024,
          // 只有 texts + images，没有 content — 旧格式
          texts: [
            {
              id: 'text-old',
              content: 'Old format text',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 104,
              height: 20,
              polygon: [[0, 0], [104, 0], [104, 20], [0, 20]],
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
          images: [
            {
              id: 'img-old',
              src: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
              polygon: [[100, 0], [200, 0], [200, 60], [100, 60]],
              opacity: 1
            }
          ]
        }
      ]
    }

    // 旧格式：parser 回退 [...texts, ...images]
    const html = await decodeSerializedDocumentToHtml(serialized)
    expect(html).toContain('Old format text')
    expect(html).toContain('<img class="hamster-note-image"')
    expect(html).toContain('img-old')
  })

  // ---- TDD: background option forwarding tests (excludeImagesFromBackground) ----

  it('forwards excludeImagesFromBackground through data.background to injected decodeToHtml', async () => {
    const serialized = {
      id: 'bg-exclude-img-doc',
      title: 'BG Exclude Images',
      outline: [],
      background: { excludeImagesFromBackground: true },
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 200,
          texts: [
            {
              id: 'text-1',
              content: 'BG option forwarding',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 160,
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
              polygon: [[0, 0], [160, 0], [160, 20], [0, 20]]
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
    const opts = receivedArgs[1] as Record<string, unknown>
    const bg = opts.background as Record<string, unknown>
    expect(bg).toBeDefined()
    expect(bg).toMatchObject({ excludeImagesFromBackground: true })
  })

  it('forwards excludeImagesFromBackground independently without excludeTextFromBackground', async () => {
    const serialized = {
      id: 'bg-img-only-doc',
      title: 'BG Image Only',
      outline: [],
      // 仅设置 excludeImagesFromBackground，不设置 excludeTextFromBackground
      background: { excludeImagesFromBackground: true },
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 200,
          texts: [
            {
              id: 'text-1',
              content: 'Independent forwarding',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 176,
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
              polygon: [[0, 0], [176, 0], [176, 20], [0, 20]]
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
    const opts = receivedArgs[1] as Record<string, unknown>
    const bg = opts.background as Record<string, unknown>
    expect(bg).toBeDefined()
    expect(bg.excludeImagesFromBackground).toBe(true)
    // 独立转发：excludeTextFromBackground 不应被自动设置
    expect(bg.excludeTextFromBackground).toBeUndefined()
  })

  it('existing background options remain forwarded alongside excludeImagesFromBackground (regression)', async () => {
    const serialized = {
      id: 'bg-all-options-doc',
      title: 'BG All Options',
      outline: [],
      background: {
        includeBackground: false,
        backgroundQuality: 0.8,
        excludeTextFromBackground: true,
        excludeImagesFromBackground: true
      },
      pages: [
        {
          id: 'page-1',
          number: 1,
          width: 800,
          height: 200,
          texts: [
            {
              id: 'text-1',
              content: 'Regression forwarding',
              fontSize: 16,
              fontFamily: '',
              fontWeight: 400,
              italic: false,
              color: '#000000',
              width: 176,
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
              polygon: [[0, 0], [176, 0], [176, 20], [0, 20]]
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
    const opts = receivedArgs[1] as Record<string, unknown>
    const bg = opts.background as Record<string, unknown>
    expect(bg).toBeDefined()
    // 回归：所有已知背景选项必须完整转发
    expect(bg).toMatchObject({
      includeBackground: false,
      backgroundQuality: 0.8,
      excludeTextFromBackground: true,
      excludeImagesFromBackground: true
    })
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
