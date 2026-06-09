import type { IntermediateImage, IntermediatePage, IntermediateText } from '@hamster-note/types'

import { cssStyleRecordToString, formatTextCssStyle } from './textCssStyle.js'
import { computeTextStyle } from './textStyle.js'

export interface OffscreenPageInput extends Pick<IntermediatePage, 'width' | 'height'> {
  id?: IntermediatePage['id']
  texts: IntermediateText[]
  /** 页面中的图片列表，仅在 excludeImagesFromBackground !== true 时渲染 */
  images?: IntermediateImage[]
}

export interface BuildOffscreenPageElementOptions {
  excludeTextFromBackground?: boolean
  /** 是否从背景图中排除图片，默认 false */
  excludeImagesFromBackground?: boolean
  /** 原始 HTML 所在的 Document，仅在排除背景文本时用于捕获视觉容器样式 */
  sourceDoc?: Document
  /** 已在源 DOM 生命周期内捕获好的视觉容器模型 */
  styleContainers?: readonly WhitelistedStyleContainerModel[]
  /** 缩略图快照宽度；未传入时沿用页面自身宽度 */
  snapshotWidth?: number
}

export interface OffscreenPageHandle {
  element: HTMLElement
  cleanup: () => void
}

export interface WhitelistedStyleContainerModel {
  left: number
  top: number
  width: number
  height: number
  styles: Record<string, string>
}

const STYLE_CONTAINER_CLASS = 'hamster-note-visual-container'
const ELEMENT_NODE_FILTER = 1
const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const
const VISUAL_STYLE_PROPERTY_PREFIXES = [
  'background-',
  'border-',
  'outline-',
  'padding-',
  'font-',
  'text-',
  'overflow-',
  'flex-',
  'grid-',
  'align-',
  'justify-',
  'place-'
] as const
const VISUAL_STYLE_PROPERTY_NAMES = new Set([
  'background',
  'border',
  'border-radius',
  'box-shadow',
  'color',
  'column-gap',
  'display',
  'gap',
  'opacity',
  'outline',
  'overflow',
  'padding',
  'row-gap',
  'visibility'
])
const DENIED_STYLE_PROPERTY_NAMES = new Set([
  'animation',
  'animation-composition',
  'animation-delay',
  'animation-direction',
  'animation-duration',
  'animation-fill-mode',
  'animation-iteration-count',
  'animation-name',
  'animation-play-state',
  'animation-range',
  'animation-range-end',
  'animation-range-start',
  'animation-timeline',
  'animation-timing-function',
  'backdrop-filter',
  'caret-color',
  'cursor',
  'filter',
  'mix-blend-mode',
  'overscroll-behavior',
  'overscroll-behavior-block',
  'overscroll-behavior-inline',
  'overscroll-behavior-x',
  'overscroll-behavior-y',
  'pointer-events',
  'resize',
  'scroll-behavior',
  'scroll-margin',
  'scroll-padding',
  'transition',
  'transition-behavior',
  'transition-delay',
  'transition-duration',
  'transition-property',
  'transition-timing-function',
  'user-select',
  'will-change'
])
const DEFAULT_COMPUTED_STYLE_VALUES = new Map([
  ['direction', 'ltr'],
  ['display', 'block'],
  ['font-family', '"times new roman"'],
  ['font-size', '16px'],
  ['font-stretch', 'normal'],
  ['font-style', 'normal'],
  ['font-variant', 'normal'],
  ['font-weight', 'normal'],
  ['line-height', 'normal']
])

function readCss(style: CSSStyleDeclaration, property: string): string {
  return style.getPropertyValue(property).trim()
}

function isZeroCssLength(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (normalized === '') return true
  if (normalized === '0') return true
  return /^0(?:\.0+)?(?:px|em|rem|%|pt)?$/.test(normalized)
}

function isTransparentColor(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (normalized === '' || normalized === 'transparent') return true

  const compact = normalized.replace(/\s+/g, '')
  if (compact === 'rgba(0,0,0,0)') return true

  const rgbaMatch = compact.match(/^rgba\([^,]+,[^,]+,[^,]+,([^,)]+)\)$/)
  if (rgbaMatch) {
    return Number.parseFloat(rgbaMatch[1] ?? '1') === 0
  }

  const slashAlphaMatch = compact.match(/^rgb\([^/]+\/([^/)]+)\)$/)
  if (slashAlphaMatch) {
    const alpha = slashAlphaMatch[1] ?? '1'
    return alpha === '0' || alpha === '0%'
  }

  return false
}

function isVisibleLineStyle(style: string): boolean {
  const normalized = style.trim().toLowerCase()
  return normalized !== '' && normalized !== 'none' && normalized !== 'hidden'
}

function isDeniedStyleProperty(property: string, value: string): boolean {
  if (property.startsWith('--')) return true
  if (property.startsWith('-')) return true
  if (property.startsWith('aria-')) return true
  if (property.includes('-internal-')) return true
  if (value.toLowerCase().includes('-internal-')) return true
  if (property === 'role') return true
  if (DENIED_STYLE_PROPERTY_NAMES.has(property)) return true
  return (
    property.startsWith('animation-') ||
    property.startsWith('transition-') ||
    property.startsWith('scroll-') ||
    property.startsWith('overscroll-')
  )
}

function isVisualStyleProperty(property: string): boolean {
  if (VISUAL_STYLE_PROPERTY_NAMES.has(property)) return true
  return VISUAL_STYLE_PROPERTY_PREFIXES.some((prefix) =>
    property.startsWith(prefix)
  )
}

function isDefaultComputedStyleValue(property: string, value: string): boolean {
  return DEFAULT_COMPUTED_STYLE_VALUES.get(property) === value.toLowerCase()
}

function isColorProperty(property: string): boolean {
  return property === 'color' || property.endsWith('-color')
}

function shouldSkipZeroLengthProperty(property: string): boolean {
  return (
    property.startsWith('padding') ||
    property.endsWith('-radius') ||
    property.endsWith('-width') ||
    property.endsWith('-gap') ||
    property === 'gap' ||
    property === 'letter-spacing' ||
    property === 'outline-offset' ||
    property === 'text-indent' ||
    property === 'word-spacing'
  )
}

function getBorderSide(property: string): (typeof BORDER_SIDES)[number] | undefined {
  return BORDER_SIDES.find((side) => property.startsWith(`border-${side}-`))
}

function shouldKeepBorderSideProperty(
  computedStyle: CSSStyleDeclaration,
  property: string,
  value: string
): boolean {
  const side = getBorderSide(property)
  if (!side) return true

  const borderWidth = readCss(computedStyle, `border-${side}-width`)
  const borderStyle = readCss(computedStyle, `border-${side}-style`)
  if (isZeroCssLength(borderWidth) || !isVisibleLineStyle(borderStyle)) {
    return false
  }

  if (property === `border-${side}-color`) {
    return !isTransparentColor(value)
  }

  return true
}

function shouldKeepOutlineProperty(
  computedStyle: CSSStyleDeclaration,
  property: string,
  value: string
): boolean {
  if (!property.startsWith('outline')) return true

  const outlineWidth = readCss(computedStyle, 'outline-width')
  const outlineStyle = readCss(computedStyle, 'outline-style')
  if (isZeroCssLength(outlineWidth) || !isVisibleLineStyle(outlineStyle)) {
    return false
  }

  if (property === 'outline-color') return !isTransparentColor(value)
  return true
}

function shouldKeepStyleValue(property: string, value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (normalized === '') return false
  if (normalized === 'none') return false
  if (normalized === 'initial' || normalized === 'inherit' || normalized === 'unset') {
    return false
  }
  if (normalized === 'auto' || normalized === 'auto auto') return false
  if (property.startsWith('overflow') && normalized === 'visible') return false
  if (property.startsWith('background') && normalized === 'repeat') return false
  if (property.startsWith('background-position') && normalized === '0% 0%') {
    return false
  }
  if (property === 'background-color' && isTransparentColor(value)) return false
  if (isColorProperty(property) && isTransparentColor(value)) return false
  if (shouldSkipZeroLengthProperty(property) && isZeroCssLength(value)) return false
  return !isDefaultComputedStyleValue(property, value)
}

function readVisualCss(
  computedStyle: CSSStyleDeclaration,
  inlineStyle: CSSStyleDeclaration | undefined,
  property: string
): string {
  const computedValue = readCss(computedStyle, property)
  if (computedValue !== '') return computedValue
  return inlineStyle ? readCss(inlineStyle, property) : ''
}

function collectWhitelistedStyles(
  computedStyle: CSSStyleDeclaration,
  inlineStyle?: CSSStyleDeclaration
): Record<string, string> {
  const styles: Record<string, string> = {}

  const candidateProperties = new Set<string>()
  for (let index = 0; index < computedStyle.length; index += 1) {
    candidateProperties.add(computedStyle.item(index))
  }
  if (inlineStyle) {
    for (let index = 0; index < inlineStyle.length; index += 1) {
      candidateProperties.add(inlineStyle.item(index))
    }
  }

  for (const property of candidateProperties) {
    const value = readVisualCss(computedStyle, inlineStyle, property)
    if (isDeniedStyleProperty(property, value)) continue
    if (!isVisualStyleProperty(property)) continue
    if (!shouldKeepStyleValue(property, value)) continue
    if (!shouldKeepBorderSideProperty(computedStyle, property, value)) continue
    if (!shouldKeepOutlineProperty(computedStyle, property, value)) continue

    styles[property] = value
  }

  return styles
}

function getSourceComputedStyle(sourceDoc: Document, element: Element): CSSStyleDeclaration {
  const sourceWindow = sourceDoc.defaultView
  if (sourceWindow) return sourceWindow.getComputedStyle(element)
  return globalThis.getComputedStyle(element)
}

function appendWhitelistedStyleContainerModel(
  sourceDoc: Document,
  containers: WhitelistedStyleContainerModel[],
  element: Element
): void {
  const rect = element.getBoundingClientRect()

  // 0 尺寸元素不会被 html2canvas 绘制，提前跳过减少无效 DOM。
  if (rect.width <= 0 || rect.height <= 0) return

  const styles = collectWhitelistedStyles(
    getSourceComputedStyle(sourceDoc, element),
    (element as HTMLElement).style
  )

  if (Object.keys(styles).length === 0) return

  containers.push({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    styles
  })
}

export function captureWhitelistedStyleContainerModels(
  sourceDoc: Document
): WhitelistedStyleContainerModel[] {
  const body = sourceDoc.body
  if (!body) return []

  const treeWalker = sourceDoc.createTreeWalker(body, ELEMENT_NODE_FILTER)
  const containers: WhitelistedStyleContainerModel[] = []

  // TreeWalker 从 body 的子节点开始遍历；这里先显式捕获 html/body 本身，
  // 避免页面级背景（如 html/body background）在缩略图中丢失。
  appendWhitelistedStyleContainerModel(sourceDoc, containers, sourceDoc.documentElement)
  appendWhitelistedStyleContainerModel(sourceDoc, containers, body)

  for (let node = treeWalker.nextNode(); node; node = treeWalker.nextNode()) {
    appendWhitelistedStyleContainerModel(sourceDoc, containers, node as Element)
  }

  return containers
}

function appendWhitelistedStyleContainer(
  page: HTMLElement,
  doc: Document,
  model: WhitelistedStyleContainerModel
): HTMLElement {
  const container = doc.createElement('div')
  container.className = STYLE_CONTAINER_CLASS

  Object.assign(container.style, {
    position: 'absolute',
    left: `${model.left}px`,
    top: `${model.top}px`,
    width: `${model.width}px`,
    height: `${model.height}px`,
    pointerEvents: 'none',
    boxSizing: 'border-box',
    zIndex: '0'
  })

  for (const [property, value] of Object.entries(model.styles)) {
    container.style.setProperty(property, value)
  }

  page.appendChild(container)
  return container
}

export function captureWhitelistedStyleContainers(
  sourceDoc: Document,
  page: HTMLElement,
  doc: Document
): HTMLElement[] {
  try {
    return captureWhitelistedStyleContainerModels(sourceDoc).map((model) =>
      appendWhitelistedStyleContainer(page, doc, model)
    )
  } catch {
    // 背景样式捕获是增强路径；源 DOM 遍历失败时保持旧缩略图行为。
    return []
  }
}

export function buildOffscreenPageElement(
  page: OffscreenPageInput,
  ownerDocument?: Document,
  options?: BuildOffscreenPageElementOptions
): OffscreenPageHandle {
  const doc = ownerDocument ?? globalThis.document

  if (!doc) {
    throw new Error('buildOffscreenPageElement requires a document context')
  }

  const wrapper = doc.createElement('div')
  wrapper.className = 'hamster-note-page'
  if (page.id) wrapper.id = page.id

  Object.assign(wrapper.style, {
    position: 'absolute',
    left: '-10000px',
    top: '0',
    pointerEvents: 'none',
    width: `${options?.snapshotWidth ?? page.width}px`,
    height: `${page.height}px`,
    overflow: 'hidden',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'top center',
    backgroundSize: 'contain'
  })

  if (options?.styleContainers) {
    options.styleContainers.forEach((model) => {
      appendWhitelistedStyleContainer(wrapper, doc, model)
    })
  } else if (options?.sourceDoc) {
    captureWhitelistedStyleContainers(options.sourceDoc, wrapper, doc)
  }

  if (options?.excludeTextFromBackground !== true) {
    page.texts.forEach((text) => {
      const span = doc.createElement('span')
      span.className = 'hamster-note-text'
      span.id = text.id
      span.textContent = text.content

      const styleText = cssStyleRecordToString(
        formatTextCssStyle(computeTextStyle(text))
      )
      span.setAttribute('style', styleText)

      wrapper.appendChild(span)
    })
  }

  if (options?.excludeImagesFromBackground !== true) {
    // 未启用图片排除时渲染背景图片；仍不受 excludeTextFromBackground 影响
    const images = page.images ?? []
    images.forEach((image) => {
      const img = doc.createElement('img')
      img.className = 'hamster-note-image'
      img.id = image.id
      img.src = image.src

      // polygon 为四个角点 [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
      // left = 左上角 x, top = 左上角 y
      // width = 右上角 x - 左上角 x, height = 左下角 y - 左上角 y
      const left = image.polygon[0][0]
      const top = image.polygon[0][1]
      const width = image.polygon[1][0] - image.polygon[0][0]
      const height = image.polygon[2][1] - image.polygon[0][1]

      Object.assign(img.style, {
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`
      })

      // 非完全不透明时设置 opacity
      if (image.opacity !== 1) {
        img.style.opacity = String(image.opacity)
      }

      // 存在裁剪区域时应用 clip-path
      if (image.clip) {
        const { x, y, width: cw, height: ch } = image.clip
        img.style.clipPath = `inset(${y}px ${width - x - cw}px ${height - y - ch}px ${x}px)`
      }

      wrapper.appendChild(img)
    })
  }

  doc.body.appendChild(wrapper)

  return {
    element: wrapper,
    cleanup: () => {
      wrapper.parentNode?.removeChild(wrapper)
    }
  }
}
