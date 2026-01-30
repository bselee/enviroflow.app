/**
 * Unit tests for VPD (Vapor Pressure Deficit) calculation utilities.
 *
 * These tests verify the correctness of VPD calculations, validation logic,
 * status categorization, and formatting functions used throughout the app.
 */

import {
  calculateVPD,
  calculateVPDCelsius,
  getVPDStatus,
  formatVPD,
  calculateLeafVPD,
  estimateLeafTemperature,
  VPD_RANGES,
} from '../vpd-utils';

describe('vpd-utils', () => {
  describe('calculateVPD', () => {
    describe('valid inputs', () => {
      it('should calculate VPD correctly for typical growing conditions', () => {
        // 75°F, 65% RH - typical indoor growing environment
        const vpd = calculateVPD(75, 65);
        expect(vpd).toBeCloseTo(1.02, 2);
      });

      it('should calculate VPD for cool, humid conditions', () => {
        // 60°F, 80% RH - propagation conditions
        const vpd = calculateVPD(60, 80);
        expect(vpd).toBeCloseTo(0.34, 2);
      });

      it('should calculate VPD for warm, dry conditions', () => {
        // 85°F, 45% RH - late flowering conditions
        const vpd = calculateVPD(85, 45);
        expect(vpd).toBeCloseTo(1.84, 2);
      });

      it('should handle 0% humidity (dry air)', () => {
        const vpd = calculateVPD(70, 0);
        expect(vpd).not.toBeNull();
        expect(vpd).toBeGreaterThan(0);
      });

      it('should handle 100% humidity (saturated air)', () => {
        const vpd = calculateVPD(70, 100);
        expect(vpd).toBe(0);
      });

      it('should return values rounded to 2 decimal places', () => {
        const vpd = calculateVPD(75, 65);
        expect(vpd).toBe(Math.round((vpd as number) * 100) / 100);
      });

      it('should calculate VPD at minimum valid temperature (32°F)', () => {
        const vpd = calculateVPD(32, 50);
        expect(vpd).not.toBeNull();
        expect(vpd).toBeGreaterThanOrEqual(0);
      });

      it('should calculate VPD at maximum valid temperature (140°F)', () => {
        const vpd = calculateVPD(140, 50);
        expect(vpd).not.toBeNull();
        expect(vpd).toBeGreaterThan(0);
      });
    });

    describe('edge cases and invalid inputs', () => {
      it('should return null for temperature below valid range', () => {
        expect(calculateVPD(31, 50)).toBeNull();
        expect(calculateVPD(-10, 50)).toBeNull();
      });

      it('should return null for temperature above valid range', () => {
        expect(calculateVPD(141, 50)).toBeNull();
        expect(calculateVPD(200, 50)).toBeNull();
      });

      it('should return null for negative humidity', () => {
        expect(calculateVPD(75, -1)).toBeNull();
        expect(calculateVPD(75, -50)).toBeNull();
      });

      it('should return null for humidity above 100%', () => {
        expect(calculateVPD(75, 101)).toBeNull();
        expect(calculateVPD(75, 150)).toBeNull();
      });

      it('should return null for NaN temperature', () => {
        expect(calculateVPD(NaN, 50)).toBeNull();
      });

      it('should return null for NaN humidity', () => {
        expect(calculateVPD(75, NaN)).toBeNull();
      });

      it('should return null for Infinity temperature', () => {
        expect(calculateVPD(Infinity, 50)).toBeNull();
        expect(calculateVPD(-Infinity, 50)).toBeNull();
      });

      it('should return null for Infinity humidity', () => {
        expect(calculateVPD(75, Infinity)).toBeNull();
        expect(calculateVPD(75, -Infinity)).toBeNull();
      });

      it('should return null for both invalid inputs', () => {
        expect(calculateVPD(NaN, NaN)).toBeNull();
        expect(calculateVPD(Infinity, -1)).toBeNull();
      });
    });

    describe('boundary conditions', () => {
      it('should handle boundary at 0% humidity', () => {
        expect(calculateVPD(70, 0)).not.toBeNull();
      });

      it('should handle boundary at 100% humidity', () => {
        expect(calculateVPD(70, 100)).toBe(0);
      });

      it('should handle boundary at 32°F (0°C)', () => {
        expect(calculateVPD(32, 50)).not.toBeNull();
      });

      it('should handle boundary at 140°F (60°C)', () => {
        expect(calculateVPD(140, 50)).not.toBeNull();
      });
    });
  });

  describe('calculateVPDCelsius', () => {
    it('should calculate VPD with Celsius input', () => {
      // 23.9°C ≈ 75°F, 65% RH
      const vpd = calculateVPDCelsius(23.9, 65);
      expect(vpd).toBeCloseTo(1.02, 1);
    });

    it('should produce same result as calculateVPD with equivalent temp', () => {
      const tempF = 75;
      const tempC = (tempF - 32) * 5 / 9;
      const humidity = 65;

      const vpdFromF = calculateVPD(tempF, humidity);
      const vpdFromC = calculateVPDCelsius(tempC, humidity);

      expect(vpdFromC).toBeCloseTo(vpdFromF as number, 2);
    });

    it('should handle 0°C (32°F)', () => {
      const vpd = calculateVPDCelsius(0, 50);
      expect(vpd).not.toBeNull();
    });

    it('should handle 60°C (140°F)', () => {
      const vpd = calculateVPDCelsius(60, 50);
      expect(vpd).not.toBeNull();
    });

    it('should return null for out-of-range Celsius values', () => {
      // -1°C is 30.2°F (below 32°F min)
      expect(calculateVPDCelsius(-1, 50)).toBeNull();
      // 61°C is 141.8°F (above 140°F max)
      expect(calculateVPDCelsius(61, 50)).toBeNull();
    });
  });

  describe('getVPDStatus', () => {
    const generalRange = VPD_RANGES.general; // { min: 0.8, max: 1.2 }

    it('should return "optimal" for values within target range', () => {
      expect(getVPDStatus(0.8, generalRange)).toBe('optimal');
      expect(getVPDStatus(1.0, generalRange)).toBe('optimal');
      expect(getVPDStatus(1.2, generalRange)).toBe('optimal');
    });

    it('should return "warning_low" for values below min but above danger threshold', () => {
      // Between min * 0.6 (0.48) and min (0.8)
      expect(getVPDStatus(0.7, generalRange)).toBe('warning_low');
      expect(getVPDStatus(0.6, generalRange)).toBe('warning_low');
      expect(getVPDStatus(0.5, generalRange)).toBe('warning_low');
    });

    it('should return "danger_low" for values below danger threshold', () => {
      // Below min * 0.6 (0.48)
      expect(getVPDStatus(0.4, generalRange)).toBe('danger_low');
      expect(getVPDStatus(0.3, generalRange)).toBe('danger_low');
      expect(getVPDStatus(0.1, generalRange)).toBe('danger_low');
    });

    it('should return "warning_high" for values above max but below danger threshold', () => {
      // Between max (1.2) and max * 1.3 (1.56)
      expect(getVPDStatus(1.3, generalRange)).toBe('warning_high');
      expect(getVPDStatus(1.4, generalRange)).toBe('warning_high');
      expect(getVPDStatus(1.5, generalRange)).toBe('warning_high');
    });

    it('should return "danger_high" for values above danger threshold', () => {
      // Above max * 1.3 (1.56)
      expect(getVPDStatus(1.6, generalRange)).toBe('danger_high');
      expect(getVPDStatus(2.0, generalRange)).toBe('danger_high');
      expect(getVPDStatus(3.0, generalRange)).toBe('danger_high');
    });

    it('should return null for null VPD input', () => {
      expect(getVPDStatus(null, generalRange)).toBeNull();
    });

    it('should use general range as default', () => {
      expect(getVPDStatus(1.0)).toBe('optimal');
      expect(getVPDStatus(0.4)).toBe('danger_low');
      expect(getVPDStatus(1.7)).toBe('danger_high');
    });

    it('should work with different target ranges', () => {
      const propagationRange = VPD_RANGES.propagation; // { min: 0.4, max: 0.8 }

      expect(getVPDStatus(0.6, propagationRange)).toBe('optimal');
      expect(getVPDStatus(0.3, propagationRange)).toBe('warning_low');
      expect(getVPDStatus(0.9, propagationRange)).toBe('warning_high');
    });

    it('should correctly categorize status for vegetative range', () => {
      const vegRange = VPD_RANGES.vegetative; // { min: 0.8, max: 1.2 }

      expect(getVPDStatus(1.0, vegRange)).toBe('optimal');
      expect(getVPDStatus(0.5, vegRange)).toBe('warning_low');
      expect(getVPDStatus(1.8, vegRange)).toBe('danger_high');
    });

    it('should correctly categorize status for flowering range', () => {
      const flowerRange = VPD_RANGES.flowering; // { min: 1.0, max: 1.5 }

      expect(getVPDStatus(1.2, flowerRange)).toBe('optimal');
      expect(getVPDStatus(0.8, flowerRange)).toBe('warning_low');
      expect(getVPDStatus(2.0, flowerRange)).toBe('danger_high');
    });
  });

  describe('formatVPD', () => {
    describe('kPa format (default)', () => {
      it('should format valid VPD in kPa', () => {
        expect(formatVPD(1.23)).toBe('1.23 kPa');
      });

      it('should format with 2 decimal places', () => {
        expect(formatVPD(1.2)).toBe('1.20 kPa');
        expect(formatVPD(0.5)).toBe('0.50 kPa');
      });

      it('should format zero correctly', () => {
        expect(formatVPD(0)).toBe('0.00 kPa');
      });

      it('should return "--" for null input', () => {
        expect(formatVPD(null)).toBe('--');
      });
    });

    describe('mbar format', () => {
      it('should format valid VPD in mbar', () => {
        // 1 kPa = 10 mbar
        expect(formatVPD(1.23, 'mbar')).toBe('12.3 mbar');
      });

      it('should format with 1 decimal place in mbar', () => {
        expect(formatVPD(1.0, 'mbar')).toBe('10.0 mbar');
        expect(formatVPD(0.5, 'mbar')).toBe('5.0 mbar');
      });

      it('should format zero correctly in mbar', () => {
        expect(formatVPD(0, 'mbar')).toBe('0.0 mbar');
      });

      it('should return "--" for null input in mbar format', () => {
        expect(formatVPD(null, 'mbar')).toBe('--');
      });

      it('should correctly convert kPa to mbar (1 kPa = 10 mbar)', () => {
        expect(formatVPD(2.5, 'mbar')).toBe('25.0 mbar');
        expect(formatVPD(0.15, 'mbar')).toBe('1.5 mbar');
      });
    });

    describe('edge cases', () => {
      it('should format very small VPD values', () => {
        expect(formatVPD(0.01)).toBe('0.01 kPa');
        expect(formatVPD(0.01, 'mbar')).toBe('0.1 mbar');
      });

      it('should format large VPD values', () => {
        expect(formatVPD(5.0)).toBe('5.00 kPa');
        expect(formatVPD(5.0, 'mbar')).toBe('50.0 mbar');
      });
    });
  });

  describe('estimateLeafTemperature', () => {
    it('should default to 3°F offset without light intensity', () => {
      expect(estimateLeafTemperature(75)).toBe(72);
      expect(estimateLeafTemperature(80)).toBe(77);
    });

    it('should use 1°F offset for high light (>800 PPFD)', () => {
      expect(estimateLeafTemperature(75, 1000)).toBe(74);
      expect(estimateLeafTemperature(80, 900)).toBe(79);
    });

    it('should use 2°F offset for medium light (400-800 PPFD)', () => {
      expect(estimateLeafTemperature(75, 600)).toBe(73);
      expect(estimateLeafTemperature(80, 500)).toBe(78);
    });

    it('should use 3°F offset for low light (200-400 PPFD)', () => {
      expect(estimateLeafTemperature(75, 300)).toBe(72);
      expect(estimateLeafTemperature(80, 250)).toBe(77);
    });

    it('should use 4°F offset for very low light (<200 PPFD)', () => {
      expect(estimateLeafTemperature(75, 100)).toBe(71);
      expect(estimateLeafTemperature(80, 50)).toBe(76);
    });

    it('should handle boundary at 200 PPFD', () => {
      expect(estimateLeafTemperature(75, 199)).toBe(71); // 4°F offset
      expect(estimateLeafTemperature(75, 200)).toBe(72); // 3°F offset
    });

    it('should handle boundary at 400 PPFD', () => {
      expect(estimateLeafTemperature(75, 399)).toBe(72); // 3°F offset
      expect(estimateLeafTemperature(75, 400)).toBe(73); // 2°F offset
    });

    it('should handle boundary at 800 PPFD', () => {
      expect(estimateLeafTemperature(75, 799)).toBe(73); // 2°F offset
      expect(estimateLeafTemperature(75, 800)).toBe(73); // 2°F offset
      expect(estimateLeafTemperature(75, 801)).toBe(74); // 1°F offset
    });

    it('should handle 0 PPFD', () => {
      expect(estimateLeafTemperature(75, 0)).toBe(71); // 4°F offset
    });
  });

  describe('calculateLeafVPD', () => {
    it('should calculate leaf VPD with default 3°F offset', () => {
      // Air: 75°F, 65% RH → Leaf: 72°F, 65% RH
      const leafVPD = calculateLeafVPD(75, 65);
      const expectedVPD = calculateVPD(72, 65);
      expect(leafVPD).toEqual(expectedVPD);
    });

    it('should calculate leaf VPD with custom offset', () => {
      // Air: 75°F, 65% RH with 5°F offset → Leaf: 70°F, 65% RH
      const leafVPD = calculateLeafVPD(75, 65, 5);
      const expectedVPD = calculateVPD(70, 65);
      expect(leafVPD).toEqual(expectedVPD);
    });

    it('should be lower than air VPD (leaves are cooler)', () => {
      const airVPD = calculateVPD(80, 60);
      const leafVPD = calculateLeafVPD(80, 60, 3);

      expect(leafVPD).not.toBeNull();
      expect(airVPD).not.toBeNull();
      expect(leafVPD as number).toBeLessThan(airVPD as number);
    });

    it('should return null for invalid inputs', () => {
      expect(calculateLeafVPD(30, 50)).toBeNull(); // Below 32°F
      expect(calculateLeafVPD(150, 50)).toBeNull(); // Above 140°F
      expect(calculateLeafVPD(75, -10)).toBeNull(); // Negative humidity
      expect(calculateLeafVPD(75, 110)).toBeNull(); // Humidity > 100%
    });

    it('should handle zero offset (same as air VPD)', () => {
      const airVPD = calculateVPD(75, 65);
      const leafVPD = calculateLeafVPD(75, 65, 0);
      expect(leafVPD).toEqual(airVPD);
    });

    it('should handle large offset', () => {
      // 75°F air with 10°F offset → 65°F leaf
      const leafVPD = calculateLeafVPD(75, 65, 10);
      const expectedVPD = calculateVPD(65, 65);
      expect(leafVPD).toEqual(expectedVPD);
    });

    it('should respect temperature boundaries after offset', () => {
      // 35°F air with 4°F offset → 31°F leaf (below minimum)
      expect(calculateLeafVPD(35, 50, 4)).toBeNull();
    });
  });

  describe('VPD_RANGES constants', () => {
    it('should define propagation range', () => {
      expect(VPD_RANGES.propagation).toEqual({ min: 0.4, max: 0.8 });
    });

    it('should define vegetative range', () => {
      expect(VPD_RANGES.vegetative).toEqual({ min: 0.8, max: 1.2 });
    });

    it('should define flowering range', () => {
      expect(VPD_RANGES.flowering).toEqual({ min: 1.0, max: 1.5 });
    });

    it('should define late flowering range', () => {
      expect(VPD_RANGES.lateFlowering).toEqual({ min: 1.2, max: 1.6 });
    });

    it('should define general range', () => {
      expect(VPD_RANGES.general).toEqual({ min: 0.8, max: 1.2 });
    });

    it('should have increasing min values across growth stages', () => {
      expect(VPD_RANGES.propagation.min).toBeLessThan(VPD_RANGES.vegetative.min);
      expect(VPD_RANGES.vegetative.min).toBeLessThanOrEqual(VPD_RANGES.flowering.min);
      expect(VPD_RANGES.flowering.min).toBeLessThan(VPD_RANGES.lateFlowering.min);
    });

    it('should have increasing max values across growth stages', () => {
      expect(VPD_RANGES.propagation.max).toBeLessThanOrEqual(VPD_RANGES.vegetative.max);
      expect(VPD_RANGES.vegetative.max).toBeLessThan(VPD_RANGES.flowering.max);
      expect(VPD_RANGES.flowering.max).toBeLessThan(VPD_RANGES.lateFlowering.max);
    });
  });

  describe('integration tests', () => {
    it('should correctly flow from calculation to status to formatting', () => {
      const temp = 75;
      const humidity = 65;

      const vpd = calculateVPD(temp, humidity);
      expect(vpd).not.toBeNull();

      const status = getVPDStatus(vpd);
      expect(status).toBe('optimal');

      const formatted = formatVPD(vpd);
      expect(formatted).toMatch(/^\d+\.\d{2} kPa$/);
    });

    it('should handle full workflow with invalid inputs gracefully', () => {
      const vpd = calculateVPD(200, 50); // Invalid temperature
      expect(vpd).toBeNull();

      const status = getVPDStatus(vpd);
      expect(status).toBeNull();

      const formatted = formatVPD(vpd);
      expect(formatted).toBe('--');
    });

    it('should demonstrate leaf VPD workflow', () => {
      const airTemp = 80;
      const humidity = 60;
      const lightPPFD = 600;

      // Estimate leaf temperature based on light
      const leafTemp = estimateLeafTemperature(airTemp, lightPPFD);
      expect(leafTemp).toBeLessThan(airTemp);

      // Calculate both air and leaf VPD
      const airVPD = calculateVPD(airTemp, humidity);
      const leafVPD = calculateLeafVPD(airTemp, humidity);

      expect(airVPD).not.toBeNull();
      expect(leafVPD).not.toBeNull();
      expect(leafVPD as number).toBeLessThan(airVPD as number);

      // Get status for leaf VPD
      const status = getVPDStatus(leafVPD, VPD_RANGES.vegetative);
      expect(status).toBeTruthy();
    });
  });
});
