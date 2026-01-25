# Integration Guide: Add ExportButton to RoomDetailPanel

This guide shows exactly where and how to add the ExportButton to the RoomDetailPanel component.

## Step-by-Step Integration

### Step 1: Add Imports

At the top of `/apps/web/src/components/dashboard/RoomDetailPanel.tsx`, add:

```tsx
// Add to existing imports
import { ExportButton } from "@/components/ui/ExportButton";
```

Also update the React import to include `useRef`:

```tsx
// Change this:
import { useMemo, useState } from "react";

// To this:
import { useMemo, useState, useRef } from "react";
```

### Step 2: Add Chart Ref

Inside the `RoomDetailPanel` component, after the `useState` declarations (around line 200), add:

```tsx
// Create ref for chart export
const chartRef = useRef<HTMLDivElement>(null);
```

### Step 3: Convert Data for Export

Add this `useMemo` hook after the `filteredData` calculations (around line 250):

```tsx
// Convert TimeSeriesPoint[] to SensorReading[] for export
const sensorReadingsForExport = useMemo(() => {
  const readings: SensorReading[] = [];
  const controllerId = roomSummary.controllers[0]?.id || "";

  // Temperature readings
  filteredData.temperature.forEach(point => {
    readings.push({
      id: `temp_${point.timestamp}`,
      controller_id: controllerId,
      sensor_type: "temperature",
      value: point.value,
      unit: "°F",
      recorded_at: point.timestamp,
      is_stale: false,
      port: null,
    });
  });

  // Humidity readings
  filteredData.humidity.forEach(point => {
    readings.push({
      id: `humidity_${point.timestamp}`,
      controller_id: controllerId,
      sensor_type: "humidity",
      value: point.value,
      unit: "%",
      recorded_at: point.timestamp,
      is_stale: false,
      port: null,
    });
  });

  // VPD readings
  filteredData.vpd.forEach(point => {
    readings.push({
      id: `vpd_${point.timestamp}`,
      controller_id: controllerId,
      sensor_type: "vpd",
      value: point.value,
      unit: "kPa",
      recorded_at: point.timestamp,
      is_stale: false,
      port: null,
    });
  });

  // CO2 readings (if available)
  if (filteredData.co2.length > 0) {
    filteredData.co2.forEach(point => {
      readings.push({
        id: `co2_${point.timestamp}`,
        controller_id: controllerId,
        sensor_type: "co2",
        value: point.value,
        unit: "ppm",
        recorded_at: point.timestamp,
        is_stale: false,
        port: null,
      });
    });
  }

  return readings;
}, [filteredData, roomSummary.controllers]);
```

### Step 4: Calculate Export Date Range

Add this `useMemo` hook right after the previous one:

```tsx
// Calculate date range for export based on selected timeRange
const exportDateRange = useMemo(() => {
  const end = new Date();
  let start = new Date();

  switch (timeRange) {
    case "1h":
      start = new Date(end.getTime() - 60 * 60 * 1000);
      break;
    case "6h":
      start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
      break;
    case "24h":
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  }

  return { start, end };
}, [timeRange]);
```

### Step 5: Add ExportButton to Header

In the header controls section (around line 315-332), modify the controls div to add the ExportButton:

**BEFORE:**
```tsx
<div className="flex items-center gap-2">
  {/* Time Range Selector */}
  <Select
    value={timeRange}
    onValueChange={(value) => setTimeRange(value as TimeRange)}
  >
    <SelectTrigger className="w-28 h-9">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {TIME_RANGE_OPTIONS.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Expand/Collapse Button */}
  {onToggleExpand && (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggleExpand}
      className="h-9 w-9"
    >
      {isExpanded ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </Button>
  )}

  {/* Close Button */}
  {onClose && (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClose}
      className="h-9 w-9"
    >
      <X className="h-4 w-4" />
    </Button>
  )}
</div>
```

**AFTER (with ExportButton added):**
```tsx
<div className="flex items-center gap-2">
  {/* Export Button - NEW */}
  {!isLoading && sensorReadingsForExport.length > 0 && (
    <ExportButton
      data={sensorReadingsForExport}
      controllerName={roomSummary.room.name}
      controllerId={roomSummary.controllers[0]?.id || ""}
      dateRange={exportDateRange}
      chartRef={chartRef}
      variant="outline"
      size="sm"
      showLabel={false}
    />
  )}

  {/* Time Range Selector */}
  <Select
    value={timeRange}
    onValueChange={(value) => setTimeRange(value as TimeRange)}
  >
    <SelectTrigger className="w-28 h-9">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {TIME_RANGE_OPTIONS.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Expand/Collapse Button */}
  {onToggleExpand && (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggleExpand}
      className="h-9 w-9"
    >
      {isExpanded ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </Button>
  )}

  {/* Close Button */}
  {onClose && (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClose}
      className="h-9 w-9"
    >
      <X className="h-4 w-4" />
    </Button>
  )}
</div>
```

### Step 6: Wrap Chart with Ref

In the chart section (around line 424-453), add the `ref` to the container div:

**BEFORE:**
```tsx
{/* Full Time-Series Chart */}
<div
  className={cn(
    "rounded-lg border p-4",
    isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
  )}
>
  <h3
    className={cn(
      "text-sm font-medium mb-4",
      isDark ? "text-gray-200" : "text-gray-700"
    )}
  >
    Sensor History
  </h3>
  <SensorChart
    temperatureData={filteredData.temperature}
    humidityData={filteredData.humidity}
    vpdData={filteredData.vpd}
    co2Data={filteredData.co2.length > 0 ? filteredData.co2 : undefined}
    visibleSensors={availableSensors}
    height={isExpanded ? 400 : 280}
    showLegend
    showGrid
    variant="area"
    optimalRanges={optimalRanges}
    timeFormat={timeRange === "7d" ? "long" : "short"}
    isLoading={isLoading}
  />
</div>
```

**AFTER (with ref added):**
```tsx
{/* Full Time-Series Chart */}
<div
  ref={chartRef}  {/* ADD THIS REF */}
  className={cn(
    "rounded-lg border p-4",
    isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
  )}
>
  <h3
    className={cn(
      "text-sm font-medium mb-4",
      isDark ? "text-gray-200" : "text-gray-700"
    )}
  >
    Sensor History
  </h3>
  <SensorChart
    temperatureData={filteredData.temperature}
    humidityData={filteredData.humidity}
    vpdData={filteredData.vpd}
    co2Data={filteredData.co2.length > 0 ? filteredData.co2 : undefined}
    visibleSensors={availableSensors}
    height={isExpanded ? 400 : 280}
    showLegend
    showGrid
    variant="area"
    optimalRanges={optimalRanges}
    timeFormat={timeRange === "7d" ? "long" : "short"}
    isLoading={isLoading}
  />
</div>
```

### Step 7: Add SensorReading Import

At the top of the file, update the type imports to include `SensorReading`:

**BEFORE:**
```tsx
import type { TimeSeriesPoint, SensorType } from "@/types";
```

**AFTER:**
```tsx
import type { TimeSeriesPoint, SensorType, SensorReading } from "@/types";
```

## Complete Diff Summary

### Imports (top of file)
```diff
  "use client";

- import { useMemo, useState } from "react";
+ import { useMemo, useState, useRef } from "react";
  import { cn } from "@/lib/utils";
  import { useTheme } from "@/components/providers/ThemeProvider";
  import { Button } from "@/components/ui/button";
+ import { ExportButton } from "@/components/ui/ExportButton";
  // ... other imports

- import type { TimeSeriesPoint, SensorType } from "@/types";
+ import type { TimeSeriesPoint, SensorType, SensorReading } from "@/types";
```

### Inside Component (after state declarations)
```diff
  export function RoomDetailPanel({ ... }: RoomDetailPanelProps) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [timeRange, setTimeRange] = useState<TimeRange>("24h");
+   const chartRef = useRef<HTMLDivElement>(null);

    // ... existing code ...
```

### After filteredData calculations
```diff
  // ... filteredData calculations ...

+ // Convert data for export
+ const sensorReadingsForExport = useMemo(() => {
+   const readings: SensorReading[] = [];
+   const controllerId = roomSummary.controllers[0]?.id || "";
+
+   // Temperature, humidity, VPD, CO2...
+   // (see Step 3 for full code)
+
+   return readings;
+ }, [filteredData, roomSummary.controllers]);

+ // Calculate export date range
+ const exportDateRange = useMemo(() => {
+   const end = new Date();
+   let start = new Date();
+   // (see Step 4 for full code)
+   return { start, end };
+ }, [timeRange]);
```

### Header controls
```diff
  <div className="flex items-center gap-2">
+   {/* Export Button */}
+   {!isLoading && sensorReadingsForExport.length > 0 && (
+     <ExportButton
+       data={sensorReadingsForExport}
+       controllerName={roomSummary.room.name}
+       controllerId={roomSummary.controllers[0]?.id || ""}
+       dateRange={exportDateRange}
+       chartRef={chartRef}
+       variant="outline"
+       size="sm"
+       showLabel={false}
+     />
+   )}

    {/* Time Range Selector */}
    <Select ... />
```

### Chart container
```diff
  <div
+   ref={chartRef}
    className={cn(
      "rounded-lg border p-4",
      isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
    )}
  >
```

## Testing the Integration

After making these changes:

1. **Start the dev server**: `npm run dev`
2. **Navigate to a room detail view**
3. **Look for the download icon** in the header (left of the time range selector)
4. **Click the export button** and verify:
   - Dropdown menu appears with CSV/JSON/PDF options
   - Selecting CSV downloads a file
   - Selecting JSON downloads a file with metadata
   - Selecting PDF downloads a file with chart image
   - Filename format is correct
   - Large dataset warning appears if >100k rows

## Expected Result

The RoomDetailPanel header should now look like this:

```
┌──────────────────────────────────────────────────────┐
│  Grow Tent A                    🟢 Live • Just now   │
│                                                      │
│  [⬇]  [24 Hours ▼]  [⛶]  [✕]                       │
│   ↑                                                  │
│ Export                                               │
│                                                      │
```

When clicked, the export button shows:

```
┌─────────────────────────┐
│ Export Format           │
├─────────────────────────┤
│ 📄 CSV                  │
│    Spreadsheet format   │
├─────────────────────────┤
│ 📋 JSON                 │
│    Structured data      │
├─────────────────────────┤
│ 📰 PDF                  │
│    Report with chart    │
└─────────────────────────┘
```

## Troubleshooting

### Issue: "Cannot find module ExportButton"
**Solution**: Make sure you saved the files and the import path is correct: `@/components/ui/ExportButton`

### Issue: TypeScript errors for SensorReading
**Solution**: Make sure you added `SensorReading` to the type imports from `@/types`

### Issue: Export button doesn't appear
**Solution**: Check that `sensorReadingsForExport.length > 0` and `!isLoading`

### Issue: PDF export doesn't include chart
**Solution**: Verify that `chartRef` is properly attached to the chart container div

## Estimated Integration Time

- **Code changes**: 5 minutes
- **Testing**: 5 minutes
- **Total**: ~10 minutes

## Next Steps

After integration:
1. Test all three export formats
2. Verify large dataset warning works
3. Check filename generation
4. Confirm chart appears in PDF
5. Deploy to staging for QA

## Support

For questions or issues, refer to:
- `/apps/web/src/components/ui/ExportButton.README.md`
- `/apps/web/src/components/ui/ExportButton.example.tsx`
- `/docs/TASK-020-EXPORT-IMPLEMENTATION.md`
