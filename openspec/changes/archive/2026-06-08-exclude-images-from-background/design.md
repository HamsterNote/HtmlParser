# Design: Exclude Images From Background

## Context

### 项目背景
HtmlParser 是一个文档解析器，可以将文档转换为 HTML。在解码过程中，它会生成背景缩略图，该缩略图通过离屏 DOM 构建。现有的 `excludeTextFromBackground` 选项允许用户控制是否在背景中包含文本内容，但缺少对图片的类似控制。

### 学习到的内容
- `BackgroundDecodeOptions` 位于 `src/decodeTextControl.ts`，当前包含 3 个字段
- `buildOffscreenPageElement()` 在 `src/pageThumbnailDom.ts` 中处理图片渲染
- `buildDecodePagePayload()` 在 `src/index.ts` 中处理路由逻辑
- Demo 有两个解码路径：`handleDecode()` 和 `handleDecodeInput()`
- 现有的 `excludeTextFromBackground` 使用 `=== true` 显式检查

## Goals / Non-Goals

### Goals
- 实现 `excludeImagesFromBackground` 背景/解码选项
- 保持与现有 `excludeTextFromBackground` 选项的一致性
- 确保默认行为不变（选项默认为 `false`）
- 提供完整的 TDD 测试覆盖
- 在 Demo 中提供用户界面控制

### Non-Goals
- 不修改 `EncodeOptions`
- 不处理 CSS `background-image`、SVG、`<picture>`、视频等
- 不修改前景解码图片
- 不修改 `IntermediateDocument` 内容
- 不引入嵌套配置对象
- 不重新设计 Demo 布局

## Decisions

### 1. OpenSpec 变更形状
**决策**: 使用 `## ADDED Requirements`（而不是 MODIFIED）用于两个规格增量，因为当前的规格文件不提及背景选项。

**选择原因**: 添加新需求是最干净的增量方式。

**备选方案**: 修改现有规格文件。

**不采用原因**: 现有规格文件没有相关内容，修改会增加复杂性。

### 2. 公共选项名称
**决策**: 使用 `excludeImagesFromBackground`（camelCase，与现有的 `excludeTextFromBackground` 平行）。

**选择原因**: 保持命名一致性，两个独立的布尔值。

**备选方案**: 使用嵌套对象 `excludeContent: { text, images }`。

**不采用原因**: 嵌套对象会破坏现有 API 的兼容性。

### 3. 默认行为
**决策**: 对于 `undefined` 和显式 `false`，默认行为为 OFF。新代码路径必须显式检查 `=== true`。

**选择原因**: 与现有的 `excludeTextFromBackground` 模式匹配。

**备选方案**: 使用默认 `true`。

**不采用原因**: 会破坏现有行为。

### 4. Demo 复选框位置
**决策**: 将复选框放在 `bg-exclude-text` 下方。

**选择原因**: 保持 UI 逻辑分组，用户期望相关选项在一起。

**备选方案**: 放在其他位置。

**不采用原因**: 会破坏用户预期。

### 5. 路由条件
**决策**: `buildDecodePagePayload()` 中的路由条件变为两个布尔值的 OR 逻辑——任一为 `true` 都通过自定义 `captureThumbnail()` 路径。

**选择原因**: 这是使"仅排除图片"工作的唯一方式，因为默认的 `p.getThumbnail(quality)` 路径总是将图片烘焙到背景中。

**备选方案**: 使用 AND 逻辑。

**不采用原因**: 无法实现仅排除图片的功能。

## Risks / Trade-offs

### 风险
1. **TDD 测试失败**: 在实现之前，红色测试是预期的断言失败，不是阻塞问题。
2. **Demo 转发测试绿色**: 转发测试通过是因为 `decodeSerializedDocumentToHtml` 使用通用对象透传，这不是问题。
3. **路由复杂性**: 添加 OR 条件可能使路由逻辑稍复杂，但保持了与现有模式的一致性。

### 权衡
1. **简单性 vs 功能**: 选择两个独立布尔值而不是嵌套对象，牺牲了一些结构化但获得了更好的兼容性。
2. **测试覆盖 vs 开发时间**: 选择 TDD 方法增加了前期时间但提高了代码质量。
3. **UI 一致性 vs 创新**: 选择与现有复选框相同的模式，牺牲了一些创新但保持了用户体验的一致性。

## Migration Plan

### 迁移步骤
1. 添加新的类型定义和选项
2. 实现离屏 DOM 图片门控
3. 更新路由逻辑
4. 添加 Demo UI 控制
5. 添加测试覆盖

### 回滚计划
如果出现问题，可以：
1. 移除新的类型定义
2. 移除离屏 DOM 门控逻辑
3. 恢复原始路由条件
4. 移除 Demo 复选框

### 兼容性
- 完全向后兼容
- 默认行为不变
- 现有代码无需修改