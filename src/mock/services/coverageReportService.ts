import { MockError } from '../errors'
import {
  CoverageReport,
  CoverageReportRequest,
  CoverageSnapshot
} from '../types'
import { createMockId, coverageReportStore } from '../store/mockStores'
import { calculateCoverageDelta } from '../coverage/coverageEvaluator'

const ensureSnapshot = (snapshot: CoverageSnapshot, label: string): void => {
  const values = [
    snapshot.branchCoverage,
    snapshot.statementCoverage,
    snapshot.functionCoverage,
    snapshot.lineCoverage
  ]

  values.forEach((value) => {
    if (Number.isNaN(value) || value < 0 || value > 100) {
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
    delta: calculateCoverageDelta(request.baseline, request.current),
    uncoveredBranches: request.uncoveredBranches,
    generatedAt: new Date().toISOString()
  }

  coverageReportStore.set(report.id, report)
  return report
}
