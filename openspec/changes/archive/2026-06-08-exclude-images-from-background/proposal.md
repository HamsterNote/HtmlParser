# Proposal: Exclude Images From Background

## Why

用户需要像现有的 "Exclude text from background image" 选项一样，增加从背景中排除图片的选项。当前 HtmlParser 在生成背景缩略图时会将前景图片注入到离屏 DOM 中，用户希望有一个选项可以控制这一行为，以便在需要时生成不包含前景图片的背景缩略图。

**原始需求**: "像 Exclude text from background image 选项一样，增加 从背景中排除图片的选项，在 encode 中增加相应的选项。在 Demo 中增加相应选项。"

## What Changes

添加 `excludeImagesFromBackground?: boolean` 作为背景/解码选项，与现有的 `excludeTextFromBackground` 选项平行：

1. **源代码变更**:
   - 在 `BackgroundDecodeOptions` 中添加 `excludeImagesFromBackground?: boolean` 字段
   - 在 `BuildOffscreenPageElementOptions` 中添加相同字段
   - 在 `buildOffscreenPageElement()` 中添加图片渲染门控逻辑
   - 更新 `captureThumbnail()` 和 `buildDecodePagePayload()` 的路由逻辑

2. **Demo 变更**:
   - 在 Demo 类型镜像中添加字段
   - 在 Demo HTML 中添加复选框控件
   - 在 Demo JS 中添加两个解码路径的读取和转发逻辑

3. **测试变更**:
   - 添加 TDD 测试覆盖真/假/未定义行为
   - 添加图片独占路由测试
   - 添加 E2E 测试验证浏览器行为

## Capabilities

- [x] 用户可以在 Demo 中勾选 "Exclude images from background image" 复选框
- [x] 当选项为 `true` 时，生成的背景缩略图不包含前景图片
- [x] 当选项为 `false` 或 `undefined` 时，保持现有行为（图片包含在背景中）
- [x] 前景解码图片不受影响
- [x] 可以与现有的 `excludeTextFromBackground` 选项独立组合使用
- [x] 程序化调用者可以通过 `background: { excludeImagesFromBackground: true }` 传递选项

## Impact

- **影响范围**: 背景缩略图生成功能
- **向后兼容**: 完全兼容，默认行为不变（选项默认为 `false`）
- **依赖关系**: 不影响外部包、编码选项或前景图片处理
- **测试覆盖**: 单元测试、集成测试和 E2E 测试全部覆盖