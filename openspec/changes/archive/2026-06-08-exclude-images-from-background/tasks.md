# Tasks: Exclude Images From Background

## Tasks

### Plan: exclude-images-from-background

- [x] 1. Create OpenSpec delta for background image exclusion
  - 创建 `openspec/changes/add-exclude-images-from-background/` 目录结构
  - 添加 `proposal.md`、`tasks.md` 和规格增量文件
  - 指定 `excludeImagesFromBackground` 是背景/解码选项，默认为 false

- [x] 2. Add failing renderer tests for image background exclusion semantics
  - 在 `src/__tests__/renderer.test.ts` 中添加 TDD 测试
  - 覆盖 `buildOffscreenPageElement` 在 `excludeImagesFromBackground: true` 时省略图片元素
  - 覆盖 false/undefined 仍然渲染图片
  - 覆盖仅排除图片时文本仍然渲染
  - 添加路由测试证明图片独占排除使用自定义缩略图捕获

- [x] 3. Add failing Demo/type forwarding tests for the new background option
  - 在 `src/__tests__/demoDocumentSerialization.test.ts` 中添加 TDD 覆盖
  - 证明 Demo 序列化/类型转发接受 `excludeImagesFromBackground`
  - 镜像现有的背景/文本控制转发测试
  - 准备 E2E 期望用于 `bg-exclude-images` 复选框存在/默认未选中

- [x] 4. Implement source types and offscreen DOM image gate
  - 在 `src/decodeTextControl.ts` 中添加 `excludeImagesFromBackground?: boolean` 到 `BackgroundDecodeOptions`
  - 在 `src/pageThumbnailDom.ts` 中添加相同选项到 `BuildOffscreenPageElementOptions`
  - 更新 `OffscreenPageInput.images` 注释移除“始终渲染”假设
  - 用 `if (options?.excludeImagesFromBackground !== true) { ... }` 包装现有图片渲染块

- [x] 5. Thread image exclusion through decode background capture routing
  - 在 `src/index.ts` 中更新 `captureThumbnail()` 传递 `excludeImagesFromBackground`
  - 更新 `buildDecodePagePayload()` 路由，当任一背景排除标志为 true 时使用自定义 `captureThumbnail()`
  - 确保图片独占排除不调用 `p.getThumbnail()`

- [x] 6. Wire Demo UI, Demo JS, and Demo mirror type
  - 更新 `demo/demoDocumentSerialization.d.ts` 镜像类型
  - 在 `demo/encode.html` 中添加未选中复选框
  - 在 `demo/demo.js` 中更新两个解码路径读取和转发新复选框

- [x] 7. Add Demo E2E coverage for the image background option
  - 扩展 `e2e/test_encode_json_input.py` 或最近的现有 Demo 背景选项 E2E
  - 验证 `[data-role="bg-exclude-images"]` 可见且默认未选中
  - 断言预览仍然渲染前景图片输出
  - 断言背景选项不崩溃且预览 iframe 出现

- [x] 8. Run full regression, audit references, and store evidence
  - 运行有针对性的和完整的验证命令
  - 使用 LSP/引用或 AST/文本审计确认没有遗漏活动代码引用
  - 记录证据到 `.omo/evidence/`
  - 仅修复由此功能直接引起的回归

## Final Verification Wave

- [~] F1. Plan Compliance Audit — oracle — AWAITING_USER_APPROVAL
- [~] F2. Code Quality Review — unspecified-high — AWAITING_USER_APPROVAL
- [~] F3. Real Manual QA — unspecified-high (+ Playwright if UI) — AWAITING_USER_APPROVAL
- [~] F4. Scope Fidelity Check — deep — AWAITING_USER_APPROVAL

## Commit Strategy

1. `spec(background): propose image exclusion option`
2. `test(background): cover image exclusion semantics`
3. `feat(background): add image exclusion gate`
4. `feat(decode): route image background exclusion`
5. `feat(demo): add image background exclusion control`
6. `test(e2e): cover image background exclusion control`
7. `test(background): verify image exclusion regressions`