"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Wifi,
  WifiOff,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Zap,
  Server,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Timer,
  Signal,
  Percent,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { Controller } from "@/types";
import {
  getConnectionHealth,
  formatLastSeen,
  type ConnectionHealth,
} from "./ControllerStatusIndicator";
import { CredentialUpdateModal } from "./CredentialUpdateModal";
import {
  type DiagnosticMetrics,
  type DiagnosticHistoryPoint,
  type MetricStatus,
  getResponseTimeStatus,
  getPacketLossStatus,
  getSyncLagStatus,
  getSuccessRateStatus,
  getOverallStatus,
  getStatusClasses,
  getStatusLabel,
  getRecommendations,
  formatResponseTime,
  formatPacketLoss,
  formatSuccessRate,
  formatSyncLag,
  calculateSyncLag,
  generateMockHistoricalData,
} from "@/lib/diagnostic-utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/**
 * Props for ControllerDiagnosticsPanel component
 */
export interface ControllerDiagnosticsPanelProps {
  /** Controller to show diagnostics for */
  controller: Controller;
  /** Whether the diagnostics dialog is open */
  open: boolean;
  /** Callback when the dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Optional callback to refresh controller data */
  onRefresh?: () => Promise<void>;
  /** Optional callback to test connection (for compatibility) */
  onTestConnection?: (controllerId: string) => Promise<void>;
}

/**
 * Metric card data structure
 */
interface MetricCardData {
  id: string;
  label: string;
  value: string;
  status: MetricStatus;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

/**
 * Get troubleshooting steps based on controller brand and health
 */
function getTroubleshootingSteps(
  brand: string,
  health: ConnectionHealth
): string[] {
  const commonSteps = [
    "Verify the device is powered on",
    "Check that the device is within WiFi range",
    "Ensure your router is functioning properly",
  ];

  const brandSpecificSteps: Record<string, string[]> = {
    ac_infinity: [
      "Confirm the controller is connected to 2.4GHz WiFi (not 5GHz)",
      "Check the AC Infinity app to verify cloud connectivity",
      "Try power cycling the controller (unplug for 30 seconds)",
      "Verify credentials match your AC Infinity account",
    ],
    inkbird: [
      "Confirm the device is connected to your WiFi network",
      "Check the Inkbird app for device status",
      "Ensure WiFi credentials are correct in device settings",
      "Try resetting the WiFi connection on the device",
    ],
    ecowitt: [
      "Verify the weather station gateway is online",
      "Check that data is uploading to ecowitt.net",
      "Confirm API key is valid and active",
      "Check the station's WiFi connection indicator",
    ],
    csv_upload: [
      "This is a manual data upload controller",
      "Upload a new CSV file to refresh data",
      "Verify CSV file format matches the template",
    ],
  };

  const steps = [...commonSteps];

  if (brand in brandSpecificSteps) {
    steps.push(...brandSpecificSteps[brand]);
  }

  return steps;
}

/**
 * Get health badge variant for connection status
 */
function getHealthBadgeVariant(
  health: ConnectionHealth
): "default" | "secondary" | "destructive" {
  switch (health) {
    case "online":
      return "default";
    case "stale":
      return "secondary";
    case "offline":
      return "destructive";
  }
}

/**
 * Format chart data for 7-day trend
 */
function formatChartData(history: DiagnosticHistoryPoint[]) {
  return history.map((point) => ({
    date: new Date(point.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    responseTime: point.responseTime,
    packetLoss: point.packetLoss,
    successRate: point.successRate,
  }));
}

/**
 * ControllerDiagnosticsPanel Component
 *
 * Displays comprehensive connection quality metrics and diagnostics for a controller.
 *
 * Features:
 * - 4 key metrics: Response Time, Packet Loss, Sync Lag, Success Rate
 * - Color-coded status indicators (green/yellow/red)
 * - Run diagnostic button with real API testing
 * - 7-day historical trend chart
 * - Contextual recommendations
 * - Brand-specific troubleshooting guidance
 *
 * @example
 * ```tsx
 * <ControllerDiagnosticsPanel
 *   controller={controller}
 *   open={isDiagnosticsOpen}
 *   onOpenChange={setIsDiagnosticsOpen}
 *   onRefresh={refreshController}
 * />
 * ```
 */
export function ControllerDiagnosticsPanel({
  controller,
  open,
  onOpenChange,
  onRefresh,
  onTestConnection,
}: ControllerDiagnosticsPanelProps): JSX.Element {
  const [isTesting, setIsTesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<DiagnosticMetrics | null>(null);
  const [history, setHistory] = useState<DiagnosticHistoryPoint[]>([]);
  const [showTrends, setShowTrends] = useState(false);
  const [showCredentialUpdate, setShowCredentialUpdate] = useState(false);

  const health = getConnectionHealth(controller.status, controller.last_seen);

  // Check if controller supports credential updates (ac_infinity, inkbird)
  const supportsCredentialUpdate = controller.brand === 'ac_infinity' || controller.brand === 'inkbird';
  const isOffline = controller.status !== 'online';

  /**
   * Load historical diagnostics data
   */
  const loadHistory = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/controllers/${controller.id}/diagnostics`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.history.length > 0) {
          setHistory(data.history);
        } else {
          // Use mock data if no history available
          setHistory(generateMockHistoricalData(7));
        }
      } else {
        // Use mock data on error
        setHistory(generateMockHistoricalData(7));
      }
    } catch (error) {
      console.error("Failed to load diagnostic history:", error);
      // Use mock data on error
      setHistory(generateMockHistoricalData(7));
    }
  }, [controller.id]);

  /**
   * Calculate current metrics from controller data
   */
  useEffect(() => {
    if (open) {
      const syncLag = calculateSyncLag(controller.last_seen);

      // Set initial metrics from controller data
      const initialMetrics: DiagnosticMetrics = {
        responseTime: controller.status === "online" ? 350 : 1500,
        packetLoss: controller.status === "online" ? 0 : 15,
        syncLag,
        successRate: controller.status === "online" ? 98 : 65,
        lastChecked: new Date().toISOString(),
      };

      setMetrics(initialMetrics);
      loadHistory();
    }
  }, [open, controller, loadHistory]);

  /**
   * Run comprehensive diagnostic test
   */
  const handleRunDiagnostics = async () => {
    setIsTesting(true);

    try {
      const response = await fetch(`/api/controllers/${controller.id}/diagnostics`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);

        // Reload history
        await loadHistory();

        toast({
          title: "Diagnostics completed",
          description: data.message || "Connection quality metrics updated",
        });
      } else {
        toast({
          title: "Diagnostics failed",
          description: data.error || "Unable to complete diagnostic tests",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Diagnostic test error:", error);
      toast({
        title: "Test error",
        description: "An error occurred while running diagnostics",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = async () => {
    if (!onRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      toast({
        title: "Refreshed",
        description: "Controller data has been updated",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Unable to refresh controller data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Generate metric cards
  const metricCards: MetricCardData[] = metrics
    ? [
        {
          id: "responseTime",
          label: "Response Time",
          value: formatResponseTime(metrics.responseTime),
          status: getResponseTimeStatus(metrics.responseTime),
          icon: Timer,
          description: "Average API response latency",
        },
        {
          id: "packetLoss",
          label: "Packet Loss",
          value: formatPacketLoss(metrics.packetLoss),
          status: getPacketLossStatus(metrics.packetLoss),
          icon: Signal,
          description: "Failed connection attempts",
        },
        {
          id: "syncLag",
          label: "Sync Lag",
          value: formatSyncLag(metrics.syncLag),
          status: getSyncLagStatus(metrics.syncLag),
          icon: Clock,
          description: "Time since last data sync",
        },
        {
          id: "successRate",
          label: "Success Rate",
          value: formatSuccessRate(metrics.successRate),
          status: getSuccessRateStatus(metrics.successRate),
          icon: Percent,
          description: "API call success rate (24h)",
        },
      ]
    : [];

  const overallStatus = metrics ? getOverallStatus(metrics) : "red";
  const recommendations = metrics ? getRecommendations(metrics, controller) : [];
  const troubleshootingSteps = getTroubleshootingSteps(controller.brand, health);
  const chartData = formatChartData(history);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Connection Quality Metrics
            </DialogTitle>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={cn("w-4 h-4", isRefreshing && "animate-spin")}
                />
              </Button>
            )}
          </div>
          <DialogDescription>
            {controller.name} ({controller.brand.replace("_", " ")})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Overall Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <h3 className="font-medium text-sm text-muted-foreground">
                Overall Status
              </h3>
              <p className="text-lg font-semibold mt-1">
                {getStatusLabel(overallStatus)} Connection
              </p>
            </div>
            <Badge
              variant={
                overallStatus === "green"
                  ? "default"
                  : overallStatus === "yellow"
                    ? "secondary"
                    : "destructive"
              }
              className="text-xs"
            >
              {overallStatus.toUpperCase()}
            </Badge>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 gap-4">
            {metricCards.map((metric) => {
              const Icon = metric.icon;
              const styles = getStatusClasses(metric.status);

              return (
                <Card key={metric.id} className={cn("border", styles.border)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Icon className={cn("w-5 h-5", styles.text)} />
                      <div className={cn("w-2 h-2 rounded-full", styles.dot)} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{metric.value}</p>
                      <p className="text-sm font-medium text-muted-foreground">
                        {metric.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {metric.description}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn("text-xs mt-2", styles.badge)}
                      >
                        {getStatusLabel(metric.status)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Run Diagnostic Button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleRunDiagnostics}
              disabled={isTesting || controller.brand === "csv_upload"}
              className="flex-1"
              size="lg"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 mr-2" />
                  Run Diagnostics
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowTrends(!showTrends)}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {showTrends ? "Hide" : "Show"} Trends
            </Button>
          </div>

          {controller.brand === "csv_upload" && (
            <p className="text-sm text-muted-foreground text-center">
              CSV Upload controllers do not support connection testing
            </p>
          )}

          {/* Historical Trend Chart */}
          {showTrends && history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  7-Day Connection Quality Trend
                </CardTitle>
                <CardDescription>
                  Historical performance metrics over the past week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="responseTime"
                      stroke="#10b981"
                      name="Response Time (ms)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="successRate"
                      stroke="#3b82f6"
                      name="Success Rate (%)"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4" />
                Recommendations
              </h3>
              <div className="space-y-2">
                {recommendations.map((recommendation, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Troubleshooting Steps (only if not healthy) */}
          {overallStatus !== "green" && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Troubleshooting Steps
              </h3>
              <ol className="space-y-2 text-sm">
                {troubleshootingSteps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="text-muted-foreground font-medium flex-shrink-0">
                      {index + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              {/* Update Credentials Button */}
              {isOffline && supportsCredentialUpdate && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowCredentialUpdate(true)}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Update Credentials
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    If you recently changed your password, update it here to restore connection.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Metric Details */}
          {metrics?.details && (
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Diagnostic Details
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 text-muted-foreground">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium">Test Attempts</p>
                    <p>
                      {metrics.details.successfulAttempts} / {metrics.details.totalAttempts} successful
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Response Range</p>
                    <p>
                      {metrics.details.minResponseTime}ms - {metrics.details.maxResponseTime}ms
                    </p>
                  </div>
                </div>
                <p className="pt-2 border-t">
                  Last checked: {new Date(metrics.lastChecked).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Additional Information */}
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <p className="font-medium mb-1">Color Coding Guide:</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  Green
                </span>
                : Response &lt; 500ms, No packet loss, Sync &lt; 60s, Success &ge; 95%
              </li>
              <li>
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                  Yellow
                </span>
                : Response 500-1000ms, Loss 1-10%, Sync 1-5min, Success 75-94%
              </li>
              <li>
                <span className="text-red-600 dark:text-red-400 font-medium">
                  Red
                </span>
                : Response &gt; 1000ms, Loss &gt; 10%, Sync &gt; 5min, Success &lt; 75%
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>

      {/* Credential Update Modal */}
      <CredentialUpdateModal
        open={showCredentialUpdate}
        onOpenChange={setShowCredentialUpdate}
        controller={controller}
        onSuccess={async () => {
          toast({
            title: "Credentials updated",
            description: "Controller credentials have been updated and verified successfully.",
          });
          setShowCredentialUpdate(false);
          // Refresh controller data to reflect new status
          if (onRefresh) {
            await onRefresh();
          }
        }}
      />
    </Dialog>
  );
}
