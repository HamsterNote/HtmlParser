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
const excludeSelectorsInput = document.querySelector('[data-role="exclude-selectors"]')
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

const parseExcludeSelectors = () => {
  const rawValue = excludeSelectorsInput?.value?.trim() ?? ''

  // 空输入代表不启用 excludeSelectors，保留旧版 demo 的完整页面编码行为。
  if (!rawValue) {
    return undefined
  }

  let parsed
  try {
    parsed = JSON.parse(rawValue)
  } catch {
    throw new Error('Encode exclude selectors must be a JSON array of strings.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Encode exclude selectors must be a JSON array of strings.')
  }

  const selectors = parsed.map((selector) => {
    if (typeof selector !== 'string') {
      throw new Error('Encode exclude selectors must be a JSON array of strings.')
    }
    return selector.trim()
  }).filter(Boolean)

  return selectors.length > 0 ? selectors : undefined
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
    // 添加 <base> 标签以确保 srcdoc 中的相对 URL 能正确解析
    const baseTag = `<base href="${document.baseURI}">`
    const htmlWithBase = html.includes('<head>')
      ? html.replace('<head>', `<head>${baseTag}`)
      : `${baseTag}${html}`
    const buffer = new TextEncoder().encode(htmlWithBase).buffer
    const excludeSelectors = parseExcludeSelectors()
    // 默认值写在 encode.html，使用“反选”方式排除 demo chrome/control 区，
    // 让默认 Parse 输出稳定聚焦在 #sample-content，便于观察样式背景与图文混排。
    const doc = excludeSelectors
      ? await HtmlParser.encode(buffer, { excludeSelectors })
      : await HtmlParser.encode(buffer)
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
    if (!rawText.startsWith('{')) {
      throw new Error('JSON output is not available. Run "Parse current page".')
    }
    const data = JSON.parse(rawText)

    const bgIncludeCheckbox = document.querySelector('[data-role="bg-include"]')
    const bgQualitySlider = document.querySelector('[data-role="bg-quality"]')
    const bgExcludeTextCheckbox = document.querySelector('[data-role="bg-exclude-text"]')
    const bgExcludeImagesCheckbox = document.querySelector('[data-role="bg-exclude-images"]')

    const includeBackground = bgIncludeCheckbox?.checked ?? true
    const backgroundQuality = parseFloat(bgQualitySlider?.value ?? '0.3')
    const excludeTextFromBackground = bgExcludeTextCheckbox?.checked ?? false
    const excludeImagesFromBackground = bgExcludeImagesCheckbox?.checked ?? false

    const hasCustomBg = !includeBackground || backgroundQuality !== 0.3 || excludeTextFromBackground || excludeImagesFromBackground
    if (hasCustomBg) {
      data.background = {
        includeBackground,
        backgroundQuality,
        excludeTextFromBackground,
        excludeImagesFromBackground
      }
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
    if (!rawText.startsWith('{')) {
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

    const bgIncludeCheckbox = document.querySelector('[data-role="bg-include"]')
    const bgQualitySlider = document.querySelector('[data-role="bg-quality"]')
    const bgExcludeTextCheckbox = document.querySelector('[data-role="bg-exclude-text"]')
    const bgExcludeImagesCheckbox = document.querySelector('[data-role="bg-exclude-images"]')

    const includeBackground = bgIncludeCheckbox?.checked ?? true
    const backgroundQuality = parseFloat(bgQualitySlider?.value ?? '0.3')
    const excludeTextFromBackground = bgExcludeTextCheckbox?.checked ?? false
    const excludeImagesFromBackground = bgExcludeImagesCheckbox?.checked ?? false

    const hasCustomBg = !includeBackground || backgroundQuality !== 0.3 || excludeTextFromBackground || excludeImagesFromBackground
    if (hasCustomBg) {
      data.background = {
        includeBackground,
        backgroundQuality,
        excludeTextFromBackground,
        excludeImagesFromBackground
      }
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

const bgQualitySlider = document.querySelector('[data-role="bg-quality"]')
const bgQualityValue = document.querySelector('[data-role="bg-quality-value"]')
if (bgQualitySlider && bgQualityValue) {
  bgQualitySlider.addEventListener('input', () => {
    bgQualityValue.textContent = bgQualitySlider.value
  })
}
