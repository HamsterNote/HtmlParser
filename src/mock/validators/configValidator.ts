import {
  ConflictDiagnostic,
  ConstraintConflict,
  GenerationParams,
  MockDataConfig,
  MockDataConfigInput
} from '../types'
import { DEFAULT_GENERATION_PARAMS, SENSITIVE_FIELD_NAMES } from '../constants'
import { MockError } from '../errors'
import { detectConstraintConflicts } from './constraintValidator'
import { createMockId } from '../store/mockStores'

const normalizeFieldName = (name: string): string => name.toLowerCase()

const isSensitiveFieldName = (fieldName: string): boolean => {
  const normalized = normalizeFieldName(fieldName)
  return SENSITIVE_FIELD_NAMES.some((key) => normalized.includes(key))
}

const buildConflictDiagnostic = (
  configId: string,
  conflicts: ConstraintConflict[]
): ConflictDiagnostic => ({
  id: createMockId('conflict'),
  configId,
  conflicts,
  generatedAt: new Date().toISOString()
})

const ensureGenerationParams = (
  params: GenerationParams | undefined
): GenerationParams => ({
  ...DEFAULT_GENERATION_PARAMS,
  ...params
})

export const validateConfigInput = (
  input: MockDataConfigInput
): void => {
  if (!input.name.trim()) {
    throw new MockError('CONFIG_INVALID', 'name is required')
  }
  if (!input.version.trim()) {
    throw new MockError('CONFIG_INVALID', 'version is required')
  }
  if (!input.seed.trim()) {
    throw new MockError('CONFIG_INVALID', 'seed is required')
  }
  if (!input.targetModule.trim()) {
    throw new MockError('CONFIG_INVALID', 'targetModule is required')
  }
  if (!input.fields || input.fields.length === 0) {
    throw new MockError('CONFIG_INVALID', 'fields are required')
  }

  const generationParams = ensureGenerationParams(input.generationParams)
  if (generationParams.sampleCount < 1) {
    throw new MockError('CONFIG_INVALID', 'sampleCount must be >= 1')
  }
}

export const validateConfig = (
  config: MockDataConfig
): { valid: boolean; conflict?: ConflictDiagnostic } => {
  validateConfigInput(config)

  const conflicts: ConstraintConflict[] = []
  config.fields.forEach((field) => {
    if (config.sensitiveFieldPolicy === 'reject' && isSensitiveFieldName(field.fieldName)) {
      conflicts.push({
        fieldName: field.fieldName,
        reason: 'sensitive-field',
        details: 'sensitive fields are rejected by policy'
      })
    }
  })

  conflicts.push(...detectConstraintConflicts(config.fields))

  if (conflicts.length > 0) {
    return { valid: false, conflict: buildConflictDiagnostic(config.id, conflicts) }
  }

  return { valid: true }
}

export const normalizeConfigInput = (
  input: MockDataConfigInput
): MockDataConfigInput => ({
  ...input,
  generationParams: ensureGenerationParams(input.generationParams),
  sensitiveFieldPolicy: input.sensitiveFieldPolicy ?? 'reject'
})
