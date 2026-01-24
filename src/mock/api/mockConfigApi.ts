import { toErrorResponse } from '../errors'
import {
  ConflictDiagnostic,
  ErrorResponse,
  MockDataConfig,
  MockDataConfigInput,
  ValidationResult
} from '../types'
import {
  createMockConfig,
  getMockConfig,
  listMockConfigs,
  validateMockConfig
} from '../services/mockConfigService'

export type ApiResponse<T> = {
  status: number
  body: T
}

export const createMockConfigHandler = (
  input: MockDataConfigInput
): ApiResponse<MockDataConfig | ErrorResponse> => {
  try {
    const config = createMockConfig(input)
    return { status: 201, body: config }
  } catch (error) {
    return { status: 400, body: toErrorResponse(error) }
  }
}

export const listMockConfigsHandler = (): ApiResponse<MockDataConfig[]> => ({
  status: 200,
  body: listMockConfigs()
})

export const getMockConfigHandler = (
  configId: string
): ApiResponse<MockDataConfig | ErrorResponse> => {
  try {
    const config = getMockConfig(configId)
    return { status: 200, body: config }
  } catch (error) {
    return { status: 404, body: toErrorResponse(error) }
  }
}

export const validateMockConfigHandler = (
  configId: string
): ApiResponse<ValidationResult | ConflictDiagnostic | ErrorResponse> => {
  try {
    const result = validateMockConfig(configId)
    if ('conflicts' in result) {
      return { status: 409, body: result }
    }
    return { status: 200, body: result }
  } catch (error) {
    if (
      error === 'CONFIG_NOT_FOUND' ||
      (error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'CONFIG_NOT_FOUND') ||
      (error &&
        typeof error === 'object' &&
        'message' in error &&
        error.message === 'CONFIG_NOT_FOUND')
    ) {
      return { status: 404, body: toErrorResponse(error) }
    }
    return { status: 400, body: toErrorResponse(error) }
  }
}
