# Baseline Evidence: Demo UI Lacks Snapshot Width Control

**File**: `demo/encode.html`
**Lines**: 70-84
**Date Captured**: 2026-06-08

## Current Code

```html
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
</div>
```

**File**: `demo/demo.js`
**Lines**: 87-92
**Date Captured**: 2026-06-08

```javascript
const excludeSelectors = parseExcludeSelectors()
const doc = excludeSelectors
  ? await HtmlParser.encode(buffer, { excludeSelectors })
  : await HtmlParser.encode(buffer)
```

## Baseline Behavior

The encode demo page exposes an input for `excludeSelectors` but has no control for `snapshotWidth`. The `handleParse` function in `demo/demo.js` only reads `excludeSelectors` and passes it to `HtmlParser.encode()`. There is no code path that could forward a custom width.

## Expected After Change

`demo/encode.html` should contain a new number input:

```html
<div class="snapshot-width-section">
  <label class="snapshot-width-label" for="snapshot-width">
    Snapshot width (px)
  </label>
  <p class="input-hint">
    Width for the snapshot iframe and thumbnail. Leave empty to use the default (1024).
  </p>
  <input
    id="snapshot-width"
    class="snapshot-width-input"
    data-role="snapshot-width"
    type="number"
    placeholder="1024"
  />
</div>
```

`demo/demo.js` should read this input and include it in the encode call:

```javascript
const snapshotWidthInput = document.querySelector('[data-role="snapshot-width"]')
const snapshotWidth = snapshotWidthInput?.value ? parseInt(snapshotWidthInput.value, 10) : undefined
const doc = await HtmlParser.encode(buffer, {
  excludeSelectors,
  snapshotWidth: Number.isFinite(snapshotWidth) && snapshotWidth > 0 ? snapshotWidth : undefined,
})
```

## Impact

The demo is the primary user-facing validation surface. Without a UI control, the feature cannot be manually exercised or demonstrated.
