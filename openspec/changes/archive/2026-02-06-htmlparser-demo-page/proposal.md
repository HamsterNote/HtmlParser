## Why

当前仓库只有库级 API 与单测示例，缺少可交互、可视化的演示入口，导致 HtmlParser 的 encode/decode 能力难以被快速理解与验证。新增一个可通过不同 path 访问的 demo 页面，并提供一键解析与 JSON 输出能力，可以显著提升使用者的上手效率与验证体验。

## What Changes

- 新增一个 demo 目录与页面入口，支持通过不同 path 访问不同 demo 页面。
- 在 demo 页面中提供一个按钮，将页面 HTML 交给 HtmlParser 进行解析。
- 在页面内展示 HtmlParser 输出的中间结构（JSON）。
- 保持现有库 API 与构建产物不变（无 **BREAKING** 变更）。

## Capabilities

### New Capabilities
- `htmlparser-demo-page`: 提供 HtmlParser 编码/解码演示页面、路径访问与 JSON 可视化输出。

### Modified Capabilities
- （无）

## Impact

- 代码：新增 demo 相关页面与路由入口文件（新的目录与静态资源）。
- 工具链：可能需要最小化的静态页面构建/启动方式（仅用于 demo，不影响库发布）。
- 文档：README 可增加 demo 访问与使用说明（如需）。
