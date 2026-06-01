import { IntermediatePage, IntermediateText, normalizeDecodeTextControl } from '../dist/index.js'

function cloneOutlineItem(item) {
  return {
    ...item
  }
}

function cloneText(text) {
  return new IntermediateText({
    ...text
  })
}

function clonePage(page) {
  return {
    id: page.id,
    number: page.number,
    width: page.width,
    height: page.height,
    texts: page.texts.map(cloneText),
    thumbnail: page.thumbnail ?? undefined
  }
}

async function resolvePages(intermediate) {
  const pages = await intermediate.pages
  return Promise.all(
    pages.map(async (page) => {
      const content =
        Array.isArray(page.content)
          ? page.content
          : typeof page.getContent === 'function'
            ? await page.getContent()
            : undefined
      const texts =
        Array.isArray(page.texts)
          ? page.texts
          : Array.isArray(content)
            ? content.filter((item) => item instanceof IntermediateText)
            : typeof page.getTexts === 'function'
              ? await page.getTexts()
              : []

      let thumbnail = page.thumbnail
      if (thumbnail == null && typeof page.getThumbnail === 'function') {
        thumbnail = await page.getThumbnail(0.3)
      }

      return clonePage({
        id: page.id,
        number: page.number,
        width: page.width,
        height: page.height,
        texts,
        thumbnail
      })
    })
  )
}

export async function serializeIntermediate(intermediate) {
  const outline =
    typeof intermediate.getOutline === 'function'
      ? (intermediate.getOutline() ?? [])
      : (intermediate.outline ?? [])

  return {
    id: intermediate.id,
    title: intermediate.title,
    outline: outline.map(cloneOutlineItem),
    pages: await resolvePages(intermediate)
  }
}

export function parseSerializedDocument(serialized) {
  const outline = Array.isArray(serialized.outline)
    ? serialized.outline.map(cloneOutlineItem)
    : []
  const pages = Array.isArray(serialized.pages)
    ? serialized.pages.map((page) => {
        const normalizedPage = clonePage(page)
        const content = normalizedPage.texts.map(cloneText)
        const intermediatePage = new IntermediatePage({
          id: normalizedPage.id,
          number: normalizedPage.number,
          width: normalizedPage.width,
          height: normalizedPage.height,
          texts: content,
          thumbnail: undefined
        })
        intermediatePage.setGetContent(async () => content.map(cloneText))
        intermediatePage.setGetThumbnail(async () => normalizedPage.thumbnail)
        intermediatePage.texts = normalizedPage.texts
        intermediatePage.thumbnail = normalizedPage.thumbnail
        return intermediatePage
      })
    : []

  return {
    id: serialized.id,
    title: serialized.title,
    outline,
    pages: Promise.resolve(pages),
    getOutline() {
      return outline
    }
  }
}

async function loadHtmlParser() {
  if (typeof window === 'undefined') {
    return import('../src/index.ts')
  }

  return import('../dist/index.js')
}

export async function decodeSerializedDocumentToHtml(serialized, decodeToHtml) {
  const document = parseSerializedDocument(serialized)
  const textControl = normalizeDecodeTextControl(serialized.textControl)

  const options = {}
  if (textControl !== undefined) {
    options.textControl = textControl
  }
  if (serialized.background && typeof serialized.background === 'object') {
    options.background = serialized.background
  }

  const hasOptions = Object.keys(options).length > 0

  if (typeof decodeToHtml === 'function') {
    return hasOptions
      ? decodeToHtml(document, options)
      : decodeToHtml(document)
  }

  const { HtmlParser } = await loadHtmlParser()
  return hasOptions
    ? HtmlParser.decodeToHtml(document, options)
    : HtmlParser.decodeToHtml(document)
}
