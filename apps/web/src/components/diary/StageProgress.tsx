"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DiaryCycleStage } from "@/types";
import { cn } from "@/lib/utils";

interface StageInfo {
  value: DiaryCycleStage;
  label: string;
  icon: string;
  minDays: number;
  maxDays: number;
  prompt: string;
}

const STAGES: StageInfo[] = [
  {
    value: "germination",
    label: "Germination",
    icon: "🌰",
    minDays: 3,
    maxDays: 7,
    prompt: "Typically 3-7 days. Move to Seedling when sprouts emerge with first leaves.",
  },
  {
    value: "seedling",
    label: "Seedling",
    icon: "🌱",
    minDays: 14,
    maxDays: 21,
    prompt: "Typically 14-21 days. Move to Vegetative when 3-4 leaf sets have developed.",
  },
  {
    value: "vegetative",
    label: "Vegetative",
    icon: "🌿",
    minDays: 21,
    maxDays: 60,
    prompt: "Typically 21-60 days. Move to Flowering when switching light schedule or seeing pre-flowers.",
  },
  {
    value: "flowering",
    label: "Flowering",
    icon: "🌸",
    minDays: 45,
    maxDays: 70,
    prompt: "Typically 45-70 days. Move to Harvest when trichomes are mostly cloudy/amber.",
  },
  {
    value: "harvest",
    label: "Harvest",
    icon: "🌾",
    minDays: 1,
    maxDays: 3,
    prompt: "Typically 1-3 days. Move to Cure after drying is complete.",
  },
  {
    value: "cure",
    label: "Cure",
    icon: "🫙",
    minDays: 14,
    maxDays: 60,
    prompt: "Typically 14-60 days. This is the final stage before archiving the cycle.",
  },
];

interface StageProgressProps {
  currentStage: DiaryCycleStage;
  startedAt: string;
  stageChangedAt?: string | null;
  onStageChange?: (newStage: DiaryCycleStage) => void;
  disabled?: boolean;
}

/**
 * Calculate days in current stage
 */
function getDaysInStage(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get the next stage in the progression
 */
function getNextStage(currentStage: DiaryCycleStage): DiaryCycleStage | null {
  const currentIndex = STAGES.findIndex((s) => s.value === currentStage);
  if (currentIndex === -1 || currentIndex === STAGES.length - 1) {
    return null;
  }
  return STAGES[currentIndex + 1].value;
}

export function StageProgress({
  currentStage,
  startedAt,
  stageChangedAt,
  onStageChange,
  disabled = false,
}: StageProgressProps) {
  const [confirmStage, setConfirmStage] = useState<DiaryCycleStage | null>(null);
  const currentStageInfo = STAGES.find((s) => s.value === currentStage);
  const currentStageIndex = STAGES.findIndex((s) => s.value === currentStage);

  // Calculate days in current stage (use stageChangedAt if available, otherwise cycle start)
  const stageStartDate = stageChangedAt || startedAt;
  const daysInStage = getDaysInStage(stageStartDate);

  const nextStage = getNextStage(currentStage);
  const nextStageInfo = nextStage ? STAGES.find((s) => s.value === nextStage) : null;

  // Determine if we should show transition prompt
  const showPrompt = useMemo(() => {
    if (!currentStageInfo) return false;
    return daysInStage >= currentStageInfo.minDays;
  }, [currentStageInfo, daysInStage]);

  const handleStageClick = (stage: DiaryCycleStage) => {
    if (disabled || !onStageChange) return;
    const targetIndex = STAGES.findIndex((s) => s.value === stage);
    if (targetIndex < currentStageIndex) {
      // Backward move — ask for confirmation
      setConfirmStage(stage);
    } else if (targetIndex > currentStageIndex) {
      // Forward move — apply directly
      onStageChange(stage);
    }
    // Same stage — no-op
  };

  const confirmBackwardMove = () => {
    if (confirmStage && onStageChange) {
      onStageChange(confirmStage);
    }
    setConfirmStage(null);
  };

  const handleMoveToNext = () => {
    if (nextStage && !disabled && onStageChange) {
      onStageChange(nextStage);
    }
  };

  if (!currentStageInfo) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Current stage header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentStageInfo.icon}</span>
              <div>
                <h3 className="text-lg font-semibold uppercase tracking-wide">
                  {currentStageInfo.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Day {daysInStage} of {currentStageInfo.label}
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative">
            <div className="flex items-center justify-between">
              {STAGES.map((stage, index) => {
                const isActive = index === currentStageIndex;
                const isPast = index < currentStageIndex;
                const isFuture = index > currentStageIndex;

                return (
                  <div
                    key={stage.value}
                    className="flex flex-col items-center flex-1 relative"
                  >
                    {/* Progress line (before dot) */}
                    {index > 0 && (
                      <div
                        className={cn(
                          "absolute left-0 top-4 h-0.5 w-full -translate-x-1/2",
                          isPast || isActive ? "bg-primary" : "bg-muted"
                        )}
                        style={{ zIndex: 0 }}
                      />
                    )}

                    {/* Stage dot */}
                    <button
                      onClick={() => handleStageClick(stage.value)}
                      disabled={disabled || isActive}
                      className={cn(
                        "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                        isActive &&
                          "h-10 w-10 border-primary bg-primary text-primary-foreground shadow-lg",
                        isPast &&
                          "border-primary bg-primary/20 hover:bg-primary/30",
                        isFuture && "border-muted bg-background hover:border-primary/50 hover:bg-primary/10",
                        !disabled && !isActive && "cursor-pointer"
                      )}
                      title={stage.label}
                    >
                      <span className={cn("text-lg", !isActive && "text-sm")}>
                        {stage.icon}
                      </span>
                    </button>

                    {/* Stage label (only on larger screens) */}
                    <span
                      className={cn(
                        "mt-2 hidden text-xs font-medium md:block",
                        isActive && "text-foreground",
                        !isActive && "text-muted-foreground"
                      )}
                    >
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transition prompt */}
          {showPrompt && nextStageInfo && (
            <div className="mt-4 rounded-lg bg-muted/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">
                    Ready to move to {nextStageInfo.label}?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentStageInfo.prompt}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleMoveToNext}
                  disabled={disabled}
                  className="flex-shrink-0"
                >
                  Move to {nextStageInfo.label}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Stage info (when not showing prompt) */}
          {!showPrompt && (
            <div className="mt-4 rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                {currentStageInfo.prompt}
              </p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Backward stage confirmation dialog */}
      <AlertDialog open={!!confirmStage} onOpenChange={(open) => !open && setConfirmStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move stage backward?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the cycle from{" "}
              <strong>{currentStageInfo?.label}</strong> back to{" "}
              <strong>{STAGES.find((s) => s.value === confirmStage)?.label}</strong>.
              Stage timing will be reset. This action is usually not needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBackwardMove}>
              Move Backward
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
