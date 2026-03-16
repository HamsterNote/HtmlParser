import { Window } from 'happy-dom'
import { HtmlParser } from '../index'

async function withDomGlobals<T>(fn: () => Promise<T>): Promise<T> {
  const window = new Window()
  const globalRef = globalThis as Record<string, unknown>

  const original = {
    DOMParser: globalRef['DOMParser'],
    Node: globalRef['Node']
  }

  globalRef['DOMParser'] = window.DOMParser
  globalRef['Node'] = window.Node

  try {
    return await fn()
  } finally {
    if (original.DOMParser) globalRef['DOMParser'] = original.DOMParser
    else delete globalRef['DOMParser']
    if (original.Node) globalRef['Node'] = original.Node
    else delete globalRef['Node']
  }
}

describe('HtmlParser', () => {
  it('encode 应该在无 DOM 环境下回退为纯文本解析', async () => {
    const html = `<h1>标题</h1>
    <p>第一段</p>
    <p>第二段</p>`

    const buffer = new TextEncoder().encode(html).buffer

    const doc = await HtmlParser.encode(buffer)
    expect(doc).toBeDefined()

    const intermediate = doc?.getIntermediateDocument()
    expect(intermediate?.title).toBe('Untitled HTML')

    const pages = await intermediate?.pages
    expect(pages).toBeDefined()
    expect(pages?.length).toBeGreaterThan(0)

    const page = pages?.[0]
    const texts = await page?.getTexts()
    expect(texts?.length).toBe(3)
    expect(texts?.[0].content).toContain('标题')
    expect(texts?.[1].content).toContain('第一段')
    expect(texts?.[2].content).toContain('第二段')
  })

  it('encode 应该识别斜体文本', async () => {
    await withDomGlobals(async () => {
      const html = `<p><em>italic</em></p><p><i>italic2</i></p><p><span style=\"font-style: italic;\">italic3</span></p>`
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc?.getIntermediateDocument()
      const pages = await intermediate?.pages
      const page = pages?.[0]
      const texts = await page?.getTexts()

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
    await withDomGlobals(async () => {
      const html = '<p>Hello <strong>World</strong><span> Again</span></p>'
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc.getIntermediateDocument()
      const pages = await intermediate.pages
      const texts = await pages[0].getTexts()

      expect(texts.length).toBe(3)
      expect(texts.map((text) => text.content)).toEqual([
        'Hello',
        'World',
        'Again'
      ])
      expect(texts.map((text) => text.isEOL)).toEqual([false, false, true])
      expect(texts[0].x).toBe(0)
      expect(texts[1].x).toBeGreaterThan(texts[0].x)
      expect(texts[2].x).toBeGreaterThan(texts[1].x)
    })
  })

  it('encode DOM 路径在块边界和 <br> 处结束语义行且每行仅一个 isEOL', async () => {
    await withDomGlobals(async () => {
      const html =
        '<div>Alpha<span>Beta</span><br/>Gamma<span>Delta</span></div><p>Epsilon</p>'
      const buffer = new TextEncoder().encode(html).buffer
      const doc = await HtmlParser.encode(buffer)
      const intermediate = doc.getIntermediateDocument()
      const pages = await intermediate.pages
      const texts = await pages[0].getTexts()

      expect(texts.map((text) => text.content)).toEqual([
        'Alpha',
        'Beta',
        'Gamma',
        'Delta',
        'Epsilon'
      ])

      const lineGroups = texts.reduce<Record<number, typeof texts>>(
        (acc, text) => {
          const key = text.y
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

  it('encode fallback 路径在多行输入中每个输出条目保持 isEOL 为 true', async () => {
    const html = 'line-1\nline-2\nline-3'
    const buffer = new TextEncoder().encode(html).buffer
    const doc = await HtmlParser.encode(buffer)
    const intermediate = doc.getIntermediateDocument()
    const pages = await intermediate.pages
    const texts = await pages[0].getTexts()

    expect(texts.length).toBe(3)
    expect(texts.map((text) => text.content)).toEqual([
      'line-1',
      'line-2',
      'line-3'
    ])
    expect(texts.every((text) => text.isEOL)).toBe(true)
  })
})
