# Feature Specification: Mock 数据驱动单测用例生成

**Feature Branch**: `[001-mock-test-cases]`  
**Created**: 2026-01-23  
**Status**: Draft  
**Input**: User description: "使用 自己生成 mock 数据的方式进行单元测试 case 生成，要求 case 覆盖率大幅提升"

## Clarifications

### Session 2026-01-23

- Q: 为满足“同一配置可复用且一致或可追溯”，你希望默认采用哪种一致性策略？ → A: 固定随机种子 + 配置版本化（完全可重复）
- Q: 当输入包含不允许的敏感字段时，默认处理策略是什么？ → A: 拒绝生成并提示原因
- Q: “覆盖率提升”默认使用哪种覆盖指标？ → A: 分支覆盖率（Branch）
- Q: 当数据约束冲突或不完整时，默认处理策略是什么？ → A: 拒绝生成并返回冲突诊断清单

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 面向目标模块的用例生成 (Priority: P1)

测试人员/开发者为目标模块定义数据约束与覆盖目标后，系统生成可直接用于单元测试用例的 mock 数据集，从而快速产出大量高价值用例。

**Why this priority**: 这是提升用例数量与覆盖率的核心路径，直接决定交付价值。

**Independent Test**: 在单一模块上配置约束并生成 mock 数据集，确认可产出可用用例集合并覆盖主要路径。

**Acceptance Scenarios**:

1. **Given** 已定义字段范围与业务约束，**When** 发起生成请求，**Then** 输出的数据满足约束且可用于生成单元测试用例
2. **Given** 定义了边界与异常条件，**When** 生成数据集，**Then** 输出包含边界值与异常值样本

---

### User Story 2 - 可复用且一致的 mock 数据配置 (Priority: P2)

测试人员/开发者希望同一配置能稳定复用，便于持续回归和结果对比。

**Why this priority**: 没有稳定复用能力，覆盖率提升无法验证与复现，价值折损。

**Independent Test**: 使用同一配置重复生成数据，确认结果一致或可追溯。

**Acceptance Scenarios**:

1. **Given** 相同配置与固定生成参数，**When** 多次生成数据集，**Then** 数据内容保持一致或可追溯

---

### User Story 3 - 覆盖提升可评估 (Priority: P3)

测试人员/开发者希望知道生成的用例与数据是否带来了实质覆盖提升，并能发现剩余空白区域。

**Why this priority**: 没有可评估性，难以证明“覆盖率大幅提升”的效果。

**Independent Test**: 在指定模块上生成并执行用例后，能看到覆盖提升结果与不足提示。

**Acceptance Scenarios**:

1. **Given** 已有基线覆盖数据，**When** 生成并执行新用例，**Then** 能看到覆盖提升结果与未覆盖区域提示

---

### Edge Cases

- 当数据约束互相冲突或不完整时，系统拒绝生成并返回冲突诊断清单
- 当生成规模过大导致时间过长时，系统如何反馈进度或失败原因
- 当输入包含不允许的敏感字段时，系统拒绝生成并提示原因

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 支持为目标模块定义 mock 数据的字段范围与业务约束
- **FR-002**: 系统 MUST 基于约束生成可用于单元测试用例的 mock 数据集
- **FR-003**: 系统 MUST 提供覆盖边界值与异常值的 mock 数据样本
- **FR-004**: 系统 MUST 支持复用同一配置并保持结果一致（固定随机种子 + 配置版本化）
- **FR-005**: 系统 MUST 提供基于分支覆盖率的评估结果与未覆盖区域提示

### Key Entities *(include if feature involves data)*

- **Mock 数据配置**: 定义字段范围、约束条件、生成参数、随机种子与配置版本的集合
- **Mock 数据集**: 生成后的样本集合，作为单元测试用例的输入
- **用例覆盖报告**: 用于展示覆盖提升与剩余空白的结果摘要

## Assumptions

- 目标模块已有可对比的基线覆盖数据
- 测试人员能够提供领域规则与数据约束
- 生成数据不包含真实敏感信息

## Dependencies

- 现有单元测试用例生成流程可接收 mock 数据输入
- 覆盖评估数据可被读取并用于对比

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 目标模块的单元测试用例数量相较基线提升至少 2 倍
- **SC-002**: 目标模块的分支覆盖率相较基线提升至少 25 个百分点
- **SC-003**: 生成的 mock 数据集中，98% 以上满足定义的约束与校验
- **SC-004**: 单个目标模块从配置到生成可用用例的时间不超过 10 分钟
