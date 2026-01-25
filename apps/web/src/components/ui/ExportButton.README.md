# Export Button Component

Production-ready sensor data export functionality for EnviroFlow.

## Features

- **Multiple Formats**: CSV, JSON, and PDF exports
- **Client-Side Processing**: No server round-trip, instant downloads
- **Large Dataset Warning**: Alerts users when exporting >100k rows
- **PDF with Charts**: Captures chart visualizations in PDF reports
- **Summary Statistics**: Automatic calculation of min/max/avg/latest values
- **Standardized Filenames**: `enviroflow_sensors_[controllername]_[startdate]_[enddate].[ext]`

## Installation

Dependencies are already installed:
```bash
npm install jspdf html2canvas
npm install --save-dev @types/html2canvas
```

## Basic Usage

```tsx
import { useRef } from "react";
import { ExportButton } from "@/components/ui/ExportButton";
import { SensorChart } from "@/components/charts/SensorChart";
import type { SensorReading } from "@/types";

function MyComponent() {
  const chartRef = useRef<HTMLDivElement>(null);

  const sensorReadings: SensorReading[] = [...]; // Your data
  const dateRange = {
    start: new Date("2024-01-01"),
    end: new Date("2024-01-31")
  };

  return (
    <>
      <div ref={chartRef}>
        <SensorChart {...chartProps} />
      </div>

      <ExportButton
        data={sensorReadings}
        controllerName="Grow Tent A"
        controllerId="ctrl_123"
        dateRange={dateRange}
        chartRef={chartRef}
        showLabel
      />
    </>
  );
}
```

## Export Formats

### CSV Export
- **Columns**: timestamp, temperature, humidity, vpd, co2, light, ph, ec, etc.
- **Format**: Standard comma-separated values
- **Use Case**: Import into Excel, Google Sheets, or data analysis tools
- **Example Output**:
  ```csv
  timestamp,temperature,humidity,vpd,co2
  2024-01-01 10:00:00,72.5,60.2,0.95,1000
  2024-01-01 11:00:00,73.1,61.0,0.98,1050
  ```

### JSON Export
- **Structure**: Metadata + Summary + Readings
- **Format**: Pretty-printed JSON with 2-space indent
- **Use Case**: API integration, custom data processing
- **Example Output**:
  ```json
  {
    "metadata": {
      "controller": {
        "id": "ctrl_123",
        "name": "Grow Tent A"
      },
      "dateRange": {
        "start": "2024-01-01T00:00:00.000Z",
        "end": "2024-01-31T23:59:59.999Z"
      },
      "exportedAt": "2024-01-31T12:00:00.000Z",
      "totalReadings": 1440,
      "sensorTypes": ["temperature", "humidity", "vpd"]
    },
    "summary": [
      {
        "sensorType": "temperature",
        "count": 480,
        "min": 68.5,
        "max": 76.2,
        "average": 72.3,
        "latest": 73.1,
        "unit": "°F"
      }
    ],
    "readings": [...]
  }
  ```

### PDF Export
- **Contents**:
  - Header with controller name and date range
  - Summary statistics table
  - Chart image (if chartRef provided)
- **Format**: A4 portrait, professional layout
- **Use Case**: Reports, documentation, sharing with non-technical users
- **Features**:
  - Automatic pagination
  - High-resolution chart capture (2x scale)
  - Clean typography using Helvetica

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `data` | `SensorReading[]` | Yes | - | Array of sensor readings to export |
| `controllerName` | `string` | Yes | - | Controller name for filename and metadata |
| `controllerId` | `string` | Yes | - | Controller ID for metadata |
| `dateRange` | `{ start: Date; end: Date }` | Yes | - | Date range for the data |
| `chartRef` | `React.RefObject<HTMLElement>` | No | - | Ref to chart element for PDF export |
| `variant` | `"default" \| "outline" \| "ghost" \| "secondary"` | No | `"outline"` | Button visual style |
| `size` | `"default" \| "sm" \| "lg" \| "icon"` | No | `"default"` | Button size |
| `showLabel` | `boolean` | No | `true` | Whether to show "Export" text |
| `className` | `string` | No | - | Additional CSS classes |
| `onExportStart` | `(format: ExportFormat) => void` | No | - | Callback when export begins |
| `onExportComplete` | `(format: ExportFormat) => void` | No | - | Callback when export succeeds |
| `onExportError` | `(format: ExportFormat, error: Error) => void` | No | - | Callback when export fails |

## Integration Examples

### Example 1: Add to RoomDetailPanel Header

```tsx
// In RoomDetailPanel.tsx, add to imports:
import { ExportButton } from "@/components/ui/ExportButton";
import { useRef, useMemo } from "react";

// Inside component, after state declarations:
const chartRef = useRef<HTMLDivElement>(null);

// Convert TimeSeriesPoint[] to SensorReading[] for export:
const sensorReadings = useMemo(() => {
  const readings: SensorReading[] = [];
  const controllerId = roomSummary.controllers[0]?.id || "";

  // Temperature
  filteredData.temperature.forEach(point => {
    readings.push({
      id: crypto.randomUUID(),
      controller_id: controllerId,
      sensor_type: "temperature",
      value: point.value,
      unit: "°F",
      recorded_at: point.timestamp,
      is_stale: false,
      port: null,
    });
  });

  // Humidity
  filteredData.humidity.forEach(point => {
    readings.push({
      id: crypto.randomUUID(),
      controller_id: controllerId,
      sensor_type: "humidity",
      value: point.value,
      unit: "%",
      recorded_at: point.timestamp,
      is_stale: false,
      port: null,
    });
  });

  // VPD
  filteredData.vpd.forEach(point => {
    readings.push({
      id: crypto.randomUUID(),
      controller_id: controllerId,
      sensor_type: "vpd",
      value: point.value,
      unit: "kPa",
      recorded_at: point.timestamp,
      is_stale: false,
      port: null,
    });
  });

  return readings;
}, [filteredData, roomSummary.controllers]);

// Calculate date range:
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
  }

  return { start, end };
}, [timeRange]);

// In the header controls (around line 315):
<div className="flex items-center gap-2">
  {/* Export Button */}
  <ExportButton
    data={sensorReadings}
    controllerName={roomSummary.room.name}
    controllerId={roomSummary.controllers[0]?.id || ""}
    dateRange={exportDateRange}
    chartRef={chartRef}
    variant="outline"
    size="sm"
    showLabel={false}
  />

  {/* Time Range Selector */}
  <Select value={timeRange} onValueChange={...}>
    ...
  </Select>

  {/* Other controls... */}
</div>

// Wrap the chart section with ref (around line 424):
<div
  ref={chartRef}
  className={cn("rounded-lg border p-4", ...)}
>
  <h3>Sensor History</h3>
  <SensorChart {...} />
</div>
```

### Example 2: Icon-Only Button

```tsx
import { ExportButtonIcon } from "@/components/ui/ExportButton";

<ExportButtonIcon
  data={readings}
  controllerName="My Controller"
  controllerId="ctrl_123"
  dateRange={dateRange}
  chartRef={chartRef}
/>
```

### Example 3: With Callbacks

```tsx
<ExportButton
  data={readings}
  controllerName="Controller A"
  controllerId="ctrl_123"
  dateRange={dateRange}
  chartRef={chartRef}
  onExportStart={(format) => {
    console.log(`Starting ${format} export...`);
  }}
  onExportComplete={(format) => {
    console.log(`${format} export completed!`);
    // Track analytics event
    analytics.track("data_exported", { format });
  }}
  onExportError={(format, error) => {
    console.error(`${format} export failed:`, error);
    // Send error to monitoring service
    errorReporting.captureException(error);
  }}
/>
```

## Large Dataset Handling

The component automatically warns users when exporting more than 100,000 rows:

```tsx
// Threshold: 100,000 rows
const LARGE_EXPORT_THRESHOLD = 100000;

// Warning dialog appears for large exports
if (data.length > LARGE_EXPORT_THRESHOLD) {
  // Shows alert: "This export contains X rows, which may affect browser
  // performance. Consider reducing the date range."
}
```

Users can:
1. Cancel and reduce the date range
2. Continue with the large export

## Performance Considerations

- **CSV/JSON**: Fast, client-side generation using Blob API
- **PDF**: Slower due to chart rendering with html2canvas
  - Chart is rendered at 2x scale for quality
  - Large charts may take 2-3 seconds to capture
- **Memory**: Large exports (>100k rows) may use significant browser memory
- **Bundle Size**: jsPDF and html2canvas are ~150KB combined (lazy loaded)

## Filename Format

Generated filenames follow this pattern:
```
enviroflow_sensors_[controllername]_[startdate]_[enddate].[ext]
```

Examples:
- `enviroflow_sensors_grow_tent_a_2024-01-01_2024-01-31.csv`
- `enviroflow_sensors_main_controller_2024-06-15_2024-06-20.json`
- `enviroflow_sensors_room_1_2024-12-01_2024-12-31.pdf`

Special characters in controller names are replaced with underscores.

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 13+)
- **Mobile**: Works on all modern mobile browsers

## Testing

Unit tests are available in `src/lib/__tests__/export-utils.test.ts`:

```bash
npm test export-utils.test.ts
```

Tests cover:
- Filename generation
- Export size checking
- Summary statistics calculation
- Edge cases (empty data, single reading, etc.)

## Troubleshooting

### Issue: "No data to export" toast
**Solution**: Ensure the `data` prop contains SensorReading objects with the correct structure.

### Issue: PDF export doesn't include chart
**Solution**: Make sure to pass a valid `chartRef` that points to the chart container element.

### Issue: Large export causes browser to freeze
**Solution**: This is expected for very large datasets (>500k rows). Consider:
- Reducing the date range
- Implementing server-side export for massive datasets
- Using CSV/JSON instead of PDF for large exports

### Issue: Filename has weird characters
**Solution**: Special characters are automatically replaced with underscores. This is by design.

## Accessibility

- Keyboard navigable dropdown menu
- ARIA labels on all interactive elements
- Screen reader friendly
- Respects reduced motion preferences

## Future Enhancements

Potential improvements for future versions:
- [ ] Streaming export for very large datasets
- [ ] Server-side PDF generation for better performance
- [ ] Custom column selection for CSV export
- [ ] Multiple chart pages in PDF
- [ ] Excel (.xlsx) format support
- [ ] Scheduled/automated exports
- [ ] Email export functionality

## License

Part of EnviroFlow application. See main repository license.
