# Quickstart

## Goal

Generate deterministic mock datasets for unit tests and evaluate branch coverage improvement.

## 1) Define a Mock Data Config

Create a configuration with a fixed seed and explicit field constraints.

```ts
import { createMockConfig } from '@hamster-note/html-parser'
```

```json
{
  "name": "user-flow",
  "version": "v1",
  "seed": "user-flow-v1",
  "targetModule": "html-parser",
  "fields": [
    {
      "fieldName": "title",
      "type": "string",
      "required": true,
      "nullable": false,
      "length": { "min": 1, "max": 120 },
      "boundaryValues": ["", "A"],
      "exceptionValues": [null]
    },
    {
      "fieldName": "pageCount",
      "type": "number",
      "required": true,
      "nullable": false,
      "range": { "min": 1, "max": 50 },
      "boundaryValues": [1, 50],
      "exceptionValues": [-1]
    }
  ],
  "generationParams": {
    "sampleCount": 200,
    "includeBoundarySamples": true,
    "includeExceptionSamples": true,
    "maxDurationSeconds": 600,
    "configVersioning": true
  },
  "sensitiveFieldPolicy": "reject"
}
```

## 2) Validate Config

Call `validateMockConfigHandler(configId)` to detect constraint conflicts or sensitive fields.

Expected outcomes:

- 200 OK with `valid: true`
- 409 Conflict with a `ConflictDiagnostic` list

## 3) Generate Dataset

Call `generateMockDatasetHandler({ configId })` with the config id.

Expected outcomes:

- 201 Created with deterministic `samples`
- 409 Conflict when constraints are inconsistent or contain sensitive fields

## 4) Run Tests With Coverage

Use the existing Jest setup and enable coverage reporting for branch coverage.

Key Jest settings (from official docs):

- `collectCoverage`
- `coverageReporters` (text, lcov, html)
- `coverageThreshold` with `branches`

## 5) Create Coverage Report

Create a report by comparing baseline vs current branch coverage.

Call `createCoverageReportHandler` with `baseline`, `current`, and `uncoveredBranches`.

## 6) Reproducibility Checks

Repeat dataset generation with the same seed and config version. The payloads and ordering should be identical or traceable via metadata.

## Quickstart Validation Checklist

- [x] 配置创建与参数检查完成
- [x] 配置校验返回 200 或 409
- [x] 数据集生成返回 201 或 409
- [x] 覆盖率报告返回 201
- [x] 可复现性检查完成
