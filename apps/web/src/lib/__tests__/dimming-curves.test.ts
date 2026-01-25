/**
 * Dimming Curves Tests
 *
 * Tests for dimming curve calculation functions
 */

import {
  calculateDimmingValue,
  applyCurve,
  generateCurvePreview,
  getCurveDescription,
} from '../dimming-curves'
import type { DimmerCurveType } from '@/types'

describe('applyCurve', () => {
  it('should handle linear curve correctly', () => {
    expect(applyCurve(0, 'linear')).toBe(0)
    expect(applyCurve(0.5, 'linear')).toBe(0.5)
    expect(applyCurve(1, 'linear')).toBe(1)
  })

  it('should handle sigmoid curve correctly', () => {
    const result0 = applyCurve(0, 'sigmoid')
    const result50 = applyCurve(0.5, 'sigmoid')
    const result100 = applyCurve(1, 'sigmoid')

    expect(result0).toBeGreaterThan(0)
    expect(result0).toBeLessThan(0.1)
    expect(result50).toBeCloseTo(0.5, 1)
    expect(result100).toBeGreaterThan(0.9)
    expect(result100).toBeLessThan(1)
  })

  it('should handle exponential curve correctly', () => {
    expect(applyCurve(0, 'exponential')).toBe(0)
    expect(applyCurve(0.5, 'exponential')).toBe(0.25)
    expect(applyCurve(1, 'exponential')).toBe(1)
  })

  it('should handle logarithmic curve correctly', () => {
    expect(applyCurve(0, 'logarithmic')).toBe(0)
    expect(applyCurve(0.25, 'logarithmic')).toBe(0.5)
    expect(applyCurve(1, 'logarithmic')).toBe(1)
  })

  it('should clamp progress values to [0, 1]', () => {
    expect(applyCurve(-0.5, 'linear')).toBe(0)
    expect(applyCurve(1.5, 'linear')).toBe(1)
  })

  it('should fallback to linear for unknown curve types', () => {
    const unknownCurve = 'unknown' as DimmerCurveType
    expect(applyCurve(0.5, unknownCurve)).toBe(0.5)
  })
})

describe('calculateDimmingValue', () => {
  it('should calculate correct value at start', () => {
    const result = calculateDimmingValue(0, 100, 0, 60000, 'linear')
    expect(result).toBe(0)
  })

  it('should calculate correct value at midpoint with linear curve', () => {
    const result = calculateDimmingValue(0, 100, 30000, 60000, 'linear')
    expect(result).toBe(50)
  })

  it('should calculate correct value at end', () => {
    const result = calculateDimmingValue(0, 100, 60000, 60000, 'linear')
    expect(result).toBe(100)
  })

  it('should handle reverse dimming (100 to 0)', () => {
    const result = calculateDimmingValue(100, 0, 30000, 60000, 'linear')
    expect(result).toBe(50)
  })

  it('should clamp values beyond duration', () => {
    const result = calculateDimmingValue(0, 100, 120000, 60000, 'linear')
    expect(result).toBe(100)
  })

  it('should clamp values before start', () => {
    const result = calculateDimmingValue(0, 100, -1000, 60000, 'linear')
    expect(result).toBe(0)
  })

  it('should handle sigmoid curve correctly', () => {
    const result25 = calculateDimmingValue(0, 100, 15000, 60000, 'sigmoid')
    const result50 = calculateDimmingValue(0, 100, 30000, 60000, 'sigmoid')
    const result75 = calculateDimmingValue(0, 100, 45000, 60000, 'sigmoid')

    expect(result25).toBeGreaterThan(0)
    expect(result25).toBeLessThan(25) // Slower at start
    expect(result50).toBeCloseTo(50, 0)
    expect(result75).toBeGreaterThan(75) // Faster in middle
  })

  it('should handle exponential curve correctly', () => {
    const result25 = calculateDimmingValue(0, 100, 15000, 60000, 'exponential')
    const result50 = calculateDimmingValue(0, 100, 30000, 60000, 'exponential')

    expect(result25).toBeLessThan(10) // Slower at end
    expect(result50).toBe(25)
  })

  it('should handle zero duration gracefully', () => {
    const result = calculateDimmingValue(0, 100, 0, 0, 'linear')
    expect(result).toBe(100) // Should immediately jump to target
  })

  it('should round to 1 decimal place', () => {
    const result = calculateDimmingValue(0, 100, 33333, 100000, 'linear')
    expect(result).toBe(33.3) // Not 33.333
  })

  it('should clamp result to valid range [0, 100]', () => {
    const result = calculateDimmingValue(0, 150, 60000, 60000, 'linear')
    expect(result).toBe(100)
  })
})

describe('generateCurvePreview', () => {
  it('should generate correct number of points', () => {
    const preview = generateCurvePreview('linear', 10)
    expect(preview).toHaveLength(11) // 0 to 10 inclusive
  })

  it('should have points in [0, 1] range', () => {
    const preview = generateCurvePreview('sigmoid', 50)

    for (const point of preview) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(1)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(1)
    }
  })

  it('should start at (0, 0) for all curves', () => {
    const curves: DimmerCurveType[] = ['linear', 'sigmoid', 'exponential', 'logarithmic']

    for (const curve of curves) {
      const preview = generateCurvePreview(curve, 50)
      expect(preview[0].x).toBe(0)
      expect(preview[0].y).toBeCloseTo(0, 5) // Allow tiny rounding errors
    }
  })

  it('should end near (1, 1) for all curves', () => {
    const curves: DimmerCurveType[] = ['linear', 'sigmoid', 'exponential', 'logarithmic']

    for (const curve of curves) {
      const preview = generateCurvePreview(curve, 50)
      const lastPoint = preview[preview.length - 1]
      expect(lastPoint.x).toBe(1)
      expect(lastPoint.y).toBeCloseTo(1, 1)
    }
  })
})

describe('getCurveDescription', () => {
  it('should return descriptions for all curve types', () => {
    expect(getCurveDescription('linear')).toContain('constant rate')
    expect(getCurveDescription('sigmoid')).toContain('S-curve')
    expect(getCurveDescription('exponential')).toContain('Rapid change')
    expect(getCurveDescription('logarithmic')).toContain('Gradual change')
  })

  it('should handle unknown curve type', () => {
    const unknownCurve = 'unknown' as DimmerCurveType
    expect(getCurveDescription(unknownCurve)).toContain('Unknown')
  })
})
