## Why

Demo 目前只展示 encode 的 JSON 输出，缺少将 JSON 还原为 HTML 的验证路径，难以直观确认解析结果是否可回显。补充 decode 回显可以形成完整闭环，并便于验证样式与布局的近似效果。

## What Changes

- 在 demo 页面增加“Decode”展示区，用于将当前 JSON 结果还原为 HTML 片段并渲染预览。
- 在 demo 脚本中增加 JSON -> IntermediateDocument 的反序列化流程，并调用 HtmlParser.decodeToHtml。
- 明确 encode/ decode 的演示交互与状态反馈。

## Capabilities

### New Capabilities
- `demo-decode-preview`: Demo 提供将 JSON 中间结构回显为 HTML 片段的能力。

### Modified Capabilities
- `htmlparser-demo-page`: 在 demo 页面增加 decode 回显能力与交互流程。

## Impact

- demo 页面：`demo/index.html`, `demo/encode.html`, `demo/demo.js`, `demo/demo.css`
- 依赖 HtmlParser 现有 `decodeToHtml` 能力，无新增外部依赖
