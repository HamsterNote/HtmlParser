import { IntermediateImage, IntermediatePage, IntermediateText, normalizeDecodeTextControl } from '../dist/index.js'

const DEFAULT_THUMBNAIL_QUALITY = 0.3

// duck-typing 鉴别函数（与 src/intermediateTextGuard.ts 逻辑一致）
function isIntermediateTextLike(value) {
  return (
    typeof value === 'object' && value !== null &&
    typeof value.content === 'string' &&
    Array.isArray(value.polygon) &&
    typeof value.fontSize === 'number'
  )
}

function isIntermediateImageLike(value) {
  return (
    typeof value === 'object' && value !== null &&
    typeof value.src === 'string' &&
    Array.isArray(value.polygon) &&
    typeof value.opacity === 'number'
  )
}

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

function cloneImage(image) {
  return new IntermediateImage({
    ...image
  })
}

// 按 DOM 顺序克隆 content 数组项，使用 duck-typing 鉴别 text/image
function cloneContentItem(item) {
  if (isIntermediateImageLike(item)) {
    return cloneImage(item)
  }
  return cloneText(item)
}

function clonePage(page) {
  // 优先保留 content 数组（DOM 顺序），同时保留 texts/images 供旧版读取
  const content = Array.isArray(page.content)
    ? page.content.map(cloneContentItem)
    : undefined
  return {
    id: page.id,
    number: page.number,
    width: page.width,
    height: page.height,
    texts: (page.texts ?? []).map(cloneText),
    images: (page.images ?? []).map(cloneImage),
    // 向后兼容：content 字段保留 text+image 混排 DOM 顺序
    ...(content ? { content } : {}),
    thumbnail: page.thumbnail ?? undefined
  }
}

function resolveThumbnailQuality(options) {
  const thumbnailQuality = options?.thumbnailQuality
  return Number.isFinite(thumbnailQuality) && thumbnailQuality > 0
    ? thumbnailQuality
    : DEFAULT_THUMBNAIL_QUALITY
}

async function resolvePages(intermediate, options = {}) {
  const thumbnailQuality = resolveThumbnailQuality(options)
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
            ? content.filter((item) => isIntermediateTextLike(item))
            : typeof page.getTexts === 'function'
              ? await page.getTexts()
              : []
      const images =
        Array.isArray(content)
          ? content.filter((item) => isIntermediateImageLike(item))
          : []

      let thumbnail = page.thumbnail
      if (thumbnail == null && typeof page.getThumbnail === 'function') {
        thumbnail = await page.getThumbnail(thumbnailQuality)
      }

      return clonePage({
        id: page.id,
        number: page.number,
        width: page.width,
        height: page.height,
        content,
        texts,
        images,
        thumbnail
      })
    })
  )
}

export async function serializeIntermediate(intermediate, options = {}) {
  const outline =
    typeof intermediate.getOutline === 'function'
      ? (intermediate.getOutline() ?? [])
      : (intermediate.outline ?? [])

  return {
    id: intermediate.id,
    title: intermediate.title,
    outline: outline.map(cloneOutlineItem),
    pages: await resolvePages(intermediate, options)
  }
}

export function parseSerializedDocument(serialized) {
  const outline = Array.isArray(serialized.outline)
    ? serialized.outline.map(cloneOutlineItem)
    : []
  const pages = Array.isArray(serialized.pages)
    ? serialized.pages.map((page) => {
        const normalizedPage = clonePage(page)
        const texts = normalizedPage.texts.map(cloneText)
        const images = normalizedPage.images.map(cloneImage)
        // 优先使用 content 数组保持 DOM 顺序；否则回退 [...texts, ...images]
        const content = Array.isArray(normalizedPage.content)
          ? normalizedPage.content.map(cloneContentItem)
          : [...texts, ...images]
        const intermediatePage = new IntermediatePage({
          id: normalizedPage.id,
          number: normalizedPage.number,
          width: normalizedPage.width,
          height: normalizedPage.height,
          content,
          thumbnail: undefined
        })
        intermediatePage.setGetContent(async () => content.map(item =>
          isIntermediateImageLike(item) ? cloneImage(item) : cloneText(item)
        ))
        intermediatePage.setGetThumbnail(async () => normalizedPage.thumbnail)
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
