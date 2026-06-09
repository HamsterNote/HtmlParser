snapshotWidth - 最终验证摘要
========================

## 已变更文件
demo/demo.js
demo/demoDocumentSerialization.d.ts
demo/encode.html
src/__tests__/htmlParser.test.ts
src/__tests__/renderer.test.ts
src/__tests__/typeExports.test.ts
src/index.ts
src/pageThumbnailDom.ts

## 新增文件
- e2e/test_encode_snapshot_width.py
- openspec/changes/add-css-background-snapshot-width/ (change.md, scope.md, tests.md, tasks.md, proposal.md)
- src/__tests__/demoEncodeSnapshotWidth.test.ts
## 验证命令和结果

| 命令 | 结果 |
|------|------|
| npm test | 200 passed, 15 suites |
| npm run lint | no-lint (clean) |
| npm run test:e2e | 17 passed |
| git diff --name-only, archive grep | 无 archive 编辑 |

## Spec 校正记录

实现代码与 OpenSpec 之间发现并修正了以下差异:

1. **validation 规则**: change.md 原描述只写 "有限正数"，scope.md 未提 throw 行为。
   实际实现通过 resolveSnapshotWidth() 做严格校验（整数 + 100-10000 范围），
   非法值 throw 而非静默回退。已更新 change.md 和 scope.md 与之对齐。

2. **tests.md 校验清单**: 未包含 Runtime Validation Tests (1b) 类别，
   尽管 Task 2 已实现包含望值和非法值两条路径的完整测试。
   已补充该章节，与 src/__tests__/htmlParser.test.ts 中的测试保持一致。

3. 所有其他 spec 断言（缓存隔离、html2canvas options、离屏 DOM、Demo 输入框、向后兼容）均与代码一致，无需修改。

## 接受的默认行为

- snapshotWidth 为 undefined/省略 → 默认硬编码 1024px
- 验证规则: 整数 + 有限 + 100...10000，非法则 throw
- 缓存键 = scale + resolvedSnapshotWidth，不同宽度不串用
- html2canvas receiving width + windowWidth 仅当 width 已定义时
- Catalog of accepted defaults/design decisions validated against codebase

## Evidence Files

- task-9-npm-test.txt
- task-9-lint.txt
- task-9-e2e.txt
- task-9-spec-alignment.txt
- task-9-summary.md (本文件)
