# CSS Background Snapshot Width

## Why

用户要求：`html2canvas` 可以把 CSS 转成图片，但当前 `html-parser` 只转换文字和图片，背景图中没有包含 CSS 内容，例如元素边框、背景颜色等；需要补上。另要求 `encode` 增加参数，用于控制 html2canvas 做快照时使用的屏幕宽度/其他宽度，暴露在函数参数中，并体现在 Demo 上。

## What Changes

- 扩展 HtmlParser encode 功能，使背景缩略图保留广泛的 CSS 视觉样式
- 添加可选的 `EncodeOptions.snapshotWidth` 参数来控制快照/布局宽度
- 更新 Demo 和 OpenSpec，使用 TDD 方法并保留当前行为（当 `snapshotWidth` 省略时）

## Capabilities

- `EncodeOptions.snapshotWidth?: number` - 控制快照宽度的可选参数
- 广泛的计算视觉样式捕获，带有明确的排除列表
- 共享宽度解析逻辑，用于离屏布局和 html2canvas 选项
- Demo 中可选的 `snapshotWidth` 输入控件
- Jest + Playwright 回归覆盖和证据产物

## Impact

- 向后兼容：现有的 `HtmlParser.encode(input)` 和 `HtmlParser.encode(input, { excludeSelectors })` 仍然正常工作
- 新增 `snapshotWidth` 参数，范围 100-10000 CSS 像素
- 背景 CSS 视觉捕获比旧的白名单策略更广泛，但受文档化的排除列表约束
- 不添加伪元素或自定义背景 URL 获取功能
