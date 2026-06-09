# CSS Background Snapshot Width - Tasks

## Tasks

### Plan: css-background-snapshot-width

- [x] 1. Create OpenSpec change and capture pre-change baseline
- [x] 2. Add failing API/type tests for `snapshotWidth`
- [x] 3. Implement `snapshotWidth` API, validation, and width plumbing
- [x] 4. Add failing broad CSS visual capture tests
- [x] 5. Implement broad CSS visual capture with denylist
- [x] 6. Add failing Demo tests for optional snapshot width input
- [x] 7. Implement Demo snapshot width control and encode wiring
- [x] 8. Add integration, cache, and performance-budget regression coverage
- [x] 9. Validate OpenSpec alignment and consolidate final evidence

### Final Verification Wave

- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## 任务详情

### Task 1: Create OpenSpec change and capture pre-change baseline
**状态**: 已完成
**描述**: 创建 `openspec/changes/add-css-background-snapshot-width/` 包含 `proposal.md` 和 spec deltas。包含广泛 CSS 视觉捕获、可选 `snapshotWidth`、Demo 暴露、确定性无效值错误的要求，以及伪元素/自定义 URL 获取的范围外说明。在源代码更改前捕获基线证据。

### Task 2: Add failing API/type tests for `snapshotWidth`
**状态**: 已完成
**描述**: 以 TDD 风格添加失败测试：`EncodeOptions.snapshotWidth?: number` 的类型/导出测试；encode 接受省略/空选项不变；有效 `snapshotWidth` 被接受；无效值抛出确定性 `Invalid snapshotWidth` 错误。包括边界情况：`99`、`100`、`10000`、`10001`、`0`、负数、`NaN`、`Infinity`、小数。

### Task 3: Implement `snapshotWidth` API, validation, and width plumbing
**状态**: 已完成
**描述**: 添加 `snapshotWidth?: number` 到 `EncodeOptions`。添加内部解析器验证有限整数 CSS 像素范围 100-10000，省略时返回 `undefined`，无效输入抛出 `Invalid snapshotWidth: {value}`。将解析后的宽度从 `HtmlParser.encode()` 线程化到懒缩略图创建、离屏页面构建和 html2canvas 选项。

### Task 4: Add failing broad CSS visual capture tests
**状态**: 已完成
**描述**: 扩展 `src/__tests__/renderer.test.ts` 中的背景样式捕获区域。添加 RED 测试证明广泛计算视觉样式捕获包括：背景渐变、背景大小/位置/重复、内边距、溢出/裁剪相关视觉字段、文本阴影、字体/颜色视觉字段。添加排除列表测试证明动画/过渡/光标/指针事件/用户选择/will-change/供应商内部噪声被排除。

### Task 5: Implement broad CSS visual capture with denylist
**状态**: 已完成
**描述**: 替换 `collectWhitelistedStyles()` 中的窄白名单行为为有界广泛视觉复制策略：迭代计算样式属性，通过允许前缀/类别保留视觉属性，删除明确排除列表，跳过空/默认/非视觉/噪声值，并保留现有几何/可见性过滤器。

### Task 6: Add failing Demo tests for optional snapshot width input
**状态**: 已完成
**描述**: 添加 RED 测试用于 Demo 行为：`demo/encode.html` 包含带有 `data-role="snapshot-width"` 的可选数字输入；`demo/demo.js` 在 `handleParse()` 中读取它；空输入省略 `snapshotWidth`；数字输入传递 `{ snapshotWidth: value }`；无效输入显示/传播确定性解析错误。

### Task 7: Implement Demo snapshot width control and encode wiring
**状态**: 已完成
**描述**: 在 `demo/encode.html` 中排除选择器控件附近添加标记的可选数字输入，使用 `data-role="snapshot-width"`。更新 `demo/demo.js` `handleParse()` 读取输入，修剪，空时省略，解析整数，并在现有选项对象中传递 `snapshotWidth`。

### Task 8: Add integration, cache, and performance-budget regression coverage
**状态**: 已完成
**描述**: 添加/完成集成测试证明所有部分协同工作：广泛 CSS 样式出现在背景缩略图捕获路径中，`snapshotWidth` 一致地影响布局/html2canvas 选项，缓存键包含宽度，省略宽度保留旧行为，Demo 流程成功。

### Task 9: Validate OpenSpec alignment and consolidate final evidence
**状态**: 已完成
**描述**: 确保 OpenSpec 更改文件匹配实现的 API 和 Demo 行为。如果实现在批准范围内更改了实现细节，则更新 proposal/spec 文本。运行仓库验证命令并保存输出。确认没有归档编辑和额外公共选项。

### F1. Plan Compliance Audit
**状态**: 已完成
**描述**: 验证实现匹配每个 TODO、Must Have、Must NOT Have 和 OpenSpec 要求。

### F2. Code Quality Review
**状态**: 已完成
**描述**: 审查 `src/index.ts`、`src/pageThumbnailDom.ts`、Demo 更改和测试的最小性、可维护性和无 AI 代码异味。

### F3. Real Manual QA
**状态**: 已完成
**描述**: 使用 Playwright 操作 Demo：空宽度解析、`640` 解析、无效 `99` 解析、解析后解码预览。

### F4. Scope Fidelity Check
**状态**: 已完成
**描述**: 确认没有新依赖、没有伪元素/自定义 URL 获取、没有额外公共选项、没有归档编辑、没有不相关的重构。
