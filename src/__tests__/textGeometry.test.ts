import type { IntermediateTextPolygon } from '@hamster-note/types'

import {
  computeRotationDeg,
  computeTargetHeight,
  computeTargetWidth,
  validatePolygon
} from '../textGeometry.js'

type Polygon = IntermediateTextPolygon

describe('textGeometry - polygon validation and computation', () => {
  describe('validatePolygon', () => {
    it('accepts polygon with exactly 4 points', () => {
      const polygon: Polygon = [[0, 0], [100, 0], [100, 50], [0, 50]]
      expect(() => validatePolygon(polygon)).not.toThrow()
    })

    it('throws descriptive error for polygon with fewer than 4 points', () => {
      const polygon = [[0, 0], [100, 0], [100, 50]] as unknown as Polygon
      expect(() => validatePolygon(polygon)).toThrow(
        'Polygon must have exactly 4 points, got 3'
      )
    })

    it('throws descriptive error for polygon with more than 4 points', () => {
      const polygon =
        [[0, 0], [100, 0], [100, 50], [0, 50], [50, 25]] as unknown as Polygon
      expect(() => validatePolygon(polygon)).toThrow(
        'Polygon must have exactly 4 points, got 5'
      )
    })
  })

  describe('computeRotationDeg', () => {
    it('returns 0 degrees for horizontal top edge (p0 -> p1)', () => {
      const polygon: Polygon = [[0, 0], [100, 0], [100, 50], [0, 50]]
      expect(computeRotationDeg(polygon)).toBeCloseTo(0)
    })

    it('returns 90 degrees for vertical top edge (p0.x == p1.x, p1.y > p0.y)', () => {
      const polygon: Polygon = [[0, 0], [0, 100], [50, 100], [50, 0]]
      expect(computeRotationDeg(polygon)).toBeCloseTo(90)
    })

    it('returns 135 degrees for upward-sloping top edge (p0 -> p1 goes up-left)', () => {
      const polygon: Polygon = [[100, 0], [0, 100], [0, 150], [100, 50]]
      const rotation = computeRotationDeg(polygon)
      expect(rotation).toBeCloseTo(135)
    })
  })

  describe('computeTargetWidth', () => {
    it('returns distance from p0 to p1', () => {
      const polygon: Polygon = [[0, 0], [100, 0], [100, 50], [0, 50]]
      expect(computeTargetWidth(polygon)).toBeCloseTo(100)
    })

    it('throws descriptive error when polygon has fewer than 2 points', () => {
      const polygon = [[0, 0]] as unknown as Polygon
      expect(() => computeTargetWidth(polygon)).toThrow(
        'Cannot compute target width: polygon has fewer than 2 points'
      )
    })
  })

  describe('computeTargetHeight', () => {
    it('returns distance from p1 to p2', () => {
      const polygon: Polygon = [[0, 0], [100, 0], [100, 50], [0, 50]]
      expect(computeTargetHeight(polygon)).toBeCloseTo(50)
    })

    it('throws descriptive error when polygon has fewer than 3 points', () => {
      const polygon = [[0, 0], [100, 0]] as unknown as Polygon
      expect(() => computeTargetHeight(polygon)).toThrow(
        'Cannot compute target height: polygon has fewer than 3 points'
      )
    })
  })

  describe('0-degree polygon produces correct width/height', () => {
    it('horizontal rectangle with width 100 and height 50', () => {
      const polygon: Polygon = [[0, 0], [100, 0], [100, 50], [0, 50]]
      expect(computeRotationDeg(polygon)).toBeCloseTo(0)
      expect(computeTargetWidth(polygon)).toBeCloseTo(100)
      expect(computeTargetHeight(polygon)).toBeCloseTo(50)
    })
  })

  describe('vertical top edge produces 90-degree rotation', () => {
    it('vertical rectangle with width 50 and height 100', () => {
      const polygon: Polygon = [[0, 0], [0, 100], [50, 100], [50, 0]]
      expect(computeRotationDeg(polygon)).toBeCloseTo(90)
      expect(computeTargetWidth(polygon)).toBeCloseTo(100)
      expect(computeTargetHeight(polygon)).toBeCloseTo(50)
    })
  })
})
