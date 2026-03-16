## 1. Demo UI updates

- [x] 1.1 在 `demo/index.html` 与 `demo/encode.html` 增加 decode 操作区（按钮 + 预览容器 + 状态提示）
- [x] 1.2 统一输出区域布局，区分 JSON 输出与 HTML 预览

## 2. Demo 脚本逻辑

- [x] 2.1 在 `demo/demo.js` 增加 JSON 反序列化为 IntermediateDocument 的转换逻辑
- [x] 2.2 调用 `HtmlParser.decodeToHtml` 并将结果注入预览容器
- [x] 2.3 处理无效 JSON/缺失字段时的错误提示与状态更新

## 3. 样式与验证

- [x] 3.1 在 `demo/demo.css` 增加预览容器与按钮的样式
- [x] 3.2 手动验证：encode 输出 -> decode 预览 -> 错误输入提示
