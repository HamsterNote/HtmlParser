import {
  IntermediateDocument,
  IntermediatePage,
  IntermediatePageMap,
  IntermediateText,
  TextDir
} from '@hamster-note/types'
import { Window } from 'happy-dom'

import { HtmlPage, RenderViews } from '../HtmlPage.js'
import { HtmlParser } from '../index.js'
import {
  resetPretextAdapter,
  setPretextAdapter
} from '../textMeasurement.js'
import type { PretextAdapter } from '../textMeasurement.js'

const adapter: PretextAdapter = {
  measure: () => ({ width: 50, height: 20 })
}

const withDomGlobals = async <T>(fn: () => Promise<T>): Promise<T> => {
  const window = new Window()
  const globalRef = globalThis as Record<string, unknown>
  const original = {
    DOMParser: globalRef.DOMParser,
    Node: globalRef.Node,
    document: globalRef.document
  }

  globalRef.DOMParser = window.DOMParser
  globalRef.Node = window.Node
  globalRef.document = window.document

  try {
    return await fn()
  } finally {
    if (original.DOMParser) globalRef.DOMParser = original.DOMParser
    else delete globalRef.DOMParser
    if (original.Node) globalRef.Node = original.Node
    else delete globalRef.Node
    if (original.document) globalRef.document = original.document
    else delete globalRef.document
  }
}

const buildDocument = (text: IntermediateText): IntermediateDocument => {
  const infoList = [
    {
      id: 'page-1',
      pageNumber: 1,
      size: { x: 200, y: 200 },
      getData: async () =>
        new IntermediatePage({
          id: 'page-1',
          number: 1,
          width: 200,
          height: 200,
          texts: [text],
          thumbnail: undefined
        })
    }
  ]

  return new IntermediateDocument({
    id: 'doc-1',
    title: 'Renderer Test',
    pagesMap: IntermediatePageMap.makeByInfoList(infoList)
  })
}

const buildText = (polygon: IntermediateText['polygon']): IntermediateText =>
  new IntermediateText({
    id: 'text-1',
    content: 'Hello renderer',
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: 400,
    italic: false,
    color: '#111111',
    polygon,
    lineHeight: 20,
    ascent: 12,
    descent: 4,
    vertical: false,
    dir: TextDir.LTR,
    skew: 0,
    isEOL: true
  })

describe('renderer alignment', () => {
  beforeEach(() => {
    setPretextAdapter(adapter)
  })

  afterEach(() => {
    resetPretextAdapter()
  })

  it('renders a non-rotated polygon with the shared transform pipeline', async () => {
    const text = buildText([
      [10, 20],
      [110, 20],
      [110, 60],
      [10, 60]
    ])

    await withDomGlobals(async () => {
      const container = globalThis.document.createElement(
        'div'
      ) as unknown as HTMLDivElement
      const page = new HtmlPage(
        new IntermediatePage({
          id: 'page-1',
          number: 1,
          width: 200,
          height: 200,
          texts: [text],
          thumbnail: undefined
        })
      )

      await page.render(container, { scale: 2, views: [RenderViews.TEXT] })
      const span = container.querySelector('span') as HTMLSpanElement

      expect(span.style.transform).toBe('rotate(0deg) scale(2, 2)')
      expect(span.style.transformOrigin).toBe('0 0')
      expect(span.style.left).toBe('20px')
      expect(span.style.top).toBe('40px')
    })
  })

  it('renders a rotated polygon with the same transform in both renderers', async () => {
    const text = buildText([
      [10, 20],
      [80.71067811865476, 90.71067811865476],
      [52.42640687119285, 118.99494936611666],
      [-18.284271247461902, 48.2842712474619]
    ])

    await withDomGlobals(async () => {
      const container = globalThis.document.createElement(
        'div'
      ) as unknown as HTMLDivElement
      const page = new HtmlPage(
        new IntermediatePage({
          id: 'page-1',
          number: 1,
          width: 200,
          height: 200,
          texts: [text],
          thumbnail: undefined
        })
      )

      await page.render(container, { scale: 1, views: [RenderViews.TEXT] })
      const span = container.querySelector('span') as HTMLSpanElement
      const domTransform = span.style.transform

      const document = buildDocument(text)
      const html = await HtmlParser.decodeToHtml(document)
      const htmlTransform = html.match(/transform:\s*([^;]+);/)?.[1] ?? ''

      expect(domTransform).toBe('rotate(45deg) scale(2, 2)')
      expect(htmlTransform).toBe('rotate(45deg) scale(2, 2)')
      expect(span.style.transformOrigin).toBe('0 0')
      expect(html).toContain('transform-origin: 0 0')
    })
  })

  it('renders text even when baseline measurement fails', async () => {
    setPretextAdapter({
      measure: () => {
        throw new Error('measurement failed')
      }
    })

    const text = buildText([
      [10, 20],
      [110, 20],
      [110, 60],
      [10, 60]
    ])

    await withDomGlobals(async () => {
      const container = globalThis.document.createElement(
        'div'
      ) as unknown as HTMLDivElement
      const page = new HtmlPage(
        new IntermediatePage({
          id: 'page-1',
          number: 1,
          width: 200,
          height: 200,
          texts: [text],
          thumbnail: undefined
        })
      )

      await expect(
        page.render(container, { scale: 1, views: [RenderViews.TEXT] })
      ).resolves.toBeUndefined()

      const span = container.querySelector('span') as HTMLSpanElement
      expect(span.style.transform).toBe('rotate(0deg) scale(1, 1)')
      expect(span.style.left).toBe('10px')
      expect(span.style.top).toBe('20px')
    })
  })
})
