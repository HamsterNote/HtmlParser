import { MockError } from '../errors'
import {
  CoverageReport,
  CoverageReportRequest,
  CoverageSnapshot
} from '../types'
import { createMockId, coverageReportStore } from '../store/mockStores'

const ensureSnapshot = (snapshot: CoverageSnapshot, label: string): void => {
  const values = [
    snapshot.branchCoverage,
    snapshot.statementCoverage,
    snapshot.functionCoverage,
    snapshot.lineCoverage
  ]

  values.forEach((value) => {
    if (
      typeof value !== 'number' ||
      Number.isNaN(value) ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    ) {
      throw new MockError(
        'COVERAGE_INVALID',
        `${label} coverage values must be between 0 and 100`
      )
    }
  })
}

export const createCoverageReport = (
  request: CoverageReportRequest
): CoverageReport => {
  if (!request.configId.trim()) {
    throw new MockError('CONFIG_INVALID', 'configId is required')
  }
  ensureSnapshot(request.baseline, 'baseline')
  ensureSnapshot(request.current, 'current')

  const report: CoverageReport = {
    id: createMockId('coverage'),
    configId: request.configId,
    baseline: request.baseline,
    current: request.current,
    delta: {
      branchDelta:
        request.current.branchCoverage - request.baseline.branchCoverage,
      statementDelta:
        request.current.statementCoverage - request.baseline.statementCoverage,
      functionDelta:
        request.current.functionCoverage - request.baseline.functionCoverage,
      lineDelta: request.current.lineCoverage - request.baseline.lineCoverage
    },
    uncoveredBranches: request.uncoveredBranches,
    generatedAt: new Date().toISOString()
  }

  coverageReportStore.set(report.id, report)
  return report
}
