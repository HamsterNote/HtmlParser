# HtmlParser Encode/Decode Media Options Optimization

## Why

用户要求 HtmlParser 的 encode/decode 功能增强：
1. `encode` 函数增加排除选项，可以按 CSS 选择器排除元素
2. `encode` 支持图片，参考 `@hamster-note/types` 新增内容支持 text/image 混排
3. `encode` 的背景图支持把元素样式并入背景图，解决带 `border`、`background-color` 的元素背景图里只看到文字的问题
4. `decode` 也支持图片解析
5. Demo 体现以上几点，且默认排除 Sample content 栏以外的内容

## What Changes

### Core Objective
Make HtmlParser reliably encode and decode mixed text/image content while allowing callers and the demo to exclude non-target DOM sections by CSS selector, without regressing existing text layout or OpenSpec demo behavior.

### Deliverables
- New `EncodeOptions` type exported from `src/index.ts` or a colocated exported type module
- `HtmlParser.encode(fileOrBuffer, options?)` with selector exclusion applied consistently to rendered text, fallback text, and image extraction
- Decode HTML foreground image renderer in `src/htmlParserWorkerCore.ts` using `IntermediateImage` payloads
- Background style capture pipeline for whitelisted visual styles in `src/index.ts` and/or `src/pageThumbnailDom.ts`
- Demo UI and JS updates in `demo/encode.html`, `demo/demo.js`, and related declarations/tests
- Unit and E2E tests covering all new behavior

## Capabilities

### Must Have
- Public API: `HtmlParser.encode(input, { excludeSelectors: [...] })`
- `excludeSelectors` removes matched elements and descendants from text and foreground image content
- Invalid selector throws a deterministic error message containing `Invalid exclude selector` and the offending selector
- `IntermediatePage.content` carries mixed `IntermediateText` and `IntermediateImage` serialized objects
- Decode output includes `<img>` elements for foreground images, with `position:absolute`, bbox-derived `left/top/width/height`, opacity, optional clip-path, and z-index below text
- Background capture preserves whitelisted visual styles even when text is excluded from background

### Must NOT Have
- No broad `getComputedStyle()` full-copy
- No `includeSelectors` or selector priority system
- No SVG / `<picture>` / video poster support in this change
- No lint script repair; `lint` is currently a placeholder and out of scope
- No rewrite of the whole encode traversal pipeline
- No human-only verification steps

## Impact

- **API Surface**: New optional second parameter for `HtmlParser.encode()`
- **Type Exports**: New `EncodeOptions` type
- **Demo**: Updated with selector exclusion controls and styled background samples
- **Test Coverage**: 162/162 Jest tests passing, 9/9 E2E scenarios passing
- **Build**: `npm run build:all` passes successfully
