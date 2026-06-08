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
const BORDER_RADIUS_CORNERS = [
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left'
] as const

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

function collectWhitelistedStyles(computedStyle: CSSStyleDeclaration): Record<string, string> {
  const styles: Record<string, string> = {}
  const backgroundColor = readCss(computedStyle, 'background-color')

  if (!isTransparentColor(backgroundColor)) {
    styles['background-color'] = backgroundColor
  }

  for (const side of BORDER_SIDES) {
    const widthProperty = `border-${side}-width`
    const styleProperty = `border-${side}-style`
    const colorProperty = `border-${side}-color`
    const borderWidth = readCss(computedStyle, widthProperty)
    const borderStyle = readCss(computedStyle, styleProperty)

    // 边框只有在线型可见且宽度非 0 时才有可绘制内容。
    if (!isZeroCssLength(borderWidth) && isVisibleLineStyle(borderStyle)) {
      styles[widthProperty] = borderWidth
      styles[styleProperty] = borderStyle
      styles[colorProperty] = readCss(computedStyle, colorProperty)
    }
  }

  for (const corner of BORDER_RADIUS_CORNERS) {
    const property = `border-${corner}-radius`
    const value = readCss(computedStyle, property)
    if (!isZeroCssLength(value)) {
      styles[property] = value
    }
  }

  const boxShadow = readCss(computedStyle, 'box-shadow')
  if (boxShadow !== '' && boxShadow.toLowerCase() !== 'none') {
    styles['box-shadow'] = boxShadow
  }

  const outlineWidth = readCss(computedStyle, 'outline-width')
  const outlineStyle = readCss(computedStyle, 'outline-style')
  if (!isZeroCssLength(outlineWidth) && isVisibleLineStyle(outlineStyle)) {
    styles['outline-width'] = outlineWidth
    styles['outline-style'] = outlineStyle
    styles['outline-color'] = readCss(computedStyle, 'outline-color')
  }

  return styles
}

function getSourceComputedStyle(sourceDoc: Document, element: Element): CSSStyleDeclaration {
  const sourceWindow = sourceDoc.defaultView
  if (sourceWindow) return sourceWindow.getComputedStyle(element)
  return globalThis.getComputedStyle(element)
}

export function captureWhitelistedStyleContainerModels(
  sourceDoc: Document
): WhitelistedStyleContainerModel[] {
  const body = sourceDoc.body
  if (!body) return []

  const treeWalker = sourceDoc.createTreeWalker(body, ELEMENT_NODE_FILTER)
  const containers: WhitelistedStyleContainerModel[] = []

  for (let node = treeWalker.nextNode(); node; node = treeWalker.nextNode()) {
    const element = node as Element
    const rect = element.getBoundingClientRect()

    // 0 尺寸元素不会被 html2canvas 绘制，提前跳过减少无效 DOM。
    if (rect.width <= 0 || rect.height <= 0) continue

    const styles = collectWhitelistedStyles(
      getSourceComputedStyle(sourceDoc, element)
    )

    if (Object.keys(styles).length === 0) continue

    containers.push({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      styles
    })
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
    width: `${page.width}px`,
    height: `${page.height}px`,
    overflow: 'hidden',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'top center',
    backgroundSize: 'contain'
  })

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
  } else if (options.styleContainers) {
    options.styleContainers.forEach((model) => {
      appendWhitelistedStyleContainer(wrapper, doc, model)
    })
  } else if (options.sourceDoc) {
    captureWhitelistedStyleContainers(options.sourceDoc, wrapper, doc)
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
