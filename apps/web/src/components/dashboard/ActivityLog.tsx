"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Brain,
  Loader2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useActivityLogs } from "@/hooks/use-activity-logs";
import type { FormattedActivityLog } from "@/types";

/**
 * Props for ActivityLog component.
 * Supports both real data mode (no props) and mock data mode (with logs prop).
 */
interface ActivityLogProps {
  /** Optional room ID to filter logs */
  roomId?: string;
  /** Maximum number of logs to display */
  limit?: number;
  /** Time range in hours (default: 24) */
  timeRangeHours?: number;
  /** Optional room data for AI analysis context */
  roomData?: {
    name: string;
    temperature: number;
    humidity: number;
    vpd: number;
    fanSpeed: number;
    lightLevel: number;
  }[];
}

/**
 * Returns the appropriate icon component for a log type.
 */
function getLogIcon(type: FormattedActivityLog["type"]) {
  switch (type) {
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "error":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    default:
      return <Info className="h-4 w-4 text-info" />;
  }
}

/**
 * Loading skeleton for ActivityLog.
 */
function ActivityLogSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state component when no logs are available.
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Clock className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">No activity yet</p>
      <p className="text-xs text-muted-foreground mt-1">
        Automation actions will appear here
      </p>
    </div>
  );
}

/**
 * Activity log component displaying recent automation actions.
 *
 * Fetches activity logs from Supabase and displays them in a timeline format.
 * Supports filtering by room, AI analysis of logs, and real-time updates.
 *
 * @example
 * ```tsx
 * // Basic usage - shows all recent activity
 * <ActivityLog />
 *
 * // Filter by room
 * <ActivityLog roomId="room-123" />
 *
 * // Custom time range
 * <ActivityLog timeRangeHours={12} limit={20} />
 * ```
 */
export function ActivityLog({
  roomId,
  limit = 50,
  timeRangeHours = 24,
  roomData,
}: ActivityLogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");

  const {
    formattedLogs,
    isLoading,
    error,
    refetch,
  } = useActivityLogs({
    roomId,
    limit,
    timeRangeHours,
  });

  /**
   * Handles AI analysis of the activity logs.
   * Sends log data to the analysis API and streams the response.
   */
  const analyzeWithAI = async () => {
    setIsAnalyzing(true);
    setAnalysis("");

    try {
      // Prepare log data for analysis
      const logsForAnalysis = formattedLogs.map((log) => ({
        id: log.id,
        timestamp: log.relativeTime,
        type: log.type,
        message: log.message,
        roomName: log.roomName,
      }));

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logs: {
            entries: logsForAnalysis,
            roomData,
          },
        }),
      });

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          toast.error("Rate limit exceeded", {
            description: "Please try again later.",
          });
          return;
        }
        if (response.status === 402) {
          toast.error("Usage limit reached", {
            description: "Please add credits to continue.",
          });
          return;
        }
        throw new Error("Failed to start analysis");
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullAnalysis = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullAnalysis += content;
              setAnalysis(fullAnalysis);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Analysis failed", {
        description: "Please try again.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Activity Log</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => refetch()}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
            <span className="sr-only">Refresh</span>
          </Button>
          <Button
            onClick={analyzeWithAI}
            disabled={isAnalyzing || formattedLogs.length === 0}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* AI Analysis Result */}
        {analysis && (
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">AI Analysis</span>
            </div>
            <ScrollArea className="h-48">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground whitespace-pre-wrap">
                {analysis}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/20">
            <p className="text-sm text-destructive">
              Failed to load activity logs: {error}
            </p>
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && <ActivityLogSkeleton />}

        {/* Empty State */}
        {!isLoading && !error && formattedLogs.length === 0 && <EmptyState />}

        {/* Log Entries */}
        {!isLoading && !error && formattedLogs.length > 0 && (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {formattedLogs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                    log.type === "error" && "bg-destructive/5 border-destructive/20",
                    log.type === "warning" && "bg-warning/5 border-warning/20",
                    log.type === "success" && "bg-success/5 border-success/20",
                    log.type === "info" && "bg-muted/50 border-border"
                  )}
                >
                  {getLogIcon(log.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{log.message}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {log.relativeTime}
                      </span>
                      {log.roomName && (
                        <Badge variant="outline" className="text-xs">
                          {log.roomName}
                        </Badge>
                      )}
                      {log.workflowName && (
                        <Link
                          href={`/automations`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {log.workflowName}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {log.result && log.result !== "success" && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            log.result === "failed" &&
                              "bg-destructive/10 text-destructive",
                            log.result === "skipped" &&
                              "bg-muted text-muted-foreground",
                            log.result === "dry_run" &&
                              "bg-info/10 text-info"
                          )}
                        >
                          {log.result === "dry_run" ? "Dry Run" : log.result}
                        </Badge>
                      )}
                    </div>
                    {log.errorMessage && (
                      <p className="text-xs text-destructive mt-1">
                        Error: {log.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
