"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { AppLayout } from "@/components/layout/AppLayout";
import { SensorChartWithDateRange } from "@/components/charts";
import { useControllers } from "@/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

/**
 * Analytics Demo Page
 *
 * Demonstrates the new date range selection feature for sensor analytics.
 * Shows how to use the SensorChartWithDateRange component with various configurations.
 */
export default function AnalyticsDemoPage(): JSX.Element {
  const { controllers, loading } = useControllers();

  // Get first controller for demo
  const demoControllerId = controllers[0]?.id;

  return (
    <AppLayout>
      <div className="min-h-screen bg-env-bg">
        <PageHeader
          title="Sensor Analytics"
          description="Historical sensor data with customizable date ranges"
        />

        <div className="p-6 lg:p-8 space-y-8">
          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This page demonstrates the new date range selection feature for sensor analytics.
              Select from preset ranges (Today, Last 7/30/90 days, YTD) or choose a custom date range.
              The URL is updated automatically, making reports shareable.
            </AlertDescription>
          </Alert>

          {/* No Controllers State */}
          {!loading && controllers.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>No Controllers Found</CardTitle>
                <CardDescription>
                  Add a controller to view sensor analytics. Go to Controllers and connect a device
                  to get started.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Full-Featured Chart with Date Range */}
          {demoControllerId && (
            <SensorChartWithDateRange
              controllerIds={[demoControllerId]}
              title="Temperature, Humidity & VPD Trends"
              description="View historical sensor data with customizable time ranges"
              visibleSensors={["temperature", "humidity", "vpd"]}
              height={400}
              showLegend
              variant="area"
              defaultPreset="7d"
              showExport
              onExport={(range) => {
                console.log("Export requested for range:", range);
                // Implement export logic here
                alert(`Export functionality would export data from ${range.from.toLocaleDateString()} to ${range.to.toLocaleDateString()}`);
              }}
              optimalRanges={{
                temperature: [70, 82],
                humidity: [50, 70],
                vpd: [0.8, 1.2],
              }}
            />
          )}

          {/* Multiple Charts Example */}
          {demoControllerId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SensorChartWithDateRange
                controllerIds={[demoControllerId]}
                title="Temperature Only"
                description="Focused view of temperature data"
                visibleSensors={["temperature"]}
                height={300}
                showLegend={false}
                variant="line"
                defaultPreset="30d"
                optimalRanges={{
                  temperature: [70, 82],
                }}
              />

              <SensorChartWithDateRange
                controllerIds={[demoControllerId]}
                title="Humidity Only"
                description="Focused view of humidity data"
                visibleSensors={["humidity"]}
                height={300}
                showLegend={false}
                variant="line"
                defaultPreset="30d"
                optimalRanges={{
                  humidity: [50, 70],
                }}
              />
            </div>
          )}

          {/* Feature List */}
          <Card>
            <CardHeader>
              <CardTitle>Feature Highlights</CardTitle>
              <CardDescription>
                What&apos;s included in the date range selection feature
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>
                    <strong>Quick Presets:</strong> Select from Today, Last 7 days, 30 days, 90 days, or Year to Date
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>
                    <strong>Custom Range:</strong> Pick any date range using the calendar popup
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>
                    <strong>URL Persistence:</strong> Date range is saved in URL for shareable reports
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>
                    <strong>Auto-Reload:</strong> Chart data automatically refreshes when range changes
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>
                    <strong>Mobile-Friendly:</strong> Date picker collapses to dropdown on mobile devices
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>
                    <strong>Loading Skeleton:</strong> Smooth loading states during data fetch
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>
                    <strong>Export Ready:</strong> Optional export button for downloading data
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Technical Details */}
          <Card>
            <CardHeader>
              <CardTitle>Implementation Details</CardTitle>
              <CardDescription>
                Technical approach and components used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Components Created:</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                    <li><code>DateRangePicker.tsx</code> - Reusable date range picker with presets</li>
                    <li><code>SensorChartWithDateRange.tsx</code> - Enhanced sensor chart with date selection</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Hooks Created:</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                    <li><code>use-date-range.ts</code> - State management with URL persistence</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Type Updates:</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                    <li>Added <code>DateRangePreset</code> and <code>DateRangeValue</code> types</li>
                    <li>Extended <code>SensorReadingsOptions</code> to support <code>dateRange</code></li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Backend Integration:</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                    <li>Updated <code>useSensorReadings</code> hook to filter by date range</li>
                    <li>Supports both legacy <code>timeRangeHours</code> and new <code>dateRange</code></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
