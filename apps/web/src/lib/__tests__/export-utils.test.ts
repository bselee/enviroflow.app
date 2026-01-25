/**
 * Unit tests for export utilities
 *
 * Run with: npm test export-utils.test.ts
 */

import { describe, it, expect } from "@jest/globals";
import type { SensorReading, SensorType } from "@/types";
import {
  generateExportFilename,
  checkExportSize,
  calculateSummaryStats,
} from "../export-utils";

describe("Export Utils", () => {
  describe("generateExportFilename", () => {
    it("should generate correct CSV filename", () => {
      const filename = generateExportFilename(
        "Grow Tent A",
        new Date("2024-01-01"),
        new Date("2024-01-31"),
        "csv"
      );
      expect(filename).toBe("enviroflow_sensors_grow_tent_a_2024-01-01_2024-01-31.csv");
    });

    it("should generate correct JSON filename", () => {
      const filename = generateExportFilename(
        "Main Controller",
        new Date("2024-06-15"),
        new Date("2024-06-20"),
        "json"
      );
      expect(filename).toBe("enviroflow_sensors_main_controller_2024-06-15_2024-06-20.json");
    });

    it("should generate correct PDF filename", () => {
      const filename = generateExportFilename(
        "Room #1",
        new Date("2024-12-01"),
        new Date("2024-12-31"),
        "pdf"
      );
      expect(filename).toBe("enviroflow_sensors_room__1_2024-12-01_2024-12-31.pdf");
    });

    it("should handle special characters in controller name", () => {
      const filename = generateExportFilename(
        "Test & Demo Controller!",
        new Date("2024-01-01"),
        new Date("2024-01-02"),
        "csv"
      );
      expect(filename).toBe("enviroflow_sensors_test___demo_controller__2024-01-01_2024-01-02.csv");
    });
  });

  describe("checkExportSize", () => {
    it("should not warn for small exports", () => {
      const result = checkExportSize(100);
      expect(result.isLarge).toBe(false);
      expect(result.warning).toBeUndefined();
    });

    it("should not warn for medium exports", () => {
      const result = checkExportSize(50000);
      expect(result.isLarge).toBe(false);
      expect(result.warning).toBeUndefined();
    });

    it("should warn for large exports", () => {
      const result = checkExportSize(100001);
      expect(result.isLarge).toBe(true);
      expect(result.warning).toContain("100,001");
      expect(result.warning).toContain("browser performance");
    });

    it("should warn for very large exports", () => {
      const result = checkExportSize(500000);
      expect(result.isLarge).toBe(true);
      expect(result.warning).toContain("500,000");
    });
  });

  describe("calculateSummaryStats", () => {
    it("should calculate stats for single sensor type", () => {
      const readings: SensorReading[] = [
        {
          id: "1",
          controller_id: "ctrl_1",
          sensor_type: "temperature",
          value: 72.5,
          unit: "°F",
          recorded_at: "2024-01-01T10:00:00Z",
          is_stale: false,
          port: null,
        },
        {
          id: "2",
          controller_id: "ctrl_1",
          sensor_type: "temperature",
          value: 75.0,
          unit: "°F",
          recorded_at: "2024-01-01T11:00:00Z",
          is_stale: false,
          port: null,
        },
        {
          id: "3",
          controller_id: "ctrl_1",
          sensor_type: "temperature",
          value: 73.2,
          unit: "°F",
          recorded_at: "2024-01-01T12:00:00Z",
          is_stale: false,
          port: null,
        },
      ];

      const stats = calculateSummaryStats(readings);

      expect(stats).toHaveLength(1);
      expect(stats[0].sensorType).toBe("temperature");
      expect(stats[0].count).toBe(3);
      expect(stats[0].min).toBe(72.5);
      expect(stats[0].max).toBe(75.0);
      expect(stats[0].avg).toBeCloseTo(73.57, 2);
      expect(stats[0].latest).toBe(73.2);
      expect(stats[0].unit).toBe("°F");
    });

    it("should calculate stats for multiple sensor types", () => {
      const readings: SensorReading[] = [
        {
          id: "1",
          controller_id: "ctrl_1",
          sensor_type: "temperature",
          value: 72.0,
          unit: "°F",
          recorded_at: "2024-01-01T10:00:00Z",
          is_stale: false,
          port: null,
        },
        {
          id: "2",
          controller_id: "ctrl_1",
          sensor_type: "humidity",
          value: 60.0,
          unit: "%",
          recorded_at: "2024-01-01T10:00:00Z",
          is_stale: false,
          port: null,
        },
        {
          id: "3",
          controller_id: "ctrl_1",
          sensor_type: "temperature",
          value: 74.0,
          unit: "°F",
          recorded_at: "2024-01-01T11:00:00Z",
          is_stale: false,
          port: null,
        },
        {
          id: "4",
          controller_id: "ctrl_1",
          sensor_type: "humidity",
          value: 65.0,
          unit: "%",
          recorded_at: "2024-01-01T11:00:00Z",
          is_stale: false,
          port: null,
        },
      ];

      const stats = calculateSummaryStats(readings);

      expect(stats).toHaveLength(2);

      const tempStats = stats.find(s => s.sensorType === "temperature");
      expect(tempStats).toBeDefined();
      expect(tempStats?.count).toBe(2);
      expect(tempStats?.min).toBe(72.0);
      expect(tempStats?.max).toBe(74.0);
      expect(tempStats?.avg).toBe(73.0);

      const humidityStats = stats.find(s => s.sensorType === "humidity");
      expect(humidityStats).toBeDefined();
      expect(humidityStats?.count).toBe(2);
      expect(humidityStats?.min).toBe(60.0);
      expect(humidityStats?.max).toBe(65.0);
      expect(humidityStats?.avg).toBe(62.5);
    });

    it("should track latest reading correctly", () => {
      const readings: SensorReading[] = [
        {
          id: "1",
          controller_id: "ctrl_1",
          sensor_type: "vpd",
          value: 0.9,
          unit: "kPa",
          recorded_at: "2024-01-01T10:00:00Z",
          is_stale: false,
          port: null,
        },
        {
          id: "2",
          controller_id: "ctrl_1",
          sensor_type: "vpd",
          value: 1.2,
          unit: "kPa",
          recorded_at: "2024-01-01T12:00:00Z", // Latest
          is_stale: false,
          port: null,
        },
        {
          id: "3",
          controller_id: "ctrl_1",
          sensor_type: "vpd",
          value: 1.0,
          unit: "kPa",
          recorded_at: "2024-01-01T11:00:00Z",
          is_stale: false,
          port: null,
        },
      ];

      const stats = calculateSummaryStats(readings);

      expect(stats[0].latest).toBe(1.2);
    });

    it("should handle empty readings array", () => {
      const stats = calculateSummaryStats([]);
      expect(stats).toHaveLength(0);
    });

    it("should handle single reading", () => {
      const readings: SensorReading[] = [
        {
          id: "1",
          controller_id: "ctrl_1",
          sensor_type: "co2",
          value: 1000,
          unit: "ppm",
          recorded_at: "2024-01-01T10:00:00Z",
          is_stale: false,
          port: null,
        },
      ];

      const stats = calculateSummaryStats(readings);

      expect(stats).toHaveLength(1);
      expect(stats[0].count).toBe(1);
      expect(stats[0].min).toBe(1000);
      expect(stats[0].max).toBe(1000);
      expect(stats[0].avg).toBe(1000);
      expect(stats[0].latest).toBe(1000);
    });
  });
});
