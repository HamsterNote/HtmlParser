# CSS Background Snapshot Width - Design

## Context

### 项目背景
- CSS 捕获范围：用户选择「尽量全量」。本计划将其落地为"广泛复制 computed visual CSS + 明确 denylist"，而不是仅补 border/background-color。
- 宽度 API：用户选择可选且向后兼容。
- 参数名：用户选择 `snapshotWidth`。
- 测试策略：用户选择 TDD。
- Demo：新增可选数值输入；空值不传 `snapshotWidth`，保持当前行为。

### 关键发现
- `EncodeOptions` 定义在 `src/index.ts:89`，最初只有 `excludeSelectors?: string[]`
- `installFakeHtml2Canvas()` 从 `src/testUtils/html2canvasTestUtils.ts` 捕获调用包括选项
- html2canvas 仅在 CSS 背景存在于 HTML 中时被调用（需要 `background-image` 样式）
- happy-dom 在使用 `style.setProperty("background-image", value)` 时可靠地保留渐变

## Goals / Non-Goals

### Goals
- 让 encode 生成的懒加载背景快照更接近 html2canvas 对 CSS 视觉样式的呈现
- 允许调用方通过 `HtmlParser.encode(input, { snapshotWidth })` 控制快照宽度
- 保证旧调用完全兼容

### Non-Goals
- 不实现伪元素 `::before`/`::after` 渲染
- 不实现自定义背景 URL 获取/解析
- 不添加新的 `EncodeOptions` 字段（除了 `snapshotWidth`）
- 不更改 html2canvas `scale`、`useCORS` 或 `backgroundColor` 默认值

## Decisions

### 1. 宽度参数设计
- **决策**: 添加 `snapshotWidth?: number` 可选参数
- **原因**: 用户明确要求可选且向后兼容的宽度控制
- **备选方案**: 必填参数、全局配置
- **不采用原因**: 必填参数破坏向后兼容性；全局配置不够灵活

### 2. 验证策略
- **决策**: 有限整数，范围 100-10000，无效值抛出确定性错误
- **原因**: 防止无效值导致渲染问题，提供清晰的错误信息
- **备选方案**: 静默回退到默认值
- **不采用原因**: 静默回退可能隐藏用户错误

### 3. CSS 捕获策略
- **决策**: 广泛复制计算视觉样式 + 明确排除列表
- **原因**: 用户选择「尽量全量」，需要平衡全面性和性能
- **备选方案**: 仅捕获 border/background-color
- **不采用原因**: 不满足用户「尽量全量」的要求

### 4. 缓存键设计
- **决策**: 缓存键包含 `scale` 和解析后的快照宽度
- **原因**: 不同宽度需要不同的缓存条目，避免返回旧图
- **备选方案**: 仅使用 `scale` 作为缓存键
- **不采用原因**: 不同宽度会返回相同的缓存缩略图

## Risks / Trade-offs

### 风险
1. **样式爆炸风险**: 「尽量全量」可能导致样式过多
   - **缓解**: 使用排除列表、基线证据和 payload/perf 预算控制
   
2. **宽度不一致风险**: `snapshotWidth` 必须同时影响离屏布局和 html2canvas
   - **缓解**: 要求单一 `resolveSnapshotWidth()` 驱动两处

3. **缓存失效风险**: lazy thumbnail cache 可能因宽度变化返回旧图
   - **缓解**: 缓存键纳入 width

4. **性能风险**: 广泛的 CSS 捕获可能影响性能
   - **缓解**: 使用排除列表过滤不必要的属性，设置性能预算

### 权衡
- **全面性 vs 性能**: 选择广泛捕获但使用排除列表过滤
- **灵活性 vs 简单性**: 添加可选参数增加复杂性但提供灵活性
