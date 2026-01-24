import { toErrorResponse } from '../errors'
import { ApiResponse } from './mockConfigApi'
import {
  ConflictDiagnostic,
  ErrorResponse,
  GenerateDatasetRequest,
  MockDataset
} from '../types'
import { generateMockDataset } from '../services/mockDatasetService'

export const generateMockDatasetHandler = (
  request: GenerateDatasetRequest
): ApiResponse<MockDataset | ConflictDiagnostic | ErrorResponse> => {
  try {
    const result = generateMockDataset(request)
    if (result.conflict) {
      return { status: 409, body: result.conflict }
    }
    if (result.dataset) {
      return { status: 201, body: result.dataset }
    }
    return { status: 400, body: toErrorResponse(new Error('Invalid request')) }
  } catch (error) {
    return { status: 400, body: toErrorResponse(error) }
  }
}
