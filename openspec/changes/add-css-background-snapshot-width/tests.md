# Tests - `snapshotWidth` Encode Option

## Test Categories

### 1. API Type Tests

**File**: `src/__tests__/typeExports.test.ts`

- [ ] **Assertion**: `EncodeOptions` exported type includes `snapshotWidth?: number` field.
- [ ] **Assertion**: Assigning `{ snapshotWidth: 1440 }` to `EncodeOptions` compiles without error.
- [ ] **Assertion**: Assigning `{ snapshotWidth: "1024" }` to `EncodeOptions` produces a TypeScript compilation error.

### 1b. Runtime Validation Tests

**File**: `src/__tests__/htmlParser.test.ts`

- [ ] **Scenario**: Valid integer widths in range `[100, 10000]` resolve successfully
  - **Given**: `HtmlParser.encode(buffer, { snapshotWidth: value })` with `value` in `{100, 640, 10000}`
  - **Then**: Encode resolves; html2canvas is called with matching `width` option
- [ ] **Scenario**: Invalid widths throw `Invalid snapshotWidth: ${value}`
  - **Given**: `snapshotWidth` is one of `99`, `10001`, `0`, `-1`, `NaN`, `Infinity`, `1.5`
  - **Then**: `HtmlParser.encode()` rejects with `Error("Invalid snapshotWidth: ...")`

### 2. Unit Tests - Iframe Width

**File**: `src/__tests__/htmlParser.test.ts`

- [ ] **Scenario**: Default behavior (no snapshotWidth)
  - **Given**: `HtmlParser.encode(buffer)` is called without `snapshotWidth`
  - **When**: The internal `withIframeDocument` creates the iframe
  - **Then**: `iframe.style.width` is exactly `"1024px"`

- [ ] **Scenario**: Custom snapshotWidth
  - **Given**: `HtmlParser.encode(buffer, { snapshotWidth: 800 })` is called
  - **When**: The internal `withIframeDocument` creates the iframe
  - **Then**: `iframe.style.width` is exactly `"800px"`

- [ ] **Scenario**: Document root element width
  - **Given**: `HtmlParser.encode(buffer, { snapshotWidth: 600 })` is called
  - **When**: `collectTextsFromDocument` runs
  - **Then**: `doc.documentElement.style.width` is exactly `"600px"`

### 3. Unit Tests - Thumbnail Cache Isolation

**File**: `src/__tests__/htmlParser.test.ts` (lazy thumbnail test section)

- [ ] **Scenario**: Different widths do not share cache
  - **Given**: `buildLazyThumbnailFn` is created with `snapshotWidth = 1024`
  - **When**: First call with `scale = 0.3` returns thumbnail A
  - **And**: A second encode with `snapshotWidth = 800` and `scale = 0.3` returns thumbnail B
  - **Then**: Thumbnail A and B are different images (different widths)

- [ ] **Scenario**: Same width and scale share cache
  - **Given**: `buildLazyThumbnailFn` is created with `snapshotWidth = 1024`
  - **When**: First call with `scale = 0.3` returns thumbnail A
  - **And**: Second call with `scale = 0.3` returns thumbnail B
  - **Then**: Thumbnail A === Thumbnail B (cached result)

### 4. Unit Tests - html2canvas Options

**File**: `src/__tests__/htmlParser.test.ts` or new test file

- [ ] **Scenario**: html2canvas receives width and windowWidth
  - **Given**: `captureThumbnail` is called with `snapshotWidth = 1200`
  - **When**: `html2canvas` is invoked
  - **Then**: The options object contains `width: 1200` and `windowWidth: 1200`

- [ ] **Scenario**: Default html2canvas options (no snapshotWidth)
  - **Given**: `captureThumbnail` is called without `snapshotWidth`
  - **When**: `html2canvas` is invoked
  - **Then**: The options object does not contain `width` or `windowWidth` (letting html2canvas use element natural width)

### 5. Unit Tests - Offscreen DOM Width

**File**: `src/__tests__/renderer.test.ts` or `src/__tests__/pageThumbnailDom.test.ts`

- [ ] **Scenario**: buildOffscreenPageElement uses page width by default
  - **Given**: `buildOffscreenPageElement` is called with `page.width = 800` and no `snapshotWidth`
  - **When**: The wrapper element is created
  - **Then**: `wrapper.style.width` is `"800px"`

- [ ] **Scenario**: buildOffscreenPageElement uses snapshotWidth override
  - **Given**: `buildOffscreenPageElement` is called with `page.width = 800` and `snapshotWidth = 1200`
  - **When**: The wrapper element is created
  - **Then**: `wrapper.style.width` is `"1200px"`

### 6. Integration Tests

**File**: `src/__tests__/htmlParser.test.ts`

- [ ] **Scenario**: End-to-end encode with custom width
  - **Given**: A test HTML string with a fixed-width container of 1440px
  - **When**: `HtmlParser.encode(buffer, { snapshotWidth: 1440 })` is called
  - **Then**: The returned `IntermediateDocument` contains a page with `width === 1440`
  - **And**: The lazy thumbnail function produces an image with width 1440

- [ ] **Scenario**: End-to-end encode with default width
  - **Given**: A test HTML string with a fixed-width container of 1440px
  - **When**: `HtmlParser.encode(buffer)` is called (no snapshotWidth)
  - **Then**: The returned `IntermediateDocument` contains a page with `width === 1024` (existing behavior)

### 7. Demo UI Tests

**File**: E2E tests (`e2e/test_encode_parse_decode.py` or `e2e/test_encode_json_input.py`)

- [ ] **Scenario**: Snapshot width input exists and defaults to empty
  - **Given**: The encode demo page is open
  - **When**: Inspecting the `snapshot-width` input
  - **Then**: The input is visible, type is "number", value is empty

- [ ] **Scenario**: Snapshot width value forwards to encode call
  - **Given**: The encode demo page is open
  - **When**: The user enters `800` in the snapshot-width input and clicks "Parse current page"
  - **Then**: The resulting JSON output contains a page whose thumbnail generation context reflects 800px width

## Test Priorities

| Priority | Category | Rationale |
|----------|----------|-----------|
| P0 | API Type Tests | Must compile before any runtime test matters |
| P0 | Default behavior | Zero regression risk; existing tests must still pass |
| P1 | Iframe / Doc root width | Core feature behavior |
| P1 | html2canvas options | Core feature behavior |
| P1 | Offscreen DOM width | Core feature behavior |
| P2 | Cache isolation | Quality / correctness guard |
| P2 | Integration | Validates full pipeline |
| P2 | Demo UI | User-facing verification |

## Notes

- All existing tests must continue to pass without modification, validating the "default behavior unchanged" guarantee.
- RED tests should be written before implementation (TDD style) for the new behavior paths.
- Mock `html2canvas` in unit tests to avoid actual canvas rendering overhead.
