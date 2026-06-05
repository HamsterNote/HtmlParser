import {
  IntermediateDocument,
  IntermediatePage,
  IntermediatePageMap,
  IntermediateText,
  TextDir
} from '@hamster-note/types'
import { HtmlDocument } from '../HtmlDocument.js'
import { HtmlParser, setHtml2CanvasLoader } from '../index'
import { withDomDocument, withGlobalsRemoved } from '../testUtils/domTestUtils.js'
import { installFakeHtml2Canvas } from '../testUtils/html2canvasTestUtils.js'
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
