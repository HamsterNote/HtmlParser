# Implementation Plan: Mock 数据驱动单测用例生成

**Branch**: `[001-mock-test-cases]` | **Date**: 2026-01-23 | **Spec**: `/specs/001-mock-test-cases/spec.md`
**Input**: Feature specification from `/specs/001-mock-test-cases/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

为目标模块提供可配置的 mock 数据生成能力，支持字段约束、边界/异常样本与固定随机种子 + 配置版本化，输出可直接用于单测用例的数据集，并提供基于分支覆盖率的评估与未覆盖区域提示。

## Technical Context

**Language/Version**: TypeScript 5.0.2（Node.js ESM）  
**Primary Dependencies**: @hamster-note/document-parser, @hamster-note/types  
**Storage**: N/A（配置与报告以文件/内存结构为主）  
**Testing**: Jest 30.2.0 + ts-jest 29.4.6  
**Target Platform**: Node.js library  
**Project Type**: 单包库（single project）  
**Performance Goals**: 单模块配置到生成可用用例不超过 10 分钟  
**Constraints**: 固定随机种子 + 配置版本化可复现；冲突约束与敏感字段必须拒绝并给出诊断  
**Scale/Scope**: 面向单目标模块的 mock 数据配置、生成与覆盖评估

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Code Quality Is Non-Negotiable: PASS（计划包含显式错误输出与结构化模型）
- Testing Standards Are Enforced: PASS（新增/变更行为需补齐单元与集成测试）
- User Experience Consistency: PASS（统一错误提示格式与输出字段，避免破坏现有接口）
- Performance Requirements Are Defined: PASS（定义 10 分钟生成目标）
- Regression Guardrails: PASS（CI 需运行 lint/type/test；覆盖评估纳入检查）

**Post-Phase 1 Re-check**: PASS（数据模型、契约与快速上手保持上述约束，不引入偏离）

## Project Structure

### Documentation (this feature)

```text
specs/001-mock-test-cases/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── HtmlDocument.ts
├── HtmlPage.ts
├── lazyLoadPage.ts
├── index.ts
└── __tests__/
    └── htmlParser.test.ts

dist/
```

**Structure Decision**: 单包库结构，核心逻辑与测试均位于 `src/` 下，符合当前仓库布局。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
