import { toErrorResponse } from '../errors'
import { ApiResponse } from './mockConfigApi'
import { CoverageReport, CoverageReportRequest, ErrorResponse } from '../types'
import { createCoverageReport } from '../services/coverageReportService'

export const createCoverageReportHandler = (
  request: CoverageReportRequest
): ApiResponse<CoverageReport | ErrorResponse> => {
  try {
    const report = createCoverageReport(request)
    return { status: 201, body: report }
  } catch (error) {
    return { status: 400, body: toErrorResponse(error) }
  }
}
