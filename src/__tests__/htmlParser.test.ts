import {
  IntermediateDocument,
  IntermediateImage,
  IntermediatePage,
  IntermediatePageMap,
  IntermediateText,
  TextDir
} from '@hamster-note/types'
import { HtmlDocument } from '../HtmlDocument.js'
import { type EncodeOptions, HtmlParser, setHtml2CanvasLoader } from '../index'
import { withDomDocument, withGlobalsRemoved } from '../testUtils/domTestUtils.js'
import { installFakeHtml2Canvas } from '../testUtils/html2canvasTestUtils.js'
import { computeTargetHeight, computeTargetWidth } from '../textGeometry.js'
import { resetPretextAdapter, setPretextAdapter } from '../textMeasurement.js'

const exposeGlobalDocument = (document: Document): (() => void) => {
  const snapshot = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: document
  })

  return () => {
    if (snapshot) {
      Object.defineProperty(globalThis, 'document', snapshot)
    } else {
      delete (globalThis as Record<string, unknown>).document
    }
  }
}

describe('HtmlParser', () => {
  afterEach(() => {
    resetPretextAdapter()
  })

  it('encode 应该在无 DOM 环境下抛出错误', async () => {
    const globalsToDelete = [
      'document',
      'window',
      'Node',
      'HTMLElement',
      'HTMLIFrameElement',
      'Element',
      'getComputedStyle',
      'DOMParser',
      'DOMRect',
      'Window'
    ]

    await withGlobalsRemoved(globalsToDelete, async () => {
      const html = `<h1>标题</h1><p>第一段</p><p>第二段</p>`
      const buffer = new TextEncoder().encode(html).buffer
      await expect(HtmlParser.encode(buffer)).rejects.toThrow(
        'HtmlParser.encode requires iframe-capable DOM APIs'
      )
    })
  })

  it('encode 应该识别斜体文本', async () => {
    await withDomDocument(async () => {
      const html = `<p><em>italic</em></p><p><i>italic2</i></p><p><span style="font-style: italic;">italic3</span></p>`
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc?.getIntermediateDocument()
      const pages = await intermediate?.pages
      const page = pages?.[0]
      const content = await page?.getContent()
      const texts = content?.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )

      const getByContent = (content: string) =>
        texts?.find((text) => text.content.trim() === content)

      expect(getByContent('italic')).toBeDefined()
      expect(getByContent('italic2')).toBeDefined()
      expect(getByContent('italic3')).toBeDefined()
      expect(getByContent('italic')?.italic).toBe(true)
      expect(getByContent('italic2')?.italic).toBe(true)
      expect(getByContent('italic3')?.italic).toBe(true)
    })
  })

  it('encode DOM 路径中同一语义行仅最后片段 isEOL 为 true', async () => {
    await withDomDocument(async () => {
      const html = '<p>Hello <strong>World</strong><span> Again</span></p>'
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc.getIntermediateDocument()
      const pages = await intermediate.pages
      const content = await pages[0].getContent()
      const texts = content.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )

      expect(texts.length).toBe(3)
      expect(texts.map((text) => text.content)).toEqual([
        'Hello',
        'World',
        'Again'
      ])
      expect(texts.map((text) => text.isEOL)).toEqual([false, false, true])
      expect(texts[0].polygon[0][0]).toBe(0)
      expect(texts[1].polygon[0][0]).toBeGreaterThan(texts[0].polygon[0][0])
      expect(texts[2].polygon[0][0]).toBeGreaterThan(texts[1].polygon[0][0])
    })
  })

  it('encode DOM 路径在块边界和 <br> 处结束语义行且每行仅一个 isEOL', async () => {
    await withDomDocument(async () => {
      const html =
        '<div>Alpha<span>Beta</span><br/>Gamma<span>Delta</span></div><p>Epsilon</p>'
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc.getIntermediateDocument()
      const pages = await intermediate.pages
      const content = await pages[0].getContent()
      const texts = content.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )

      expect(texts.map((text) => text.content)).toEqual([
        'Alpha',
        'Beta',
        'Gamma',
        'Delta',
        'Epsilon'
      ])

      const lineGroups = texts.reduce<Record<number, typeof texts>>(
        (acc, text) => {
          const key = text.polygon[0][1]
          if (!acc[key]) acc[key] = []
          acc[key].push(text)
          return acc
        },
        {}
      )

      const groups = Object.values(lineGroups)
      expect(groups).toHaveLength(3)
      groups.forEach((group) => {
        const eolCount = group.filter((text) => text.isEOL).length
        expect(eolCount).toBe(1)
        expect(group[group.length - 1].isEOL).toBe(true)
      })
    })
  })

  it('encode DOM 路径在多行输入中合并文本节点且最后片段 isEOL 为 true', async () => {
    await withDomDocument(async () => {
      const html = 'line-1\nline-2\nline-3'
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc.getIntermediateDocument()
      const pages = await intermediate.pages
      const content = await pages[0].getContent()
      const texts = content.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )

      expect(texts.length).toBe(1)
      expect(texts[0].content).toBe('line-1 line-2 line-3')
      expect(texts[0].isEOL).toBe(true)
    })
  })

  it('encode fallback 路径应该使用 pretext 宽度生成 polygon', async () => {
    await withDomDocument(async () => {
      setPretextAdapter({
        measure: (text) => ({
          width: text.length * 8,
          height: 18
        })
      })

      const html = 'plain'
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc.getIntermediateDocument()
      const pages = await intermediate.pages
      const content = await pages[0].getContent()
      const texts = content.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )

      expect(texts).toHaveLength(1)
      expect(texts[0].polygon[1][0] - texts[0].polygon[0][0]).toBe(40)
      expect(texts[0].polygon[2][1] - texts[0].polygon[1][1]).toBe(18)
    })
  })

  it('encode 应该在 pretext 测量失败时回退到启发式宽度', async () => {
    await withDomDocument(async () => {
      setPretextAdapter({
        measure: () => {
          throw new Error('measurement failed')
        }
      })

      const html = 'fallback'
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc.getIntermediateDocument()
      const pages = await intermediate.pages
      const content = await pages[0].getContent()
      const texts = content.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )

      expect(texts).toHaveLength(1)
      expect(texts[0].polygon[1][0] - texts[0].polygon[0][0]).toBe(77)
      expect(texts[0].polygon[2][1] - texts[0].polygon[1][1]).toBe(19)
    })
  })

  it('encode 应该使用 pretext 测量文本宽度并生成 polygon', async () => {
    await withDomDocument(async () => {
      setPretextAdapter({
        measure: (text) => ({
          width: text.length * 10,
          height: 20
        })
      })

      const html = '<p>Hello <strong>World</strong></p>'
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc.getIntermediateDocument()
      const pages = await intermediate.pages
      const content = await pages[0].getContent()
      const texts = content.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )

      expect(texts.map((text) => text.content)).toEqual(['Hello', 'World'])
      expect(texts[0].polygon[1][0] - texts[0].polygon[0][0]).toBe(50)
      expect(texts[1].polygon[1][0] - texts[1].polygon[0][0]).toBe(50)
      expect(texts[1].polygon[0][0]).toBe(50)
    })
  })

  it('encode 应该在成功编码后清理 iframe', async () => {
    await withDomDocument(async ({ document }) => {
      const iframeCountBefore = document.querySelectorAll('iframe').length
      const html = '<p>Hello World</p>'
      const buffer = new TextEncoder().encode(html).buffer
      await HtmlParser.encode(buffer)
      const iframeCountAfter = document.querySelectorAll('iframe').length
      expect(iframeCountAfter).toBe(iframeCountBefore)
    })
  })

  it('encode 应该在测量失败时清理 iframe', async () => {
    await withDomDocument(async ({ document }) => {
      setPretextAdapter({
        measure: () => {
          throw new Error('measurement failed')
        }
      })
      const iframeCountBefore = document.querySelectorAll('iframe').length
      const html = 'fallback'
      const buffer = new TextEncoder().encode(html).buffer
      await HtmlParser.encode(buffer)
      const iframeCountAfter = document.querySelectorAll('iframe').length
      expect(iframeCountAfter).toBe(iframeCountBefore)
    })
  })

  it('encode 应该在 collectTextsFromDocument 抛出错误时清理 iframe', async () => {
    await withDomDocument(async ({ document }) => {
      const parserRef = HtmlParser as unknown as Record<string, unknown>
      const original = parserRef.collectTextsFromDocument as () => { title: string; texts: unknown[]; pageHeight: number }
      parserRef.collectTextsFromDocument = () => {
        throw new Error('forced collection failure')
      }
      const iframeCountBefore = document.querySelectorAll('iframe').length
      try {
        const html = '<p>test</p>'
        const buffer = new TextEncoder().encode(html).buffer
        await expect(HtmlParser.encode(buffer)).rejects.toThrow('forced collection failure')
      } finally {
        parserRef.collectTextsFromDocument = original
        const iframeCountAfter = document.querySelectorAll('iframe').length
        expect(iframeCountAfter).toBe(iframeCountBefore)
      }
    })
  })

  it('encode 应该通过 iframe DOM 解析嵌套样式 HTML', async () => {
    await withDomDocument(async () => {
      setPretextAdapter({
        measure: (text) => ({
          width: text.length * 10,
          height: 20
        })
      })
      const html = '<p style="font-size: 20px; color: red"><em>Hello</em></p>'
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc.getIntermediateDocument()
      const pages = await intermediate.pages
      const content = await pages[0].getContent()
      const texts = content.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )

      expect(pages).toHaveLength(1)
      const helloText = texts.find((text) => text.content === 'Hello')
      expect(helloText).toBeDefined()
      expect(helloText?.italic).toBe(true)
      expect(helloText?.fontSize).toBe(20)
    })
  })

  it('decodeToHtml 后再 encode 应该保留带引号的 font-family', async () => {
    await withDomDocument(async () => {
      setPretextAdapter({
        measure: (text) => ({
          width: text.length * 10,
          height: 20
        })
      })

      const fontFamily = '-apple-system, "system-ui", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      const text = new IntermediateText({
        id: 'text-font-family',
        content: 'Encode Demo',
        fontSize: 20,
        fontFamily,
        fontWeight: 700,
        italic: false,
        color: 'rgb(31, 35, 40)',
        polygon: [[20, 32], [150, 32], [150, 55], [20, 55]],
        lineHeight: 24,
        ascent: 16,
        descent: 7,
        vertical: false,
        dir: TextDir.LTR,
        skew: 0,
        isEOL: true
      })

      const doc = new IntermediateDocument({
        id: 'doc-font-family',
        title: 'Font Family Round Trip',
        pagesMap: IntermediatePageMap.makeByInfoList([
          {
            id: 'page-1',
            pageNumber: 1,
            size: { x: 200, y: 100 },
            getData: async () => new IntermediatePage({
              id: 'page-1',
              number: 1,
              width: 200,
              height: 100,
              texts: [text],
              thumbnail: undefined
            })
          }
        ])
      })

      const html = await HtmlParser.decodeToHtml(doc)
      expect(html).toContain('&quot;system-ui&quot;')
      expect(html).toContain('&quot;Segoe UI&quot;')

      const encoded = await HtmlParser.encode(new TextEncoder().encode(html).buffer)
      const intermediate = encoded.getIntermediateDocument()
      const pages = await intermediate.pages
      const content = await pages[0].getContent()
      const texts = content.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )

      expect(texts[0]?.fontFamily).toBe(fontFamily)
    })
  })

  it('encode 应该正确解析引号内包含分号和冒号的 font-family', async () => {
    await withDomDocument(async () => {
      setPretextAdapter({
        measure: (text) => ({
          width: text.length * 10,
          height: 20
        })
      })

      const fontFamily = '"A;B", "C:D", sans-serif'
      const html = `<p><span style='font-family: ${fontFamily}; font-size: 18px;'>Hello</span></p>`
      const encoded = await HtmlParser.encode(new TextEncoder().encode(html).buffer)
      const intermediate = encoded.getIntermediateDocument()
      const pages = await intermediate.pages
      const content = await pages[0].getContent()
      const texts = content.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )

      expect(texts[0]?.fontFamily).toBe(fontFamily)
      expect(texts[0]?.fontSize).toBe(18)
    })
  })

  it('collectTextsFromDocument 应该基于 computed style 和 bounding rect 生成中间文本', async () => {
    await withDomDocument(async ({ document, DOMRect }) => {
      setPretextAdapter({
        measure: (text) => {
          if (text === 'Hello') return { width: 40, height: 18 }
          if (text === 'World') return { width: 50, height: 18 }
          return { width: text.length * 8, height: 18 }
        }
      })

      const parserRef = HtmlParser as unknown as Record<string, unknown>
      const testDocument = document
      const originalTitle = testDocument.title
      const originalBodyHtml = testDocument.body.innerHTML
      const originalCreateRange = testDocument.createRange.bind(testDocument)
      const originalBodyRect = testDocument.body.getBoundingClientRect.bind(testDocument.body)
      const defaultView = testDocument.defaultView
      if (!defaultView) throw new Error('expected defaultView to exist in test document')
      const originalGetComputedStyle = defaultView.getComputedStyle.bind(defaultView)

      try {
        testDocument.title = 'Rendered Layout'
        testDocument.body.innerHTML = '<p><span id="first">Hello</span><span id="second">World</span></p>'

        Object.defineProperty(testDocument.documentElement, 'scrollWidth', {
          configurable: true,
          value: 640
        })
        Object.defineProperty(testDocument.documentElement, 'scrollHeight', {
          configurable: true,
          value: 480
        })
        Object.defineProperty(testDocument.body, 'scrollWidth', {
          configurable: true,
          value: 640
        })
        Object.defineProperty(testDocument.body, 'scrollHeight', {
          configurable: true,
          value: 480
        })
        const bodyRect = new DOMRect(10, 20, 640, 480)
        testDocument.body.getBoundingClientRect =
          (() => bodyRect) as typeof testDocument.body.getBoundingClientRect

        const firstNode = testDocument.querySelector('#first')?.firstChild as Text
        const secondNode = testDocument.querySelector('#second')?.firstChild as Text
        const rectMap = new Map<Text, DOMRect>([
          [firstNode, new DOMRect(10, 20, 40, 18)],
          [secondNode, new DOMRect(55, 20, 50, 18)]
        ])

        testDocument.createRange = (() => {
          let currentNode: Text | null = null

          return {
            selectNodeContents(node: Node) {
              currentNode = node as Text
            },
            setStart(node: Node) {
              currentNode = node as Text
            },
            setEnd(node: Node) {
              currentNode = node as Text
            },
            getClientRects() {
              const rect = currentNode ? rectMap.get(currentNode) : undefined
              return rect ? [rect] : []
            },
            getBoundingClientRect() {
              return currentNode ? rectMap.get(currentNode) ?? null : null
            },
            detach() {}
          } as unknown as Range
        }) as typeof testDocument.createRange

        defaultView.getComputedStyle = ((element: Element) => {
          if ((element as HTMLElement).id === 'second') {
            return {
              fontSize: '20px',
              lineHeight: '28px',
              fontWeight: '700',
              fontStyle: 'italic',
              color: 'rgb(255, 0, 0)',
              fontFamily: 'Inter'
            } as CSSStyleDeclaration
          }

          return {
            fontSize: '16px',
            lineHeight: '24px',
            fontWeight: '400',
            fontStyle: 'normal',
            color: 'rgb(0, 0, 0)',
            fontFamily: 'sans-serif'
          } as CSSStyleDeclaration
        }) as typeof defaultView.getComputedStyle

        const result = await (parserRef.collectTextsFromDocument as (
          doc: Document,
          id: string
        ) => Promise<{
          title: string
          texts: Array<{
            content: string
            fontSize: number
            fontWeight: number
            italic: boolean
            polygon: number[][]
            ascent: number
            descent: number
            isEOL: boolean
          }>
          pageWidth: number
          pageHeight: number
        }>)(testDocument, 'doc-1')

        expect(result.title).toBe('Rendered Layout')
        expect(result.pageWidth).toBe(640)
        expect(result.pageHeight).toBe(480)
        expect(result.texts.map((text) => text.content)).toEqual(['Hello', 'World'])
        expect(result.texts[0]?.polygon).toEqual([[0, 0], [40, 0], [40, 18], [0, 18]])
        expect(result.texts[1]?.polygon).toEqual([[45, 0], [95, 0], [95, 18], [45, 18]])
        expect(result.texts[0]?.fontSize).toBe(16)
        expect(result.texts[1]?.fontSize).toBe(20)
        expect(result.texts.map((text) => text.ascent)).toEqual([13, 16])
        expect(result.texts.map((text) => text.descent)).toEqual([5, 4])
        expect(result.texts[1]?.fontWeight).toBe(700)
        expect(result.texts[1]?.italic).toBe(true)
        expect(result.texts.map((text) => text.isEOL)).toEqual([false, true])
      } finally {
        testDocument.title = originalTitle
        testDocument.body.innerHTML = originalBodyHtml
        testDocument.createRange = originalCreateRange
        testDocument.body.getBoundingClientRect = originalBodyRect
        defaultView.getComputedStyle = originalGetComputedStyle
      }
    })
  })

  it('collectTextsFromDocument 不应被长内容撑大的 scrollWidth 放大页面宽度', async () => {
    await withDomDocument(async ({ document, DOMRect }) => {
      setPretextAdapter({
        measure: (text) => ({
          width: text.length * 8,
          height: 18
        })
      })

      const parserRef = HtmlParser as unknown as Record<string, unknown>
      const testDocument = document
      const originalTitle = testDocument.title
      const originalBodyHtml = testDocument.body.innerHTML
      const originalCreateRange = testDocument.createRange.bind(testDocument)
      const originalBodyRect = testDocument.body.getBoundingClientRect.bind(testDocument.body)
      const defaultView = testDocument.defaultView
      if (!defaultView) throw new Error('expected defaultView to exist in test document')
      const originalGetComputedStyle = defaultView.getComputedStyle.bind(defaultView)

      try {
        testDocument.title = 'Inflated Scroll Width'
        testDocument.body.innerHTML = '<p><span id="short-text">Preview text</span></p>'

        Object.defineProperty(testDocument.documentElement, 'scrollWidth', {
          configurable: true,
          value: 30000
        })
        Object.defineProperty(testDocument.documentElement, 'scrollHeight', {
          configurable: true,
          value: 12000
        })
        Object.defineProperty(testDocument.body, 'scrollWidth', {
          configurable: true,
          value: 30000
        })
        Object.defineProperty(testDocument.body, 'scrollHeight', {
          configurable: true,
          value: 12000
        })

        const bodyRect = new DOMRect(10, 20, 320, 240)
        testDocument.body.getBoundingClientRect =
          (() => bodyRect) as typeof testDocument.body.getBoundingClientRect

        const textNode = testDocument.querySelector('#short-text')?.firstChild as Text
        const textRect = new DOMRect(10, 20, 96, 18)

        testDocument.createRange = (() => {
          let currentNode: Text | null = null

          return {
            selectNodeContents(node: Node) {
              currentNode = node as Text
            },
            setStart(node: Node) {
              currentNode = node as Text
            },
            setEnd(node: Node) {
              currentNode = node as Text
            },
            getClientRects() {
              return currentNode === textNode ? [textRect] : []
            },
            getBoundingClientRect() {
              return currentNode === textNode ? textRect : null
            },
            detach() {}
          } as unknown as Range
        }) as typeof testDocument.createRange

        defaultView.getComputedStyle = (() => ({
          fontSize: '16px',
          lineHeight: '20px',
          fontWeight: '400',
          fontStyle: 'normal',
          color: 'rgb(0, 0, 0)',
          fontFamily: 'sans-serif',
          writingMode: 'horizontal-tb',
          transform: 'none',
          transformOrigin: '0px 0px'
        } as CSSStyleDeclaration)) as typeof defaultView.getComputedStyle

        const result = await (parserRef.collectTextsFromDocument as (
          doc: Document,
          id: string
        ) => Promise<{
          texts: Array<{ content: string; polygon: number[][] }>
          pageWidth: number
          pageHeight: number
        }>)(testDocument, 'inflated-scroll')

        expect(result.texts.map((text) => text.content)).toEqual(['Preview text'])
        expect(result.texts[0]?.polygon).toEqual([[0, 0], [96, 0], [96, 18], [0, 18]])
        expect(result.pageWidth).toBe(320)
        expect(result.pageHeight).toBe(240)
      } finally {
        testDocument.title = originalTitle
        testDocument.body.innerHTML = originalBodyHtml
        testDocument.createRange = originalCreateRange
        testDocument.body.getBoundingClientRect = originalBodyRect
        defaultView.getComputedStyle = originalGetComputedStyle
      }
    })
  })

  it('collectTextsFromDocument 应该支持特殊 demo 文本场景', async () => {
    await withDomDocument(async ({ document, DOMRect }) => {
      setPretextAdapter({
        measure: (text) => {
          switch (text) {
            case 'First line':
              return { width: 60, height: 18 }
            case 'Second line':
              return { width: 72, height: 18 }
            case 'Rotate':
              return { width: 64, height: 20 }
            case 'Scale':
              return { width: 67.6923076923, height: 20 }
            case 'Translate':
              return { width: 84, height: 20 }
            case 'Shadow':
              return { width: 74, height: 20 }
            case '原生竖排':
              return { width: 20, height: 80 }
            default:
              return { width: text.length * 8, height: 20 }
          }
        }
      })

      const parserRef = HtmlParser as unknown as Record<string, unknown>
      const testDocument = document
      const originalTitle = testDocument.title
      const originalBodyHtml = testDocument.body.innerHTML
      const originalCreateRange = testDocument.createRange.bind(testDocument)
      const originalBodyRect = testDocument.body.getBoundingClientRect.bind(
        testDocument.body
      )
      const defaultView = testDocument.defaultView
      if (!defaultView) throw new Error('expected defaultView to exist in test document')
      const originalGetComputedStyle = defaultView.getComputedStyle.bind(defaultView)

      try {
        testDocument.title = 'Special Demo Layout'
        testDocument.body.innerHTML = [
          '<div>',
          '  <span id="br-first">First line</span><br />',
          '  <span id="br-second">Second line</span>',
          '  <span id="rotate">Rotate</span>',
          '  <span id="scale">Scale</span>',
          '  <span id="translate">Translate</span>',
          '  <span id="shadow">Shadow</span>',
          '  <span id="vertical">原生竖排</span>',
          '</div>'
        ].join('')

        Object.defineProperty(testDocument.documentElement, 'scrollWidth', {
          configurable: true,
          value: 640
        })
        Object.defineProperty(testDocument.documentElement, 'scrollHeight', {
          configurable: true,
          value: 480
        })
        Object.defineProperty(testDocument.body, 'scrollWidth', {
          configurable: true,
          value: 640
        })
        Object.defineProperty(testDocument.body, 'scrollHeight', {
          configurable: true,
          value: 480
        })

        const bodyRect = new DOMRect(10, 20, 640, 480)
        testDocument.body.getBoundingClientRect =
          (() => bodyRect) as typeof testDocument.body.getBoundingClientRect

        const getTextNode = (selector: string) =>
          testDocument.querySelector(selector)?.firstChild as Text

        const rectMap = new Map<Text, DOMRect>([
          [getTextNode('#br-first'), new DOMRect(10, 20, 60, 18)],
          [getTextNode('#br-second'), new DOMRect(10, 44, 72, 18)],
          [getTextNode('#rotate'), new DOMRect(18, 74, 72, 28)],
          [getTextNode('#scale'), new DOMRect(18, 112, 88, 17)],
          [getTextNode('#translate'), new DOMRect(94, 146, 84, 20)],
          [getTextNode('#shadow'), new DOMRect(18, 182, 74, 20)],
          [getTextNode('#vertical'), new DOMRect(220, 40, 20, 80)]
        ])

        testDocument.createRange = (() => {
          let currentNode: Text | null = null

          return {
            selectNodeContents(node: Node) {
              currentNode = node as Text
            },
            setStart(node: Node) {
              currentNode = node as Text
            },
            setEnd(node: Node) {
              currentNode = node as Text
            },
            getClientRects() {
              const rect = currentNode ? rectMap.get(currentNode) : undefined
              return rect ? [rect] : []
            },
            getBoundingClientRect() {
              return currentNode ? rectMap.get(currentNode) ?? null : null
            },
            detach() {}
          } as unknown as Range
        }) as typeof testDocument.createRange

        defaultView.getComputedStyle = ((element: Element) => {
          const id = (element as HTMLElement).id

          if (id === 'vertical') {
            return {
              fontSize: '16px',
              lineHeight: '20px',
              fontWeight: '400',
              fontStyle: 'normal',
              color: 'rgb(0, 0, 0)',
              fontFamily: 'sans-serif',
              writingMode: 'vertical-rl',
              textShadow: 'none'
            } as CSSStyleDeclaration
          }

          if (id === 'rotate') {
            return {
              fontSize: '16px',
              lineHeight: '20px',
              fontWeight: '400',
              fontStyle: 'normal',
              color: 'rgb(0, 0, 0)',
              fontFamily: 'sans-serif',
              writingMode: 'horizontal-tb',
              transform: 'rotate(-12deg)',
              textShadow: 'none'
            } as CSSStyleDeclaration
          }

          if (id === 'scale') {
            return {
              fontSize: '16px',
              lineHeight: '20px',
              fontWeight: '400',
              fontStyle: 'normal',
              color: 'rgb(0, 0, 0)',
              fontFamily: 'sans-serif',
              writingMode: 'horizontal-tb',
              transform: 'scale(1.3, 0.85)',
              textShadow: 'none'
            } as CSSStyleDeclaration
          }

          if (id === 'translate') {
            return {
              fontSize: '16px',
              lineHeight: '20px',
              fontWeight: '400',
              fontStyle: 'normal',
              color: 'rgb(0, 0, 0)',
              fontFamily: 'sans-serif',
              writingMode: 'horizontal-tb',
              transform: 'translate(18px, 6px)',
              textShadow: 'none'
            } as CSSStyleDeclaration
          }

          if (id === 'shadow') {
            return {
              fontSize: '16px',
              lineHeight: '20px',
              fontWeight: '400',
              fontStyle: 'normal',
              color: 'rgb(30, 58, 138)',
              fontFamily: 'sans-serif',
              writingMode: 'horizontal-tb',
              textShadow: '2px 2px 6px rgba(59, 130, 246, 0.35)'
            } as CSSStyleDeclaration
          }

          return {
            fontSize: '16px',
            lineHeight: '20px',
            fontWeight: '400',
            fontStyle: 'normal',
            color: 'rgb(0, 0, 0)',
            fontFamily: 'sans-serif',
            writingMode: 'horizontal-tb',
            textShadow: 'none'
          } as CSSStyleDeclaration
        }) as typeof defaultView.getComputedStyle

        const result = await (parserRef.collectTextsFromDocument as (
          doc: Document,
          id: string
        ) => Promise<{
          texts: Array<{
            content: string
            polygon: number[][]
            vertical: boolean
            isEOL: boolean
          }>
        }>)(testDocument, 'special-demo')

        expect(result.texts.map((text) => text.content)).toEqual([
          'First line',
          '原生竖排',
          'Second line',
          'Rotate',
          'Scale',
          'Translate',
          'Shadow'
        ])

        const byContent = (content: string) =>
          result.texts.find((text) => text.content === content)

        expect(byContent('First line')?.polygon).toEqual([
          [0, 0],
          [60, 0],
          [60, 18],
          [0, 18]
        ])
        expect(byContent('Second line')?.polygon).toEqual([
          [0, 24],
          [72, 24],
          [72, 42],
          [0, 42]
        ])
        expect(byContent('Translate')?.polygon).toEqual([
          [84, 126],
          [168, 126],
          [168, 146],
          [84, 146]
        ])
        const rotatePolygon = byContent('Rotate')?.polygon
        expect(rotatePolygon).toBeDefined()
        expect(rotatePolygon?.[0]?.[1]).not.toBeCloseTo(rotatePolygon?.[1]?.[1] ?? 0)
        expect(rotatePolygon?.[1]?.[0]).toBeGreaterThan(rotatePolygon?.[0]?.[0] ?? 0)
        expect(rotatePolygon?.[3]?.[1]).toBeGreaterThan(rotatePolygon?.[0]?.[1] ?? 0)
        const scalePolygon = byContent('Scale')?.polygon
        expect(scalePolygon?.[0]?.[0]).toBeCloseTo(8)
        expect(scalePolygon?.[0]?.[1]).toBeCloseTo(92)
        expect(scalePolygon?.[1]?.[0]).toBeCloseTo(96)
        expect(scalePolygon?.[2]?.[1]).toBeCloseTo(109)
        expect(byContent('Shadow')?.polygon).toEqual([
          [8, 162],
          [82, 162],
          [82, 182],
          [8, 182]
        ])
        expect(byContent('原生竖排')?.vertical).toBe(true)
        expect(byContent('原生竖排')?.polygon).toEqual([
          [210, 20],
          [230, 20],
          [230, 100],
          [210, 100]
        ])
        expect(result.texts.every((text) => text.isEOL)).toBe(true)
      } finally {
        testDocument.title = originalTitle
        testDocument.body.innerHTML = originalBodyHtml
        testDocument.createRange = originalCreateRange
        testDocument.body.getBoundingClientRect = originalBodyRect
        defaultView.getComputedStyle = originalGetComputedStyle
      }
    })
  })

  it('collectTextsFromDocument 应该支持百分比 translate', async () => {
    await withDomDocument(async ({ document, DOMRect }) => {
      setPretextAdapter({
        measure: (text) => {
          if (text === 'Translate percent') return { width: 80, height: 20 }
          return { width: text.length * 8, height: 20 }
        }
      })

      const parserRef = HtmlParser as unknown as Record<string, unknown>
      const testDocument = document
      const originalTitle = testDocument.title
      const originalBodyHtml = testDocument.body.innerHTML
      const originalCreateRange = testDocument.createRange.bind(testDocument)
      const originalBodyRect = testDocument.body.getBoundingClientRect.bind(testDocument.body)
      const defaultView = testDocument.defaultView
      if (!defaultView) throw new Error('expected defaultView to exist in test document')
      const originalGetComputedStyle = defaultView.getComputedStyle.bind(defaultView)

      try {
        testDocument.title = 'Percentage Translate'
        testDocument.body.innerHTML = '<span id="translate-percent">Translate percent</span>'

        Object.defineProperty(testDocument.documentElement, 'scrollWidth', {
          configurable: true,
          value: 300
        })
        Object.defineProperty(testDocument.documentElement, 'scrollHeight', {
          configurable: true,
          value: 200
        })
        Object.defineProperty(testDocument.body, 'scrollWidth', {
          configurable: true,
          value: 300
        })
        Object.defineProperty(testDocument.body, 'scrollHeight', {
          configurable: true,
          value: 200
        })

        const bodyRect = new DOMRect(10, 20, 300, 200)
        testDocument.body.getBoundingClientRect =
          (() => bodyRect) as typeof testDocument.body.getBoundingClientRect

        const textNode = testDocument.querySelector('#translate-percent')?.firstChild as Text
        const textRect = new DOMRect(70, 110, 80, 20)

        testDocument.createRange = (() => ({
          selectNodeContents() {},
          setStart() {},
          setEnd() {},
          getClientRects() {
            return [textRect]
          },
          getBoundingClientRect() {
            return textRect
          },
          detach() {}
        } as unknown as Range)) as typeof testDocument.createRange

        defaultView.getComputedStyle = ((element: Element) => {
          if ((element as HTMLElement).id === 'translate-percent') {
            return {
              fontSize: '16px',
              lineHeight: '20px',
              fontWeight: '400',
              fontStyle: 'normal',
              color: 'rgb(0, 0, 0)',
              fontFamily: 'sans-serif',
              writingMode: 'horizontal-tb',
              transform: 'translate(-50%, -50%)',
              transformOrigin: '0px 0px'
            } as CSSStyleDeclaration
          }

          return originalGetComputedStyle(element)
        }) as typeof defaultView.getComputedStyle

        const result = await (parserRef.collectTextsFromDocument as (
          doc: Document,
          id: string
        ) => Promise<{
          texts: Array<{ content: string; polygon: number[][] }>
        }>)(testDocument, 'percent-translate')

        expect(textNode.textContent).toBe('Translate percent')
        expect(result.texts).toHaveLength(1)
        expect(result.texts[0]?.polygon).toEqual([
          [60, 90],
          [140, 90],
          [140, 110],
          [60, 110]
        ])
        expect(result.texts[0]?.polygon.flat().every(Number.isFinite)).toBe(true)
      } finally {
        testDocument.title = originalTitle
        testDocument.body.innerHTML = originalBodyHtml
        testDocument.createRange = originalCreateRange
        testDocument.body.getBoundingClientRect = originalBodyRect
        defaultView.getComputedStyle = originalGetComputedStyle
      }
    })
  })

  it('collectTextsFromDocument 应该按渲染行切分包裹的拉丁文本', async () => {
    await withDomDocument(async ({ document, DOMRect }) => {
      setPretextAdapter({
        measure: (text) => {
          if (text === 'Hello world') return { width: 90, height: 18 }
          if (text === 'again') return { width: 40, height: 18 }
          return { width: text.length * 8, height: 18 }
        }
      })

      const parserRef = HtmlParser as unknown as Record<string, unknown>
      const testDocument = document
      const originalTitle = testDocument.title
      const originalBodyHtml = testDocument.body.innerHTML
      const originalCreateRange = testDocument.createRange.bind(testDocument)
      const originalBodyRect = testDocument.body.getBoundingClientRect.bind(testDocument.body)
      const defaultView = testDocument.defaultView
      if (!defaultView) throw new Error('expected defaultView to exist in test document')
      const originalGetComputedStyle = defaultView.getComputedStyle.bind(defaultView)

      try {
        testDocument.title = 'Wrapped Latin Text'
        testDocument.body.innerHTML = '<span id="wrapped-latin">Hello world again</span>'

        Object.defineProperty(testDocument.documentElement, 'scrollWidth', {
          configurable: true,
          value: 240
        })
        Object.defineProperty(testDocument.documentElement, 'scrollHeight', {
          configurable: true,
          value: 120
        })
        Object.defineProperty(testDocument.body, 'scrollWidth', {
          configurable: true,
          value: 240
        })
        Object.defineProperty(testDocument.body, 'scrollHeight', {
          configurable: true,
          value: 120
        })

        const bodyRect = new DOMRect(10, 20, 240, 120)
        testDocument.body.getBoundingClientRect =
          (() => bodyRect) as typeof testDocument.body.getBoundingClientRect

        const textNode = testDocument.querySelector('#wrapped-latin')?.firstChild as Text
        const fullText = textNode.textContent ?? ''
        const lineRects = [new DOMRect(10, 20, 90, 18), new DOMRect(10, 44, 40, 18)]

        testDocument.createRange = (() => {
          let currentNode: Text | null = null
          let startOffset = 0
          let endOffset = 0

          const getCharRect = (): DOMRect | null => {
            if (currentNode !== textNode) return null
            if (endOffset - startOffset !== 1) return null

            if (startOffset <= 10) return new DOMRect(10, 20, 8, 18)
            if (startOffset >= 12 && startOffset < fullText.length) {
              return new DOMRect(10, 44, 8, 18)
            }

            return null
          }

          return {
            selectNodeContents(node: Node) {
              currentNode = node as Text
              startOffset = 0
              endOffset = currentNode.textContent?.length ?? 0
            },
            setStart(node: Node, offset: number) {
              currentNode = node as Text
              startOffset = offset
            },
            setEnd(node: Node, offset: number) {
              currentNode = node as Text
              endOffset = offset
            },
            getClientRects() {
              if (currentNode === textNode && startOffset === 0 && endOffset === fullText.length) {
                return lineRects
              }
              const rect = getCharRect()
              return rect ? [rect] : []
            },
            getBoundingClientRect() {
              if (currentNode === textNode && startOffset === 0 && endOffset === fullText.length) {
                return lineRects[0] ?? null
              }
              return getCharRect()
            },
            detach() {}
          } as unknown as Range
        }) as typeof testDocument.createRange

        defaultView.getComputedStyle = ((element: Element) => {
          if ((element as HTMLElement).id === 'wrapped-latin') {
            return {
              fontSize: '16px',
              lineHeight: '18px',
              fontWeight: '400',
              fontStyle: 'normal',
              color: 'rgb(0, 0, 0)',
              fontFamily: 'sans-serif',
              writingMode: 'horizontal-tb',
              transform: 'none',
              transformOrigin: '0px 0px'
            } as CSSStyleDeclaration
          }

          return originalGetComputedStyle(element)
        }) as typeof defaultView.getComputedStyle

        const result = await (parserRef.collectTextsFromDocument as (
          doc: Document,
          id: string
        ) => Promise<{
          texts: Array<{ content: string; polygon: number[][] }>
        }>)(testDocument, 'wrapped-latin')

        expect(result.texts.map((text) => text.content)).toEqual([
          'Hello world',
          'again'
        ])
        expect(result.texts[0]?.polygon).toEqual([
          [0, 0],
          [90, 0],
          [90, 18],
          [0, 18]
        ])
        expect(result.texts[1]?.polygon).toEqual([
          [0, 24],
          [40, 24],
          [40, 42],
          [0, 42]
        ])
      } finally {
        testDocument.title = originalTitle
        testDocument.body.innerHTML = originalBodyHtml
        testDocument.createRange = originalCreateRange
        testDocument.body.getBoundingClientRect = originalBodyRect
        defaultView.getComputedStyle = originalGetComputedStyle
      }
    })
  })

  it('collectTextsFromDocument 应该按渲染行切分无空格文本', async () => {
    await withDomDocument(async ({ document, DOMRect }) => {
      setPretextAdapter({
        measure: (text) => {
          if (text === '你好世界') return { width: 40, height: 18 }
          if (text === '再见') return { width: 20, height: 18 }
          return { width: text.length * 10, height: 18 }
        }
      })

      const parserRef = HtmlParser as unknown as Record<string, unknown>
      const testDocument = document
      const originalTitle = testDocument.title
      const originalBodyHtml = testDocument.body.innerHTML
      const originalCreateRange = testDocument.createRange.bind(testDocument)
      const originalBodyRect = testDocument.body.getBoundingClientRect.bind(testDocument.body)
      const defaultView = testDocument.defaultView
      if (!defaultView) throw new Error('expected defaultView to exist in test document')
      const originalGetComputedStyle = defaultView.getComputedStyle.bind(defaultView)

      try {
        testDocument.title = 'Wrapped CJK Text'
        testDocument.body.innerHTML = '<span id="wrapped-cjk">你好世界再见</span>'

        Object.defineProperty(testDocument.documentElement, 'scrollWidth', {
          configurable: true,
          value: 240
        })
        Object.defineProperty(testDocument.documentElement, 'scrollHeight', {
          configurable: true,
          value: 120
        })
        Object.defineProperty(testDocument.body, 'scrollWidth', {
          configurable: true,
          value: 240
        })
        Object.defineProperty(testDocument.body, 'scrollHeight', {
          configurable: true,
          value: 120
        })

        const bodyRect = new DOMRect(10, 20, 240, 120)
        testDocument.body.getBoundingClientRect =
          (() => bodyRect) as typeof testDocument.body.getBoundingClientRect

        const textNode = testDocument.querySelector('#wrapped-cjk')?.firstChild as Text
        const fullText = textNode.textContent ?? ''
        const lineRects = [new DOMRect(10, 20, 40, 18), new DOMRect(10, 44, 20, 18)]

        testDocument.createRange = (() => {
          let currentNode: Text | null = null
          let startOffset = 0
          let endOffset = 0

          const getCharRect = (): DOMRect | null => {
            if (currentNode !== textNode) return null
            if (endOffset - startOffset !== 1) return null

            if (startOffset <= 3) return new DOMRect(10, 20, 10, 18)
            if (startOffset >= 4 && startOffset < fullText.length) {
              return new DOMRect(10, 44, 10, 18)
            }

            return null
          }

          return {
            selectNodeContents(node: Node) {
              currentNode = node as Text
              startOffset = 0
              endOffset = currentNode.textContent?.length ?? 0
            },
            setStart(node: Node, offset: number) {
              currentNode = node as Text
              startOffset = offset
            },
            setEnd(node: Node, offset: number) {
              currentNode = node as Text
              endOffset = offset
            },
            getClientRects() {
              if (currentNode === textNode && startOffset === 0 && endOffset === fullText.length) {
                return lineRects
              }
              const rect = getCharRect()
              return rect ? [rect] : []
            },
            getBoundingClientRect() {
              if (currentNode === textNode && startOffset === 0 && endOffset === fullText.length) {
                return lineRects[0] ?? null
              }
              return getCharRect()
            },
            detach() {}
          } as unknown as Range
        }) as typeof testDocument.createRange

        defaultView.getComputedStyle = ((element: Element) => {
          if ((element as HTMLElement).id === 'wrapped-cjk') {
            return {
              fontSize: '16px',
              lineHeight: '18px',
              fontWeight: '400',
              fontStyle: 'normal',
              color: 'rgb(0, 0, 0)',
              fontFamily: 'sans-serif',
              writingMode: 'horizontal-tb',
              transform: 'none',
              transformOrigin: '0px 0px'
            } as CSSStyleDeclaration
          }

          return originalGetComputedStyle(element)
        }) as typeof defaultView.getComputedStyle

        const result = await (parserRef.collectTextsFromDocument as (
          doc: Document,
          id: string
        ) => Promise<{
          texts: Array<{ content: string; polygon: number[][] }>
        }>)(testDocument, 'wrapped-cjk')

        expect(result.texts.map((text) => text.content)).toEqual([
          '你好世界',
          '再见'
        ])
        expect(result.texts[0]?.polygon).toEqual([
          [0, 0],
          [40, 0],
          [40, 18],
          [0, 18]
        ])
        expect(result.texts[1]?.polygon).toEqual([
          [0, 24],
          [20, 24],
          [20, 42],
          [0, 42]
        ])
      } finally {
        testDocument.title = originalTitle
        testDocument.body.innerHTML = originalBodyHtml
        testDocument.createRange = originalCreateRange
        testDocument.body.getBoundingClientRect = originalBodyRect
        defaultView.getComputedStyle = originalGetComputedStyle
      }
    })
  })

  it('encode does not call html2canvas before page thumbnail is requested', async () => {
    await withDomDocument(async ({ document }) => {
      const restoreDocument = exposeGlobalDocument(document)
      const handle = installFakeHtml2Canvas()
      try {
        const buffer = new TextEncoder().encode('<p>Hi</p>').buffer
        const doc = await HtmlParser.encode(buffer)
        expect(handle.calls).toHaveLength(0)
        expect(handle.loaderCallCount).toBe(0)
        const intermediate = doc.getIntermediateDocument()
        const pages = await intermediate.pages
        const result = await pages[0].getThumbnail(0.3)
        expect(handle.calls).toHaveLength(1)
        expect(handle.loaderCallCount).toBe(1)
        expect(result).toMatchObject({ src: 'data:image/png;base64,FAKE' })
      } finally {
        handle.restore()
        restoreDocument()
      }
    })
  })

  it('encode lazily generates page thumbnail on first getThumbnail call', async () => {
    await withDomDocument(async ({ document }) => {
      const restoreDocument = exposeGlobalDocument(document)
      const handle = installFakeHtml2Canvas()
      try {
        const buffer = new TextEncoder().encode('<p>Hi</p>').buffer
        const doc = await HtmlParser.encode(buffer)
        const pages = await doc.getIntermediateDocument().pages

        const firstResult = await pages[0].getThumbnail(0.3)
        const secondResult = await pages[0].getThumbnail(0.3)

        expect(firstResult).toMatchObject({ src: 'data:image/png;base64,FAKE' })
        expect(secondResult).toMatchObject({ src: 'data:image/png;base64,FAKE' })
        expect(handle.calls).toHaveLength(1)
        expect(handle.calls[0]?.options).toEqual({
          backgroundColor: '#ffffff',
          scale: 0.3,
          useCORS: true
        })
      } finally {
        handle.restore()
        restoreDocument()
      }
    })
  })

  it('encode resolves undefined when html2canvas thumbnail capture fails', async () => {
    await withDomDocument(async ({ document }) => {
      const restoreDocument = exposeGlobalDocument(document)
      const handle = installFakeHtml2Canvas({ behavior: 'reject', error: new Error('boom') })
      try {
        const buffer = new TextEncoder().encode('<p>Hi</p>').buffer
        const doc = await HtmlParser.encode(buffer)
        const pages = await doc.getIntermediateDocument().pages

        await expect(pages[0].getThumbnail(0.3)).resolves.toBeUndefined()
        expect(handle.calls).toHaveLength(1)
      } finally {
        handle.restore()
        restoreDocument()
      }
    })
  })

  it('encode deduplicates concurrent thumbnail requests at the same scale', async () => {
    await withDomDocument(async ({ document }) => {
      const restoreDocument = exposeGlobalDocument(document)
      const handle = installFakeHtml2Canvas({ loaderDelayMs: 5 })
      try {
        const buffer = new TextEncoder().encode('<p>Hi</p>').buffer
        const doc = await HtmlParser.encode(buffer)
        const pages = await doc.getIntermediateDocument().pages

        const [a, b] = await Promise.all([
          pages[0].getThumbnail(0.3),
          pages[0].getThumbnail(0.3)
        ])

        expect(handle.calls).toHaveLength(1)
        expect(a).toEqual(b)
        expect(a).toMatchObject({ src: 'data:image/png;base64,FAKE' })
      } finally {
        handle.restore()
        restoreDocument()
      }
    })
  })

  it('encode isolates lazy thumbnail captures for different snapshotWidth values', async () => {
    await withDomDocument(async ({ document }) => {
      const restoreDocument = exposeGlobalDocument(document)
      const calls: Array<Record<string, unknown> | undefined> = []

      setHtml2CanvasLoader(async () => async (_element, options) => {
        calls.push(options)
        const widthLabel = options?.width ?? 'default'
        return {
          toDataURL: () => `data:image/png;base64,WIDTH_${widthLabel}`
        }
      })

      try {
        const buffer = new TextEncoder().encode('<p>Hi</p>').buffer
        const narrowDoc = await HtmlParser.encode(buffer, { snapshotWidth: 320 })
        const wideDoc = await HtmlParser.encode(buffer, { snapshotWidth: 640 })
        const narrowPage = (await narrowDoc.getIntermediateDocument().pages)[0]
        const widePage = (await wideDoc.getIntermediateDocument().pages)[0]

        const firstNarrow = await narrowPage.getThumbnail(0.3)
        const secondNarrow = await narrowPage.getThumbnail(0.3)
        const wide = await widePage.getThumbnail(0.3)

        expect(calls).toHaveLength(2)
        expect(calls.map((options) => options?.width)).toEqual([320, 640])
        expect(calls.map((options) => options?.windowWidth)).toEqual([320, 640])
        expect(firstNarrow).toEqual(secondNarrow)
        expect(firstNarrow?.src).toBe('data:image/png;base64,WIDTH_320')
        expect(wide?.src).toBe('data:image/png;base64,WIDTH_640')
      } finally {
        setHtml2CanvasLoader(null)
        restoreDocument()
      }
    })
  })

  it('encode with snapshotWidth feeds decodeToHtml background output end to end', async () => {
    await withDomDocument(async ({ document }) => {
      const restoreDocument = exposeGlobalDocument(document)
      const handle = installFakeHtml2Canvas({ dataUrl: 'data:image/png;base64,WIDTH640' })

      try {
        const buffer = new TextEncoder().encode('<p>Snapshot width output</p>').buffer
        const doc = await HtmlParser.encode(buffer, { snapshotWidth: 640 })
        const html = await HtmlParser.decodeToHtml(doc.getIntermediateDocument())

        expect(html).toContain(
          "background-image:url(&#39;data:image/png;base64,WIDTH640&#39;)"
        )
        expect(handle.calls).toHaveLength(1)
        expect(handle.calls[0]?.options).toEqual({
          backgroundColor: '#ffffff',
          scale: 0.3,
          useCORS: true,
          width: 640,
          windowWidth: 640
        })
        expect(handle.calls[0]?.element.style.width).toBe('640px')
      } finally {
        handle.restore()
        restoreDocument()
      }
    })
  })

  it('encode recaptures page thumbnail when a larger scale is requested', async () => {
    await withDomDocument(async ({ document }) => {
      const restoreDocument = exposeGlobalDocument(document)
      const handle = installFakeHtml2Canvas()
      try {
        const buffer = new TextEncoder().encode('<p>Hi</p>').buffer
        const doc = await HtmlParser.encode(buffer)
        const pages = await doc.getIntermediateDocument().pages
        const page = pages[0]

        const firstResult = await page.getThumbnail(0.3)
        expect(firstResult).toMatchObject({ src: 'data:image/png;base64,FAKE' })
        expect(handle.calls).toHaveLength(1)

        const secondResult = await page.getThumbnail(1)
        expect(secondResult).toMatchObject({ src: 'data:image/png;base64,FAKE' })
        expect(handle.calls).toHaveLength(2)
        expect(handle.calls[1]?.options?.scale).toBe(1)
        expect((page as unknown as { _thumbnail?: { src: string } })._thumbnail).toEqual(secondResult)
      } finally {
        handle.restore()
        restoreDocument()
      }
    })
  })

  it('encode keeps lazyRenderPageDiv background image working through the lazy thumbnail path', async () => {
    await withDomDocument(async ({ document }) => {
      const restoreDocument = exposeGlobalDocument(document)
      const handle = installFakeHtml2Canvas()
      try {
        const buffer = new TextEncoder().encode('<p>Hi</p>').buffer
        const doc = await HtmlParser.encode(buffer)
        const intermediate = doc.getIntermediateDocument()
        const html = await HtmlParser.decodeToHtml(intermediate)
        expect(html).toContain("background-image:url(&#39;data:image/png;base64,FAKE&#39;)")
      } finally {
        handle.restore()
        restoreDocument()
      }
    })
  })

  it('encode preserves IntermediatePage.serialize thumbnail after lazy capture mutates the private field', async () => {
    await withDomDocument(async ({ document }) => {
      const restoreDocument = exposeGlobalDocument(document)
      const handle = installFakeHtml2Canvas()
      try {
        const buffer = new TextEncoder().encode('<p>Hi</p>').buffer
        const doc = await HtmlParser.encode(buffer)
        const pages = await doc.getIntermediateDocument().pages
        const page = pages[0]

        // Sanity: before calling getThumbnail, serialize shows undefined thumbnail
        const serializedBefore = IntermediatePage.serialize(page)
        expect(serializedBefore.thumbnail).toBeUndefined()

        // Trigger lazy capture
        await page.getThumbnail(0.3)

        // After capture, serialize should show the captured data URL
        const serializedAfter = IntermediatePage.serialize(page)
        expect(serializedAfter.thumbnail).toMatchObject({ src: 'data:image/png;base64,FAKE' })
      } finally {
        handle.restore()
        restoreDocument()
      }
    })
  })

  it('encode does not downgrade cached thumbnail when a smaller-scale capture finishes after a larger one', async () => {
    await withDomDocument(async ({ document }) => {
      const restoreDocument = exposeGlobalDocument(document)
      const pendings: Array<{
        scale: number
        resolve: (value: { toDataURL: () => string }) => void
      }> = []

      setHtml2CanvasLoader(async () => (_element, options) => new Promise((resolve) => {
        const scale = options?.scale
        if (typeof scale !== 'number') {
          throw new Error('expected numeric html2canvas scale')
        }
        pendings.push({ scale, resolve })
      }))

      try {
        const buffer = new TextEncoder().encode('<p>Hi</p>').buffer
        const doc = await HtmlParser.encode(buffer)
        const pages = await doc.getIntermediateDocument().pages
        const page = pages[0]

        const smallResultPromise = page.getThumbnail(0.3)
        const largeResultPromise = page.getThumbnail(1)
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()

        expect(pendings).toHaveLength(2)
        pendings.find((pending) => pending.scale === 1)?.resolve({
          toDataURL: () => 'data:image/png;base64,LARGE'
        })
        pendings.find((pending) => pending.scale === 0.3)?.resolve({
          toDataURL: () => 'data:image/png;base64,SMALL'
        })

        const [smallResult, largeResult] = await Promise.all([
          smallResultPromise,
          largeResultPromise
        ])

        expect(smallResult).toMatchObject({ src: 'data:image/png;base64,SMALL' })
        expect(largeResult).toMatchObject({ src: 'data:image/png;base64,LARGE' })
        expect((page as unknown as { _thumbnail?: { src: string } })._thumbnail).toMatchObject({
          src: 'data:image/png;base64,LARGE'
        })
      } finally {
        setHtml2CanvasLoader(null)
        restoreDocument()
      }
    })
  })

  describe('HtmlParser.encode excludeSelectors', () => {
    const encodeHtml = (html: string, options?: Parameters<typeof HtmlParser.encode>[1]) =>
      HtmlParser.encode(new TextEncoder().encode(html).buffer, options)

    const readContent = async (doc: HtmlDocument) => {
      const pages = await doc.getIntermediateDocument().pages
      const content = await pages[0].getContent()
      return { pages, content }
    }

    const readTextAndImages = async (doc: HtmlDocument) => {
      const { pages, content } = await readContent(doc)
      const texts = content.filter(
        (item): item is IntermediateText => item instanceof IntermediateText
      )
      const images = content.filter(
        (item): item is IntermediateImage => item instanceof IntermediateImage
      )
      return { pages, content, texts, images }
    }

    it('removes matching subtree text and images', async () => {
      await withDomDocument(async () => {
        const html = '<div class="keep">Keep me</div><div class="exclude"><p>Drop</p><img src="data:image/png;base64,iVBORw0KGgo=" /></div>'
        const doc = await encodeHtml(html, { excludeSelectors: ['.exclude'] })
        const { texts, images } = await readTextAndImages(doc)

        expect(texts.map((text) => text.content)).toEqual(['Keep me'])
        expect(texts.some((text) => text.content.includes('Drop'))).toBe(false)
        expect(images).toHaveLength(0)
      })
    })

    it('treats empty/undefined as no-op', async () => {
      await withDomDocument(async () => {
        const originalDateNow = Date.now
        Date.now = () => 2026060702
        const html = '<div class="keep">Keep me</div><div class="exclude"><p>Drop</p><img src="data:image/png;base64,iVBORw0KGgo=" /></div>'

        try {
          const baseline = await readContent(await encodeHtml(html))
          const withEmptyObject = await readContent(await encodeHtml(html, {}))
          const withEmptySelectors = await readContent(await encodeHtml(html, { excludeSelectors: [] }))
          const summarize = ({ content }: Awaited<ReturnType<typeof readContent>>) =>
            content.map((item) => ({
              id: item.id,
              kind: item instanceof IntermediateImage ? 'image' : 'text',
              content: item instanceof IntermediateText ? item.content : undefined,
              src: item instanceof IntermediateImage ? item.src : undefined
            }))

          expect(withEmptyObject.content).toHaveLength(baseline.content.length)
          expect(withEmptySelectors.content).toHaveLength(baseline.content.length)
          expect(summarize(withEmptyObject)).toEqual(summarize(baseline))
          expect(summarize(withEmptySelectors)).toEqual(summarize(baseline))
        } finally {
          Date.now = originalDateNow
        }
      })
    })

    it('treats zero-match selectors as no-op', async () => {
      await withDomDocument(async () => {
        const originalDateNow = Date.now
        Date.now = () => 2026060708
        const html = '<main><p>Keep text</p><img src="data:image/png;base64,KEEP" /></main>'

        try {
          const baseline = await readTextAndImages(await encodeHtml(html))
          const zeroMatch = await readTextAndImages(await encodeHtml(html, {
            excludeSelectors: ['.does-not-exist']
          }))

          expect(zeroMatch.texts.map((text) => text.content)).toEqual(
            baseline.texts.map((text) => text.content)
          )
          expect(zeroMatch.images.map((image) => image.src)).toEqual(
            baseline.images.map((image) => image.src)
          )
          expect(zeroMatch.content).toHaveLength(baseline.content.length)
        } finally {
          Date.now = originalDateNow
        }
      })
    })

    it('excluding body yields empty content but valid document', async () => {
      await withDomDocument(async () => {
        const html = '<div class="keep">Keep me</div><p>Drop me too</p>'
        const doc = await encodeHtml(html, { excludeSelectors: ['body'] })
        const { pages, content } = await readContent(doc)

        expect(pages.length).toBeGreaterThanOrEqual(1)
        expect(pages[0].width).toBe(800)
        expect(pages[0].height).toBeGreaterThan(0)
        expect(content).toHaveLength(0)
      })
    })

    it('rejects invalid selector with deterministic error', async () => {
      await withDomDocument(async () => {
        const html = '<div>Keep me</div>'
        await expect(encodeHtml(html, { excludeSelectors: ['<<<bad'] })).rejects.toThrow(
          /^Invalid exclude selector: <<<bad/
        )
      })
    })

    it('multiple selectors combine via OR', async () => {
      await withDomDocument(async () => {
        const html = '<div class="a">A</div><div class="b">B</div><div class="c">C</div>'
        const doc = await encodeHtml(html, { excludeSelectors: ['.a', '.c'] })
        const { texts } = await readTextAndImages(doc)

        expect(texts.map((text) => text.content)).toEqual(['B'])
      })
    })

    it('deduplicates behavior for overlapping selectors matching the same element', async () => {
      await withDomDocument(async () => {
        const html = [
          '<section>',
          '  <div class="a b"><p>Drop once</p><img src="data:image/png;base64,DROP" /></div>',
          '  <p class="keep">Keep once</p>',
          '</section>'
        ].join('')
        const doc = await encodeHtml(html, { excludeSelectors: ['.a', '.a.b'] })
        const { texts, images } = await readTextAndImages(doc)

        expect(texts.map((text) => text.content)).toEqual(['Keep once'])
        expect(texts.some((text) => text.content.includes('Drop once'))).toBe(false)
        expect(images).toHaveLength(0)
      })
    })
  })

  describe('HtmlParser.encode snapshotWidth', () => {
    const encodeHtmlWith = (html: string, options: EncodeOptions) =>
      HtmlParser.encode(new TextEncoder().encode(html).buffer, options)

    describe('valid snapshotWidth values', () => {
      const validValues = [100, 640, 10000]

      validValues.forEach((width) => {
        it(`accepts snapshotWidth=${width} and passes it to html2canvas`, async () => {
          const handle = installFakeHtml2Canvas()
          try {
            await withDomDocument(async () => {
              const html = '<div style="background-image:url(data:image/png;base64,AAAA)">Content</div>'
              await encodeHtmlWith(html, { snapshotWidth: width })
              expect(handle.calls.length).toBeGreaterThan(0)
              expect(handle.calls[0].options?.width).toBe(width)
            })
          } finally {
            handle.restore()
          }
        })
      })
    })

    describe('omitted/undefined snapshotWidth', () => {
      it('accepts undefined snapshotWidth with unchanged behavior', async () => {
        const handle = installFakeHtml2Canvas()
        try {
          await withDomDocument(async () => {
            const html = '<div style="background-image:url(data:image/png;base64,AAAA)">Content</div>'
            await encodeHtmlWith(html, {})
            await encodeHtmlWith(html, { snapshotWidth: undefined })
            expect(handle.calls[0].options?.width).toBeUndefined()
          })
        } finally {
          handle.restore()
        }
      })
    })

    describe('invalid snapshotWidth values', () => {
      const invalidCases = [
        { value: 99, description: 'below minimum (99)' },
        { value: 10001, description: 'above maximum (10001)' },
        { value: 0, description: 'zero' },
        { value: -1, description: 'negative' },
        { value: NaN, description: 'NaN' },
        { value: Infinity, description: 'Infinity' },
        { value: 1.5, description: 'decimal' },
      ]

      invalidCases.forEach(({ value, description }) => {
        it(`rejects snapshotWidth that is ${description}`, async () => {
          await withDomDocument(async () => {
            const html = '<div>Content</div>'
            await expect(
              encodeHtmlWith(html, { snapshotWidth: value })
            ).rejects.toThrow(
              expect.objectContaining({
                message: expect.stringMatching(
                  new RegExp(`Invalid snapshotWidth.*${String(value)}`)
                )
              })
            )
          })
        })
      })
    })
  })

  describe('HtmlParser.encode mixed content order', () => {
    type OrderedItem<T extends object> = T & { sourceOrder: number }
    type CollectImagesForMixedTest = (
      doc: Document,
      id: string,
      excludeMatcher?: (el: Element) => boolean
    ) => Promise<IntermediateImage[]>
    type CollectTextsForMixedTest = (
      doc: Document,
      id: string,
      excludeMatcher?: (el: Element) => boolean
    ) => Promise<{
      title: string
      texts: IntermediateText[]
      images: IntermediateImage[]
      pageWidth: number
      pageHeight: number
    }>
    type ImageToDataUrlForMixedTest = (img: HTMLImageElement) => Promise<string>

    const withSourceOrder = <T extends object>(item: T, sourceOrder: number): OrderedItem<T> =>
      Object.assign(item, { sourceOrder })

    const makeText = (id: string, content: string, sourceOrder: number): OrderedItem<IntermediateText> =>
      withSourceOrder(new IntermediateText({
        id,
        content,
        fontSize: 16,
        fontFamily: 'Inter',
        fontWeight: 400,
        italic: false,
        color: '#111111',
        polygon: [[0, sourceOrder * 20], [80, sourceOrder * 20], [80, sourceOrder * 20 + 18], [0, sourceOrder * 20 + 18]],
        lineHeight: 20,
        ascent: 13,
        descent: 5,
        vertical: false,
        dir: TextDir.LTR,
        skew: 0,
        isEOL: true
      }), sourceOrder)

    const makeImage = (id: string, src: string, sourceOrder: number): OrderedItem<IntermediateImage> =>
      withSourceOrder(new IntermediateImage({
        id,
        src,
        polygon: [[0, sourceOrder * 20], [32, sourceOrder * 20], [32, sourceOrder * 20 + 16], [0, sourceOrder * 20 + 16]],
        opacity: 1
      }), sourceOrder)

    const readFirstPageContent = async (doc: HtmlDocument) => {
      const pages = await doc.getIntermediateDocument().pages
      const content = await pages[0].getContent()
      return { page: pages[0], content }
    }

    const setRect = (element: Element, rect: DOMRect): void => {
      element.getBoundingClientRect = (() => rect) as typeof element.getBoundingClientRect
    }

    it('emits text and images in DOM order', async () => {
      await withDomDocument(async () => {
        const parserRef = HtmlParser as unknown as {
          collectTextsFromDocument: CollectTextsForMixedTest
        }
        const originalCollectTexts = parserRef.collectTextsFromDocument

        parserRef.collectTextsFromDocument = async () => ({
          title: 'Mixed DOM Order',
          texts: [
            makeText('mixed-text-0', 'Alpha', 0),
            makeText('mixed-text-2', 'Beta', 2),
            makeText('mixed-text-4', 'Gamma', 4)
          ],
          images: [
            makeImage('mixed-image-1', 'data:image/png;base64,ONE', 1),
            makeImage('mixed-image-3', 'data:image/png;base64,TWO', 3)
          ],
          pageWidth: 800,
          pageHeight: 120
        })

        try {
          const doc = await HtmlParser.encode(new TextEncoder().encode('<p>fixture</p>').buffer)
          const { page, content } = await readFirstPageContent(doc)
          const summary = content.map((item) => {
            if (item instanceof IntermediateImage) {
              return { kind: 'image', id: item.id, src: item.src }
            }

            return { kind: 'text', id: item.id, content: item.content }
          })

          expect(content).toHaveLength(5)
          expect(summary).toEqual([
            { kind: 'text', id: 'mixed-text-0', content: 'Alpha' },
            { kind: 'image', id: 'mixed-image-1', src: 'data:image/png;base64,ONE' },
            { kind: 'text', id: 'mixed-text-2', content: 'Beta' },
            { kind: 'image', id: 'mixed-image-3', src: 'data:image/png;base64,TWO' },
            { kind: 'text', id: 'mixed-text-4', content: 'Gamma' }
          ])

          const images = content.filter(
            (item): item is IntermediateImage => item instanceof IntermediateImage
          )
          expect(images[0]).toMatchObject({
            id: 'mixed-image-1',
            src: 'data:image/png;base64,ONE',
            polygon: [[0, 20], [32, 20], [32, 36], [0, 36]],
            opacity: 1
          })
          expect(images[1]).toMatchObject({
            id: 'mixed-image-3',
            src: 'data:image/png;base64,TWO',
            polygon: [[0, 60], [32, 60], [32, 76], [0, 76]],
            opacity: 1
          })
          expect(IntermediatePage.serialize(page).content?.some((item) => 'sourceOrder' in item)).toBe(false)
        } finally {
          parserRef.collectTextsFromDocument = originalCollectTexts
        }
      })
    })

    it('preserves original src when canvas conversion fails', async () => {
      await withDomDocument(async ({ document, DOMRect }) => {
        const parserRef = HtmlParser as unknown as {
          collectImagesFromDocument: CollectImagesForMixedTest
          imageToDataUrl: ImageToDataUrlForMixedTest
        }
        const originalImageToDataUrl = parserRef.imageToDataUrl
        const conversionAttempts: string[] = []

        document.body.innerHTML = '<img id="fallback-image" src="/assets/fail.png" />'
        setRect(document.body, new DOMRect(0, 0, 800, 600))
        const img = document.querySelector('#fallback-image')
        if (!img) throw new Error('expected fixture image')
        setRect(img, new DOMRect(12, 34, 56, 78))
        parserRef.imageToDataUrl = async (image) => {
          conversionAttempts.push(image.getAttribute('src') ?? '')
          throw new Error('canvas conversion failed')
        }

        try {
          const images = await parserRef.collectImagesFromDocument(document, 'fallback-src')
          expect(conversionAttempts).toEqual(['/assets/fail.png'])
          expect(images).toHaveLength(1)
          expect(images[0]).toMatchObject({
            id: 'fallback-src-page-1-image-0',
            src: '/assets/fail.png',
            polygon: [[12, 34], [68, 34], [68, 112], [12, 112]],
            opacity: 1
          })
        } finally {
          parserRef.imageToDataUrl = originalImageToDataUrl
        }
      })
    })

    it('skips display:none and 0x0 images', async () => {
      await withDomDocument(async ({ document, DOMRect }) => {
        const parserRef = HtmlParser as unknown as {
          collectImagesFromDocument: CollectImagesForMixedTest
        }

        document.body.innerHTML = [
          '<img id="hidden-image" style="display:none" src="data:image/png;base64,HIDDEN" />',
          '<img id="zero-image" src="data:image/png;base64,ZERO" />',
          '<img id="visible-image" src="data:image/png;base64,VISIBLE" />'
        ].join('')
        setRect(document.body, new DOMRect(0, 0, 800, 600))

        const hidden = document.querySelector('#hidden-image')
        const zero = document.querySelector('#zero-image')
        const visible = document.querySelector('#visible-image')
        if (!hidden || !zero || !visible) throw new Error('expected fixture images')
        setRect(hidden, new DOMRect(0, 0, 0, 0))
        setRect(zero, new DOMRect(20, 20, 0, 0))
        setRect(visible, new DOMRect(40, 50, 60, 70))

        const images = await parserRef.collectImagesFromDocument(document, 'skip-images')
        expect(images).toHaveLength(1)
        expect(images[0]?.src).toBe('data:image/png;base64,VISIBLE')
        expect(images[0]?.polygon).toEqual([[40, 50], [100, 50], [100, 120], [40, 120]])
      })
    })

    it('keeps data url images unchanged', async () => {
      await withDomDocument(async ({ document, DOMRect }) => {
        const parserRef = HtmlParser as unknown as {
          collectImagesFromDocument: CollectImagesForMixedTest
          imageToDataUrl: ImageToDataUrlForMixedTest
        }
        const originalImageToDataUrl = parserRef.imageToDataUrl
        const dataUrl = 'data:image/png;base64,UNCHANGED'

        document.body.innerHTML = `<img id="data-image" src="${dataUrl}" />`
        setRect(document.body, new DOMRect(0, 0, 800, 600))
        const img = document.querySelector('#data-image')
        if (!img) throw new Error('expected data image')
        setRect(img, new DOMRect(5, 6, 7, 8))
        parserRef.imageToDataUrl = async () => {
          throw new Error('data url image should not be converted')
        }

        try {
          const images = await parserRef.collectImagesFromDocument(document, 'data-url')
          expect(images).toHaveLength(1)
          expect(images[0]).toMatchObject({
            id: 'data-url-page-1-image-0',
            src: dataUrl,
            polygon: [[5, 6], [12, 6], [12, 14], [5, 14]],
            opacity: 1
          })
        } finally {
          parserRef.imageToDataUrl = originalImageToDataUrl
        }
      })
    })
  })

  describe('HtmlDocument.getCover', () => {
    const installFakeImage = (ImageClass: typeof Image) => {
      const originalImageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image')

      const FakeImage = function (this: unknown) {
        const img = new ImageClass()
        let internalSrc = ''

        Object.defineProperty(img, 'src', {
          configurable: true,
          get() {
            return internalSrc
          },
          set(value: string) {
            internalSrc = value
            if (value) {
              img.onload?.({} as Event)
            } else {
              img.onerror?.({} as Event)
            }
          }
        })

        return img
      } as unknown as typeof Image

      Object.defineProperty(globalThis, 'Image', {
        configurable: true,
        value: FakeImage
      })

      return () => {
        if (originalImageDescriptor) {
          Object.defineProperty(globalThis, 'Image', originalImageDescriptor)
        } else {
          delete (globalThis as Record<string, unknown>).Image
        }
      }
    }

    const createIntermediateDocumentForCoverTest = (
      cover: { src: string } | undefined
    ): IntermediateDocument => {
      const intermediate = new IntermediateDocument({
        id: 'doc-cover-test',
        title: 'Cover Test',
        pagesMap: IntermediatePageMap.makeByInfoList([
          {
            id: 'page-1',
            pageNumber: 1,
            size: { x: 320, y: 200 },
            getData: async () => new IntermediatePage({
              id: 'page-1',
              number: 1,
              width: 320,
              height: 200,
              texts: [],
              thumbnail: undefined
            })
          }
        ])
      })

      ;(
        intermediate as unknown as {
          getCover: () => Promise<{ src: string } | undefined>
        }
      ).getCover = async () => cover

      return intermediate
    }

    it('getCover 返回对象 src 时应解析为 HTMLImageElement', async () => {
      await withDomDocument(async (window) => {
        const { document, Image: WindowImage, HTMLImageElement } = window
        const restoreDocument = exposeGlobalDocument(document)
        const restoreImage = installFakeImage(WindowImage)

        try {
          const intermediate = createIntermediateDocumentForCoverTest({
            src: 'data:image/png;base64,cover'
          })
          const htmlDocument = new HtmlDocument(intermediate)
          const cover = await htmlDocument.getCover()

          expect(cover).toBeInstanceOf(HTMLImageElement)
          expect((cover as HTMLImageElement).src).toBe('data:image/png;base64,cover')
        } finally {
          restoreImage()
          restoreDocument()
        }
      })
    })

    it('getCover 返回 undefined 时应回退为 HTMLCanvasElement', async () => {
      await withDomDocument(async (window) => {
        const { document, Image: WindowImage, HTMLCanvasElement } = window
        const restoreDocument = exposeGlobalDocument(document)
        const restoreImage = installFakeImage(WindowImage)

        try {
          const intermediate = createIntermediateDocumentForCoverTest(undefined)
          const htmlDocument = new HtmlDocument(intermediate)
          const cover = await htmlDocument.getCover()

          expect(cover).toBeInstanceOf(HTMLCanvasElement)
        } finally {
          restoreImage()
          restoreDocument()
        }
      })
    })

    it('getCover 返回空 src 时应回退为 HTMLCanvasElement', async () => {
      await withDomDocument(async (window) => {
        const { document, Image: WindowImage, HTMLCanvasElement } = window
        const restoreDocument = exposeGlobalDocument(document)
        const restoreImage = installFakeImage(WindowImage)

        try {
          const intermediate = createIntermediateDocumentForCoverTest({ src: '' })
          const htmlDocument = new HtmlDocument(intermediate)
          const cover = await htmlDocument.getCover()

          expect(cover).toBeInstanceOf(HTMLCanvasElement)
        } finally {
          restoreImage()
          restoreDocument()
        }
      })
    })
  })
})

type Task1StyleProbeExpectation = {
  cssName: string
  prop: string
  expected: string
}

const task1ReadStyleValue = (
  style: CSSStyleDeclaration,
  prop: string
): string => {
  const value = (style as unknown as Record<string, unknown>)[prop]
  return typeof value === 'string' ? value : ''
}

const task1StyleProbeStyle = [
  'background-color: rgb(1, 2, 3)',
  'border-top: 1px solid rgb(10, 20, 30)',
  'border-right: 2px dashed rgb(40, 50, 60)',
  'border-bottom: 3px dotted rgb(70, 80, 90)',
  'border-left: 4px double rgb(100, 110, 120)',
  'border-radius: 5px 6px 7px 8px',
  'box-shadow: 1px 2px 3px rgb(9, 8, 7)',
  'outline: 9px solid rgb(11, 22, 33)'
].join('; ')

const task1StyleProbeExpectations: Task1StyleProbeExpectation[] = [
  { cssName: 'background-color', prop: 'backgroundColor', expected: 'rgb(1, 2, 3)' },
  { cssName: 'border-top-width', prop: 'borderTopWidth', expected: '1px' },
  { cssName: 'border-top-style', prop: 'borderTopStyle', expected: 'solid' },
  { cssName: 'border-top-color', prop: 'borderTopColor', expected: 'rgb(10, 20, 30)' },
  { cssName: 'border-right-width', prop: 'borderRightWidth', expected: '2px' },
  { cssName: 'border-right-style', prop: 'borderRightStyle', expected: 'dashed' },
  { cssName: 'border-right-color', prop: 'borderRightColor', expected: 'rgb(40, 50, 60)' },
  { cssName: 'border-bottom-width', prop: 'borderBottomWidth', expected: '3px' },
  { cssName: 'border-bottom-style', prop: 'borderBottomStyle', expected: 'dotted' },
  { cssName: 'border-bottom-color', prop: 'borderBottomColor', expected: 'rgb(70, 80, 90)' },
  { cssName: 'border-left-width', prop: 'borderLeftWidth', expected: '4px' },
  { cssName: 'border-left-style', prop: 'borderLeftStyle', expected: 'double' },
  { cssName: 'border-left-color', prop: 'borderLeftColor', expected: 'rgb(100, 110, 120)' },
  { cssName: 'border-top-left-radius', prop: 'borderTopLeftRadius', expected: '5px' },
  { cssName: 'border-top-right-radius', prop: 'borderTopRightRadius', expected: '6px' },
  { cssName: 'border-bottom-right-radius', prop: 'borderBottomRightRadius', expected: '7px' },
  { cssName: 'border-bottom-left-radius', prop: 'borderBottomLeftRadius', expected: '8px' },
  { cssName: 'border-radius', prop: 'borderRadius', expected: '5px 6px 7px 8px' },
  { cssName: 'box-shadow', prop: 'boxShadow', expected: '1px 2px 3px rgb(9, 8, 7)' },
  { cssName: 'outline-width', prop: 'outlineWidth', expected: '9px' },
  { cssName: 'outline-style', prop: 'outlineStyle', expected: 'solid' },
  { cssName: 'outline-color', prop: 'outlineColor', expected: 'rgb(11, 22, 33)' }
]

describe('Task 1 computed style whitelist assumption probe', () => {
  it('documents happy-dom retrieval support for whitelisted inline styles', async () => {
    await withDomDocument(async ({ document }) => {
      const defaultView = document.defaultView
      if (!defaultView) throw new Error('expected defaultView to exist in test document')

      const el = document.createElement('div')
      el.setAttribute('style', task1StyleProbeStyle)
      document.body.appendChild(el)

      // 探针：验证 happy-dom 能否读取背景样式白名单中的 computed style 与 inline style。
      const computed = defaultView.getComputedStyle(el)
      const observed = task1StyleProbeExpectations.map(({ cssName, prop, expected }) => {
        const computedValue = task1ReadStyleValue(computed, prop)
        const inlineValue = task1ReadStyleValue(el.style, prop)

        return {
          cssName,
          computedReadable: computedValue === expected,
          computedValue,
          inlineReadable: inlineValue === expected,
          inlineValue
        }
      })

      expect(observed).toEqual(
        task1StyleProbeExpectations.map(({ cssName, expected }) => ({
          cssName,
          computedReadable: true,
          computedValue: expected,
          inlineReadable: true,
          inlineValue: expected
        }))
      )
    })
  })
})

type Task1Polygon = ReadonlyArray<Readonly<[number, number]>>

const task1PolygonBounds = (polygon: Task1Polygon) => {
  const xs = polygon.map(([x]) => x)
  const ys = polygon.map(([, y]) => y)

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  }
}

const task1FitsPage = (
  polygon: Task1Polygon,
  page: { width: number; height: number }
): boolean => {
  const bounds = task1PolygonBounds(polygon)
  return (
    bounds.minX >= 0 &&
    bounds.minY >= 0 &&
    bounds.maxX <= page.width &&
    bounds.maxY <= page.height
  )
}

describe('Task 1 polygon coordinate alignment assumption probe', () => {
  it('documents IntermediateImage and IntermediateText sharing page coordinates', () => {
    const page = { width: 800, height: 1024 }
    const imagePolygon = [
      [10, 20],
      [110, 20],
      [110, 80],
      [10, 80]
    ] satisfies IntermediateImage['polygon']
    const textPolygon = [
      [120, 30],
      [220, 30],
      [220, 70],
      [120, 70]
    ] satisfies IntermediateText['polygon']

    const image = new IntermediateImage({
      id: 'task-1-image',
      src: 'data:image/png;base64,TASK1',
      polygon: imagePolygon,
      opacity: 1
    })
    const text = new IntermediateText({
      id: 'task-1-text',
      content: 'Task 1 text',
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      italic: false,
      color: '#111111',
      polygon: textPolygon,
      lineHeight: 20,
      ascent: 12,
      descent: 4,
      vertical: false,
      dir: TextDir.LTR,
      skew: 0,
      isEOL: true
    })

    // 探针：图片和文字 polygon 都以页面左上角为原点，并落在同一页尺寸内。
    expect(task1PolygonBounds(image.polygon)).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 80
    })
    expect(task1PolygonBounds(text.polygon)).toEqual({
      minX: 120,
      minY: 30,
      maxX: 220,
      maxY: 70
    })
    expect(task1FitsPage(image.polygon, page)).toBe(true)
    expect(task1FitsPage(text.polygon, page)).toBe(true)
    expect(computeTargetWidth(image.polygon)).toBe(100)
    expect(computeTargetHeight(image.polygon)).toBe(60)
    expect(computeTargetWidth(text.polygon)).toBe(100)
    expect(computeTargetHeight(text.polygon)).toBe(40)
  })
})
