import type { IntermediateImage, IntermediatePage, IntermediateText } from '@hamster-note/types'

import { cssStyleRecordToString, formatTextCssStyle } from './textCssStyle.js'
import { computeTextStyle } from './textStyle.js'

export interface OffscreenPageInput extends Pick<IntermediatePage, 'width' | 'height'> {
  id?: IntermediatePage['id']
  texts: IntermediateText[]
  /** 页面中的图片列表，始终渲染不受 excludeTextFromBackground 影响 */
  images?: IntermediateImage[]
}

export interface BuildOffscreenPageElementOptions {
  excludeTextFromBackground?: boolean
}

export interface OffscreenPageHandle {
  element: HTMLElement
  cleanup: () => void
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
  }

  // 渲染图片元素——始终渲染，不受 excludeTextFromBackground 影响
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

  doc.body.appendChild(wrapper)

  return {
    element: wrapper,
    cleanup: () => {
      wrapper.parentNode?.removeChild(wrapper)
    }
  }
}
