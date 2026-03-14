import { HtmlParser } from '../dist/index.js'
import {
  parseSerializedDocument,
  serializeIntermediate
} from './demoDocumentSerialization.js'

const parseButton = document.querySelector('[data-action="parse"]')
const decodeButton = document.querySelector('[data-action="decode"]')
const output = document.querySelector('[data-role="output"]')
const status = document.querySelector('[data-role="status"]')
const preview = document.querySelector('[data-role="preview"]')
const previewNote = document.querySelector('[data-role="preview-note"]')

const setStatus = (text) => {
  if (status) {
    status.textContent = text
  }
}

const setPreviewNote = (text, isError = false) => {
  if (!previewNote) return
  previewNote.textContent = text
  previewNote.classList.toggle('is-error', isError)
}

const setPreviewMessage = (text, isError = false) => {
  if (!preview) return
  preview.classList.toggle('preview-error', isError)
  preview.innerHTML = ''
  const placeholder = document.createElement('span')
  placeholder.className = 'preview-placeholder'
  placeholder.textContent = text
  preview.appendChild(placeholder)
}

const handleParse = async () => {
  if (!output) return

  setStatus('Parsing...')
  output.textContent = 'Working...'
  setPreviewMessage('Click "Decode JSON" to render the HTML preview.')
  setPreviewNote(
    'Preview is an approximation based on the IntermediateDocument layout.'
  )

  try {
    const html = document.documentElement.outerHTML
    const buffer = new TextEncoder().encode(html).buffer
    const doc = await HtmlParser.encode(buffer)
    const intermediate = doc.getIntermediateDocument()
    const serialized = await serializeIntermediate(intermediate)
    output.textContent = JSON.stringify(serialized, null, 2)
    setStatus('Done')
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message}\n${error.stack ?? ''}`
        : String(error)
    output.textContent = message
    setStatus('Failed')
    setPreviewMessage('Parsing failed. See the JSON output for details.', true)
    setPreviewNote('Preview is unavailable due to parse errors.', true)
  }
}

const handleDecode = async () => {
  if (!output) return

  setStatus('Decoding...')

  try {
    const rawText = output.textContent?.trim() ?? ''
    if (!rawText || (!rawText.startsWith('{') && !rawText.startsWith('['))) {
      throw new Error('JSON output is not available. Run "Parse current page".')
    }
    const data = JSON.parse(rawText)
    const intermediate = parseSerializedDocument(data)
    const html = await HtmlParser.decodeToHtml(intermediate)
    if (preview) {
      preview.classList.remove('preview-error')
      preview.innerHTML = html
    }
    setPreviewNote(
      'Preview is an approximation based on the IntermediateDocument layout.'
    )
    setStatus('Decode ready')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setPreviewMessage(message, true)
    setPreviewNote('Preview is unavailable due to decode errors.', true)
    setStatus('Decode failed')
  }
}

if (parseButton) {
  parseButton.addEventListener('click', () => {
    void handleParse()
  })
}

if (decodeButton) {
  decodeButton.addEventListener('click', () => {
    void handleDecode()
  })
}
