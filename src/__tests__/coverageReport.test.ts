import { createCoverageReport } from '../mock'

describe('coverage report', () => {
  it('calculates coverage deltas', () => {
    const report = createCoverageReport({
      configId: 'config-1',
      baseline: {
        branchCoverage: 60,
        statementCoverage: 70,
        functionCoverage: 80,
        lineCoverage: 75
      },
      current: {
        branchCoverage: 75,
        statementCoverage: 80,
        functionCoverage: 90,
        lineCoverage: 85
      },
      uncoveredBranches: [
        {
          filePath: 'src/index.ts',
          branchId: 'if-1',
          line: 10,
          summary: 'missing else branch'
        }
      ]
    })

    expect(report.delta.branchDelta).toBe(15)
    expect(report.delta.statementDelta).toBe(10)
    expect(report.delta.functionDelta).toBe(10)
    expect(report.delta.lineDelta).toBe(10)
  })
})
