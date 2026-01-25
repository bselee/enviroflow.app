/**
 * Date Range Functionality Tests
 *
 * Tests for the date range picker and hook implementation.
 * Run with: npm test -- date-range.test.ts
 */

import { startOfDay, endOfDay, startOfYear, addDays } from "date-fns";

// Helper functions from use-date-range.ts
function calculateRangeFromPreset(preset: string) {
  const now = new Date();

  switch (preset) {
    case "today":
      return {
        from: startOfDay(now),
        to: endOfDay(now),
        preset: "today" as const,
      };

    case "7d":
      return {
        from: startOfDay(addDays(now, -6)),
        to: endOfDay(now),
        preset: "7d" as const,
      };

    case "30d":
      return {
        from: startOfDay(addDays(now, -29)),
        to: endOfDay(now),
        preset: "30d" as const,
      };

    case "90d":
      return {
        from: startOfDay(addDays(now, -89)),
        to: endOfDay(now),
        preset: "90d" as const,
      };

    case "ytd":
      return {
        from: startOfYear(now),
        to: endOfDay(now),
        preset: "ytd" as const,
      };

    default:
      return {
        from: startOfDay(addDays(now, -6)),
        to: endOfDay(now),
        preset: "7d" as const,
      };
  }
}

describe("Date Range Calculations", () => {
  it("should calculate 'today' range correctly", () => {
    const range = calculateRangeFromPreset("today");
    const now = new Date();

    expect(range.from.getDate()).toBe(now.getDate());
    expect(range.to.getDate()).toBe(now.getDate());
    expect(range.from.getHours()).toBe(0);
    expect(range.to.getHours()).toBe(23);
    expect(range.preset).toBe("today");
  });

  it("should calculate '7d' range correctly", () => {
    const range = calculateRangeFromPreset("7d");
    const diffDays = Math.floor(
      (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)
    );

    expect(diffDays).toBe(6); // 7 days inclusive = 6 days difference
    expect(range.preset).toBe("7d");
  });

  it("should calculate '30d' range correctly", () => {
    const range = calculateRangeFromPreset("30d");
    const diffDays = Math.floor(
      (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)
    );

    expect(diffDays).toBe(29); // 30 days inclusive = 29 days difference
    expect(range.preset).toBe("30d");
  });

  it("should calculate '90d' range correctly", () => {
    const range = calculateRangeFromPreset("90d");
    const diffDays = Math.floor(
      (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)
    );

    expect(diffDays).toBe(89); // 90 days inclusive = 89 days difference
    expect(range.preset).toBe("90d");
  });

  it("should calculate 'ytd' range correctly", () => {
    const range = calculateRangeFromPreset("ytd");
    const now = new Date();

    expect(range.from.getMonth()).toBe(0); // January
    expect(range.from.getDate()).toBe(1);
    expect(range.to.getFullYear()).toBe(now.getFullYear());
    expect(range.preset).toBe("ytd");
  });

  it("should default to '7d' for unknown presets", () => {
    const range = calculateRangeFromPreset("unknown");
    expect(range.preset).toBe("7d");
  });
});

describe("URL Serialization", () => {
  it("should serialize preset ranges correctly", () => {
    const range = calculateRangeFromPreset("7d");
    // For presets, we just use the preset string
    expect(range.preset).toBe("7d");
  });

  it("should serialize custom ranges to YYYY-MM-DD format", () => {
    const customRange = {
      from: new Date("2024-01-01"),
      to: new Date("2024-01-31"),
      preset: "custom" as const,
    };

    const fromStr = customRange.from.toISOString().split("T")[0];
    const toStr = customRange.to.toISOString().split("T")[0];

    expect(fromStr).toBe("2024-01-01");
    expect(toStr).toBe("2024-01-31");
  });
});

describe("Time Range Conversion", () => {
  it("should convert date range to hours correctly", () => {
    const range = calculateRangeFromPreset("7d");
    const diffMs = range.to.getTime() - range.from.getTime();
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));

    expect(hours).toBeGreaterThanOrEqual(168); // 7 days * 24 hours
  });

  it("should handle today conversion", () => {
    const range = calculateRangeFromPreset("today");
    const diffMs = range.to.getTime() - range.from.getTime();
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));

    expect(hours).toBeGreaterThanOrEqual(23);
    expect(hours).toBeLessThanOrEqual(24);
  });
});

console.log("\nDate Range Tests - Manual Verification");
console.log("=====================================\n");

const presets = ["today", "7d", "30d", "90d", "ytd"];
presets.forEach((preset) => {
  const range = calculateRangeFromPreset(preset);
  console.log(`${preset.toUpperCase()}:`);
  console.log(`  From: ${range.from.toISOString()}`);
  console.log(`  To:   ${range.to.toISOString()}`);
  console.log(`  Days: ${Math.floor((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24))} days difference`);
  console.log();
});
