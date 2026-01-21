"use client";
import { useState } from "react";
import { Brain, Loader2, Clock, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "warning" | "success" | "error";
  message: string;
  roomName?: string;
}

interface ActivityLogProps {
  logs: LogEntry[];
  roomData?: {
    name: string;
    temperature: number;
    humidity: number;
    vpd: number;
    fanSpeed: number;
    lightLevel: number;
  }[];
}

export function ActivityLog({ logs, roomData }: ActivityLogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");

  const analyzeWithAI = async () => {
    setIsAnalyzing(true);
    setAnalysis("");

    try {
      // Use Next.js API route for AI analysis
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ logs: { entries: logs, roomData } }),
      });

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
          return;
        }
        if (response.status === 402) {
          toast.error("Usage limit reached. Please add credits to continue.");
          return;
        }
        throw new Error("Failed to start analysis");
      }

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
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze logs. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getLogIcon = (type: LogEntry["type"]) => {
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
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Activity Log</CardTitle>
        <Button
          onClick={analyzeWithAI}
          disabled={isAnalyzing}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {isAnalyzing ? "Analyzing..." : "Analyze Logs"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <ScrollArea className="h-64">
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  log.type === "error" && "bg-destructive/5 border-destructive/20",
                  log.type === "warning" && "bg-warning/5 border-warning/20",
                  log.type === "success" && "bg-success/5 border-success/20",
                  log.type === "info" && "bg-muted/50 border-border"
                )}
              >
                {getLogIcon(log.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{log.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {log.timestamp}
                    </span>
                    {log.roomName && (
                      <Badge variant="outline" className="text-xs">
                        {log.roomName}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
