import {
  MockConfigStatus,
  SensitiveFieldPolicy,
  GenerationParams
} from './types'

export const DEFAULT_CONFIG_STATUS: MockConfigStatus = 'draft'
export const DEFAULT_SENSITIVE_FIELD_POLICY: SensitiveFieldPolicy = 'reject'

export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  sampleCount: 100,
  includeBoundarySamples: true,
  includeExceptionSamples: true,
  maxDurationSeconds: 600,
  configVersioning: true
}

export const SENSITIVE_FIELD_NAMES = [
  'password',
  'token',
  'secret',
  'apikey',
  'apiKey',
  'auth',
  'credential',
  'key'
]
