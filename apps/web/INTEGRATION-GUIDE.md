# Date Range Selection - Integration Guide

Quick start guide for integrating the date range selection feature into existing EnviroFlow components.

## Quick Start

### 1. Add to Existing Chart

Replace an existing sensor chart with the enhanced version:

**Before:**
```tsx
import { SensorChart } from "@/components/charts";

<SensorChart
  temperatureData={tempData}
  humidityData={humidityData}
  height={300}
/>
```

**After:**
```tsx
import { SensorChartWithDateRange } from "@/components/charts";

<SensorChartWithDateRange
  controllerIds={[controllerId]}
  visibleSensors={["temperature", "humidity"]}
  height={300}
  defaultPreset="7d"
/>
```

### 2. Use in Dashboard

Add historical data view to dashboard:

```tsx
// In apps/web/src/app/dashboard/page.tsx

import { SensorChartWithDateRange } from "@/components/charts";

// In your component
<SensorChartWithDateRange
  controllerIds={roomControllerIds}
  title="Room Environmental History"
  description="Historical temperature, humidity, and VPD data"
  visibleSensors={["temperature", "humidity", "vpd"]}
  defaultPreset="30d"
  showExport
  onExport={(range) => {
    // Handle export
    console.log("Export from", range.from, "to", range.to);
  }}
  optimalRanges={{
    temperature: preferences.optimalTemp,
    humidity: preferences.optimalHumidity,
    vpd: preferences.optimalVPD,
  }}
/>
```

### 3. Room Detail Page

Add to room detail pages for historical analysis:

```tsx
// In apps/web/src/app/rooms/[id]/page.tsx

import { SensorChartWithDateRange } from "@/components/charts";
import { useParams } from "next/navigation";

export default function RoomDetailPage() {
  const params = useParams();
  const roomId = params.id as string;

  // Get controllers for this room
  const { controllers } = useControllers();
  const roomControllers = controllers.filter(c => c.room_id === roomId);
  const controllerIds = roomControllers.map(c => c.id);

  return (
    <div className="space-y-6">
      {/* Current data */}
      <EnvironmentSnapshot roomId={roomId} />

      {/* Historical data */}
      <SensorChartWithDateRange
        controllerIds={controllerIds}
        title="Historical Environmental Data"
        description="View trends over time with customizable date ranges"
        visibleSensors={["temperature", "humidity", "vpd"]}
        defaultPreset="7d"
        height={400}
      />
    </div>
  );
}
```

## Advanced Integration

### Custom Hook Usage

For more control, use the hook directly:

```tsx
import { useDateRange } from "@/hooks";
import { useSensorReadings } from "@/hooks";
import { SensorChart } from "@/components/charts";
import { DateRangePicker } from "@/components/ui/DateRangePicker";

function CustomAnalyticsView({ controllerId }: { controllerId: string }) {
  // Date range state
  const { range, setRange } = useDateRange({
    defaultPreset: "7d",
    persistInUrl: true,
    urlParamKey: "analyticsRange"
  });

  // Fetch data with date range
  const { readings, isLoading, getTimeSeries } = useSensorReadings({
    controllerIds: [controllerId],
    dateRange: range,
  });

  // Extract time series
  const temperatureData = getTimeSeries(controllerId, "temperature");
  const humidityData = getTimeSeries(controllerId, "humidity");

  return (
    <div className="space-y-4">
      {/* Custom header with date picker */}
      <div className="flex justify-between items-center">
        <h2>Custom Analytics</h2>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* Your custom chart */}
      {isLoading ? (
        <Skeleton className="h-[300px]" />
      ) : (
        <SensorChart
          temperatureData={temperatureData}
          humidityData={humidityData}
          height={300}
        />
      )}
    </div>
  );
}
```

### Export Functionality

Implement data export:

```tsx
import { format } from "date-fns";

function handleExport(range: DateRangeValue, readings: SensorReading[]) {
  // Filter readings by range
  const filteredReadings = readings.filter((reading) => {
    const timestamp = new Date(reading.recorded_at);
    return timestamp >= range.from && timestamp <= range.to;
  });

  // Convert to CSV
  const headers = ["Timestamp", "Sensor Type", "Value", "Unit"];
  const rows = filteredReadings.map((reading) => [
    format(new Date(reading.recorded_at), "yyyy-MM-dd HH:mm:ss"),
    reading.sensor_type,
    reading.value.toString(),
    reading.unit,
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  // Download
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sensor-data-${format(range.from, "yyyy-MM-dd")}-to-${format(range.to, "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Usage
<SensorChartWithDateRange
  controllerIds={[controllerId]}
  showExport
  onExport={(range) => {
    handleExport(range, readings);
  }}
/>
```

### Comparison View

Compare different time periods:

```tsx
function EnvironmentComparisonView() {
  const { range: range1, setRange: setRange1 } = useDateRange({
    defaultPreset: "7d",
    persistInUrl: true,
    urlParamKey: "range1"
  });

  const { range: range2, setRange: setRange2 } = useDateRange({
    defaultPreset: "30d",
    persistInUrl: true,
    urlParamKey: "range2"
  });

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3>Period 1</h3>
        <SensorChartWithDateRange
          controllerIds={controllerIds}
          defaultPreset="7d"
        />
      </div>
      <div>
        <h3>Period 2</h3>
        <SensorChartWithDateRange
          controllerIds={controllerIds}
          defaultPreset="30d"
        />
      </div>
    </div>
  );
}
```

## Common Patterns

### Shareable Reports

Generate shareable links:

```tsx
function ShareButton({ range }: { range: DateRangeValue }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const shareUrl = () => {
    const url = new URL(window.location.origin + pathname);
    const params = new URLSearchParams(searchParams);

    // Serialize range to URL
    if (range.preset && range.preset !== "custom") {
      params.set("range", range.preset);
    } else {
      const rangeStr = `${range.from.toISOString().split("T")[0]},${range.to.toISOString().split("T")[0]}`;
      params.set("range", rangeStr);
    }

    return url.toString() + "?" + params.toString();
  };

  return (
    <Button onClick={() => {
      navigator.clipboard.writeText(shareUrl());
      toast.success("Link copied to clipboard");
    }}>
      Share Report
    </Button>
  );
}
```

### Auto-Refresh

Add auto-refresh for recent data:

```tsx
function LiveDataChart({ controllerId }: { controllerId: string }) {
  const { range, setPreset } = useDateRange({
    defaultPreset: "today"
  });

  const { refetch } = useSensorReadings({
    controllerIds: [controllerId],
    dateRange: range,
  });

  // Auto-refresh every 30 seconds if viewing today
  useEffect(() => {
    if (range.preset === "today") {
      const interval = setInterval(() => {
        refetch();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [range.preset, refetch]);

  return (
    <SensorChartWithDateRange
      controllerIds={[controllerId]}
      defaultPreset="today"
    />
  );
}
```

### Mobile Optimization

Optimize for mobile:

```tsx
function MobileOptimizedChart() {
  return (
    <div className="space-y-4">
      {/* Use compact variant on mobile */}
      <div className="block sm:hidden">
        <SensorChartWithDateRangeCompact
          controllerIds={controllerIds}
          visibleSensors={["temperature", "humidity"]}
          height={250}
          defaultPreset="7d"
        />
      </div>

      {/* Full version on desktop */}
      <div className="hidden sm:block">
        <SensorChartWithDateRange
          controllerIds={controllerIds}
          title="Environmental Data"
          visibleSensors={["temperature", "humidity", "vpd"]}
          height={400}
          defaultPreset="7d"
          showExport
        />
      </div>
    </div>
  );
}
```

## Troubleshooting

### No Data Showing

```tsx
// Check if controllers have data
const { readings, isLoading, error } = useSensorReadings({
  controllerIds: [controllerId],
  dateRange: range,
});

if (error) {
  console.error("Error fetching readings:", error);
}

if (!isLoading && readings.length === 0) {
  return <Alert>No sensor data available for this period</Alert>;
}
```

### URL Not Updating

```tsx
// Ensure persistInUrl is true
const { range } = useDateRange({
  defaultPreset: "7d",
  persistInUrl: true, // Must be true
  urlParamKey: "sensorRange" // Custom key
});
```

### Performance Issues

```tsx
// Limit data points for large ranges
const { readings } = useSensorReadings({
  controllerIds: [controllerId],
  dateRange: range,
  limit: 1000, // Limit to 1000 points
});

// Or use data aggregation
const aggregatedData = useMemo(() => {
  // Aggregate hourly instead of per-minute
  return aggregateByHour(readings);
}, [readings]);
```

## Best Practices

1. **Use presets for common ranges** - Faster for users
2. **Persist to URL** - Enable sharing and bookmarking
3. **Show loading states** - Better UX during data fetch
4. **Handle errors gracefully** - Show helpful error messages
5. **Optimize for mobile** - Use compact variants when appropriate
6. **Limit data points** - For performance on large ranges
7. **Cache aggressively** - Use React Query or SWR for caching
8. **Document date ranges** - Show what range is displayed

## Next Steps

1. Review the demo page at `/analytics-demo`
2. Check existing implementations in dashboard
3. Add to room detail pages
4. Implement export functionality
5. Add comparison views
6. Optimize for your use cases

## Support

For questions:
- Check `/apps/web/src/app/analytics-demo/page.tsx` for examples
- Review component JSDoc comments
- See TASK-017-IMPLEMENTATION.md for technical details
