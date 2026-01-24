# 数据模型

## 实体概览

### MockDataConfig（Mock 数据配置）

- **id**: string（唯一标识）
- **name**: string（配置名称）
- **version**: string（配置版本号，例如 `v1`）
- **seed**: string（固定随机种子）
- **targetModule**: string（目标模块标识）
- **fields**: FieldConstraint[]（字段约束列表）
- **generationParams**: GenerationParams（生成参数）
- **sensitiveFieldPolicy**: "reject"（敏感字段策略：默认拒绝）
- **status**: "draft" | "active" | "archived"
- **createdAt**: string（ISO 8601）
- **updatedAt**: string（ISO 8601）

### FieldConstraint（字段约束）

- **fieldName**: string（字段名）
- **type**: "string" | "number" | "boolean" | "date" | "enum" | "object" | "array"
- **required**: boolean
- **nullable**: boolean
- **range**: { min?: number; max?: number }（数值范围）
- **length**: { min?: number; max?: number }（字符串长度）
- **pattern**: string（正则表达式）
- **allowedValues**: string[] | number[]（枚举可选值）
- **boundaryValues**: unknown[]（边界样本）
- **exceptionValues**: unknown[]（异常样本）
- **relations**: RelationConstraint[]（跨字段约束）

### RelationConstraint（关联约束）

- **type**: "equals" | "notEquals" | "greaterThan" | "lessThan" | "in" | "custom"
- **left**: string（字段名）
- **right**: string | number | boolean | string[] | number[]
- **message**: string（冲突诊断提示）

### GenerationParams（生成参数）

- **sampleCount**: number（样本数量）
- **includeBoundarySamples**: boolean
- **includeExceptionSamples**: boolean
- **maxDurationSeconds**: number（上限运行时间）
- **configVersioning**: boolean（是否启用版本化）

### MockDataset（Mock 数据集）

- **id**: string
- **configId**: string
- **configVersion**: string
- **seed**: string
- **samples**: MockSample[]
- **stats**: DatasetStats
- **generatedAt**: string（ISO 8601）

### MockSample（样本）

- **id**: string
- **payload**: Record<string, unknown>
- **tags**: ("boundary" | "exception" | "normal")[]
- **valid**: boolean
- **violations**: string[]

### DatasetStats（数据集统计）

- **total**: number
- **validCount**: number
- **invalidCount**: number
- **boundaryCount**: number
- **exceptionCount**: number
- **constraintPassRate**: number（0-1）

### CoverageReport（用例覆盖报告）

- **id**: string
- **configId**: string
- **baseline**: CoverageSnapshot
- **current**: CoverageSnapshot
- **delta**: CoverageDelta
- **uncoveredBranches**: UncoveredBranch[]
- **generatedAt**: string（ISO 8601）

### CoverageSnapshot（覆盖快照）

- **branchCoverage**: number（0-100）
- **statementCoverage**: number（0-100）
- **functionCoverage**: number（0-100）
- **lineCoverage**: number（0-100）

### CoverageDelta（覆盖增量）

- **branchDelta**: number
- **statementDelta**: number
- **functionDelta**: number
- **lineDelta**: number

### UncoveredBranch（未覆盖分支）

- **filePath**: string
- **branchId**: string
- **line**: number
- **summary**: string

### ConflictDiagnostic（冲突诊断）

- **id**: string
- **configId**: string
- **conflicts**: ConstraintConflict[]
- **generatedAt**: string（ISO 8601）

### ConstraintConflict（约束冲突）

- **fieldName**: string
- **reason**: string
- **details**: string

## 关系与约束

- MockDataConfig 1:N FieldConstraint
- MockDataConfig 1:N MockDataset
- MockDataConfig 1:N CoverageReport
- MockDataset 1:N MockSample
- FieldConstraint 可包含 RelationConstraint 进行跨字段约束
- 当字段包含敏感信息或约束冲突时，必须拒绝生成并返回 ConflictDiagnostic
