# Tasks - Page Size and Decode Scroll Behavior

## Tasks

### Plan: fix-page-size-scrollability

- [ ] 1. Author OpenSpec change (proposal + tasks + spec deltas)

  **What to do**: Create `openspec/changes/fix-page-size-scrollability/` 下的 `proposal.md`、`tasks.md`、encode 与 decode spec deltas，明确页面尺寸语义、`snapshotWidth` 契约、CSS px 定义、decode 滚动行为、以及 html2canvas 不可用时回退逻辑。
  **Must NOT do**: 不要修改 `src/`、`demo/` 任何源代码；不要触碰 `openspec/changes/archive/**`。

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2,3,4,5,6] | Blocked By: []

  **References**:
  - Pattern: `openspec/changes/add-css-background-snapshot-width/{proposal,tasks}.md`
  - Existing encode behavior: `src/index.ts` `buildRenderedTexts()` page width/height calculation
  - Existing decode behavior: `src/htmlParserWorkerCore.ts` `renderPageDiv()` and `.hamster-note-page` styles
  - Existing scroll test: `src/__tests__/renderer.test.ts` "decode body-natural scroll without nested page scroll"

  **Acceptance Criteria**:
  - [ ] `proposal.md` 含 Summary、Problem、Proposed Change、Non-Goals。
  - [ ] `tasks.md` 列出本次 spec 拆分，且每项可由单一文件完成。
  - [ ] Encode spec delta 明确 `IntermediatePage.width/height` 为 CSS px，无 schema 变更。
  - [ ] Encode spec delta 明确 `snapshotWidth` 控制截图布局 CSS 宽度，保持 `[100,10000]` 非法抛出契约。
  - [ ] Decode spec delta 明确要求 decode 输出让 body/host 拥有自然滚动，`.hamster-note-page` 不引入嵌套滚动。
  - [ ] Decode spec delta 明确 html2canvas 不可用时回退到既有 bounds/viewport 逻辑。
  - [ ] `grep -R "CSS px" openspec/changes/fix-page-size-scrollability` 能找到 CSS-pixel 维度定义。
  - [ ] `grep -R "nested" openspec/changes/fix-page-size-scrollability` 能找到无嵌套滚动要求。

- [ ] 2. Implement encode page sizing consistency

  **What to do**: 确保 `HtmlParser.encode()` 中 `buildRenderedTexts()` 计算出的 `pageWidth`/`pageHeight` 与 `snapshotWidth` 透传逻辑一致；当 html2canvas 无法提供尺寸时，回退到 bounds/viewport 逻辑并记录证据。
  **Must NOT do**: 不要改 `IntermediatePage` schema；不要改 `snapshotWidth` 校验逻辑。

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [3,4] | Blocked By: [1]

  **Acceptance Criteria**:
  - [ ] 回退逻辑与 spec 一致。
  - [ ] 证据文件记录回退路径的代码位置与行为。

- [ ] 3. Implement decode scroll behavior guarantee

  **What to do**: 确保 decode 输出中 `.hamster-note-page` 不设置 `overflow: hidden` 或其他会阻塞滚动的样式；滚动由 document body 或 host scrolling element 拥有。
  **Must NOT do**: 不要引入新的 decode 选项；不要修改 `.hamster-note-document` 的 `position: relative` 布局。

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [4,5] | Blocked By: [1]

  **Acceptance Criteria**:
  - [ ] `renderer.test.ts` 中 "decode body-natural scroll without nested page scroll" 场景通过。
  - [ ] `.hamster-note-page` 不拥有独立滚动条。

- [ ] 4. Update Demo preview to respect page size and scroll

  **What to do**: Demo decode 预览容器必须按 `IntermediatePage.width/height` 尺寸渲染页面，并允许自然滚动；不引入嵌套滚动。
  **Must NOT do**: 不要修改 encode demo。

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [5,6] | Blocked By: [2,3]

  **Acceptance Criteria**:
  - [ ] 预览页面高度超过容器时，滚动发生在 body 层级。
  - [ ] 页面宽度匹配 `IntermediatePage.width`。

- [ ] 5. Document fallback evidence and bounds logic

  **What to do**: 在 `openspec/changes/fix-page-size-scrollability/evidence/` 中记录 html2canvas 不可用时回退到 bounds/viewport 逻辑的代码位置、触发条件与行为。
  **Must NOT do**: 不要修改源码。

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [6] | Blocked By: [2]

  **Acceptance Criteria**:
  - [ ] 证据文件清晰描述回退路径。

- [ ] 6. Regression and spec alignment verification

  **What to do**: 运行 `npm test && npm run lint`，确保 decode 滚动测试通过；将结果存档到 `.omo/evidence/`。
  **Must NOT do**: 不为了通过测试而修改 spec。

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: [Final Verification] | Blocked By: [3,4,5]

  **Acceptance Criteria**:
  - [ ] `npm test` 全部通过。
  - [ ] `npm run lint` 退出码 0。

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> Run review agents in parallel; all must APPROVE; present to user and wait for explicit okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ Playwright/demo E2E)
- [ ] F4. Scope Fidelity Check — deep (确认未触碰 archive / 未改 schema / 未改 snapshotWidth 校验)
