export type MockConfigStatus = 'draft' | 'active' | 'archived'
export type SensitiveFieldPolicy = 'reject'
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'object'
  | 'array'

export type RelationType =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'in'
  | 'custom'

export type SampleTag = 'boundary' | 'exception' | 'normal'

export type ErrorCode =
  | 'CONFIG_INVALID'
  | 'CONFIG_NOT_FOUND'
  | 'CONSTRAINT_CONFLICT'
  | 'SENSITIVE_FIELD'
  | 'DATASET_INVALID'
  | 'COVERAGE_INVALID'

export type ErrorResponse = {
  code: ErrorCode
  message: string
}

export type NumberRange = {
  min?: number
  max?: number
}

export type RelationConstraint = {
  type: RelationType
  left: string
  right: string | number | boolean | Array<string | number>
  message: string
}

export type FieldConstraint = {
  fieldName: string
  type: FieldType
  required: boolean
  nullable: boolean
  range?: NumberRange
  length?: NumberRange
  pattern?: string
  allowedValues?: Array<string | number>
  boundaryValues?: unknown[]
  exceptionValues?: unknown[]
  relations?: RelationConstraint[]
}

export type GenerationParams = {
  sampleCount: number
  includeBoundarySamples: boolean
  includeExceptionSamples: boolean
  maxDurationSeconds?: number
  configVersioning?: boolean
}

export type MockDataConfigInput = {
  name: string
  version: string
  seed: string
  targetModule: string
  fields: FieldConstraint[]
  generationParams: GenerationParams
  sensitiveFieldPolicy?: SensitiveFieldPolicy
}

export type MockDataConfig = MockDataConfigInput & {
  id: string
  status: MockConfigStatus
  createdAt: string
  updatedAt: string
}

export type MockSample = {
  id: string
  payload: Record<string, unknown>
  tags: SampleTag[]
  valid: boolean
  violations: string[]
}

export type DatasetStats = {
  total: number
  validCount: number
  invalidCount: number
  boundaryCount: number
  exceptionCount: number
  constraintPassRate: number
}

export type MockDataset = {
  id: string
  configId: string
  configVersion: string
  seed: string
  samples: MockSample[]
  stats: DatasetStats
  generatedAt: string
}

export type CoverageSnapshot = {
  branchCoverage: number
  statementCoverage: number
  functionCoverage: number
  lineCoverage: number
}

export type CoverageDelta = {
  branchDelta: number
  statementDelta: number
  functionDelta: number
  lineDelta: number
}

export type UncoveredBranch = {
  filePath: string
  branchId: string
  line: number
  summary: string
}

export type CoverageReportRequest = {
  configId: string
  baseline: CoverageSnapshot
  current: CoverageSnapshot
  uncoveredBranches: UncoveredBranch[]
}

export type CoverageReport = {
  id: string
  configId: string
  baseline: CoverageSnapshot
  current: CoverageSnapshot
  delta: CoverageDelta
  uncoveredBranches: UncoveredBranch[]
  generatedAt: string
}

export type ConstraintConflict = {
  fieldName: string
  reason: string
  details: string
}

export type ConflictDiagnostic = {
  id: string
  configId: string
  conflicts: ConstraintConflict[]
  generatedAt: string
}

export type ValidationResult = {
  valid: boolean
}

export type GenerateDatasetRequest = {
  configId: string
  overrideSeed?: string
}
