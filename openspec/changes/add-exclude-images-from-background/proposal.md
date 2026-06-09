# Add `excludeImagesFromBackground` Decode Background Option

## Why

`BackgroundDecodeOptions` 目前只能通过 `excludeTextFromBackground` 让背景缩略图省略文字，但无法在保留文字时省略图片。当调用方想让 decode 输出的背景缩略图只承载文字与样式容器（不再注入前景图片占位）时，没有任何 API 可用，只能要么连文字一起去掉，要么照常带图。

实际使用场景：调用方希望背景图只表达布局/底色/边框，前景图片由 decode 出来的 `<img>` 单独承载。这样既避免背景里出现重复图片，又不损失前景图片渲染。

## What Changes

### Core Objective
在 `BackgroundDecodeOptions` 上新增可选布尔位 `excludeImagesFromBackground`，仅在显式为 `true` 时从背景缩略图离屏 DOM 中跳过前景图片注入。默认（`undefined` 或 `false`）行为完全不变。

### Deliverables
- `BackgroundDecodeOptions` 增加 `excludeImagesFromBackground?: boolean` 字段（`src/decodeTextControl.ts`）。
- 离屏背景 DOM 构建（`src/pageThumbnailDom.ts`）尊重新选项：当 `excludeImagesFromBackground === true` 时跳过 `images.forEach(...)` 注入块。
- `captureThumbnail()`（`src/index.ts`）将新选项透传给离屏 DOM 构建器。
- `buildDecodePagePayload()`（`src/index.ts`）的背景路由判断扩展为 `excludeTextFromBackground === true || excludeImagesFromBackground === true` 时走自定义 `captureThumbnail()`。
- Demo (`demo/encode.html` + `demo/demo.js`) 新增一个未勾选的复选框 `data-role="bg-exclude-images"`，文案 `Exclude images from background image`，置于现有 `bg-exclude-text` 复选框下方；两条 decode 路径（`handleDecode` / `handleDecodeInput`）都将其纳入 `data.background`。
- `demo/demoDocumentSerialization.d.ts` 中的 `BackgroundDecodeOptions` 镜像类型同步增加该字段。

## Capabilities

### Must Have
- 公共选项名 `excludeImagesFromBackground`（camelCase），位于 `BackgroundDecodeOptions`。
- 仅 `excludeImagesFromBackground === true` 触发图片排除；`undefined`/`false` 与现状完全一致。
- 仅图片排除（`excludeText` 未开 + `excludeImages` 开）的组合，必须走自定义 `captureThumbnail()` 而不是 `p.getThumbnail()`。
- 前景 decode 出的 `<img>` 不受影响（本选项只控制背景离屏 DOM）。
- Demo 复选框默认未勾选，位置在 `bg-exclude-text` 下方。

### Must NOT Have
- 不修改 `EncodeOptions`、`HtmlParser.encode()` 签名或 encode 阶段的图片采集。
- 不支持 CSS `background-image`、SVG、`<picture>`、`<video>` poster 作为排除目标 —— 本选项只针对 encode 阶段已收集到的 `IntermediateImage` 前景图。
- 不引入嵌套配置（如 `excludeContent: { text, images }`）。
- 不调整外部 `@hamster-note/types` 或 `IntermediateDocument` schema。
- 不复用 `excludeTextFromBackground` 语义；两者互相独立，可任意组合。

## Impact

- **API Surface**: `BackgroundDecodeOptions` 新增一个可选布尔字段，向后兼容。
- **Type Exports**: 同名字段镜像到 `demo/demoDocumentSerialization.d.ts`。
- **Demo**: `demo/encode.html` 新增一个复选框；`demo/demo.js` 两条 decode 路径读取并透传。
- **Default Behavior**: 不变。所有已通过的回归测试仍应通过；存在一处带注释「图片始终渲染，不受 excludeTextFromBackground 影响」的回归测试需要把语义收窄为「在未启用 excludeImagesFromBackground 时图片始终渲染」。
- **Test Coverage**: 新增针对「仅图片排除」「文字+图片同时排除」「未设置时图片仍渲染」的覆盖。
- **Non-Goals**: 见 Must NOT Have；CSS 背景图、SVG、`<picture>`、`<video>` 不在本次范围。
