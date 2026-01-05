# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-05

### Changed
- 使用 rolldown 打包
- 修改 publish workflow，改为 version 分支发包

## [0.2.0] - 2026-01-05

### Added
- 实现 HtmlParser 核心类，提供 HTML 与中间结构（IntermediateDocument）的双向转换
  - `encode()`: 将 HTML 文本/File/ArrayBuffer 转换为 HtmlDocument
  - `decode()`: 将 IntermediateDocument 渲染为完整的单文件 HTML
  - `decodeToHtml()`: 将 IntermediateDocument 渲染为 HTML 片段（不含 html/body）
- 实现 HtmlDocument 类，包装 IntermediateDocument，提供文档级别操作
  - 获取文档页面、大纲、封面、标题等功能
- 实现 HtmlPage 类，包装 IntermediatePage，提供页面渲染能力
  - 支持缩略图和文本内容的组合渲染
  - 支持自定义渲染选项和缩放比例
- 添加文本方向检测（RTL/LTR），基于字符范围启发式判断
- 添加行内样式解析，支持 font-size、line-height、font-weight、font-style、color、font-family
- 添加祖先节点样式收集机制，仅在当前字段未设置时采用祖先值
- 添加文本尺寸估算功能，基于字符数、字号和行高计算宽度和高度
- 添加 HTML 转义函数，防止文本注入攻击
- 添加 CSS 单位转换工具函数（px、百分比、em）
- 实现页面懒加载机制，通过 IntermediatePageMap 延迟加载页面数据

### Changed
- 优化构建配置，添加 rolldown 构建工具支持
- 完善 TypeScript 类型定义，确保类型安全

### Fixed
- 修复 DOMParser 不可用时的兜底处理，改用纯文本按行拆分方案

## [0.1.0] - Initial release

### Added
- 初始化 HtmlParser 项目
- 建立基础模块导出结构
