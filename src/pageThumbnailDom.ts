import type { IntermediatePage, IntermediateText } from '@hamster-note/types'

import { cssStyleRecordToString, formatTextCssStyle } from './textCssStyle.js'
import { computeTextStyle } from './textStyle.js'

export interface OffscreenPageInput extends Pick<IntermediatePage, 'width' | 'height'> {
  id?: IntermediatePage['id']
  texts: IntermediateText[]
}

export interface OffscreenPageHandle {
  element: HTMLElement
  cleanup: () => void
}

export function buildOffscreenPageElement(
  page: OffscreenPageInput,
  ownerDocument?: Document
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

  doc.body.appendChild(wrapper)

  return {
    element: wrapper,
    cleanup: () => {
      wrapper.parentNode?.removeChild(wrapper)
    }
  }
}
