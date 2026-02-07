import { HtmlParser } from '../dist/index.js'

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

const ensureRecord = (value, label) => {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} is missing or invalid.`)
  }
  return value
}

const requireString = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return value
}

const requireNumber = (value, label) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${label} must be a number.`)
  }
  return value
}

const parseSerializedText = (data) => {
  const record = ensureRecord(data, 'Text')
  return {
    id: requireString(record.id, 'Text.id'),
    content: requireString(record.content, 'Text.content'),
    fontSize: requireNumber(record.fontSize, 'Text.fontSize'),
    fontFamily: typeof record.fontFamily === 'string' ? record.fontFamily : '',
    fontWeight:
      typeof record.fontWeight === 'number' ? record.fontWeight : 400,
    italic: Boolean(record.italic),
    color: typeof record.color === 'string' ? record.color : '',
    width: requireNumber(record.width, 'Text.width'),
    height: requireNumber(record.height, 'Text.height'),
    lineHeight: requireNumber(record.lineHeight, 'Text.lineHeight'),
    x: requireNumber(record.x, 'Text.x'),
    y: requireNumber(record.y, 'Text.y'),
    ascent: typeof record.ascent === 'number' ? record.ascent : 0,
    descent: typeof record.descent === 'number' ? record.descent : 0,
    vertical: Boolean(record.vertical),
    dir: typeof record.dir === 'string' ? record.dir : 'ltr',
    rotate: typeof record.rotate === 'number' ? record.rotate : 0,
    skew: typeof record.skew === 'number' ? record.skew : 0,
    isEOL: Boolean(record.isEOL)
  }
}

const parseSerializedPage = (data) => {
  const record = ensureRecord(data, 'Page')
  if (!Array.isArray(record.texts)) {
    throw new Error('Page.texts must be an array.')
  }
  const thumbnail =
    typeof record.thumbnail === 'string' ? record.thumbnail : undefined
  return {
    id: requireString(record.id, 'Page.id'),
    number: requireNumber(record.number, 'Page.number'),
    width: requireNumber(record.width, 'Page.width'),
    height: requireNumber(record.height, 'Page.height'),
    texts: record.texts.map(parseSerializedText),
    getThumbnail: async () => thumbnail
  }
}

const parseSerializedDocument = (data) => {
  const record = ensureRecord(data, 'Document')
  if (!Array.isArray(record.pages)) {
    throw new Error('Document.pages must be an array.')
  }
  const pages = record.pages.map(parseSerializedPage)
  return {
    id: typeof record.id === 'string' ? record.id : 'demo-document',
    title: typeof record.title === 'string' ? record.title : 'Demo Document',
    pages: Promise.resolve(pages)
  }
}

const serializeText = (text) => ({ ...text })
const serializeOutline = (outline) => ({ ...outline })

const serializePage = async (page) => {
  const texts = await page.getTexts()
  return {
    id: page.id,
    number: page.number,
    width: page.width,
    height: page.height,
    thumbnail: await page.getThumbnail(0.3),
    texts: texts.map(serializeText)
  }
}

const serializeIntermediate = async (intermediate) => {
  const pages = await intermediate.pages
  const outline = Array.isArray(intermediate.outline)
    ? intermediate.outline.map(serializeOutline)
    : intermediate.outline
  const serializedPages = await Promise.all(pages.map(serializePage))
  return {
    id: intermediate.id,
    title: intermediate.title,
    outline,
    pages: serializedPages
  }
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
