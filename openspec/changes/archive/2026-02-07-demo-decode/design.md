## Context

当前 demo 仅展示 HtmlParser.encode 的 JSON 输出，缺少 decode 回显路径。仓库已有 HtmlParser.decodeToHtml / decode 能力，适合在 demo 层进行集成。

## Goals / Non-Goals

**Goals:**
- 在 demo 中提供 JSON -> HTML 片段回显预览。
- 复用现有 decodeToHtml，不引入新依赖。
- 交互清晰：展示 encode 输出与 decode 预览的关联。

**Non-Goals:**
- 不修改 HtmlParser 核心解析/解码算法。
- 不实现完整样式还原或复杂布局渲染。
- 不新增后端或构建流程变更。

## Decisions

- 使用 `HtmlParser.decodeToHtml` 生成 HTML 片段并插入到页面中，而非生成完整 HTML 文件。
  - 方案对比：`decode` 生成完整 HTML 文件适合下载/打开，不利于在当前页面内嵌预览；`decodeToHtml` 更直接。
- 复用现有 JSON 序列化结构，新增反序列化到 IntermediateDocument 的轻量转换逻辑，保持 demo 自包含。
  - 方案对比：引入新的序列化工具或依赖会增加 demo 复杂度且与目标无关。

## Risks / Trade-offs

- [JSON 反序列化不完整] → 仅支持 demo 中序列化的字段集合，并在 UI 中提示限制。
- [预览渲染与实际页面存在差异] → 文案说明解析为近似布局，不保证像素级还原。
