import { HtmlParser } from '../index'

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
})
