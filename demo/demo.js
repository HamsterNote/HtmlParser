import { HtmlParser } from '../dist/index.js'
import {
  decodeSerializedDocumentToHtml,
  serializeIntermediate
} from './demoDocumentSerialization.js'
import { renderPreviewHtml, setPreviewMessage } from './demoPreview.js'

const parseButton = document.querySelector('[data-action="parse"]')
const decodeButton = document.querySelector('[data-action="decode"]')
const decodeInputButton = document.querySelector('[data-action="decode-input"]')
const toggleOutputButton = document.querySelector('[data-action="toggle-output"]')
const output = document.querySelector('[data-role="output"]')
const jsonInput = document.querySelector('[data-role="json-input"]')
const textControlInput = document.querySelector('[data-role="text-control-input"]')
const status = document.querySelector('[data-role="status"]')
const preview = document.querySelector('[data-role="preview"]')
const previewNote = document.querySelector('[data-role="preview-note"]')

const setOutputCollapsed = (collapsed) => {
  if (!output || !toggleOutputButton) return

  output.classList.toggle('is-collapsed', collapsed)
  toggleOutputButton.textContent = collapsed ? 'Expand' : 'Collapse'
  toggleOutputButton.setAttribute('aria-expanded', String(!collapsed))
}

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

const handleParse = async () => {
  if (!output) return

  setStatus('Parsing...')
  output.textContent = 'Working...'
  setPreviewMessage(preview, 'Click "Decode JSON" to render the HTML preview.')
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
    setPreviewMessage(preview, 'Parsing failed. See the JSON output for details.', true)
    setPreviewNote('Preview is unavailable due to parse errors.', true)
  }
}

const handleDecode = async () => {
  if (!output) return

  setStatus('Decoding...')

  try {
    const rawText = output.textContent?.trim() ?? ''
    if (!rawText || !rawText.startsWith('{')) {
      throw new Error('JSON output is not available. Run "Parse current page".')
    }
    const data = JSON.parse(rawText)
    const html = await decodeSerializedDocumentToHtml(data)
    renderPreviewHtml(preview, html)
    setPreviewNote(
      'Preview is an approximation based on the IntermediateDocument layout.'
    )
    setStatus('Decode ready')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setPreviewMessage(preview, message, true)
    setPreviewNote('Preview is unavailable due to decode errors.', true)
    setStatus('Decode failed')
  }
}

if (parseButton) {
  parseButton.addEventListener('click', () => {
    void handleParse()
  })
}

const handleDecodeInput = async () => {
  if (!jsonInput || !preview) return

  setStatus('Decoding...')

  try {
    const rawText = jsonInput.value?.trim() ?? ''
    if (!rawText || !rawText.startsWith('{')) {
      throw new Error('Please enter valid JSON in the input area above.')
    }
    const data = JSON.parse(rawText)

    const rawTextControl = textControlInput?.value?.trim() ?? ''
    if (rawTextControl) {
      if (!rawTextControl.startsWith('{')) {
        throw new Error('Text Control JSON must be a valid JSON object.')
      }
      const textControl = JSON.parse(rawTextControl)
      data.textControl = textControl
    }

    const html = await decodeSerializedDocumentToHtml(data)
    renderPreviewHtml(preview, html)
    setPreviewNote(
      'Preview is an approximation based on the IntermediateDocument layout.'
    )
    setStatus('Decode ready')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setPreviewMessage(preview, message, true)
    setPreviewNote('Preview is unavailable due to decode errors.', true)
    setStatus('Decode failed')
  }
}

if (decodeButton) {
  decodeButton.addEventListener('click', () => {
    void handleDecode()
  })
}

if (decodeInputButton) {
  decodeInputButton.addEventListener('click', () => {
    void handleDecodeInput()
  })
}

if (toggleOutputButton) {
  toggleOutputButton.addEventListener('click', () => {
    const isCollapsed = output?.classList.contains('is-collapsed') ?? false
    setOutputCollapsed(!isCollapsed)
  })
}
