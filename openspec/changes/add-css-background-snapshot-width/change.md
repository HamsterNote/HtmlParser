# Add `snapshotWidth` to `EncodeOptions`

## Why

`HtmlParser.encode()` 目前使用硬编码的 `1024px` 宽度创建临时 iframe 并渲染离屏缩略图。调用方无法控制这一宽度，导致以下问题：

1. **宽内容被截断**：当原始 HTML 内容的实际宽度超过 1024px 时，iframe 视口无法容纳，文本折行和元素布局与原始页面不一致，缩略图失真。
2. **窄内容浪费资源**：当内容明显窄于 1024px 时，html2canvas 仍按 1024px 画布截图，产生不必要的空白区域和更大的 base64 数据。
3. **响应式布局不可控**：不同设备宽度下同一 HTML 可能呈现不同布局，调用方需要能够指定快照宽度以匹配目标展示场景。

实际使用场景：调用方在移动端预览时需要按 375px 宽度快照，在桌面端预览时需要按 1440px 宽度快照，当前没有 API 可以表达这一需求。

## What Changes

### Core Objective

在 `EncodeOptions` 上新增可选数值字段 `snapshotWidth?: number`，仅当显式传入时覆盖默认的 `1024px` 宽度；默认（`undefined`）行为完全不变，保持现有硬编码宽度。

### Deliverables

- `EncodeOptions` 增加 `snapshotWidth?: number` 字段（`src/index.ts:89`）。
- `HtmlParser.withIframeDocument()` 接受可选宽度参数，替换硬编码的 `iframe.style.width = "1024px"`（`src/index.ts:1602`）。
- `HtmlParser.collectTextsFromDocument()` 接受可选宽度参数，替换硬编码的 `doc.documentElement.style.width = "1024px"`（`src/index.ts:1882`）。
- `HtmlParser.encode()` 将 `options?.snapshotWidth` 透传给上述两个内部方法（`src/index.ts:2013-2126`）。
- `buildLazyThumbnailFn()` 的缓存键从仅按 `scale` 改为按 `scale + 解析后的 snapshotWidth`，避免不同宽度请求返回错误缓存（`src/index.ts:133-217`）。
- `captureThumbnail()` 调用 `html2canvas` 时增加 `width` 和 `windowWidth` 选项，取值自解析后的 snapshotWidth（`src/index.ts:219-279`）。
- `buildOffscreenPageElement()` 接受可选 `snapshotWidth` 覆盖 `wrapper.style.width`，使离屏 DOM 宽度与快照宽度一致（`src/pageThumbnailDom.ts:212-310`）。
- Demo（`demo/encode.html` + `demo/demo.js`）在现有的 `exclude-selectors` 输入下方新增一个数字输入框 `data-role="snapshot-width"`，标签为 `Snapshot width (px)`，占位符 `1024`，留空即表示使用默认值。
- `demo/demoDocumentSerialization.d.ts` 中的 `EncodeOptions` 镜像类型同步增加该字段。

## Capabilities

### Must Have

- 公共选项名 `snapshotWidth`（camelCase），位于 `EncodeOptions`，类型为 `number`。
- `snapshotWidth` 取值规则：必须是有限整数且 `100 <= value <= 10000`。
- `undefined`/省略 时保持默认行为（硬编码 1024px）；不满足取值规则（非整数、非有限、小于 100、大于 10000）时通过 `resolveSnapshotWidth()` 抛出 `Invalid snapshotWidth: ${value}`，让调用方在编码前显式知晓非法输入。
- 影响 iframe 渲染宽度（`withIframeDocument`）、文档根元素宽度（`collectTextsFromDocument`）、html2canvas 截图宽度（`captureThumbnail`）、离屏 DOM 包装器宽度（`buildOffscreenPageElement`）。
- 缓存键必须包含解析后的 snapshotWidth，防止交叉污染。
- Demo 数字输入框默认留空，位置在 `exclude-selectors` 下方。

### Must NOT Have

- 不修改 `BackgroundDecodeOptions`、`HtmlParser.decode()` 签名或 decode 阶段的行为。
- 不支持百分比字符串、相对单位（如 `"100%"`、`"50vw"`）或自适应宽度 —— 本选项仅接受像素数值。
- 不引入高度控制（如 `snapshotHeight`），高度仍由内容自然决定或保持现有逻辑。
- 不复用 `excludeSelectors` 语义；两者互相独立，可任意组合。
- 不调整外部 `@hamster-note/types` 或 `IntermediateDocument` schema。
- 不在 `snapshotWidth` 未设置时改变任何默认行为；所有现有回归测试的期望值应保持不变。

## Impact

- **API Surface**：`EncodeOptions` 新增一个可选数字字段，向后兼容。
- **Type Exports**：同名字段镜像到 `demo/demoDocumentSerialization.d.ts`。
- **Demo**：`demo/encode.html` 新增一个数字输入框；`demo/demo.js` 的 `handleParse()` 读取并透传 `snapshotWidth`。
- **Default Behavior**：不变。所有已通过的回归测试仍应通过。
- **Test Coverage**：新增针对「传入 snapshotWidth 后 iframe 宽度改变」「未传入时保持 1024px」「缓存键隔离不同宽度」「离屏 DOM 宽度匹配」的覆盖。
- **Non-Goals**：见 Must NOT Have；高度控制、百分比宽度、decode 阶段不在本次范围。
