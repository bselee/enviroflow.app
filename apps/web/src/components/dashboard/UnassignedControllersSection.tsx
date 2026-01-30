"use client";

import { Cpu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UnassignedControllerDataCard, UnassignedControllerDataCardSkeleton } from "./UnassignedControllerDataCard";
import { cn } from "@/lib/utils";
import type { UnassignedControllerSummary } from "@/hooks/use-dashboard-data";

// =============================================================================
// Types
// =============================================================================

interface UnassignedControllersSectionProps {
  /** Summaries for unassigned controllers with sensor data */
  controllerSummaries: UnassignedControllerSummary[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Callback when data should be refreshed */
  onRefresh?: () => void;
  /** Optional CSS class name */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * UnassignedControllersSection Component
 *
 * Displays a section for controllers that are not assigned to any room.
 * Shows sensor data directly in cards - no longer requires room assignment
 * to view data.
 *
 * @example
 * ```tsx
 * <UnassignedControllersSection
 *   controllerSummaries={unassignedControllerSummaries}
 *   isLoading={isLoading}
 * />
 * ```
 */
export function UnassignedControllersSection({
  controllerSummaries,
  isLoading,
  onRefresh,
  className,
}: UnassignedControllersSectionProps): JSX.Element {
  // Always render - show empty state message if no controllers

  // Count online controllers
  const onlineCount = controllerSummaries.filter((s) => s.isOnline).length;

  return (
    <section className={cn("space-y-4", className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Controllers</h2>
          </div>
          {!isLoading && controllerSummaries.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {onlineCount}/{controllerSummaries.length} online
            </Badge>
          )}
        </div>
        <Link href="/controllers">
          <Button variant="outline" size="sm">
            Manage
          </Button>
        </Link>
      </div>

      {/* Info Text */}
      {!isLoading && controllerSummaries.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Controllers not assigned to a room. Assign to a room to include in room-based views.
        </p>
      )}

      {/* Controller Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <UnassignedControllerDataCardSkeleton key={i} />
          ))}
        </div>
      ) : controllerSummaries.length === 0 ? (
        <div className="p-6 border border-dashed border-muted-foreground/30 rounded-lg text-center">
          <Cpu className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No unassigned controllers</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            All your controllers are assigned to rooms, or you haven&apos;t added any controllers yet.
          </p>
          <Link href="/controllers">
            <Button variant="outline" size="sm" className="mt-3">
              Add Controller
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {controllerSummaries.map((summary) => (
            <UnassignedControllerDataCard
              key={summary.controller.id}
              summary={summary}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </section>
  );
}
