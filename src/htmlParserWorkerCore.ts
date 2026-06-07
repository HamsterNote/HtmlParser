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

export type EncodeDocumentBuildInput = {
  id: string
  title: string
  pageWidth: number
  pageHeight: number
  texts: IntermediateTextSerialized[]
  images: IntermediateImageSerialized[]
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

export function buildEncodeDocumentPayload(
  input: EncodeDocumentBuildInput
): EncodeDocumentBuildResult {
  const page: IntermediatePageSerialized = {
    id: `${input.id}-page-1`,
    number: 1,
    width: input.pageWidth,
    height: input.pageHeight,
    content: [...input.texts, ...input.images]
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

function renderPageDiv(
  page: DecodeHtmlPagePayload,
  options?: DecodeOptions
): string {
  const content = page.content.map(parseSerializedContent)
  const texts = content
    .filter(isIntermediateTextLike)
    .map((text) => renderTextSpan(text, options))
    .join('')

  if (options?.background?.includeBackground === false) {
    return `<div class="hamster-note-page" id="${escapeHtml(page.id)}" style="${escapeHtml(`width:${cssPxOrPercent(page.width)};height:${cssPxOrPercent(page.height)}`)}">${texts}</div>`
  }

  const bg = page.backgroundSrc
    ? `background-image:url('${page.backgroundSrc}');`
    : ''
  return `<div class="hamster-note-page" id="${escapeHtml(page.id)}" style="${escapeHtml(`width:${cssPxOrPercent(page.width)};height:${cssPxOrPercent(page.height)};${bg}`)}">${texts}</div>`
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
