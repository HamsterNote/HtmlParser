import { HtmlParser } from '../index'
import {
  parseSerializedDocument,
  serializeIntermediate
} from '../../demo/demoDocumentSerialization.js'

describe('demo document serialization', () => {
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

    const html = await HtmlParser.decodeToHtml(
      parsed as Parameters<typeof HtmlParser.decodeToHtml>[0]
    )
    expect(html).toContain('hamster-note-document')
    expect(html).toContain('Hello demo')
  })
})
