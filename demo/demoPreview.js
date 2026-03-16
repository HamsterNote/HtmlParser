const createPreviewDocument = (html) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <base href="about:srcdoc" />
  </head>
  <body>${html}</body>
</html>`

const resetPreview = (preview, isError = false) => {
  preview.classList.toggle('preview-error', isError)
  preview.replaceChildren()
}

export const setPreviewMessage = (preview, text, isError = false) => {
  if (!preview) return

  resetPreview(preview, isError)
  const placeholder = preview.ownerDocument.createElement('span')
  placeholder.className = 'preview-placeholder'
  placeholder.textContent = text
  preview.appendChild(placeholder)
}

export const renderPreviewHtml = (preview, html) => {
  if (!preview) return

  resetPreview(preview, false)
  const frame = preview.ownerDocument.createElement('iframe')
  frame.className = 'preview-frame'
  frame.title = 'Decoded HTML preview'
  frame.setAttribute('sandbox', '')
  frame.setAttribute('referrerpolicy', 'no-referrer')
  frame.setAttribute('src', 'about:blank')
  frame.srcdoc = createPreviewDocument(html)
  preview.appendChild(frame)
}
