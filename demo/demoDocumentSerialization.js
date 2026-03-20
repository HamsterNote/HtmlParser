import { HtmlParser } from '../dist/index.js'

function cloneOutlineItem(item) {
  return {
    ...item
  }
}

function cloneText(text) {
  return {
    ...text
  }
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
      const texts =
        Array.isArray(page.texts)
          ? page.texts
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
        return {
          ...normalizedPage,
          async getTexts() {
            return normalizedPage.texts.map(cloneText)
          },
          async getThumbnail() {
            return normalizedPage.thumbnail
          }
        }
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

export async function decodeSerializedDocumentToHtml(serialized) {
  return HtmlParser.decodeToHtml(parseSerializedDocument(serialized))
}
