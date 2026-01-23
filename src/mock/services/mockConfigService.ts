import { DEFAULT_CONFIG_STATUS } from '../constants'
import { MockError } from '../errors'
import {
  ConflictDiagnostic,
  MockDataConfig,
  MockDataConfigInput,
  ValidationResult
} from '../types'
import { createMockId, mockConfigStore } from '../store/mockStores'
import {
  normalizeConfigInput,
  validateConfig,
  validateConfigInput
} from '../validators/configValidator'

export const createMockConfig = (input: MockDataConfigInput): MockDataConfig => {
  const normalized = normalizeConfigInput(input)
  validateConfigInput(normalized)
  const now = new Date().toISOString()
  const config: MockDataConfig = {
    ...normalized,
    id: createMockId('config'),
    status: DEFAULT_CONFIG_STATUS,
    createdAt: now,
    updatedAt: now
  }

  mockConfigStore.set(config.id, config)
  return config
}

export const listMockConfigs = (): MockDataConfig[] => mockConfigStore.list()

export const getMockConfig = (configId: string): MockDataConfig => {
  const config = mockConfigStore.get(configId)
  if (!config) {
    throw new MockError('CONFIG_NOT_FOUND', `Config ${configId} not found`)
  }
  return config
}

export const validateMockConfig = (
  configId: string
): ValidationResult | ConflictDiagnostic => {
  const config = getMockConfig(configId)
  const result = validateConfig(config)
  if (!result.valid && result.conflict) {
    return result.conflict
  }
  return { valid: true }
}
