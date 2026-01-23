import { ErrorCode, ErrorResponse } from './types'

export class MockError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export const toErrorResponse = (error: unknown): ErrorResponse => {
  if (error instanceof MockError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { code: 'CONFIG_INVALID', message: error.message }
  }

  return { code: 'CONFIG_INVALID', message: 'Unknown error' }
}
