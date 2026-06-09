# Tasks - HtmlParser Encode/Decode Media Options

## Tasks

### Plan: htmlparser-encode-decode-media-options

- [x] 1. Verify style/polygon/container assumptions before API work

  **What to do**: Add minimal diagnostic assertions that prove the current test environment can inspect whitelisted computed styles, that decode page containers support absolute children, and that `IntermediateImage.polygon` coordinates align with existing text page coordinates. If happy-dom cannot report a property such as `box-shadow`, document and test through direct style assignment/mocked computed style instead of weakening runtime behavior.
  **Must NOT do**: Do not implement feature behavior yet. Do not change public APIs.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: requires careful test-environment risk assessment.
  - Skills: `[]` - no specialized skill needed.
  - Omitted: `frontend-design` - not a design task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2,3,4,5,6,7,8] | Blocked By: []

  **References**:
  - Pattern: `src/__tests__/renderer.test.ts` - decode renderer assertions and image clip-path patterns.
  - Pattern: `src/__tests__/htmlParser.test.ts` - encode DOM and html2canvas test patterns.
  - API/Type: `src/pageThumbnailDom.ts` - offscreen page DOM construction.
  - API/Type: `src/textGeometry.ts` - polygon/bounding geometry utilities.

  **Acceptance Criteria**:
  - [ ] `npm test -- --runInBand src/__tests__/renderer.test.ts src/__tests__/htmlParser.test.ts` passes after adding assumption coverage.
  - [ ] Tests or comments explicitly establish z-index order target: background < foreground image < text.
  - [ ] Evidence file `.omo/evidence/task-1-assumptions.txt` records whether happy-dom needed mocking for style values.

  **QA Scenarios**:
  ```
  Scenario: Computed style whitelist is testable
    Tool: Bash
    Steps: Run `npm test -- --runInBand src/__tests__/htmlParser.test.ts` after adding a fixture element with background, border, radius, shadow, outline.
    Expected: Test can assert all whitelist properties either from computed style or controlled mock; no skipped assertion.
    Evidence: .omo/evidence/task-1-style-test.txt

  Scenario: Absolute image positioning assumptions hold
    Tool: Bash
    Steps: Run `npm test -- --runInBand src/__tests__/renderer.test.ts` with a constructed IntermediateImage polygon.
    Expected: Renderer test can assert page container position context and bbox dimensions.
    Evidence: .omo/evidence/task-1-position-test.txt
  ```

  **Commit**: YES | Message: `test(html-parser): verify media style assumptions` | Files: [`src/__tests__/*`]

- [x] 2. Add `EncodeOptions.excludeSelectors` with TDD coverage across text and images

  **What to do**: Introduce exported `EncodeOptions = { excludeSelectors?: string[] }`; change `HtmlParser.encode(fileOrBuffer, options?)`; validate selectors once inside the iframe document; apply exclusion to rendered text collection, fallback text collection, and `collectImagesFromDocument()`. Treat `undefined`/`[]` as no-op. Throw `Invalid exclude selector: <selector>` for invalid selectors.
  **Must NOT do**: Do not add `includeSelectors`, comma-string parsing, or hidden default selectors in core API.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: public API and traversal behavior.
  - Skills: `[]` - TypeScript/Jest work only.
  - Omitted: `workers-best-practices` - no worker architecture change.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [3,6,7,8] | Blocked By: [1]

  **References**:
  - Pattern: `src/index.ts` - `HtmlParser.encode(fileOrBuffer: ParserInput): Promise<HtmlDocument>`.
  - Pattern: `src/index.ts` - `collectRenderedTextSegments()`, `collectImagesFromDocument()`, fallback collection path.
  - Test: `src/__tests__/htmlParser.test.ts` - encode fixtures and DOM lifecycle tests.
  - Spec: `openspec/changes/fix-encode-iseol-single-line/proposal.md` - avoid regressing `isEOL` semantics.

  **Acceptance Criteria**:
  - [ ] Test first: fixture with `.exclude` and `.keep` text/images fails before implementation and passes after implementation.
  - [ ] `excludeSelectors: ['.exclude']` removes `.exclude` text and image descendants, retains `.keep`.
  - [ ] `excludeSelectors: ['body']` returns a legal document/page with empty content, not an exception.
  - [ ] `excludeSelectors: ['<<<']` rejects with `Invalid exclude selector`.
  - [ ] Existing `isEOL` tests still pass.

  **QA Scenarios**:
  ```
  Scenario: Exclude selector removes matching subtree
    Tool: Bash
    Steps: Run `npm test -- --runInBand src/__tests__/htmlParser.test.ts -t excludeSelectors`.
    Expected: Output document content contains only `.keep` text/image; excluded subtree absent.
    Evidence: .omo/evidence/task-2-exclude-subtree.txt

  Scenario: Invalid selector fails clearly
    Tool: Bash
    Steps: Run `npm test -- --runInBand src/__tests__/htmlParser.test.ts -t "Invalid exclude selector"`.
    Expected: Promise rejects with deterministic error including offending selector.
    Evidence: .omo/evidence/task-2-invalid-selector.txt
  ```

  **Commit**: YES | Message: `feat(encode): add selector exclusion options` | Files: [`src/index.ts`, `src/__tests__/htmlParser.test.ts`]

- [x] 3. Guarantee encode mixed text/image `content` output and DOM order

  **What to do**: Add TDD coverage proving encoded pages serialize mixed text and image entries into `IntermediatePage.content` using `@hamster-note/types` contracts. Ensure image objects include `id`, `src`, `polygon`, `opacity`, optional `clip`, and that text/image ordering follows DOM visual/document order as currently expected by renderer tests. If current `buildEncodeDocumentPayload()` merges all texts then all images, adjust ordering by source geometry/order metadata rather than breaking text line ordering.
  **Must NOT do**: Do not introduce support for SVG, `<picture>`, CSS background-image, or video poster.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: type contract and ordering may affect downstream consumers.
  - Skills: `[]`.
  - Omitted: `librarian` - type contract already researched.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [7,8] | Blocked By: [2]

  **References**:
  - API/Type: `node_modules/@hamster-note/types` - `IntermediateContent = IntermediateText | IntermediateImage`.
  - Pattern: `src/htmlParserWorkerCore.ts` - `buildEncodeDocumentPayload()` currently receives `texts[]` and `images[]`.
  - Pattern: `src/intermediateTextGuard.ts` - image/text duck type guards.
  - Test: `src/__tests__/htmlParser.test.ts` - existing image encode tests.

  **Acceptance Criteria**:
  - [ ] Mixed fixture `text → img → text` produces `page.content` length 3 with image object in the expected sequence.
  - [ ] Data URL image `src` remains unchanged.
  - [ ] 0×0 or `display:none` image is skipped.
  - [ ] Failed image data conversion preserves original `src` and does not fail encode.

  **QA Scenarios**:
  ```
  Scenario: Mixed content order round-trip
    Tool: Bash
    Steps: Run `npm test -- --runInBand src/__tests__/htmlParser.test.ts -t "mixed content"`.
    Expected: Serialized page content alternates text/image/text with valid image fields.
    Evidence: .omo/evidence/task-3-mixed-order.txt

  Scenario: Hidden image skipped
    Tool: Bash
    Steps: Run encode test fixture containing visible and display:none images.
    Expected: Only visible non-zero image appears in content.
    Evidence: .omo/evidence/task-3-hidden-image.txt
  ```

  **Commit**: YES | Message: `feat(encode): preserve mixed image content` | Files: [`src/index.ts`, `src/htmlParserWorkerCore.ts`, `src/__tests__/htmlParser.test.ts`]

- [x] 4. Render `IntermediateImage` foreground content in decode HTML

  **What to do**: Extend `src/htmlParserWorkerCore.ts` rendering so `renderPageDiv()` emits foreground `<img>` elements for `IntermediateImage` content items. Use axis-aligned bbox from polygon for v1; apply `left`, `top`, `width`, `height`, `opacity`, `position: absolute`, `object-fit: fill`, optional clip-path from `clip`; assign z-index lower than text spans and higher than background. Preserve background thumbnail behavior.
  **Must NOT do**: Do not implement rotated/skewed image transforms; non-axis-aligned polygons degrade to bbox.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: renderer output and worker payload compatibility.
  - Skills: `[]`.
  - Omitted: `frontend-design` - output is functional renderer CSS, not design.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [7,8] | Blocked By: [1]

  **References**:
  - Pattern: `src/htmlParserWorkerCore.ts` - `renderPageDiv()`, `renderTextSpan()`, `serializeWorkerContentItem()`.
  - Pattern: `src/pageThumbnailDom.ts` - existing image DOM style and clip-path logic.
  - Test: `src/__tests__/renderer.test.ts` - decode HTML assertions and image clip-path rendering.
  - API/Type: `src/intermediateTextGuard.ts` - `isIntermediateImageLike()`.

  **Acceptance Criteria**:
  - [ ] Decode of a page containing one `IntermediateImage` outputs an `<img>` tag with the expected `src`.
  - [ ] Style contains bbox-derived `left`, `top`, `width`, `height` values.
  - [ ] Text and image coexist; text z-index is higher than image z-index.
  - [ ] Image `clip` renders an equivalent `clip-path: inset(...)` or existing project-compatible clipping style.

  **QA Scenarios**:
  ```
  Scenario: Decode foreground image
    Tool: Bash
    Steps: Run `npm test -- --runInBand src/__tests__/renderer.test.ts -t "foreground image"`.
    Expected: Generated HTML contains one positioned `<img>` with exact source and geometry.
    Evidence: .omo/evidence/task-4-foreground-image.txt

  Scenario: Text overlays foreground image
    Tool: Bash
    Steps: Run renderer test with one image and one text span overlapping.
    Expected: Both elements render; CSS z-index ordering is background < img < text.
    Evidence: .omo/evidence/task-4-z-index.txt
  ```

  **Commit**: YES | Message: `feat(decode): render foreground images` | Files: [`src/htmlParserWorkerCore.ts`, `src/__tests__/renderer.test.ts`]

- [x] 5. Preserve whitelisted visual styles in background thumbnail capture

  **What to do**: Implement a small style-capture model for visual containers so background thumbnail DOM can include background-color, border longhands, border-radius, box-shadow, and outline even when text is omitted from background. Capture only elements with visible non-default whitelist styles and non-zero rects. Ensure excluded foreground text remains omitted when `excludeTextFromBackground` is true.
  **Must NOT do**: Do not copy transforms, filters, blend modes, arbitrary layout properties, or full computed style.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: html2canvas/background behavior and style whitelist precision.
  - Skills: `[]`.
  - Omitted: `frontend-design` - no visual redesign.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [6,8] | Blocked By: [1]

  **References**:
  - Pattern: `src/pageThumbnailDom.ts` - `buildOffscreenPageElement()`.
  - Pattern: `src/index.ts` - `captureThumbnail()` and `buildLazyThumbnailFn()`.
  - Test: `src/__tests__/renderer.test.ts` - background options tests.
  - Test utility: `src/testUtils/html2canvasTestUtils.ts` - fake capture assertions.

  **Acceptance Criteria**:
  - [ ] Fixture with styled container and text, captured with `excludeTextFromBackground: true`, produces offscreen DOM containing style box but no text content.
  - [ ] Whitelist includes: `background-color`, four-side border width/style/color, border radius corners, box-shadow, outline width/style/color.
  - [ ] Non-whitelist property such as `transform` is not copied into background style overlay.
  - [ ] Elements with no visible whitelist style or zero rect are skipped.

  **QA Scenarios**:
  ```
  Scenario: Visual container retained without text
    Tool: Bash
    Steps: Run `npm test -- --runInBand src/__tests__/renderer.test.ts -t "background style"`.
    Expected: Offscreen capture DOM has styled box, no text nodes, and html2canvas receives it.
    Evidence: .omo/evidence/task-5-style-container.txt

  Scenario: Full computed style not copied
    Tool: Bash
    Steps: Run whitelist test with `transform: rotate(10deg)` and `filter: blur(1px)`.
    Expected: Generated background style overlay omits transform/filter.
    Evidence: .omo/evidence/task-5-whitelist.txt
  ```

  **Commit**: YES | Message: `feat(background): preserve visual container styles` | Files: [`src/index.ts`, `src/pageThumbnailDom.ts`, `src/__tests__/renderer.test.ts`, `src/__tests__/htmlParser.test.ts`]

- [x] 6. Update demo UI/default selector to showcase exclusion and styled backgrounds

  **What to do**: Add a stable Sample content container selector/id in `demo/encode.html`; add exclude selector input with default value that excludes all content outside Sample content; wire `demo/demo.js handleParse()` to call `HtmlParser.encode(input, { excludeSelectors })`; add sample content showing text/image mix and a styled border/background/radius/shadow/outline container. Update `.d.ts` if demo module signatures change.
  **Must NOT do**: Do not redesign the whole demo or hide existing JSON/decode controls required by OpenSpec.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded demo HTML/JS update after core API exists.
  - Skills: `[]`.
  - Omitted: `frontend-design` - functional demo only.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [8] | Blocked By: [2,5]

  **References**:
  - Pattern: `demo/encode.html` - current Sample content, controls, output areas.
  - Pattern: `demo/demo.js` - `handleParse()`, `handleDecode()`, background controls.
  - Spec: `openspec/specs/htmlparser-demo-page/spec.md` - demo parse/output/decode requirements.
  - Spec: `openspec/specs/demo-decode-preview/spec.md` - preview/error behavior.

  **Acceptance Criteria**:
  - [ ] Demo has visible selector input with default value targeting exclusion outside Sample content.
  - [ ] Clicking Parse uses `EncodeOptions.excludeSelectors` from the input.
  - [ ] Default parse output excludes demo controls and includes Sample text/image/styled container data.
  - [ ] Existing decode preview and invalid JSON error behavior remain visible and functional.

  **QA Scenarios**:
  ```
  Scenario: Demo default encodes only Sample content
    Tool: Bash
    Steps: Run `npm run build:all && npm run test:e2e -- -k encode_parse_decode`.
    Expected: E2E asserts output JSON includes Sample content and excludes button/control labels.
    Evidence: .omo/evidence/task-6-demo-default.txt

  Scenario: User-edited selector replaces default
    Tool: Bash
    Steps: E2E clears selector input, clicks Parse, compares JSON content count against default parse.
    Expected: Cleared selector output contains more page/demo content than default output.
    Evidence: .omo/evidence/task-6-demo-selector-edit.txt
  ```

  **Commit**: YES | Message: `feat(demo): add encode exclusion controls` | Files: [`demo/encode.html`, `demo/demo.js`, `demo/*.d.ts`, `e2e/*`]

- [x] 7. Extend demo serialization and decode round-trip coverage for images

  **What to do**: Update `demo/demoDocumentSerialization.js` tests and implementation if needed so serialized documents preserve `IntermediateImage` items in `content`, parse them back, and `decodeSerializedDocumentToHtml()` produces foreground `<img>` output. Confirm thumbnail/background image data remains distinct from foreground image content.
  **Must NOT do**: Do not create a parallel demo-only document schema.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: mostly tests and serialization compatibility.
  - Skills: `[]`.
  - Omitted: `fullstack-dev` - no backend/integration service.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [8] | Blocked By: [3,4]

  **References**:
  - Pattern: `demo/demoDocumentSerialization.js` - serialize/parse/decode helper flow.
  - Test: `src/__tests__/demoDocumentSerialization.test.ts` - current round-trip coverage.
  - API/Type: `@hamster-note/types` - `IntermediateImage.parse()` and serialized fields.

  **Acceptance Criteria**:
  - [ ] Serialized JSON includes foreground image items in page `content`.
  - [ ] Parsing serialized JSON preserves image `src`, `polygon`, `opacity`, and `clip`.
  - [ ] Demo decode helper output contains foreground `<img>` for image content.
  - [ ] Invalid/incompatible image payload still reports decode error through existing demo path.

  **QA Scenarios**:
  ```
  Scenario: Demo serialization preserves image
    Tool: Bash
    Steps: Run `npm test -- --runInBand src/__tests__/demoDocumentSerialization.test.ts -t image`.
    Expected: Image survives serialize → parse → decode with exact src and geometry.
    Evidence: .omo/evidence/task-7-demo-image-roundtrip.txt

  Scenario: Invalid image payload reports error
    Tool: Bash
    Steps: Run demo serialization invalid payload test with image missing `polygon`.
    Expected: Decode helper rejects/reports error without rendering stale preview.
    Evidence: .omo/evidence/task-7-invalid-image.txt
  ```

  **Commit**: YES | Message: `test(demo): cover image serialization roundtrip` | Files: [`demo/demoDocumentSerialization.js`, `src/__tests__/demoDocumentSerialization.test.ts`]

- [x] 8. Run full regression hardening and document edge-case behavior

  **What to do**: Add or tighten tests for overlapping selectors, zero-match selectors, empty page output, non-axis-aligned image polygon bbox fallback, failed image conversion fallback, and build/type exports. Run full unit/build/E2E commands and store evidence.
  **Must NOT do**: Do not broaden scope after regressions; fix only failures related to this feature set.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-cutting verification and regression triage.
  - Skills: `[]`.
  - Omitted: `security-review` - no security audit requested.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: [Final Verification] | Blocked By: [2,3,4,5,6,7]

  **References**:
  - Command: `npm test` - full Jest suite.
  - Command: `npm run build:all` - library/demo/type build.
  - Command: `npm run test:e2e` - Playwright+pytest demo verification.
  - Config: `package.json` - note `lint` is placeholder and not acceptance evidence.

  **Acceptance Criteria**:
  - [ ] `npm test` passes.
  - [ ] `npm run build:all` passes.
  - [ ] `npm run test:e2e` passes.
  - [ ] `EncodeOptions` is exported and usable by TypeScript consumers.
  - [ ] Edge-case behavior is represented in tests, not only comments.

  **QA Scenarios**:
  ```
  Scenario: Full unit/build regression
    Tool: Bash
    Steps: Run `npm test && npm run build:all`.
    Expected: Both commands exit 0.
    Evidence: .omo/evidence/task-8-unit-build.txt

  Scenario: Full demo E2E regression
    Tool: Bash
    Steps: Run `npm run test:e2e`.
    Expected: All pytest Playwright scenarios pass, including new default selector assertions.
    Evidence: .omo/evidence/task-8-e2e.txt
  ```

  **Commit**: YES | Message: `test(html-parser): harden media option regressions` | Files: [`src/__tests__/*`, `e2e/*`, affected source files]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [~] F1. Plan Compliance Audit — oracle (verdict APPROVE; blocked on user okay per plan line 442)
- [~] F2. Code Quality Review — unspecified-high (initial REJECT for cssPx subpixel bug, fixed via cssPx helper + TDD; re-review APPROVE; blocked on user okay)
- [~] F3. Real Manual QA — unspecified-high (+ Playwright/demo E2E) (verdict APPROVE, 5/5 scenarios + e2e 9/9; blocked on user okay)
- [~] F4. Scope Fidelity Check — deep (verdict REJECT; surfaced two findings — R3 narrowing and style-container filter gap — both awaiting user decision A/B/C; blocked on user okay)
