# Design - HtmlParser Encode/Decode Media Options

## Context

### Codebase Orientation
- `src/index.ts` is the main HtmlParser class. `HtmlParser.encode(fileOrBuffer)` is currently single-arg. New signature must be `encode(fileOrBuffer, options?: EncodeOptions)`.
- Image collection lives in `collectImagesFromDocument()` (src/index.ts ~line 1262). Already handles data: URLs, canvas conversion, hidden/zero-size skip via `rect.width === 0 || rect.height === 0`.
- Text collection has TWO paths:
  1. `collectRenderedTextSegments()` - rendered DOM segments path (preferred when DOM measurable).
  2. `collectTextsFromDocumentFallback()` - DFS fallback when rendered path returns empty.
- Both paths must apply `excludeSelectors`.
- Thumbnail / background: `captureThumbnail()` (src/index.ts ~line 182) calls `buildOffscreenPageElement` from `src/pageThumbnailDom.ts`, then html2canvas. Already accepts `excludeTextFromBackground` flag in `BackgroundDecodeOptions`.
- Worker rendering: `src/htmlParserWorkerCore.ts` has `renderPageDiv()`, `renderTextSpan()`, `serializeWorkerContentItem()`. Foreground `<img>` rendering must be added here.
- Test environment: Jest + happy-dom (see jest.config.cjs). happy-dom may not report some computed styles (e.g. box-shadow) - Task 1 must verify and document.
- E2E: Python+Playwright+pytest (`npm run test:e2e`, see e2e/ dir).
- Demo: `demo/encode.html` + `demo/demo.js`. Uses `handleParse()` → `HtmlParser.encode(input)`.

### Conventions
- Chinese comments preferred (per AGENTS.md).
- TDD mandatory: write failing tests first, then implementation.
- `@hamster-note/types` exports `IntermediateContent = IntermediateText | IntermediateImage` and `IntermediateImage.parse()` for round-trip.
- `intermediateTextGuard.ts` exports `isIntermediateTextLike`, `isIntermediateImageLike`.

## Goals / Non-Goals

### Goals
- Public encode API supports selector exclusion and is covered by tests
- Mixed text/image `content` survives encode, serialization, demo parse, decode, and E2E flows
- Background thumbnails preserve whitelisted visual boxes when text is excluded
- Demo defaults to Sample-content-only encode and visibly demonstrates selector exclusion, foreground images, decoded images, and styled background capture

### Non-Goals
- No broad `getComputedStyle()` full-copy
- No `includeSelectors` or selector priority system
- No SVG / `<picture>` / video poster support
- No lint script repair
- No rewrite of the whole encode traversal pipeline

## Decisions

### API Shape
- `HtmlParser.encode(input, options?: EncodeOptions)` where `EncodeOptions = { excludeSelectors?: string[] }`
- `undefined`/`[]` selectors → no-op (full behavior preserved)
- Invalid selector → throw `Invalid exclude selector: <selector>` BEFORE doing any partial encode work
- Exclusion semantics: an element/text-node is excluded if it itself OR any ancestor matches any selector (`matches(sel) || closest(sel)`)
- No `includeSelectors` in v1

### Image Policy
- Data URLs unchanged
- Non-data img → canvas conversion attempted; failure → preserve original src
- Hidden / 0×0 / display:none → skip
- No SVG, `<picture>`, video poster, CSS background-image

### Background Style Whitelist
- background-color
- border-top/right/bottom/left-width/style/color (12 longhands)
- border-top/right/bottom/left-radius (4 corners)
- box-shadow
- outline-width/style/color
- DO NOT copy: transform, filter, blend modes, full computed style

### Decode Renderer
- IntermediateImage → foreground `<img>` with position:absolute
- Use axis-aligned bbox from polygon (no rotation v1)
- left/top/width/height/opacity/object-fit:fill
- Optional `clip-path: inset(...)` from `clip`
- z-index: background (default) < image (e.g. 1) < text spans (e.g. 2)

### Demo
- Default selector input pre-populated with selector list that EXCLUDES everything outside Sample content container
- Stable id/class on Sample content container
- User edits replace selector list (no hidden merge)

## Risks / Trade-offs

### Z-index Ordering
- Target: background thumbnail < foreground images < text spans
- Implementation: `.hamster-note-image { z-index: 1; }` and `.hamster-note-text { z-index: 2; }`

### Subpixel Image Bbox
- `IntermediateImage` polygon/clip coordinates are always in pixel space
- Decode foreground image rendering cannot reuse `cssPxOrPercent()` which treats `Math.abs(val) < 1` as percentage
- Solution: new private `cssPx(val: number): string` helper for bbox values

### happy-dom Computed Style
- Verified: background-color, border properties, border-radius, box-shadow, outline are all readable from both `getComputedStyle(el)` and `el.style.*`
- No fallback/workaround required

## Migration Plan

1. **Wave 1**: Task 1 - Verify style/polygon/container assumptions
2. **Wave 2**: Task 2 - Add `EncodeOptions.excludeSelectors` with TDD coverage
3. **Wave 3**: Tasks 3, 4, 5 - Image encode, decode renderer, background style capture
4. **Wave 4**: Tasks 6, 7, 8 - Demo UI, serialization, regression hardening

### Final Verification
- F1. Plan Compliance Audit
- F2. Code Quality Review
- F3. Real Manual QA
- F4. Scope Fidelity Check
