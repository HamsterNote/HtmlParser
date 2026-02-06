import { HtmlParser } from '../dist/index.js'

const parseButton = document.querySelector('[data-action="parse"]')
const output = document.querySelector('[data-role="output"]')
const status = document.querySelector('[data-role="status"]')

const setStatus = (text) => {
  if (status) {
    status.textContent = text
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
  }
}

if (parseButton) {
  parseButton.addEventListener('click', () => {
    void handleParse()
  })
}
