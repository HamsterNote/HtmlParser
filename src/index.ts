/**
 * HtmlParser
 * --------------------------------------
 * 本文件实现了 HTML 到中间结构（IntermediateDocument）的解析（encode），
 * 以及从中间结构回写为 HTML 片段或单文件 HTML（decode / decodeToHtml）。
 *
 * 设计要点：
 * - 统一的静态方法 API：encode(fileOrBuffer), decode(doc), decodeToHtml(doc)
 * - encode：读取 HTML 文本，通过临时 iframe 文档做极简提取，
 *   仅采集文本节点与少量字体样式，推断一个粗略布局（x/y/width/height）。
 * - decodeToHtml：把中间结构的文本恢复为可渲染的 HTML 片段（不含 <html>/<body>）。
 * - decode：在 decodeToHtml 的基础上，拼装成可独立打开的单文件 HTML。
 *
 * 注意：本解析器偏"轻量/近似"，并非完整/严格的 HTML 布局渲染。
 */
import { DocumentParser, type ParserInput } from '@hamster-note/document-parser'
import {
  IntermediateDocument,
  IntermediatePage,
  IntermediatePageMap,
  IntermediateText,
  TextDir
} from '@hamster-note/types'
import { devConsoleError, devConsoleLog } from './devLog.js'
import { HtmlDocument } from './HtmlDocument'
import { buildOffscreenPageElement, type OffscreenPageHandle } from './pageThumbnailDom.js'
import {
  cssStyleRecordToString,
  formatTextCssStyle
} from './textCssStyle.js'
import { measureTextBaseline } from './textMeasurement.js'
import { computeTextStyle } from './textStyle.js'

const ELEMENT_NODE = 1
const TEXT_NODE = 3

type IframeHostDocument = Pick<Document, 'createElement' | 'body' | 'documentElement'>

let iframeHostDocumentOverride: IframeHostDocument | null = null

export const setIframeHostDocument = (
  documentOverride: IframeHostDocument | null
): void => {
  iframeHostDocumentOverride = documentOverride
}

function resolveIframeHostDocument(): IframeHostDocument | null {
  if (iframeHostDocumentOverride) return iframeHostDocumentOverride

  if (
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function' ||
    typeof document.body === 'undefined'
  ) {
    return null
  }

  return document
}

// --- html2canvas lazy-loader injection seam ---

export type Html2CanvasLike = (
  element: HTMLElement,
  options?: Record<string, unknown>
) => Promise<{ toDataURL(type?: string): string }>
export type Html2CanvasLoader = () => Promise<Html2CanvasLike>

let html2canvasLoaderOverride: Html2CanvasLoader | null = null
export const setHtml2CanvasLoader = (loader: Html2CanvasLoader | null): void => {
  html2canvasLoaderOverride = loader
}
/** Internal: returns either the override or a dynamic import of html2canvas. */
export const __getHtml2CanvasLoader = (): Html2CanvasLoader =>
  html2canvasLoaderOverride
    ?? (async () => {
      const mod = await import('html2canvas')
      // html2canvas ships as default export
      return ((mod as unknown as { default?: Html2CanvasLike }).default
        ?? (mod as unknown as Html2CanvasLike))
    })

function buildLazyThumbnailFn(
  page: IntermediatePage,
  texts: IntermediateText[],
  width: number,
  height: number
): (scale?: number) => Promise<string | undefined> {
  let cachedDataUrl: string | undefined
  let cachedScale: number | undefined
  let inFlight: Promise<string | undefined> | null = null
  let inFlightScale: number | undefined

  return async (scale?: number): Promise<string | undefined> => {
    const effectiveScale = Math.max(scale ?? 0.3, 0.3)

    if (cachedDataUrl && cachedScale !== undefined && cachedScale >= effectiveScale) {
      return cachedDataUrl
    }

    if (inFlight && inFlightScale !== undefined && inFlightScale >= effectiveScale) {
      return inFlight
    }

    const localScale = effectiveScale
    let localPromise: Promise<string | undefined> = Promise.resolve(undefined)
    localPromise = (async () => {
      await Promise.resolve()
      let handle: OffscreenPageHandle | undefined
      try {
        const doc = globalThis.document
        if (!doc) {
          devConsoleLog('[encode] thumbnail capture skipped: document unavailable')
          return undefined
        }
        handle = buildOffscreenPageElement(
          { id: page.id, width, height, texts },
          doc
        )
        const loader = __getHtml2CanvasLoader()
        const html2canvas = await loader()
        const canvas = await html2canvas(handle.element, {
          backgroundColor: '#ffffff',
          scale: localScale,
          useCORS: true
        })
        const dataUrl = canvas.toDataURL('image/png')
        if (cachedScale === undefined || localScale >= cachedScale) {
          cachedDataUrl = dataUrl
          cachedScale = localScale
          ;(page as unknown as { _thumbnail?: string })._thumbnail = dataUrl
        }
        return dataUrl
      } catch (err) {
        devConsoleLog('[encode] thumbnail capture failed', err)
        return undefined
      } finally {
        handle?.cleanup()
        if (inFlight === localPromise) {
          inFlight = null
          inFlightScale = undefined
        }
      }
    })()

    inFlight = localPromise
    inFlightScale = localScale
    return localPromise
  }
}

/**
 * 转义文本为安全的 HTML 文本（避免注入）。
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 将数值转换为 CSS 长度：
 * - 绝对值 < 1 认为是百分比（例如 0.5 -> 50%）
 * - 否则使用像素 px
 */
function cssPxOrPercent(val: number): string {
  if (Math.abs(val) < 1) return `${(val * 100).toFixed(4)}%`
  return `${val}px`
}

/**
 * 粗略判断文本方向（RTL/LTR）。
 * 仅基于字符范围做启发式判断。
 */
function detectDir(text: string): TextDir {
  // 粗糙的 RTL 检测规则
  const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/
  if (rtlRegex.test(text)) return TextDir.RTL
  return TextDir.LTR
}

function splitInlineStyleDeclarations(styleText: string): string[] {
  const declarations: string[] = []
  let current = ''
  let quote: '"' | '\'' | null = null
  let parenDepth = 0

  for (let index = 0; index < styleText.length; index++) {
    const char = styleText[index]

    if (quote) {
      current += char
      if (char === quote && styleText[index - 1] !== '\\') {
        quote = null
      }
      continue
    }

    if (char === '"' || char === '\'') {
      quote = char
      current += char
      continue
    }

    if (char === '(') {
      parenDepth++
      current += char
      continue
    }

    if (char === ')' && parenDepth > 0) {
      parenDepth--
      current += char
      continue
    }

    if (char === ';' && parenDepth === 0) {
      const declaration = current.trim()
      if (declaration) declarations.push(declaration)
      current = ''
      continue
    }

    current += char
  }

  const trailingDeclaration = current.trim()
  if (trailingDeclaration) declarations.push(trailingDeclaration)
  return declarations
}

function findInlineStyleValueSeparator(declaration: string): number {
  let quote: '"' | '\'' | null = null
  let parenDepth = 0

  for (let index = 0; index < declaration.length; index++) {
    const char = declaration[index]

    if (quote) {
      if (char === quote && declaration[index - 1] !== '\\') {
        quote = null
      }
      continue
    }

    if (char === '"' || char === '\'') {
      quote = char
      continue
    }

    if (char === '(') {
      parenDepth++
      continue
    }

    if (char === ')' && parenDepth > 0) {
      parenDepth--
      continue
    }

    if (char === ':' && parenDepth === 0) {
      return index
    }
  }

  return -1
}

type ParsedInlineStyle = {
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  italic?: boolean
  color?: string
  lineHeight?: number
  writingMode?: 'horizontal-tb' | 'vertical-rl'
}

function buildInlineStyleMap(styleText: string | null): Map<string, string> {
  if (!styleText) return new Map()

  const result = splitInlineStyleDeclarations(styleText).reduce((acc, decl) => {
    const separator = findInlineStyleValueSeparator(decl)
    if (separator === -1) return acc

    const key = decl.slice(0, separator).trim().toLowerCase()
    const value = decl.slice(separator + 1).trim()

    if (key && value) acc.set(key, value)
    return acc
  }, new Map<string, string>())
  devConsoleLog('[buildInlineStyleMap] 解析 style 属性', { styleText, entries: Array.from(result.entries()) })
  return result
}

function parseFontSizeValue(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  if (raw.endsWith('px')) return Number(raw.replace('px', ''))

  if (raw.endsWith('em')) {
    const val = Number(raw.replace('em', ''))
    return Number.isNaN(val) || val === 0 ? 1 : val
  }

  return undefined
}

function parseLineHeightValue(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  if (raw.endsWith('px')) return Number(raw.replace('px', ''))

  if (raw.endsWith('em')) {
    const val = Number(raw.replace('em', ''))
    return Number.isNaN(val) || val === 0 ? 1.2 : val
  }

  const numeric = Number(raw)
  return Number.isNaN(numeric) ? undefined : numeric
}

function parseFontWeightValue(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  if (raw === 'bold') return 700
  if (raw === 'normal') return 400

  const numeric = Number(raw)
  return Number.isNaN(numeric) || numeric === 0 ? 400 : numeric
}

function parseItalicValue(raw: string | undefined): boolean | undefined {
  if (!raw) return undefined
  return /italic|oblique/i.test(raw)
}

function parseWritingModeValue(
  raw: string | undefined
): 'horizontal-tb' | 'vertical-rl' | undefined {
  if (!raw) return undefined
  return /^vertical-/i.test(raw) ? 'vertical-rl' : 'horizontal-tb'
}

const ITALIC_TAGS = new Set(['EM', 'I'])

function parseInlineTagStyle(el: Element): ParsedInlineStyle {
  const tagName = el.tagName.toUpperCase()
  if (ITALIC_TAGS.has(tagName)) return { italic: true }
  return {}
}

function parseComputedItalicValue(el: Element): boolean | undefined {
  const view = el.ownerDocument?.defaultView
  const getComputedStyle = view?.getComputedStyle ?? globalThis.getComputedStyle
  if (!getComputedStyle) return undefined
  try {
    const fontStyle = getComputedStyle(el).fontStyle
    return parseItalicValue(fontStyle)
    } catch {
      return undefined
    }
}

function setInlineStyleValue<K extends keyof ParsedInlineStyle>(
  target: ParsedInlineStyle,
  key: K,
  value: ParsedInlineStyle[K] | undefined
): void {
  if (value != null) {
    target[key] = value
  }
}

function mergeInlineStyleValue<K extends keyof ParsedInlineStyle>(
  target: ParsedInlineStyle,
  source: ParsedInlineStyle,
  key: K
): void {
  if (target[key] == null) {
    setInlineStyleValue(target, key, source[key])
  }
}

/**
 * 解析元素的行内样式，并抽取与文本排版相关的少量字段。
 * 仅解析 style="..."，不会读取计算样式或样式表。
 */
function parseInlineStyle(el: Element): ParsedInlineStyle {
  devConsoleLog('[parseInlineStyle] 解析元素行内样式', { tagName: el.tagName, style: el.getAttribute('style')?.slice(0, 100) })
  const map = buildInlineStyleMap(el.getAttribute('style'))
  const result: ParsedInlineStyle = parseInlineTagStyle(el)

  const entries: Array<
    [keyof ParsedInlineStyle, ParsedInlineStyle[keyof ParsedInlineStyle]]
  > = [
    ['fontSize', parseFontSizeValue(map.get('font-size'))],
    ['lineHeight', parseLineHeightValue(map.get('line-height'))],
    ['fontWeight', parseFontWeightValue(map.get('font-weight'))],
    ['italic', parseItalicValue(map.get('font-style'))],
    ['color', map.get('color')],
    ['fontFamily', map.get('font-family')],
    ['writingMode', parseWritingModeValue(map.get('writing-mode'))]
  ]

  entries.forEach(([key, value]) => {
    setInlineStyleValue(result, key, value)
  })

  if (result.italic == null) {
    const computedItalic = parseComputedItalicValue(el)
    if (computedItalic === true) {
      setInlineStyleValue(result, 'italic', true)
    }
  }

  devConsoleLog('[parseInlineStyle] 解析结果', result)
  return result
}

type PendingTextSegment = {
  content: string
  style: {
    fontSize: number
    lineHeight: number
    fontWeight: number
    italic: boolean
    color: string
    fontFamily: string
    writingMode: 'horizontal-tb' | 'vertical-rl'
    transform: string
    transformOrigin: string
  }
  metrics: {
    width: number
    height: number
    ascent: number
    descent: number
  }
}

type ComputedTextStyle = PendingTextSegment['style']

type RectLike = {
  left: number
  top: number
  width: number
  height: number
}

type RenderedTextSegment = {
  content: string
  style: ComputedTextStyle
  rect: RectLike
}

type Matrix2D = {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

const IDENTITY_MATRIX: Matrix2D = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0
}

function normalizeTextContent(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function isValidRect(rect: RectLike | null | undefined): rect is RectLike {
  if (!rect) return false
  return [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
    && rect.width > 0
    && rect.height > 0
}

function estimateFontMetrics(
  fontSize: number,
  rectHeight: number
): { ascent: number; descent: number } {
  const height = Math.max(rectHeight, fontSize, 1)
  const ascent = Math.max(1, Math.round(Math.min(height, fontSize * 0.8)))
  const descent = Math.max(1, Math.round(height - ascent))
  return { ascent, descent }
}

function multiplyMatrix2D(left: Matrix2D, right: Matrix2D): Matrix2D {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f
  }
}

function parseTransformNumber(raw: string): number {
  const numeric = Number.parseFloat(raw)
  return Number.isFinite(numeric) ? numeric : 0
}

function parseTransformLength(
  raw: string,
  percentBasis = 0
): number {
  if (!raw) return 0
  if (raw.endsWith('%')) {
    const ratio = Number.parseFloat(raw) / 100
    return Number.isFinite(ratio) ? percentBasis * ratio : 0
  }
  return parseTransformNumber(raw)
}

function parseTransformAngle(raw: string): number {
  if (!raw) return 0
  const numeric = parseTransformNumber(raw)
  if (raw.endsWith('rad')) return numeric * 180 / Math.PI
  if (raw.endsWith('turn')) return numeric * 360
  return numeric
}

function createTranslationMatrix(tx: number, ty: number): Matrix2D {
  return { ...IDENTITY_MATRIX, e: tx, f: ty }
}

function createScaleMatrix(scaleX: number, scaleY: number): Matrix2D {
  return { a: scaleX, b: 0, c: 0, d: scaleY, e: 0, f: 0 }
}

function createRotateMatrix(angleDeg: number): Matrix2D {
  const radians = angleDeg * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: 0,
    f: 0
  }
}

function parseTransformMatrix(
  transform: string,
  width: number,
  height: number
): Matrix2D {
  if (!transform || transform === 'none') return IDENTITY_MATRIX

  const operations = Array.from(transform.matchAll(/([a-zA-Z0-9]+)\(([^)]*)\)/g))
  if (!operations.length) return IDENTITY_MATRIX

  return operations.reduce<Matrix2D>((matrix, [, name, argString]) => {
    const args = argString.split(',').map((arg) => arg.trim()).filter(Boolean)

    switch (name) {
      case 'matrix': {
        if (args.length !== 6) return matrix
        const [a, b, c, d, e, f] = args.map(parseTransformNumber)
        return multiplyMatrix2D(matrix, { a, b, c, d, e, f })
      }
      case 'translate': {
        const tx = parseTransformLength(args[0] ?? '0', width)
        const ty = parseTransformLength(args[1] ?? '0', height)
        return multiplyMatrix2D(matrix, createTranslationMatrix(tx, ty))
      }
      case 'translateX':
        return multiplyMatrix2D(
          matrix,
          createTranslationMatrix(parseTransformLength(args[0] ?? '0', width), 0)
        )
      case 'translateY':
        return multiplyMatrix2D(
          matrix,
          createTranslationMatrix(0, parseTransformLength(args[0] ?? '0', height))
        )
      case 'scale': {
        const scaleX = parseTransformNumber(args[0] ?? '1')
        const scaleY = args[1] != null ? parseTransformNumber(args[1]) : scaleX
        return multiplyMatrix2D(matrix, createScaleMatrix(scaleX, scaleY))
      }
      case 'scaleX':
        return multiplyMatrix2D(matrix, createScaleMatrix(parseTransformNumber(args[0] ?? '1'), 1))
      case 'scaleY':
        return multiplyMatrix2D(matrix, createScaleMatrix(1, parseTransformNumber(args[0] ?? '1')))
      case 'rotate':
        return multiplyMatrix2D(matrix, createRotateMatrix(parseTransformAngle(args[0] ?? '0deg')))
      default:
        return matrix
    }
  }, IDENTITY_MATRIX)
}

function resolveTransformOriginValue(
  raw: string,
  size: number,
  axis: 'x' | 'y'
): number {
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return 0

  if (normalized.endsWith('%')) {
    const ratio = Number.parseFloat(normalized) / 100
    return Number.isFinite(ratio) ? size * ratio : 0
  }

  if (axis === 'x') {
    if (normalized === 'left') return 0
    if (normalized === 'center') return size / 2
    if (normalized === 'right') return size
  } else {
    if (normalized === 'top') return 0
    if (normalized === 'center') return size / 2
    if (normalized === 'bottom') return size
  }

  const numeric = parseTransformLength(normalized)
  return Number.isFinite(numeric) ? numeric : 0
}

function parseTransformOrigin(
  raw: string,
  width: number,
  height: number
): { x: number; y: number } {
  const parts = raw.trim().split(/\s+/).filter(Boolean)
  return {
    x: resolveTransformOriginValue(parts[0] ?? '0px', width, 'x'),
    y: resolveTransformOriginValue(parts[1] ?? '50%', height, 'y')
  }
}

function applyMatrixToPoint(
  matrix: Matrix2D,
  x: number,
  y: number,
  originX: number,
  originY: number
): [number, number] {
  const localX = x - originX
  const localY = y - originY
  return [
    matrix.a * localX + matrix.c * localY + matrix.e + originX,
    matrix.b * localX + matrix.d * localY + matrix.f + originY
  ]
}

function buildSegmentPolygon(
  segment: RenderedTextSegment,
  originX: number,
  originY: number
): [[number, number], [number, number], [number, number], [number, number]] {
  const fallbackWidth = Math.max(
    1,
    Math.round(segment.content.length * segment.style.fontSize * 0.6)
  )
  const fallbackHeight = Math.max(1, Math.round(segment.style.lineHeight))
  let metrics = { width: fallbackWidth, height: fallbackHeight }

  try {
    const measured = measureTextBaseline(
      segment.content,
      segment.style.fontSize,
      segment.style.fontFamily,
      segment.style.fontWeight,
      segment.style.italic,
      Number.MAX_SAFE_INTEGER,
      segment.style.lineHeight
    )
    metrics = {
      width: Math.max(1, measured.width),
      height: Math.max(1, measured.height)
    }
  } catch {
    metrics = { width: fallbackWidth, height: fallbackHeight }
  }

  const width = Math.max(1, metrics.width)
  const height = Math.max(1, metrics.height)
  const matrix = parseTransformMatrix(segment.style.transform, width, height)
  const { x: transformOriginX, y: transformOriginY } = parseTransformOrigin(
    segment.style.transformOrigin,
    width,
    height
  )
  const corners: Array<[number, number]> = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
  ]
  const transformedCorners = corners.map(([x, y]) =>
    applyMatrixToPoint(matrix, x, y, transformOriginX, transformOriginY)
  )
  const minX = Math.min(...transformedCorners.map(([x]) => x))
  const minY = Math.min(...transformedCorners.map(([, y]) => y))
  const baseX = segment.rect.left - minX - originX
  const baseY = segment.rect.top - minY - originY

  return transformedCorners.map(([x, y]) => [x + baseX, y + baseY] as [number, number]) as [[number, number], [number, number], [number, number], [number, number]]
}

function parseComputedPixelValue(
  raw: string,
  fallback: number
): number {
  if (!raw || raw === 'normal') return fallback
  const numeric = Number.parseFloat(raw)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function parseComputedFontWeight(raw: string): number {
  if (raw === 'bold') return 700
  if (raw === 'normal') return 400
  const numeric = Number.parseFloat(raw)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 400
}

function getTextSliceRect(
  node: Text,
  start: number,
  end: number
): DOMRect | null {
  const doc = node.ownerDocument
  const range = doc.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)

  try {
    const rect = range.getBoundingClientRect?.()
    return rect ?? null
  } finally {
    range.detach?.()
  }
}

function findMatchingLineRectIndex(
  rect: DOMRect,
  lineRects: RectLike[]
): number {
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY

  lineRects.forEach((lineRect, index) => {
    const distance = Math.abs(lineRect.top - rect.top)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })

  return bestIndex
}

function collectWrappedLineSegments(
  node: Text,
  raw: string,
  nodeRects: RectLike[]
): Array<{ content: string; rect: RectLike }> {
  const lineRects = nodeRects.filter((rect) => isValidRect(rect))
  if (lineRects.length <= 1) return []

  const ranges = new Map<number, { start: number; end: number }>()

  for (let index = 0; index < raw.length; index++) {
    const char = raw[index]
    if (!char || /\s/.test(char)) continue

    const rect = getTextSliceRect(node, index, index + 1)
    if (!isValidRect(rect)) continue

    const lineIndex = findMatchingLineRectIndex(rect, lineRects)
    const currentRange = ranges.get(lineIndex)

    if (!currentRange) {
      ranges.set(lineIndex, { start: index, end: index + 1 })
      continue
    }

    currentRange.start = Math.min(currentRange.start, index)
    currentRange.end = Math.max(currentRange.end, index + 1)
  }

  return lineRects
    .map((rect, lineIndex) => {
      const range = ranges.get(lineIndex)
      if (!range) return null

      const content = normalizeTextContent(raw.slice(range.start, range.end))
      if (!content) return null

      return {
        content,
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        }
      }
    })
    .filter((segment): segment is { content: string; rect: RectLike } => segment != null)
}

export class HtmlParser extends DocumentParser {
  static readonly exts = ['html'] as const
  static readonly ext = 'html'

  /**
   * 实例方法实现：将输入解析为 IntermediateDocument。
   */
  async encode(input: ParserInput): Promise<IntermediateDocument> {
    devConsoleLog('[encode] 实例方法开始', { inputType: input.constructor.name })
    const doc = await HtmlParser.encode(input)
    devConsoleLog('[encode] 实例方法完成，获取 IntermediateDocument')
    return doc.getIntermediateDocument()
  }

  /**
   * 实例方法实现：将中间文档回写为文件数据。
   */
  async decode(
    intermediateDocument: IntermediateDocument
  ): Promise<ParserInput> {
    devConsoleLog('[decode] 实例方法开始', { docId: intermediateDocument.id })
    return HtmlParser.decode(intermediateDocument)
  }

  // 复用的内部样式片段
  private static getFragmentStyle(): string {
    return `
      .hamster-note-document { position: relative; display: block; contain: layout style size; }
      .hamster-note-document .hamster-note-page { position: relative; overflow: hidden; background-repeat: no-repeat; background-position: top center; background-size: contain; }
      .hamster-note-document .hamster-note-text { position: absolute; white-space: pre; transform-origin: 0 0; }
    `.replace(/\n\s+/g, ' ')
  }

  // 复用的单个文本渲染
  private static renderTextSpan(t: IntermediateText): string {
    const style = cssStyleRecordToString(formatTextCssStyle(computeTextStyle(t)))
    return `<span class="hamster-note-text" id="${escapeHtml(t.id)}" style="${escapeHtml(style)}">${escapeHtml(t.content)}</span>`
  }

  // 复用的页面渲染
  private static async lazyRenderPageDiv(p: IntermediatePage): Promise<string> {
    const texts = p.texts.map((t) => HtmlParser.renderTextSpan(t)).join('')
    const thumb = await p.getThumbnail(0.3)
    const bg = thumb ? `background-image:url('${thumb}');` : ''
    return `<div class="hamster-note-page" id="${escapeHtml(p.id)}" style="${escapeHtml(`width:${cssPxOrPercent(p.width)};height:${cssPxOrPercent(p.height)};${bg}`)}">${texts}</div>`
  }

  /**
   * 将二进制 HTML 内容解码为 UTF-8 字符串。
   */
  private static decodeBufferToString(buffer: ArrayBuffer): string | undefined {
    try {
      return new TextDecoder('utf-8').decode(buffer)
    } catch {
      return undefined
    }
  }

  /**
   * 从某个文本节点向上（父节点链）采集行内样式，仅在当前字段未被填充时才采用祖先的值。
   * 注意：仅解析 style="..."，不读取计算样式，属于启发式近似。
   */
  private static collectAncestorInlineStyle(
    node: Node,
    defaults: { fontSize: number; lineHeight: number }
  ): ComputedTextStyle {
    devConsoleLog('[collectAncestorInlineStyle] 开始采集祖先样式')
    const collected: ReturnType<typeof parseInlineStyle> = {}
    let cur: Node | null = node.parentNode
    const inlineFields: Array<keyof ParsedInlineStyle> = [
      'fontSize',
      'lineHeight',
      'fontWeight',
      'italic',
      'color',
      'fontFamily',
      'writingMode'
    ]

    const mergeInlineStyle = (
      target: ReturnType<typeof parseInlineStyle>,
      source: ReturnType<typeof parseInlineStyle>
    ): void => {
      inlineFields.forEach((field) => {
        mergeInlineStyleValue(target, source, field)
      })
    }

    let depth = 0
    while (cur && cur.nodeType === ELEMENT_NODE) {
      const el = cur as Element
      const parsed = parseInlineStyle(el)
      devConsoleLog(`[collectAncestorInlineStyle] 第 ${depth} 层祖先`, { tagName: el.tagName, parsed })
      mergeInlineStyle(collected, parsed)
      cur = el.parentElement
      depth++
    }
    const fontSize = collected.fontSize ?? defaults.fontSize
    const lineHeight = collected.lineHeight ?? fontSize * defaults.lineHeight
    const result = {
      fontSize,
      lineHeight,
      fontWeight: collected.fontWeight ?? 400,
      italic: !!collected.italic,
      color: collected.color || '#000',
      fontFamily: collected.fontFamily || '',
      writingMode: collected.writingMode ?? 'horizontal-tb',
      transform: 'none',
      transformOrigin: '0px 50%'
    }
    devConsoleLog('[collectAncestorInlineStyle] 采集完成', { depth, result })
    return result
  }

  /**
   * 基于启发式估算文本的尺寸信息，作为文本测量不可用时的兜底。
   */
  private static estimateTextMetrics(
    content: string,
    fontSize: number,
    lineHeight: number
  ): { width: number; height: number; ascent: number; descent: number } {
    const width = Math.max(1, Math.round(content.length * fontSize * 0.6))
    const height = Math.max(1, Math.round(lineHeight))
    const ascent = Math.round(fontSize * 0.8)
    const descent = Math.round(fontSize * 0.2)
    return { width, height, ascent, descent }
  }

  private static measureTextMetrics(
    content: string,
    fontSize: number,
    fontFamily: string,
    fontWeight: number,
    italic: boolean,
    lineHeight: number
  ): { width: number; height: number; ascent: number; descent: number } {
    devConsoleLog('[measureTextMetrics] 开始测量文本', { content: content.slice(0, 30), fontSize, fontFamily, fontWeight, italic, lineHeight })
    const fallback = HtmlParser.estimateTextMetrics(content, fontSize, lineHeight)

    try {
      const measured = measureTextBaseline(
        content,
        fontSize,
        fontFamily,
        fontWeight,
        italic,
        Number.MAX_SAFE_INTEGER,
        lineHeight
      )
      const width = Math.round(measured.width)
      const height = Math.round(measured.height)

      const result = {
        width: Number.isFinite(width) && width > 0 ? width : fallback.width,
        height: Number.isFinite(height) && height > 0 ? height : fallback.height,
        ascent: fallback.ascent,
        descent: fallback.descent
      }
      devConsoleLog('[measureTextMetrics] pretext 测量成功', result)
      return result
    } catch (e) {
      devConsoleLog('[measureTextMetrics] pretext 测量失败，使用启发式估算', { error: e, fallback })
      return fallback
    }
  }

  private static getComputedTextStyle(
    element: Element,
    defaults: { fontSize: number; lineHeight: number }
  ): ComputedTextStyle {
    const view = element.ownerDocument?.defaultView
    const getComputedStyle = view?.getComputedStyle ?? globalThis.getComputedStyle

    if (!getComputedStyle) {
      return HtmlParser.collectAncestorInlineStyle(element, defaults)
    }

    try {
      const style = getComputedStyle(element)
      const fontSize = parseComputedPixelValue(style.fontSize, defaults.fontSize)
      const lineHeight = parseComputedPixelValue(
        style.lineHeight,
        fontSize * defaults.lineHeight
      )

      return {
        fontSize,
        lineHeight,
        fontWeight: parseComputedFontWeight(style.fontWeight),
        italic: /italic|oblique/i.test(style.fontStyle),
        color: style.color || '#000',
        fontFamily: style.fontFamily || '',
        writingMode: parseWritingModeValue(style.writingMode) ?? 'horizontal-tb',
        transform: style.transform || 'none',
        transformOrigin: style.transformOrigin || '0px 50%'
      }
    } catch {
      return HtmlParser.collectAncestorInlineStyle(element, defaults)
    }
  }

  private static getNodeRangeRects(node: Text): DOMRect[] {
    const doc = node.ownerDocument
    const range = doc.createRange()
    range.selectNodeContents(node)

    try {
      const rects = Array.from(range.getClientRects?.() ?? [])
      if (rects.length > 0) return rects

      const boundingRect = range.getBoundingClientRect?.()
      return boundingRect ? [boundingRect] : []
    } finally {
      range.detach?.()
    }
  }

  private static collectRenderedTextSegments(doc: Document): RenderedTextSegment[] {
    const body = doc.body
    const defaultFontSize = 16
    const defaultLineHeight = 1.2
    const skipTags = new Set(['SCRIPT', 'STYLE'])
    const nodeFilter = doc.defaultView?.NodeFilter ?? globalThis.NodeFilter
    if (!nodeFilter) return []
    const walker = doc.createTreeWalker(body, nodeFilter.SHOW_TEXT)
    const segments: RenderedTextSegment[] = []

    let currentNode = walker.nextNode()
    while (currentNode) {
      const textNode = currentNode as Text
      const parentElement = textNode.parentElement
      const raw = textNode.textContent || ''
      const normalized = normalizeTextContent(raw)

      if (!parentElement || !normalized) {
        currentNode = walker.nextNode()
        continue
      }

      if (skipTags.has(parentElement.tagName.toUpperCase())) {
        currentNode = walker.nextNode()
        continue
      }

      const style = HtmlParser.getComputedTextStyle(textNode.parentElement, {
        fontSize: defaultFontSize,
        lineHeight: defaultLineHeight
      })

      const nodeRects = HtmlParser.getNodeRangeRects(textNode)
      const hasMultipleRects = nodeRects.filter((rect) => isValidRect(rect)).length > 1

      if (hasMultipleRects) {
        const lineSegments = collectWrappedLineSegments(textNode, raw, nodeRects)
        lineSegments.forEach((lineSegment) => {
          segments.push({
            content: lineSegment.content,
            style,
            rect: {
              left: lineSegment.rect.left,
              top: lineSegment.rect.top,
              width: lineSegment.rect.width,
              height: lineSegment.rect.height
            }
          })
        })
      } else {
        const rect = nodeRects.find((candidate) => isValidRect(candidate))
        if (rect) {
          segments.push({
            content: normalized,
            style,
            rect: {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height
            }
          })
        }
      }

      currentNode = walker.nextNode()
    }

    return segments
  }

  private static buildRenderedTexts(
    doc: Document,
    id: string,
    segments: RenderedTextSegment[]
  ): { texts: IntermediateText[]; pageWidth: number; pageHeight: number } {
    const bodyRect = doc.body.getBoundingClientRect()
    const originX = Number.isFinite(bodyRect.left) ? bodyRect.left : 0
    const originY = Number.isFinite(bodyRect.top) ? bodyRect.top : 0
    const sortedSegments = [...segments].sort((left, right) => {
      const topDiff = left.rect.top - right.rect.top
      if (Math.abs(topDiff) > 1) return topDiff
      return left.rect.left - right.rect.left
    })

    const texts = sortedSegments.map((segment, index) => {
      const nextSegment = sortedSegments[index + 1]
      const isSameLine = nextSegment != null
        && Math.abs(nextSegment.rect.top - segment.rect.top) <= 1
      const polygon = buildSegmentPolygon(segment, originX, originY)
      const height = Math.max(1, Math.round(Math.hypot(
        polygon[2][0] - polygon[1][0],
        polygon[2][1] - polygon[1][1]
      )))

      const { ascent, descent } = estimateFontMetrics(segment.style.fontSize, height)

      return new IntermediateText({
        id: `${id}-page-1-text-${index}`,
        content: segment.content,
        fontSize: segment.style.fontSize,
        fontFamily: segment.style.fontFamily,
        fontWeight: segment.style.fontWeight,
        italic: segment.style.italic,
        color: segment.style.color,
        polygon,
        lineHeight: segment.style.lineHeight,
        ascent,
        descent,
        vertical: segment.style.writingMode === 'vertical-rl',
        dir: detectDir(segment.content),
        skew: 0,
        isEOL: !isSameLine
      })
    })

    const maxRight = texts.reduce((max, text) => Math.max(max, text.polygon[1][0]), 0)
    const maxBottom = texts.reduce((max, text) => Math.max(max, text.polygon[2][1]), 0)
    const pageWidth = Math.max(
      1,
      Math.round(
        Math.max(
          doc.documentElement.scrollWidth,
          doc.body.scrollWidth,
          maxRight
        )
      )
    )
    const pageHeight = Math.max(
      1,
      Math.round(
        Math.max(
          doc.documentElement.scrollHeight,
          doc.body.scrollHeight,
          maxBottom
        )
      )
    )

    return { texts, pageWidth, pageHeight }
  }

  /**
   * 临时创建隐藏 iframe 用于执行需要完整 DOM 环境的操作（如测量）。
   * 验证必需的 DOM API 是否存在，不存在则抛出错误。
   * @param html 要写入 iframe 的 HTML 内容
   * @param callback 文档就绪后的回调，接收 { iframe, iframeDocument, iframeWindow }
   */
  private static async withIframeDocument<T>(
    html: string,
    callback: (context: {
      iframe: HTMLIFrameElement
      iframeDocument: Document
      iframeWindow: Window
    }) => T | Promise<T>
  ): Promise<T> {
    // 验证必需的 DOM API
    const hostDocument = resolveIframeHostDocument()

    if (!hostDocument) {
      throw new Error('HtmlParser.encode requires iframe-capable DOM APIs')
    }

    const iframe = hostDocument.createElement('iframe') as HTMLIFrameElement

    // 设置视觉隐藏样式（NOT display:none）
    iframe.style.position = 'absolute'
    iframe.style.left = '-10000px'
    iframe.style.top = '0'
    iframe.style.width = '1024px'
    iframe.style.height = '2048px'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'

    // 设置 sandbox：允许同源，不允许脚本
    iframe.setAttribute('sandbox', 'allow-same-origin')

    // 追加到 body（fallback 到 html 元素）
    const parent = hostDocument.body || hostDocument.documentElement
    parent.appendChild(iframe)

    try {
      const contentWindow = iframe.contentWindow
      const contentDocument = iframe.contentDocument

      if (!contentWindow || !contentDocument) {
        throw new Error('HtmlParser.encode requires iframe-capable DOM APIs')
      }

      // 优先使用 srcdoc（更干净），否则 fallback 到 contentDocument.write
      if ('srcdoc' in iframe) {
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Iframe srcdoc load timeout'))
          }, 5000)
          iframe.onload = () => {
            clearTimeout(timeoutId)
            resolve()
          }
          iframe.onerror = () => {
            clearTimeout(timeoutId)
            reject(new Error('Iframe load failed'))
          }
          iframe.srcdoc = html
        })
        const srcdocDocument = iframe.contentDocument
        const srcdocWindow = iframe.contentWindow
        if (!srcdocWindow || !srcdocDocument) {
          throw new Error('HtmlParser.encode requires iframe-capable DOM APIs')
        }
        if (srcdocDocument.body.childNodes.length === 0 && html.trim().length > 0) {
          srcdocDocument.open()
          srcdocDocument.write(html)
          srcdocDocument.close()
        }
        return await callback({ iframe, iframeDocument: srcdocDocument, iframeWindow: srcdocWindow })
      } else {
        contentDocument.open()
        contentDocument.write(html)
        contentDocument.close()
        return await callback({ iframe, iframeDocument: contentDocument, iframeWindow: contentWindow })
      }
    } finally {
      // 确保清理 iframe（success、error、malformed HTML、measurement failure）
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
    }
  }

  /**
   * 以 DFS 遍历 Document body，收集文本节点为 IntermediateText 列表。
   */
  private static collectTextsFromDocumentFallback(
    doc: Document,
    id: string
  ): { title: string; texts: IntermediateText[]; pageHeight: number } {
    devConsoleLog('[collectTextsFromDocument] 开始解析 Document', { id })
    const title = doc.title || 'Untitled HTML'
    devConsoleLog('[collectTextsFromDocument] Document 解析完成', { title })
    const body = doc.body
    const skipTags = new Set(['SCRIPT', 'STYLE'])
    const texts: IntermediateText[] = []
    const defaultFontSize = 16
    const defaultLineHeight = 1.2
    let idx = 0
    let y = 0
    const pendingLine: PendingTextSegment[] = []
    const blockTags = new Set([
      'ADDRESS',
      'ARTICLE',
      'ASIDE',
      'BLOCKQUOTE',
      'DIV',
      'DL',
      'FIELDSET',
      'FIGCAPTION',
      'FIGURE',
      'FOOTER',
      'FORM',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'HEADER',
      'HR',
      'LI',
      'MAIN',
      'NAV',
      'OL',
      'P',
      'PRE',
      'SECTION',
      'TABLE',
      'TD',
      'TH',
      'TR',
      'UL'
    ])

    const flushPendingLine = () => {
      if (pendingLine.length === 0) return
      devConsoleLog('[flushPendingLine] 刷新行', { segmentCount: pendingLine.length, currentY: y })

      const lineHeight = pendingLine.reduce(
        (maxHeight, segment) => Math.max(maxHeight, segment.metrics.height),
        1
      )

      let xCursor = 0
      pendingLine.forEach((segment, index) => {
        const x = xCursor
        const width = segment.metrics.width
        const height = segment.metrics.height
        texts.push(
          new IntermediateText({
            id: `${id}-page-1-text-${idx++}`,
            content: segment.content,
            fontSize: segment.style.fontSize,
            fontFamily: segment.style.fontFamily,
            fontWeight: segment.style.fontWeight,
            italic: segment.style.italic,
            color: segment.style.color,
            polygon: [[x, y], [x + width, y], [x + width, y + height], [x, y + height]],
            lineHeight: segment.style.lineHeight,
            ascent: segment.metrics.ascent,
            descent: segment.metrics.descent,
            vertical: segment.style.writingMode === 'vertical-rl',
            dir: detectDir(segment.content),
            skew: 0,
            isEOL: index === pendingLine.length - 1
          })
        )
        xCursor += width
      })

      y += lineHeight
      pendingLine.length = 0
    }

    const walk = (node: Node) => {
      if (node.nodeType === ELEMENT_NODE) {
        const el = node as Element
        devConsoleLog('[walk] 遇到元素节点', { tagName: el.tagName })
        if (skipTags.has(el.tagName)) {
          devConsoleLog('[walk] 跳过标签', el.tagName)
          return
        }
        if (el.tagName === 'BR') {
          devConsoleLog('[walk] 遇到 BR 标签，刷新行')
          flushPendingLine()
          return
        }

        const isBlockElement = blockTags.has(el.tagName)
        if (isBlockElement) {
          devConsoleLog('[walk] 遇到块级元素', el.tagName)
          flushPendingLine()
        }
        for (const child of Array.from(el.childNodes)) walk(child)
        if (isBlockElement) flushPendingLine()
        return
      }
      if (node.nodeType !== TEXT_NODE) return

      const raw = String(node.textContent || '')
      const content = raw.replace(/\s+/g, ' ').trim()
      if (!content) return

      devConsoleLog('[walk] 采集文本节点', { content: content.slice(0, 50), length: content.length })

      // 自底向上采集行内样式；只有在当前字段未设置时才向上采用祖先的值。
      const sty = HtmlParser.collectAncestorInlineStyle(node, {
        fontSize: defaultFontSize,
        lineHeight: defaultLineHeight
      })
      devConsoleLog('[walk] 采集到样式', { fontSize: sty.fontSize, fontWeight: sty.fontWeight, italic: sty.italic, color: sty.color })

      const { width, height, ascent, descent } = HtmlParser.measureTextMetrics(
        content,
        sty.fontSize,
        sty.fontFamily,
        sty.fontWeight,
        sty.italic,
        sty.lineHeight
      )
      devConsoleLog('[walk] 文本测量结果', { content: content.slice(0, 30), width, height })

      pendingLine.push({
        content,
        style: sty,
        metrics: { width, height, ascent, descent }
      })
    }

    // DFS 遍历 body，收集文本节点
    devConsoleLog('[collectTextsFromDocument] 开始 DFS 遍历 body')
    walk(body)
    flushPendingLine()
    const pageHeight = Math.max(
      1,
      Math.round(texts.reduce((a, t) => Math.max(a, t.polygon[2][1]), 0))
    )
    devConsoleLog('[collectTextsFromDocument] 解析完成', { textCount: texts.length, pageHeight })
    return { title, texts, pageHeight }
  }

  private static collectTextsFromDocument(
    doc: Document,
    id: string
  ): { title: string; texts: IntermediateText[]; pageWidth: number; pageHeight: number } {
    devConsoleLog('[collectTextsFromDocument] 开始解析 Document', { id })
    const title = doc.title || 'Untitled HTML'

    doc.documentElement.style.width = '1024px'
    doc.body.style.margin = '0'
    doc.body.style.padding = '0'

    const renderedSegments = HtmlParser.collectRenderedTextSegments(doc)
    if (renderedSegments.length > 0) {
      const rendered = HtmlParser.buildRenderedTexts(doc, id, renderedSegments)
      devConsoleLog('[collectTextsFromDocument] 使用真实 DOM 布局采集完成', {
        title,
        textCount: rendered.texts.length,
        pageWidth: rendered.pageWidth,
        pageHeight: rendered.pageHeight
      })
      return { title, ...rendered }
    }

    const fallback = HtmlParser.collectTextsFromDocumentFallback(doc, id)
    return {
      title,
      texts: fallback.texts,
      pageWidth: 800,
      pageHeight: fallback.pageHeight
    }
  }

  /**
   * 当无法解析 DOM 时的兜底：将整段 HTML 当作纯文本，按行切分后构造文本块。
   */
  private static fallbackPlainText(
    html: string,
    id: string
  ): { texts: IntermediateText[]; pageHeight: number } {
    devConsoleLog('[fallbackPlainText] 进入纯文本回退模式', { htmlLength: html.length })
    const lines = html.split(/\n+/)
    devConsoleLog('[fallbackPlainText] 按行拆分', { lineCount: lines.length })
    const texts: IntermediateText[] = []
    let y = 0
    let idx = 0
    const fontSize = 16
    const lineHeight = Math.round(fontSize * 1.2)
    for (const ln of lines) {
      const content = ln.trim()
      if (!content) {
        y += lineHeight
        continue
      }
      const { width, height, ascent, descent } = HtmlParser.measureTextMetrics(
        content,
        fontSize,
        '',
        400,
        false,
        lineHeight
      )
      texts.push(
        new IntermediateText({
          id: `${id}-page-1-text-${idx++}`,
          content,
          fontSize,
          fontFamily: '',
          fontWeight: 400,
          italic: false,
          color: '#000',
          polygon: [[0, y], [width, y], [width, y + height], [0, y + height]],
          lineHeight,
          ascent,
          descent,
          vertical: false,
          dir: TextDir.LTR,
          skew: 0,
          isEOL: true
        })
      )
      y += height
    }
    const pageHeight = Math.max(
      1,
      Math.round(texts.reduce((a, t) => Math.max(a, t.polygon[2][1]), 0))
    )
    devConsoleLog('[fallbackPlainText] 回退处理完成', { textCount: texts.length, pageHeight })
    return { texts, pageHeight }
  }

  static {
    void HtmlParser.fallbackPlainText
  }

  /**
   * encode：从 HTML 文本构建 HtmlDocument。
   *
   * 输入：File | ArrayBuffer（UTF-8 编码的 HTML 文本）
   * 流程：
   * 1) 读取并解码为字符串
   * 2) 在浏览器中通过临时 iframe 文档解析，遍历 body 所有文本节点
   * 3) 向上收集行内样式（font-size/line-height/font-weight/...）
   * 4) 估算每段文本的 width/height 与 y 累进，用于简单布局
   * 5) 返回 HtmlDocument 实例（包装 IntermediateDocument）
   */
  static async encode(fileOrBuffer: ParserInput): Promise<HtmlDocument> {
    devConsoleLog('[encode] 开始编码 HTML', { inputType: fileOrBuffer.constructor?.name || typeof fileOrBuffer })
    const buffer = await HtmlParser.toArrayBuffer(fileOrBuffer)
    devConsoleLog('[encode] 转换为 ArrayBuffer', { byteLength: buffer.byteLength })

    // 1) 解码为字符串；失败则抛出异常
    const html = HtmlParser.decodeBufferToString(buffer)
    if (html == null) {
      devConsoleError('[encode] 无法将输入解码为 HTML 文本')
      throw new Error('无法将输入解码为 HTML 文本')
    }
    devConsoleLog('[encode] 解码为字符串成功', { length: html.length })

    const id = `html-${Date.now()}`
    let title = 'Untitled HTML'
    let texts: IntermediateText[] = []
    let pageWidth = 800
    let pageHeight = 0

    // 2) 通过 iframe 文档解析 HTML，并收集文本节点
    const result = await HtmlParser.withIframeDocument(html, async ({ iframeDocument }) => {
      return HtmlParser.collectTextsFromDocument(iframeDocument, id)
    })
    title = result.title || title
    texts = result.texts
    pageWidth = result.pageWidth
    pageHeight = result.pageHeight
    devConsoleLog('[encode] iframe DOM 解析完成', { title, textCount: texts.length, pageWidth, pageHeight })

    // 3) 构建单页文档的惰性 page 列表
    const infoList = [
      {
        id: `${id}-page-1`,
        pageNumber: 1,
        size: { x: pageWidth, y: pageHeight },
        getData: async () => {
          const page = new IntermediatePage({
            id: `${id}-page-1`,
            number: 1,
            width: pageWidth,
            height: pageHeight,
            texts,
            thumbnail: undefined
          })
          page.setGetThumbnail(buildLazyThumbnailFn(page, texts, pageWidth, pageHeight))
          return page
        }
      }
    ]
    const pagesMap = IntermediatePageMap.makeByInfoList(infoList)
    const intermediateDocument = new IntermediateDocument({
      id,
      title,
      pagesMap
    })

    // 4) 返回 HtmlDocument 包装
    const htmlDoc = new HtmlDocument(intermediateDocument)
    devConsoleLog('[encode] 编码完成，返回 HtmlDocument', { id, title, pageCount: infoList.length })
    return htmlDoc
  }

  /**
   * 将 IntermediateDocument 渲染为不带 <html>/<body> 的 HTML 片段，
   * 外层包裹一个 .hamster-note-document 容器，内含若干页面与文本元素。
   */
  static async decodeToHtml(
    intermediateDocument: IntermediateDocument
  ): Promise<string> {
    devConsoleLog('[decodeToHtml] 开始渲染 HTML 片段', { docId: intermediateDocument.id, title: intermediateDocument.title })
    // 片段 CSS：只包含必要的定位/换行/变换等基础样式
    const pages = await intermediateDocument.pages
    devConsoleLog('[decodeToHtml] 获取到页面数', pages.length)
    const style = HtmlParser.getFragmentStyle()

    const pageHtml = await Promise.all(
      pages.map((p) => HtmlParser.lazyRenderPageDiv(p))
    )

    const result = `<div class="hamster-note-document"><style>${style}</style>${pageHtml.join('')}</div>`
    devConsoleLog('[decodeToHtml] HTML 片段渲染完成', { length: result.length })
    return result
  }

  /**
   * 将 IntermediateDocument 包裹为完整的单文件 HTML：
   * - <html> + <head> + <body>，title 使用文档标题
   * - 优先返回 File（浏览器环境可用），失败时退化到 ArrayBuffer
   */
  static async decode(
    intermediateDocument: IntermediateDocument
  ): Promise<File | ArrayBuffer> {
    devConsoleLog('[decode] 开始生成完整 HTML 文件', { docId: intermediateDocument.id })
    const inner = await HtmlParser.decodeToHtml(intermediateDocument)
    const title = intermediateDocument.title || 'document'
    const fullHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(
      title
    )}</title></head><body>${inner}</body></html>`

    try {
      const file = new File([fullHtml], `${title}.html`, { type: 'text/html' })
      devConsoleLog('[decode] 生成 File 对象成功', { name: file.name, size: file.size })
      return file
    } catch {
      // 某些运行环境（或较旧浏览器）可能不支持 File 构造器
      devConsoleLog('[decode] File 构造器不可用，回退到 ArrayBuffer')
      const enc = new TextEncoder()
      return enc.encode(fullHtml).buffer
    }
  }
}

export * from './mock'
