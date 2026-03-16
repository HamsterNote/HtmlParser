## 1. Regression Test Baseline

- [x] 1.1 在 `src/__tests__/htmlParser.test.ts` 增加 DOM 路径用例：同一段落内混合内联节点时，仅最后一个片段 `isEOL: true`，其余片段为 `false`
- [x] 1.2 增加 DOM 路径用例：块级分隔或显式换行形成多条语义行时，每条语义行仅一个片段标记 `isEOL: true`
- [x] 1.3 增加 fallback 路径用例：无 DOM 环境且多行输入时，按换行拆分后的每个输出条目保持 `isEOL: true`

## 2. DOM Encode Line-Boundary Implementation

- [x] 2.1 修改 `src/index.ts` 的 DOM 解析分支，按语义行聚合同一行文本片段而非对每个 `TEXT_NODE` 直接终结
- [x] 2.2 在语义行输出阶段仅对最后一个片段设置 `isEOL: true`，同行前序片段设置 `isEOL: false`
- [x] 2.3 处理显式结构换行情形（块边界或换行元素）以保证每条完成语义行恰有一个 `isEOL: true`

## 3. Fallback Stability and Verification

- [x] 3.1 确认 fallback 纯文本分支保留现有 newline 拆分行为且每行继续输出 `isEOL: true`
- [x] 3.2 运行测试套件验证新增回归用例与既有用例通过（至少覆盖 `htmlParser.test.ts` 相关场景）
- [x] 3.3 复查受影响数据字段，确保 `IntermediateText` 结构与外部契约无变更

## 4. Demo Validation and Completion

- [x] 4.1 在 demo 编码场景复现并验证：视觉同一行文本不再被全部标记为 `isEOL: true`
- [x] 4.2 记录验证结果与边界观察（如 `<br>`、空块无文本）并回写到变更说明
- [x] 4.3 完成最终检查并准备进入 `/opsx-apply` 实施阶段
