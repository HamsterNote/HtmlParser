const PREVIEW_ERROR_CLASS = 'preview-error'

function getPreviewDocument(preview) {
  return preview?.ownerDocument ?? document
}

function resetPreview(preview) {
  preview.replaceChildren()
}

function createPlaceholderElement(preview, message) {
  const placeholder = getPreviewDocument(preview).createElement('span')
  placeholder.className = 'preview-placeholder'
  placeholder.textContent = message
  return placeholder
}

function getDecodedPageSize(preview, html) {
  const doc = getPreviewDocument(preview)
  const scratch = doc.createElement('div')
  scratch.innerHTML = html

  return Array.from(scratch.querySelectorAll('.hamster-note-page')).reduce(
    (size, page) => {
      const element = page instanceof doc.defaultView.HTMLElement ? page : null
      if (!element) return size

      const width = Number.parseFloat(element.style.width)
      const height = Number.parseFloat(element.style.height)

      return {
        width: Number.isFinite(width) ? Math.max(size.width, width) : size.width,
        height: Number.isFinite(height) ? Math.max(size.height, height) : size.height
      }
    },
    { width: 0, height: 0 }
  )
}

function sizeFrameToDecodedPage(frame, size) {
  if (size.width > 0) {
    frame.style.width = `${size.width}px`
    frame.style.maxWidth = 'none'
  }

  if (size.height > 0) {
    frame.style.minHeight = `${size.height}px`
  }
}

export function setPreviewMessage(preview, message, isError = false) {
  if (!preview) {
    return
  }

  resetPreview(preview)
  preview.classList.toggle(PREVIEW_ERROR_CLASS, isError)
  preview.append(createPlaceholderElement(preview, message))
}

export function renderPreviewHtml(preview, html) {
  if (!preview) {
    return
  }

  resetPreview(preview)
  preview.classList.remove(PREVIEW_ERROR_CLASS)

  const frame = getPreviewDocument(preview).createElement('iframe')
  frame.className = 'preview-frame'
  sizeFrameToDecodedPage(frame, getDecodedPageSize(preview, html))
  frame.setAttribute('sandbox', '')
  frame.setAttribute('referrerpolicy', 'no-referrer')
  frame.setAttribute('src', 'about:blank')
  frame.setAttribute(
    'srcdoc',
    `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><base href="about:srcdoc" /></head><body>${html}</body></html>`
  )

  preview.append(frame)
}
