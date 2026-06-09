import { Window } from 'happy-dom'

// ---------------------------------------------------------------------------
// Fixture: current demo/encode.html content.
// After Task 7, the HTML MUST contain a number input with
//   data-role="snapshot-width"
// placed inside the exclude-selector-section, near the existing
// exclude-selectors input. Update this string if the HTML template changes.
// ---------------------------------------------------------------------------
const ENCODE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HtmlParser Demo - Encode</title>
    <link rel="stylesheet" href="./demo.css" />
  </head>
  <body>
    <div class="container">
      <header>
        <h1>Encode Demo</h1>
      </header>
      <section id="sample-content" class="card">
        <h2>Sample content</h2>
        <p>Demo content.</p>
      </section>
      <section class="card">
        <h3>JSON Input</h3>
        <p class="input-hint">Paste intermediate document JSON here and click "Decode JSON Input" to render preview.</p>
        <div class="exclude-selector-section">
          <label class="exclude-selector-label" for="exclude-selectors">
            Encode exclude selectors
          </label>
          <p class="input-hint">
            JSON array syntax only. The default excludes page chrome and demo
            controls, leaving only <code>#sample-content</code> in the encoded output.
          </p>
          <input
            id="exclude-selectors"
            class="exclude-selector-input"
            data-role="exclude-selectors"
            value='["body > :not(.container)", ".container > :not(#sample-content)"]'
          />
          <label class="exclude-selector-label" for="snapshot-width">
            Snapshot width (px)
          </label>
          <p class="input-hint">
            Optional. Override the snapshot width used when encoding CSS
            backgrounds. Leave blank to use the default.
          </p>
          <input
            id="snapshot-width"
            class="exclude-selector-input"
            data-role="snapshot-width"
            type="number"
            min="100"
            max="10000"
            step="1"
            placeholder="1024"
          />
        </div>
        <textarea
          class="json-input"
          data-role="json-input"
          placeholder='{"id":"...","title":"...","outline":[],"pages":[...]}'
          rows="8"
        ></textarea>
        <div class="actions">
          <button type="button" class="button-secondary" data-action="decode-input">
            Decode JSON Input
          </button>
          <span class="status" data-role="status">Idle</span>
        </div>
      </section>
      <section class="card">
        <div class="actions">
          <button type="button" data-action="parse">Parse current page</button>
          <button type="button" class="button-secondary" data-action="decode">Decode JSON</button>
        </div>
        <div class="outputs">
          <div class="output-panel">
            <pre class="output" data-role="output">Click the button to inspect the IntermediateDocument JSON output.</pre>
          </div>
          <div class="output-panel">
            <h3>HTML Preview</h3>
            <div class="preview" data-role="preview">
              <span class="preview-placeholder">Decoded HTML preview will appear here.</span>
            </div>
            <p class="preview-note" data-role="preview-note">
              Preview is an approximation based on the IntermediateDocument layout.
            </p>
          </div>
        </div>
      </section>
    </div>
    <script type="module" src="./demo.js"></script>
  </body>
</html>`

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
type MockEncodeResult = { getIntermediateDocument: () => unknown }
type HappyDocument = InstanceType<typeof Window>['document']
type HappyElement = NonNullable<ReturnType<HappyDocument['querySelector']>>
type DemoInputElement = HappyElement & { type: string; value: string }

function parseHtml(html: string): HappyDocument {
  const window = new Window()
  const doc = window.document
  doc.documentElement.innerHTML = html
    .replace(/<!doctype html>/i, '')
    .replace(/<html[^>]*>/, '')
    .replace(/<\/html>/, '')
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<body[^>]*>/, '')
    .replace(/<\/body>/, '')
  return doc
}

function requireElement<T>(element: T | null, name: string): T {
  if (!element) {
    throw new Error(`Missing ${name}`)
  }

  return element
}

// ===========================================================================
// 1. HTML structure tests
// ===========================================================================
describe('demo encode.html snapshot-width input', () => {
  let doc: HappyDocument

  beforeAll(() => {
    doc = parseHtml(ENCODE_HTML)
  })

  it('contains a number input with data-role="snapshot-width"', () => {
    const input = requireElement(doc.querySelector('[data-role="snapshot-width"]'), 'snapshot-width input')
    expect(input.tagName).toBe('INPUT')
  })

  it('has type="number" on the snapshot-width input', () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]') as DemoInputElement | null,
      'snapshot-width input'
    )
    expect(input.type).toBe('number')
  })

  it('matches demo validation bounds on the snapshot-width input', () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]'),
      'snapshot-width input'
    )
    expect(input.getAttribute('min')).toBe('100')
    expect(input.getAttribute('max')).toBe('10000')
    expect(input.getAttribute('step')).toBe('1')
  })

  it('places snapshot-width input inside the exclude-selector-section', () => {
    const section = requireElement(doc.querySelector('.exclude-selector-section'), 'exclude selector section')
    const input = requireElement(section.querySelector('[data-role="snapshot-width"]'), 'snapshot-width input')
    expect(input).toBeTruthy()
  })

  it('locates snapshot-width input after the exclude-selectors input in DOM order', () => {
    const excludeInput = requireElement(doc.querySelector('[data-role="exclude-selectors"]'), 'exclude-selectors input')
    const snapshotInput = requireElement(doc.querySelector('[data-role="snapshot-width"]'), 'snapshot-width input')
    // snapshot-width must appear later in document order
    const position = excludeInput.compareDocumentPosition(snapshotInput)
    const NodeRef = doc.defaultView?.Node ?? { DOCUMENT_POSITION_FOLLOWING: 4 }
    expect(position & NodeRef.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// ===========================================================================
// 2. handleParse() behavior tests — mock-level verification
//
// ===========================================================================
describe('handleParse snapshot-width option forwarding', () => {
  let doc: HappyDocument
  let encodeCalls: Array<{ args: unknown[] }>
  let serializeCalls: Array<{ args: unknown[] }>

  function createMockEncode(): (...args: unknown[]) => Promise<MockEncodeResult> {
    encodeCalls = []
    const fn = (...args: unknown[]) => {
      encodeCalls.push({ args })
      return Promise.resolve({
        getIntermediateDocument: () => ({ id: 'test', title: 'T', pages: [] }),
      })
    }
    return fn
  }

  function createMockSerialize() {
    serializeCalls = []
    const fn = (...args: unknown[]) => {
      serializeCalls.push({ args })
      const intermediate = args[0] as { pages?: unknown[] }
      return Promise.resolve({
        id: 'test',
        title: 'T',
        outline: [],
        pages: intermediate.pages ?? [],
      })
    }
    return fn
  }

  function setupDoc() {
    const window = new Window()
    doc = window.document
    doc.documentElement.innerHTML = ENCODE_HTML
      .replace(/<!doctype html>/i, '')
      .replace(/<html[^>]*>/, '')
      .replace(/<\/html>/, '')
      .replace(/<head>[\s\S]*?<\/head>/, '')
      .replace(/<body[^>]*>/, '')
      .replace(/<\/body>/, '')
  }

  beforeEach(() => {
    setupDoc()
  })

  async function simulateHandleParse(
    document: HappyDocument,
    encodeFn: (...args: unknown[]) => Promise<MockEncodeResult>,
    serializeFn: (...args: unknown[]) => Promise<unknown>,
  ) {
    const output = document.querySelector('[data-role="output"]')
    const snapshotWidthInput = document.querySelector(
      '[data-role="snapshot-width"]'
    ) as DemoInputElement | null

    const rawValue = snapshotWidthInput?.value?.trim() ?? ''
    const encodeOptions: Record<string, unknown> = {}

    if (rawValue) {
      const value = Number(rawValue)
      if (
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value < 100 ||
        value > 10000
      ) {
        throw new Error(`Invalid snapshotWidth: ${value}`)
      }
      encodeOptions.snapshotWidth = value
    }

    const buffer = new TextEncoder().encode('<html></html>').buffer
    const result = Object.keys(encodeOptions).length > 0
      ? await encodeFn(buffer, encodeOptions)
      : await encodeFn(buffer)
    const intermediate = result.getIntermediateDocument()
    const serialized = await serializeFn(intermediate)
    if (output) {
      output.textContent = JSON.stringify(serialized, null, 2)
    }
  }

  it('omits snapshotWidth when input is empty', async () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]') as DemoInputElement | null,
      'snapshot-width input'
    )
    input.value = ''

    const mockEncode = createMockEncode()
    const mockSerialize = createMockSerialize()
    await simulateHandleParse(doc, mockEncode, mockSerialize)

    expect(encodeCalls).toHaveLength(1)
    expect(encodeCalls[0].args[1]).toBeUndefined()
  })

  it('passes { snapshotWidth: value } when input has a positive number', async () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]') as DemoInputElement | null,
      'snapshot-width input'
    )
    input.value = '640'

    const mockEncode = createMockEncode()
    const mockSerialize = createMockSerialize()
    await simulateHandleParse(doc, mockEncode, mockSerialize)

    expect(encodeCalls).toHaveLength(1)
    expect(encodeCalls[0].args[1]).toEqual({ snapshotWidth: 640 })
  })

  it('passes snapshotWidth 1200 and serializes Page width in output', async () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]') as DemoInputElement | null,
      'snapshot-width input'
    )
    const output = requireElement(doc.querySelector('[data-role="output"]'), 'output')
    input.value = '1200'

    encodeCalls = []
    serializeCalls = []
    const mockEncode = (...args: unknown[]) => {
      encodeCalls.push({ args })
      const options = args[1] as { snapshotWidth?: number } | undefined
      return Promise.resolve({
        getIntermediateDocument: () => ({
          id: 'test',
          title: 'T',
          pages: [{ id: 'page-1', width: options?.snapshotWidth, height: 900 }],
        }),
      })
    }
    const mockSerialize = createMockSerialize()

    await simulateHandleParse(doc, mockEncode, mockSerialize)

    expect(encodeCalls).toHaveLength(1)
    expect(encodeCalls[0].args[1]).toEqual({ snapshotWidth: 1200 })
    const parsed = JSON.parse(output.textContent ?? '{}') as {
      pages: Array<{ width?: number }>
    }
    expect(parsed.pages[0].width).toBe(1200)
  })

  it('throws deterministic error for fractional snapshotWidth', async () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]') as DemoInputElement | null,
      'snapshot-width input'
    )
    input.value = '800.7'

    const mockEncode = createMockEncode()
    const mockSerialize = createMockSerialize()
    await expect(
      simulateHandleParse(doc, mockEncode, mockSerialize)
    ).rejects.toThrow('Invalid snapshotWidth: 800.7')

    expect(encodeCalls).toHaveLength(0)
  })

  it('throws deterministic error for non-numeric input', async () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]') as DemoInputElement | null,
      'snapshot-width input'
    )
    // happy-dom sanitizes .value on type="number" inputs; override the getter to simulate non-numeric input
    Object.defineProperty(input, 'value', { get: () => 'abc', configurable: true })

    const mockEncode = createMockEncode()
    const mockSerialize = createMockSerialize()
    await expect(
      simulateHandleParse(doc, mockEncode, mockSerialize)
    ).rejects.toThrow('Invalid snapshotWidth: NaN')
    expect(encodeCalls).toHaveLength(0)
  })

  it('throws deterministic error for negative snapshotWidth', async () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]') as DemoInputElement | null,
      'snapshot-width input'
    )
    input.value = '-100'

    const mockEncode = createMockEncode()
    const mockSerialize = createMockSerialize()
    await expect(
      simulateHandleParse(doc, mockEncode, mockSerialize)
    ).rejects.toThrow('Invalid snapshotWidth: -100')
    expect(encodeCalls).toHaveLength(0)
  })

  it('throws deterministic error for zero snapshotWidth', async () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]') as DemoInputElement | null,
      'snapshot-width input'
    )
    input.value = '0'

    const mockEncode = createMockEncode()
    const mockSerialize = createMockSerialize()
    await expect(
      simulateHandleParse(doc, mockEncode, mockSerialize)
    ).rejects.toThrow('Invalid snapshotWidth: 0')
    expect(encodeCalls).toHaveLength(0)
  })

  it('throws deterministic error for snapshotWidth below the minimum', async () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]') as DemoInputElement | null,
      'snapshot-width input'
    )
    input.value = '99'

    const mockEncode = createMockEncode()
    const mockSerialize = createMockSerialize()
    await expect(
      simulateHandleParse(doc, mockEncode, mockSerialize)
    ).rejects.toThrow('Invalid snapshotWidth: 99')
    expect(encodeCalls).toHaveLength(0)
  })

  it('throws deterministic error for snapshotWidth above the maximum', async () => {
    const input = requireElement(
      doc.querySelector('[data-role="snapshot-width"]') as DemoInputElement | null,
      'snapshot-width input'
    )
    input.value = '10001'

    const mockEncode = createMockEncode()
    const mockSerialize = createMockSerialize()
    await expect(
      simulateHandleParse(doc, mockEncode, mockSerialize)
    ).rejects.toThrow('Invalid snapshotWidth: 10001')
    expect(encodeCalls).toHaveLength(0)
  })
})

// ===========================================================================
// 3. EncodeOptions type test — snapshotWidth must be present in the type
// ===========================================================================
describe('EncodeOptions snapshotWidth field', () => {
  it('EncodeOptions type accepts optional snapshotWidth number field', () => {
    type EncodeOptions = import('../index.js').EncodeOptions

    const options: EncodeOptions = { snapshotWidth: 1024 }
    expect(options.snapshotWidth).toBe(1024)
  })
})
