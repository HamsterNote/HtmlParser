# Tasks - Add `excludeImagesFromBackground` Decode Background Option

## Tasks

### Plan: add-exclude-images-from-background

- [ ] 1. Author OpenSpec change (proposal + tasks + spec deltas)

  **What to do**: Create `openspec/changes/add-exclude-images-from-background/` 下的 `proposal.md`、`tasks.md`、`specs/htmlparser-demo-page/spec.md`、`specs/demo-decode-preview/spec.md`，明确选项语义、范围、非目标、Demo 复选框契约。
  **Must NOT do**: 不要修改 `src/`、`demo/` 任何源代码；不要触碰 `openspec/changes/archive/**`。

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2,3,4,5] | Blocked By: []

  **References**:
  - Pattern: `openspec/changes/archive/2026-02-07-demo-decode/specs/*/spec.md` —— 历史 spec delta 的 `## ADDED Requirements` 格式。
  - Pattern: `openspec/changes/archive/2026-06-07-htmlparser-encode-decode-media-options/{proposal,tasks}.md` —— proposal/tasks 编排风格。

  **Acceptance Criteria**:
  - [ ] `proposal.md` 含 `## Why`、`## What Changes`、`## Impact` 三大段。
  - [ ] `tasks.md` 列出本次实现拆分，且每项可由单一文件/单一命令完成。
  - [ ] `specs/htmlparser-demo-page/spec.md` 含一条「Demo 复选框默认未勾选」场景。
  - [ ] `specs/demo-decode-preview/spec.md` 含一条「仅当 `excludeImagesFromBackground === true` 时背景排除图片」场景及一条「默认行为不变」场景。
  - [ ] 非目标显式列出 `EncodeOptions` 不变、CSS background-image/SVG/`<picture>`/`<video>` 不在范围。
  - [ ] `openspec validate add-exclude-images-from-background --strict` 命令运行结果（成功或 CLI 不可用）记录于 `.omo/evidence/task-1-openspec-validate.txt`。

- [ ] 2. Add `excludeImagesFromBackground` to `BackgroundDecodeOptions` + RED test

  **What to do**: 在 `src/decodeTextControl.ts` 现有 `BackgroundDecodeOptions` 内、`excludeTextFromBackground` 字段旁，新增 `excludeImagesFromBackground?: boolean` 并附中文 JSDoc `/** 是否从背景图中排除图片，默认 false */`。在 `src/__tests__/renderer.test.ts` 增加一条断言：当 `excludeImagesFromBackground: true` 时离屏 DOM 中不含 `<img>`，但前景 decode `<img>` 仍存在。
  **Must NOT do**: 不要改 `pageThumbnailDom.ts` 实现，让测试先红。

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [3] | Blocked By: [1]

  **Acceptance Criteria**:
  - [ ] `BackgroundDecodeOptions` 多了一个字段；TypeScript 编译通过。
  - [ ] 新增测试在实现之前 FAIL，给出明确错误信息。

- [ ] 3. Gate background image injection in `pageThumbnailDom.ts`

  **What to do**: `src/pageThumbnailDom.ts` 的 `BuildOffscreenPageElementOptions` 增加 `excludeImagesFromBackground?: boolean`；在 `images.forEach((image) => { ... })` 注入块外包一层 `if (options?.excludeImagesFromBackground !== true) { ... }`。把 `OffscreenPageInput.images` 注释「始终渲染不受 excludeTextFromBackground 影响」收窄为「未启用 excludeImagesFromBackground 时始终渲染」。
  **Must NOT do**: 不要复用 `excludeTextFromBackground` 的 if，保持两个开关独立。

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [4] | Blocked By: [2]

  **Acceptance Criteria**:
  - [ ] Task 2 的 RED 测试现在 GREEN。
  - [ ] 既有「图片始终渲染」回归测试已修改为「未启用 excludeImagesFromBackground 时始终渲染」并继续 GREEN。

- [ ] 4. Wire option through `captureThumbnail()` + decode routing in `src/index.ts`

  **What to do**: `captureThumbnail()` 内构建离屏 DOM 选项时透传 `excludeImagesFromBackground: options?.excludeImagesFromBackground`。`buildDecodePagePayload()` 中现有 `bgOptions?.excludeTextFromBackground === true ? captureThumbnail(...) : p.getThumbnail(quality)` 扩展为 `(bgOptions?.excludeTextFromBackground === true || bgOptions?.excludeImagesFromBackground === true) ? captureThumbnail(...) : p.getThumbnail(quality)`。
  **Must NOT do**: 不要在 `excludeImagesFromBackground !== true` 时走自定义路径，否则会改默认行为。

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [5,6] | Blocked By: [3]

  **Acceptance Criteria**:
  - [ ] 仅图片排除组合（`excludeText` 未开 + `excludeImages` 开）走自定义 `captureThumbnail()`。
  - [ ] 两个选项都未开时走 `p.getThumbnail(quality)`（默认路径），通过断言或路由计数验证。

- [ ] 5. Demo UI + decode wiring

  **What to do**:
  - `demo/encode.html`：在 `bg-exclude-text` `<label class="checkbox-label">` 块**下方**新增一段 `<label class="checkbox-label">`，含 `<input type="checkbox" data-role="bg-exclude-images">` + 文案 `Exclude images from background image`，默认未勾选。
  - `demo/demo.js`：在 `handleDecode()`（约 109-150 行内 121-136 段）与 `handleDecodeInput()`（约 158-208 行内 179-194 段）两处，新增 `const excludeImages = document.querySelector('[data-role="bg-exclude-images"]')?.checked === true;`，把 `excludeImages` 纳入 `hasCustomBg` 并写入 `data.background.excludeImagesFromBackground`。
  - `demo/demoDocumentSerialization.d.ts`：`BackgroundDecodeOptions` 镜像类型新增同名字段。

  **Must NOT do**: 不要调整既有 `bg-exclude-text` 标签的位置或文案；不要让默认勾选。

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [6] | Blocked By: [4]

  **Acceptance Criteria**:
  - [ ] 浏览器打开 demo 看到第二个复选框，默认未勾选，位于 `bg-exclude-text` 下方。
  - [ ] 勾选后点击 decode，`data.background.excludeImagesFromBackground === true` 出现在调用参数中。
  - [ ] 两条路径都通过；任何一条遗漏都视为失败。

- [ ] 6. Regression & E2E hardening

  **What to do**: 运行 `npm test && npm run build:all && npm run test:e2e`，把输出存档 `.omo/evidence/task-6-*.txt`。补一条 e2e 场景：默认未勾选时背景缩略图含图片；勾选后背景缩略图不含图片。
  **Must NOT do**: 不为了通过测试而修改既有非相关测试期望值。

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: [Final Verification] | Blocked By: [5]

  **Acceptance Criteria**:
  - [ ] `npm test` 全部通过。
  - [ ] `npm run build:all` 退出码 0。
  - [ ] `npm run test:e2e` 全部通过，含新增的「图片排除复选框」场景。

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> Run review agents in parallel; all must APPROVE; present to user and wait for explicit okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ Playwright/demo E2E)
- [ ] F4. Scope Fidelity Check — deep (确认未触碰 EncodeOptions / CSS background-image / SVG / picture / video)
