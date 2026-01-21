"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart3,
  LineChart,
  PieChart,
  Calendar,
  Filter,
  RefreshCw,
  Download,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  useAnalytics,
  type DateRange,
  type SensorTrendPoint,
  type ExecutionBreakdown,
  type RoomCompliance,
  type WorkflowStat,
} from "@/hooks/use-analytics";
import { KPICards } from "@/components/dashboard/KPICards";

/**
 * Date range presets for quick selection
 */
const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
] as const;

/**
 * Chart color palette for consistent theming
 * Uses CSS custom properties for light/dark mode support
 */
const CHART_COLORS = {
  temperature: "hsl(var(--chart-1, 12 76% 61%))",
  humidity: "hsl(var(--chart-2, 173 58% 39%))",
  vpd: "hsl(var(--chart-3, 197 37% 24%))",
  success: "hsl(var(--success, 142 76% 36%))",
  failed: "hsl(var(--destructive, 0 84% 60%))",
  skipped: "hsl(var(--warning, 38 92% 50%))",
  dry_run: "hsl(var(--muted, 220 14% 71%))",
};

/**
 * Pie chart color array for execution breakdown
 */
const PIE_COLORS = [
  CHART_COLORS.success,
  CHART_COLORS.failed,
  CHART_COLORS.skipped,
  CHART_COLORS.dry_run,
];

/**
 * Analytics Page Component
 *
 * Comprehensive analytics dashboard featuring:
 * - Date range selector with presets
 * - Room/controller filters
 * - Sensor trends over time (line chart)
 * - Workflow execution frequency (bar chart)
 * - Success/failure rate (pie chart)
 * - Per-room environment compliance (bar chart)
 * - Summary statistics via KPICards
 */
export default function AnalyticsPage(): JSX.Element {
  // Date range state with default of last 7 days
  const [dateRange, setDateRange] = useState<DateRange>({
    start: subDays(new Date(), 7),
    end: new Date(),
  });

  // Filter states
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [selectedPreset, setSelectedPreset] = useState<string>("7");

  // Fetch analytics data with current filters
  const { data, isLoading, error, refetch } = useAnalytics({
    dateRange,
    roomId: selectedRoomId,
    refreshInterval: 0, // Manual refresh on this page
  });

  /**
   * Handle preset date range selection
   */
  function handlePresetChange(value: string): void {
    setSelectedPreset(value);
    const days = parseInt(value, 10);
    setDateRange({
      start: startOfDay(subDays(new Date(), days)),
      end: endOfDay(new Date()),
    });
  }

  /**
   * Handle custom date range selection from calendar
   */
  function handleDateSelect(date: Date | undefined, isStart: boolean): void {
    if (!date) return;
    setSelectedPreset("custom");
    setDateRange((prev) => ({
      start: isStart ? startOfDay(date) : prev.start,
      end: isStart ? prev.end : endOfDay(date),
    }));
  }

  /**
   * Handle export button click
   */
  async function handleExport(): Promise<void> {
    const params = new URLSearchParams({
      type: "activity_logs",
      format: "csv",
      start_date: dateRange.start.toISOString(),
      end_date: dateRange.end.toISOString(),
    });

    if (selectedRoomId) {
      params.append("room_id", selectedRoomId);
    }

    window.open(`/api/export?${params.toString()}`, "_blank");
  }

  return (
    <AppLayout>
      <div className="min-h-screen">
        <PageHeader
          title="Analytics"
          description="Monitor performance metrics and environmental trends"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw
                  className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
                />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          }
        />

        <div className="p-6 lg:p-8 space-y-6">
          {/* Filters Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Date Range Preset */}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedPreset} onValueChange={handlePresetChange}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_PRESETS.map((preset) => (
                        <SelectItem
                          key={preset.days}
                          value={preset.days.toString()}
                        >
                          {preset.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Date Pickers (shown when custom is selected) */}
                {selectedPreset === "custom" && (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          {format(dateRange.start, "MMM d, yyyy")}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateRange.start}
                          onSelect={(date) => handleDateSelect(date, true)}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <span className="text-muted-foreground">to</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          {format(dateRange.end, "MMM d, yyyy")}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateRange.end}
                          onSelect={(date) => handleDateSelect(date, false)}
                          disabled={(date) =>
                            date > new Date() || date < dateRange.start
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </>
                )}

                {/* Room Filter */}
                <div className="flex items-center gap-2 ml-auto">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={selectedRoomId ?? "all"}
                    onValueChange={(v) =>
                      setSelectedRoomId(v === "all" ? undefined : v)
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Rooms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rooms</SelectItem>
                      {data?.roomCompliance.map((room) => (
                        <SelectItem key={room.roomId} value={room.roomId}>
                          {room.roomName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load analytics data. Please try refreshing the page.
              </AlertDescription>
            </Alert>
          )}

          {/* KPI Summary Cards */}
          <KPICards analyticsOptions={{ dateRange, roomId: selectedRoomId }} />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sensor Trends Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-primary" />
                  <CardTitle>Sensor Trends</CardTitle>
                </div>
                <CardDescription>
                  Temperature, humidity, and VPD trends over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <SensorTrendsChart data={data?.sensorTrends ?? []} />
                )}
              </CardContent>
            </Card>

            {/* Workflow Execution Frequency */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-info" />
                  <CardTitle>Workflow Executions</CardTitle>
                </div>
                <CardDescription>
                  Number of executions per workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <WorkflowExecutionsChart data={data?.workflowStats ?? []} />
                )}
              </CardContent>
            </Card>

            {/* Success/Failure Rate Pie Chart */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-success" />
                  <CardTitle>Execution Results</CardTitle>
                </div>
                <CardDescription>
                  Success, failure, and skip rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ExecutionResultsChart
                    data={data?.executionBreakdown ?? []}
                  />
                )}
              </CardContent>
            </Card>

            {/* Per-Room Compliance Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-warning" />
                  <CardTitle>Room Compliance</CardTitle>
                </div>
                <CardDescription>
                  Environmental target compliance by room
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <RoomComplianceChart data={data?.roomCompliance ?? []} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

/**
 * Sensor Trends Line Chart
 *
 * Displays temperature, humidity, and VPD trends over time.
 */
function SensorTrendsChart({
  data,
}: {
  data: SensorTrendPoint[];
}): JSX.Element {
  // Format date labels for better readability
  const formattedData = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        dateLabel: format(new Date(point.date), "MMM d"),
      })),
    [data]
  );

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No sensor data available for the selected period
      </div>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={formattedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            label={{
              value: "Temp (F) / Humidity (%)",
              angle: -90,
              position: "insideLeft",
              style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 2]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            label={{
              value: "VPD (kPa)",
              angle: 90,
              position: "insideRight",
              style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="temp"
            name="Temperature (F)"
            stroke={CHART_COLORS.temperature}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="humidity"
            name="Humidity (%)"
            stroke={CHART_COLORS.humidity}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="vpd"
            name="VPD (kPa)"
            stroke={CHART_COLORS.vpd}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Workflow Executions Bar Chart
 *
 * Displays the number of executions per workflow with success rate overlay.
 */
function WorkflowExecutionsChart({
  data,
}: {
  data: WorkflowStat[];
}): JSX.Element {
  // Sort by executions (descending) and take top 10
  const sortedData = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.executions - a.executions)
        .slice(0, 10)
        .map((item) => ({
          ...item,
          // Truncate long names for display
          displayName:
            item.name.length > 20 ? `${item.name.substring(0, 17)}...` : item.name,
        })),
    [data]
  );

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No workflow data available for the selected period
      </div>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            type="number"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            type="category"
            dataKey="displayName"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value: number, name: string) => [
              name === "executions" ? value : `${value.toFixed(1)}%`,
              name === "executions" ? "Executions" : "Success Rate",
            ]}
          />
          <Legend />
          <Bar
            dataKey="executions"
            name="Executions"
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Execution Results Pie Chart
 *
 * Displays the breakdown of execution results (success, failed, skipped, dry_run).
 */
function ExecutionResultsChart({
  data,
}: {
  data: ExecutionBreakdown[];
}): JSX.Element {
  // Filter out zero values and format labels
  const chartData = useMemo(
    () =>
      data
        .filter((item) => item.count > 0)
        .map((item) => ({
          ...item,
          name: item.status.charAt(0).toUpperCase() + item.status.slice(1).replace("_", " "),
        })),
    [data]
  );

  const totalExecutions = data.reduce((sum, item) => sum + item.count, 0);

  if (totalExecutions === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No execution data available for the selected period
      </div>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="count"
            label={({ name, percentage }) =>
              `${name}: ${percentage.toFixed(1)}%`
            }
            labelLine={{ stroke: "hsl(var(--muted-foreground))" }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${entry.status}`}
                fill={PIE_COLORS[index % PIE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [value, "Count"]}
          />
          <Legend
            verticalAlign="bottom"
            formatter={(value) => (
              <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>
            )}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Room Compliance Bar Chart
 *
 * Displays environmental compliance percentages by room.
 */
function RoomComplianceChart({
  data,
}: {
  data: RoomCompliance[];
}): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No room data available
      </div>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="roomName"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            label={{
              value: "Compliance (%)",
              angle: -90,
              position: "insideLeft",
              style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, "Compliance"]}
          />
          <Legend />
          <Bar
            dataKey="tempCompliance"
            name="Temperature"
            fill={CHART_COLORS.temperature}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="humidityCompliance"
            name="Humidity"
            fill={CHART_COLORS.humidity}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="vpdCompliance"
            name="VPD"
            fill={CHART_COLORS.vpd}
            radius={[4, 4, 0, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
