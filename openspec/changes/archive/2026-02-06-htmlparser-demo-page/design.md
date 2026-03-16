## Context

当前项目为 HtmlParser 的 TypeScript 库，缺少面向使用者的交互式演示入口。需求是新增一个 demo 目录与页面入口，通过不同 path 访问不同演示页面，并在页面内一键调用 HtmlParser 解析 HTML，展示 JSON 输出。该 demo 不应影响现有库 API 与构建产物。

## Goals / Non-Goals

**Goals:**
- 提供最小可用的多页面 demo（不同 path 对应不同页面）。
- 页面内可将当前页面 HTML 交给 HtmlParser 解析并展示 JSON 结果。
- 保持库代码与发布产物不受影响，demo 与核心库解耦。

**Non-Goals:**
- 不引入复杂前端框架或完整路由系统。
- 不改变 HtmlParser 的核心解析逻辑与 API 行为。
- 不提供复杂的 UI/UX 设计或编辑器能力。

## Decisions

- 采用独立的 `demo/` 目录承载多页面静态演示，使用多个 HTML 文件实现不同 path（例如 `/demo/index.html`、`/demo/encode.html`）。
  - 备选方案：使用单页应用 + History API 路由。未选用原因：引入额外脚本复杂度，不符合最小化原则。
- demo 页面通过浏览器端脚本直接调用 HtmlParser（库源码或构建产物），并使用 JSON 预览区域展示中间结构。
  - 备选方案：Node 端渲染输出 JSON。未选用原因：需要额外服务端环境，不符合轻量演示目标。
- demo 与构建/发布流程解耦，默认不被打包进 dist，避免影响发布体积与依赖。
  - 备选方案：将 demo 作为构建目标之一。未选用原因：改变发布流程、增加维护成本。

## Risks / Trade-offs

- [风险] demo 页面依赖浏览器环境（DOMParser），在 Node 环境无法运行 → **缓解**：明确 demo 仅面向浏览器使用，并在文档提示。
- [风险] 多页面 demo 需要静态服务器或本地服务才能使用 path → **缓解**：提供最小化启动方式（如本地静态服务脚本或使用任意静态服务器）。
- [权衡] 不引入框架减少复杂度，但可扩展性有限 → **缓解**：保持结构清晰，后续可按需升级。

## Migration Plan

- 新增 `demo/` 目录与页面文件。
- 若需要，补充 README 的 demo 使用说明。
- 无需迁移数据与无回滚风险，删除 demo 目录即可回退。

## Open Questions

- demo 是否需要一个内置的本地静态服务器脚本，还是仅提供使用说明？
