import { IntermediatePage } from '@hamster-note/types'

export function lazyRenderPageDiv(page: IntermediatePage, initialScale = 1) {
  const pageDiv = document.createElement('div')
  pageDiv.className = 'hamster-note-page'
  pageDiv.id = page.id
  const size = {
    height: page.height * initialScale,
    width: page.width * initialScale
  }
  pageDiv.style = `height: ${size.height}px; width: ${size.width}px`
  return pageDiv
}
