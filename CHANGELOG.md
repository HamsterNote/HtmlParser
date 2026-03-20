# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [UnReleased]

### Changed
- 创建 `version/0.5.2` 发布分支，后续 0.5.2 发布内容将在此处继续汇总。

## [0.5.1] - 2026-03-20

### Fixed
- 清理根目录与 `demo/`、`dist/` 中误入仓库的 DiskStation/DownloadConflict 冲突副本，并新增 `*_DownloadConflict*` 忽略规则防止再次提交
- 修复 demo 文档序列化辅助工具的类型声明与运行时行为不一致问题，新增 `decodeSerializedDocumentToHtml()` 封装 decode 流程
- 修复空文本页在序列化阶段被误判为未加载文本的问题，并补充对应测试覆盖

## [0.5.0] - 2026-03-16

### Added
- 新增 HtmlParser 多页面 demo（index/encode）与 JSON 输出展示，补充 README 访问说明
- demo 页面新增 JSON decode 预览区与错误提示，支持 JSON -> HTML 片段回显
- 实现Mock数据驱动的单测用例生成模块
  - Mock数据配置管理：支持创建、更新、查询、删除Mock配置，包含字段约束、边界值、异常值定义
  - 可确定性数据生成：基于固定随机种子和配置版本化，确保同一配置生成完全一致的数据
  - Mock数据集生成：支持批量生成指定数量的测试样本，自动包含边界值和异常值样本
  - 配置版本管理：自动为配置生成版本号，支持配置历史追溯和复用
  - 覆盖率报告：提供Mock数据生成后的覆盖率评估，包括字段覆盖率和样本覆盖率
  - 完整的API接口：提供createMockConfig、generateMockDataset、validateMockConfig、getCoverageReport等高层API
  - 配置验证：支持配置结构的完整性和约束冲突检测
- 添加单元测试：覆盖率报告、配置验证、数据集生成、可重现性测试
- 完善ESLint配置：添加忽略规则（node_modules、dist、coverage等工具目录）
- 添加代码覆盖率配置：在Jest中开启覆盖率收集和多种报告格式
- 完善项目文档：添加README、AGENTS.md、规格说明文档

### Changed
- 优化ESLint配置结构，使用数组格式扩展基础配置
- 优化代码格式，提高可读性

### Fixed
- 修复.gitignore遗漏*.swp文件的问题
- 修复PR #4 CI报错问题
  - 移除不存在的coverageEvaluator模块导出和导入
  - 修复PRNG除数为0xffffffff导致可能返回1.0的问题，改为0x100000000
  - 修复eslint.config.js末尾逗号问题
  - 修复openapi.yaml中409响应schema从ErrorResponse改为ConflictDiagnostic
  - 添加openapi.yaml安全声明（security: []和bearerAuth scheme）
   - 修复validateMockConfigHandler未处理CONFIG_NOT_FOUND返回404的问题
   - 修复fieldValueGenerator使用Date.now()破坏确定性的问题，改为使用固定epoch和PRNG偏移
   - 修复fieldValueGenerator中string类型字段未生成超出最大长度限制异常值的问题
   - 修复coverageReportService中ensureSnapshot未验证undefined/null值的问题
   - 修复configValidator中未检查字符串类型的问题，添加typeof验证
  - 修复configValidator中isSensitiveFieldName使用substring匹配的问题，改为token精确匹配
  - 修复bumpConfigVersion生成双v前缀的问题

## [0.3.0] - 2026-01-05

### Changed
- 使用 rolldown 打包
- 修改 publish workflow，改为 version 分支发包

### Fixed
- 添加 .gitignore 配置，忽略 .opencode/ 和 .specify/ 工具生成的配置文件

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
