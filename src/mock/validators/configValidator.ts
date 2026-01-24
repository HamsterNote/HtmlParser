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

const normalizeFieldName = (name: string): string[] => {
  // Split on non-alphanumeric chars and camelCase boundaries, then lowercase
  const lowercased = name.toLowerCase()
  const tokens: string[] = []
  let currentToken = ''
  for (let i = 0; i < lowercased.length; i += 1) {
    const char = lowercased[i]
    const prevChar = i > 0 ? lowercased[i - 1] : ''
    if (/[a-z0-9]/.test(char)) {
      if (
        prevChar &&
        ((char >= 'a' && char <= 'z' && prevChar >= 'A' && prevChar <= 'Z') ||
          (char >= 'A' && char <= 'Z' && prevChar >= 'a' && prevChar <= 'z'))
      ) {
        // CamelCase boundary - start new token
        if (currentToken) tokens.push(currentToken)
        currentToken = char
      } else {
        currentToken += char
      }
    } else {
      // Non-alphanumeric - end current token
      if (currentToken) tokens.push(currentToken)
      currentToken = ''
    }
  }
  if (currentToken) tokens.push(currentToken)
  return tokens
}

const isSensitiveFieldName = (fieldName: string): boolean => {
  const tokens = normalizeFieldName(fieldName)
  return tokens.some((token) => SENSITIVE_FIELD_NAMES.includes(token))
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

export const validateConfigInput = (input: MockDataConfigInput): void => {
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new MockError('CONFIG_INVALID', 'name is required')
  }
  if (typeof input.version !== 'string' || input.version.trim().length === 0) {
    throw new MockError('CONFIG_INVALID', 'version is required')
  }
  if (typeof input.seed !== 'string' || input.seed.trim().length === 0) {
    throw new MockError('CONFIG_INVALID', 'seed is required')
  }
  if (
    typeof input.targetModule !== 'string' ||
    input.targetModule.trim().length === 0
  ) {
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
    if (
      config.sensitiveFieldPolicy === 'reject' &&
      isSensitiveFieldName(field.fieldName)
    ) {
      conflicts.push({
        fieldName: field.fieldName,
        reason: 'sensitive-field',
        details: 'sensitive fields are rejected by policy'
      })
    }
  })

  conflicts.push(...detectConstraintConflicts(config.fields))

  if (conflicts.length > 0) {
    return {
      valid: false,
      conflict: buildConflictDiagnostic(config.id, conflicts)
    }
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
