import {
  type IntermediateContentSerialized,
  IntermediateImage,
  type IntermediateImageSerialized,
  type IntermediatePageSerialized,
  IntermediateText,
  type IntermediateTextSerialized
} from '@hamster-note/types'

import {
  applyDecodeTextControl,
  type DecodeOptions
} from './decodeTextControl.js'
import { isIntermediateImageLike, isIntermediateTextLike } from './intermediateTextGuard.js'
import { cssStyleRecordToString, formatTextCssStyle } from './textCssStyle.js'
import { computeTextStyle } from './textStyle.js'

type SourceOrderedTextSerialized = IntermediateTextSerialized & {
  sourceOrder?: number
}

type SourceOrderedImageSerialized = IntermediateImageSerialized & {
  sourceOrder?: number
}

export type EncodeDocumentBuildInput = {
  id: string
  title: string
  pageWidth: number
  pageHeight: number
  texts: SourceOrderedTextSerialized[]
  images: SourceOrderedImageSerialized[]
}

export type EncodeDocumentBuildResult = {
  id: string
  title: string
  page: IntermediatePageSerialized
}

export type DecodeHtmlPagePayload = {
  id: string
  width: number
  height: number
  content: IntermediateContentSerialized[]
  backgroundSrc?: string
}

export type DecodeHtmlInput = {
  pages: DecodeHtmlPagePayload[]
  options?: DecodeOptions
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function cssPxOrPercent(val: number): string {
  if (!Number.isFinite(val)) return '0px'
  if (Math.abs(val) < 1) return `${(val * 100).toFixed(4)}%`
  return `${val}px`
}

function cssPx(val: number): string {
  // IntermediateImage 的 polygon/clip 坐标始终是像素空间，不能把 subpixel 当成 0-1 比例。
  if (!Number.isFinite(val)) return '0px'
  return `${val}px`
}

export function buildEncodeDocumentPayload(
  input: EncodeDocumentBuildInput
): EncodeDocumentBuildResult {
  const textContent = input.texts.map((text, index) => ({
    item: text,
    fallbackOrder: index,
    sourceOrder: text.sourceOrder
  }))
  const imageContent = input.images.map((image, index) => ({
    item: image,
    fallbackOrder: input.texts.length + index,
    sourceOrder: image.sourceOrder
  }))
  const content: IntermediateContentSerialized[] = [
    ...textContent,
    ...imageContent
  ]
    .sort((left, right) => {
      const leftOrder = typeof left.sourceOrder === 'number'
        ? left.sourceOrder
        : left.fallbackOrder
      const rightOrder = typeof right.sourceOrder === 'number'
        ? right.sourceOrder
        : right.fallbackOrder

      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return left.fallbackOrder - right.fallbackOrder
    })
    .map(({ item }) => {
      if ('src' in item) {
        // 内部 sourceOrder 只参与 mixed content 排序，不能泄漏到 @hamster-note/types 序列化契约。
        return {
          id: item.id,
          src: item.src,
          polygon: item.polygon,
          opacity: item.opacity,
          clip: item.clip
        }
      }

      return {
        id: item.id,
        content: item.content,
        fontSize: item.fontSize,
        fontFamily: item.fontFamily,
        fontWeight: item.fontWeight,
        italic: item.italic,
        color: item.color,
        polygon: item.polygon,
        lineHeight: item.lineHeight,
        ascent: item.ascent,
        descent: item.descent,
        vertical: item.vertical,
        dir: item.dir,
        opacity: item.opacity,
        skew: item.skew,
        isEOL: item.isEOL
      }
    })
  const page: IntermediatePageSerialized = {
    id: `${input.id}-page-1`,
    number: 1,
    width: input.pageWidth,
    height: input.pageHeight,
    content
  }

  return {
    id: input.id,
    title: input.title,
    page
  }
}

function getFragmentStyle(): string {
  return `
      .hamster-note-document { position: relative; display: block; contain: layout style size; }
      .hamster-note-document .hamster-note-page { position: relative; overflow: hidden; background-repeat: no-repeat; background-position: top center; background-size: contain; }
      .hamster-note-document .hamster-note-text { position: absolute; white-space: pre; transform-origin: 0 0; }
      .hamster-note-document .hamster-note-image { position: absolute; }
      .hamster-note-image { z-index: 1; }
      .hamster-note-text { z-index: 2; }
    `.replace(/\n\s+/g, ' ')
}

function parseSerializedContent(
  item: IntermediateContentSerialized
): IntermediateText | IntermediateImage {
  if ('src' in item && typeof item.src === 'string') {
    return IntermediateImage.parse(item)
  }

  return IntermediateText.parse(item as IntermediateTextSerialized)
}

function renderTextSpan(
  text: IntermediateText,
  options?: DecodeOptions
): string {
  const controlledText = applyDecodeTextControl(text, options?.textControl)
  const style = cssStyleRecordToString(
    formatTextCssStyle(computeTextStyle(controlledText))
  )
  return `<span class="hamster-note-text" id="${escapeHtml(controlledText.id)}" style="${escapeHtml(style)}">${escapeHtml(controlledText.content)}</span>`
}

type ImageBoundingBox = {
  left: number
  top: number
  width: number
  height: number
}

function computeImageBoundingBox(
  polygon: IntermediateImage['polygon']
): ImageBoundingBox {
  // 前景图片 v1 只使用轴对齐 bbox；旋转/倾斜 polygon 自动降级到外接矩形。
  const xs = polygon.map(([x]) => x)
  const ys = polygon.map(([, y]) => y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)

  return {
    left,
    top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top
  }
}

function renderImageElement(image: IntermediateImage): string {
  const bbox = computeImageBoundingBox(image.polygon)
  const styleEntries = [
    ['position', 'absolute'],
    ['left', cssPx(bbox.left)],
    ['top', cssPx(bbox.top)],
    ['width', cssPx(bbox.width)],
    ['height', cssPx(bbox.height)],
    ['opacity', String(image.opacity ?? 1)],
    ['object-fit', 'fill']
  ]

  if (image.clip) {
    const insetTop = image.clip.y
    const insetRight = bbox.width - image.clip.x - image.clip.width
    const insetBottom = bbox.height - image.clip.y - image.clip.height
    const insetLeft = image.clip.x
    styleEntries.push([
      'clip-path',
      `inset(${cssPx(insetTop)} ${cssPx(insetRight)} ${cssPx(insetBottom)} ${cssPx(insetLeft)})`
    ])
  }

  const style = cssStyleRecordToString(Object.fromEntries(styleEntries))

  return `<img class="hamster-note-image" id="${escapeHtml(image.id)}" src="${escapeHtml(image.src)}" style="${escapeHtml(style)}" />`
}

function renderPageDiv(
  page: DecodeHtmlPagePayload,
  options?: DecodeOptions
): string {
  const renderedContent = page.content
    .map(parseSerializedContent)
    .map((item) => {
      if (isIntermediateTextLike(item)) return renderTextSpan(item, options)
      if (isIntermediateImageLike(item)) return renderImageElement(item)
      return renderImageElement(item)
    })
    .join('')

  if (options?.background?.includeBackground === false) {
    return `<div class="hamster-note-page" id="${escapeHtml(page.id)}" style="${escapeHtml(`width:${cssPxOrPercent(page.width)};height:${cssPxOrPercent(page.height)}`)}">${renderedContent}</div>`
  }

  const bg = page.backgroundSrc
    ? `background-image:url('${page.backgroundSrc}');`
    : ''
  return `<div class="hamster-note-page" id="${escapeHtml(page.id)}" style="${escapeHtml(`width:${cssPxOrPercent(page.width)};height:${cssPxOrPercent(page.height)};${bg}`)}">${renderedContent}</div>`
}

export function renderDecodeHtmlFromPayload(input: DecodeHtmlInput): string {
  const pageHtml = input.pages
    .map((page) => renderPageDiv(page, input.options))
    .join('')
  return `<div class="hamster-note-document"><style>${getFragmentStyle()}</style>${pageHtml}</div>`
}

export function serializeWorkerContentItem(
  item: unknown
): IntermediateContentSerialized | undefined {
  if (isIntermediateImageLike(item)) {
    return IntermediateImage.serialize(item)
  }

  if (isIntermediateTextLike(item)) {
    return IntermediateText.serialize(item)
  }

  return undefined
}
