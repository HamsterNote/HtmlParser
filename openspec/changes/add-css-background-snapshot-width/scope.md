# Scope - `snapshotWidth` Encode Option

## In Scope

### Source Code Changes

The following files and functions SHALL be modified to accept and propagate `snapshotWidth`:

| File | Function / Location | Change |
|------|---------------------|--------|
| `src/index.ts:89` | `EncodeOptions` type | Add `snapshotWidth?: number` field |
| `src/index.ts:133-217` | `buildLazyThumbnailFn()` | Cache key must include resolved snapshotWidth |
| `src/index.ts:219-279` | `captureThumbnail()` | Pass `width` and `windowWidth` to `html2canvas()` options |
| `src/index.ts:1596-1603` | `withIframeDocument()` | Replace hardcoded `iframe.style.width = "1024px"` with parameterized width |
| `src/index.ts:1882` | `collectTextsFromDocument()` | Replace hardcoded `doc.documentElement.style.width = "1024px"` with parameterized width |
| `src/index.ts:2013-2126` | `HtmlParser.encode()` | Resolve `options?.snapshotWidth` and forward to iframe / collection / thumbnail pipeline |
| `src/pageThumbnailDom.ts:212-310` | `buildOffscreenPageElement()` | Accept optional width override for `wrapper.style.width` |
| `demo/encode.html` | Demo UI | Add `snapshot-width` number input below `exclude-selectors` |
| `demo/demo.js:69-106` | `handleParse()` | Read `snapshot-width` input and pass into `HtmlParser.encode(buffer, { snapshotWidth })` |
| `demo/demoDocumentSerialization.d.ts` | Type mirror | Add `snapshotWidth?: number` to `EncodeOptions` mirror |

### CSS Background Visual Capture

The implemented CSS capture path in `src/pageThumbnailDom.ts` SHALL keep broad visual container styles for background snapshots while remaining bounded and deterministic:

- Candidate properties come from computed styles plus inline styles on source DOM elements with non-zero bounding boxes.
- Kept visual categories include background, border, outline, padding, font, text, overflow, flex, grid, align, justify, place, `box-shadow`, `color`, `column-gap`, `display`, `gap`, `opacity`, `row-gap`, and `visibility`.
- Value filtering drops empty values, `none`, CSS reset keywords, `auto`, default computed values, transparent colors, zero-length padding/radius/width/gap/spacing values, invisible overflow defaults, repeat-only backgrounds, and invisible border/outline sides.
- Captured container models store only `left`, `top`, `width`, `height`, and the filtered style map; offscreen rendering applies those styles to `.hamster-note-visual-container` elements.

The implemented denylist SHALL exclude behavior-affecting, unstable, or unsupported fields from background snapshots:

- Explicit names: animation fields, transition fields, `backdrop-filter`, `caret-color`, `cursor`, `filter`, `mix-blend-mode`, `overscroll-behavior*`, `pointer-events`, `resize`, `scroll-behavior`, `scroll-margin`, `scroll-padding`, `user-select`, and `will-change`.
- Prefixes: custom properties (`--*`), vendor/internal properties (`-webkit-*`, `-moz-*`, `-ms-*`), ARIA-like properties, `animation-*`, and `transition-*`.
- Value-level denials: any property whose value contains `url(`, except background properties.

### Behavior Guarantees

1. **Default preservation**: When `snapshotWidth` is `undefined` or omitted, every hardcoded `1024px` value remains exactly as today.
2. **Strict validation**: `snapshotWidth` must satisfy `Number.isFinite(value) && Number.isInteger(value) && value >= 100 && value <= 10000`. Any other defined value (NaN, Infinity, non-integer, out-of-range, zero, negative) causes `resolveSnapshotWidth()` to throw `Invalid snapshotWidth: ${value}` — invalid inputs do NOT silently fall back to default.
3. **Consistency across pipeline**: The same resolved width value must flow through iframe creation, document root styling, html2canvas capture, and offscreen DOM wrapper.
4. **Cache isolation**: Two encode calls with different `snapshotWidth` values must not share a cached thumbnail.

## Out of Scope (Non-Goals)

The following SHALL NOT be changed or introduced:

- **Height control**: No `snapshotHeight` option. Height continues to be determined by existing logic (`pageHeight`, content flow, or hardcoded `2048px` iframe height).
- **Relative or percentage widths**: Only pixel numbers are accepted. Strings like `"100%"`, `"50vw"`, or `"auto"` are explicitly unsupported.
- **Decode phase changes**: `BackgroundDecodeOptions`, `HtmlParser.decodeToHtml()`, `buildDecodePagePayload()`, and background thumbnail generation at decode time are untouched.
- **CSS media query simulation**: Changing the snapshot width does not imply injecting `<meta name="viewport">` or simulating device pixel ratio; it only affects the iframe viewport width and canvas capture width.
- **External schema changes**: `IntermediateDocument`, `IntermediatePage`, `IntermediateImage`, and `@hamster-note/types` packages remain unchanged. The snapshot width is a runtime encode option only.
- **Existing `excludeSelectors` behavior**: The `excludeSelectors` option continues to work exactly as before, independent of `snapshotWidth`.
- **Demo preview sandbox**: `demo/demoPreview.js` sandbox settings are unchanged.
- **Pseudo-elements**: `::before` / `::after` capture remains out of scope; source capture uses element computed styles only.

## Scope Boundaries Diagram

```
Encode Phase (IN SCOPE)
  HtmlParser.encode(buffer, { snapshotWidth })
    -> withIframeDocument(html, resolvedWidth)
    -> collectTextsFromDocument(doc, id, resolvedWidth)
    -> buildLazyThumbnailFn(page, texts, images, pageWidth, pageHeight, sourceDoc, styleContainers)
         -> captureThumbnail(..., resolvedWidth)
              -> html2canvas(element, { width, windowWidth, ... })
              -> buildOffscreenPageElement(..., { snapshotWidth: resolvedWidth })

Decode Phase (OUT OF SCOPE)
  HtmlParser.decodeToHtml(intermediate, options)
    -> buildDecodePagePayload()
         -> p.getThumbnail(quality)  [unchanged]
         -> captureThumbnail()       [unchanged]
```

## Risk Surface

- **Thumbnail cache invalidation**: If the cache key logic is incorrect, callers who switch between widths may see stale thumbnails.
- **Layout drift**: If iframe width and html2canvas width diverge, the captured thumbnail may not match the rendered layout.
- **Zero / negative widths**: Must be guarded to prevent invalid CSS or canvas dimensions.
