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
  frame.setAttribute('sandbox', '')
  frame.setAttribute('referrerpolicy', 'no-referrer')
  frame.setAttribute('src', 'about:blank')
  frame.setAttribute(
    'srcdoc',
    `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><base href="about:srcdoc" /></head><body>${html}</body></html>`
  )

  preview.append(frame)
}
