"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  WifiOff,
  Clock,
  Bot,
  X,
  ChevronRight,
  Pause,
  Play,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Alert represents a system notification that may require user attention.
 * Used for environmental warnings, system errors, or informational messages.
 */
export interface Alert {
  /** Unique identifier for the alert */
  id: string;
  /** Severity level determining visual treatment and priority */
  severity: "info" | "warning" | "critical";
  /** Short, descriptive title for the alert */
  title: string;
  /** Detailed message explaining the alert */
  message: string;
  /** ISO timestamp of when the alert was created */
  timestamp: string;
  /** Whether the alert has a specific action the user can take */
  actionable: boolean;
  /** Optional action button configuration */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Automation represents an active or paused automation workflow.
 */
export interface Automation {
  /** Unique identifier for the automation */
  id: string;
  /** Display name of the automation */
  name: string;
  /** Current status of the automation */
  status: "active" | "paused" | "error";
  /** Optional room name where the automation is running */
  roomName?: string;
  /** ISO timestamp of when the automation last executed */
  lastRun?: string;
}

/**
 * ControllerSummary provides minimal controller info for offline status display.
 */
export interface ControllerSummary {
  /** Unique identifier for the controller */
  id: string;
  /** Display name of the controller */
  name: string;
  /** ISO timestamp of when the controller was last seen online */
  lastSeen: string;
}

/**
 * ScheduledEvent represents an upcoming scheduled action.
 */
export interface ScheduledEvent {
  /** Display name of the event */
  name: string;
  /** ISO timestamp of when the event will occur */
  time: string;
  /** Type of scheduled event for icon selection */
  type: "lights" | "automation" | "schedule";
}

/**
 * Props for the SmartActionCards component.
 */
export interface SmartActionCardsProps {
  /** Active alerts requiring user attention */
  alerts?: Alert[];
  /** Currently running automations */
  activeAutomations?: Automation[];
  /** Controllers that have gone offline */
  offlineControllers?: ControllerSummary[];
  /** The next scheduled event to display */
  nextScheduledEvent?: ScheduledEvent;
  /** Callback when user dismisses an alert */
  onAlertDismiss?: (alertId: string) => void;
  /** Callback when user toggles an automation on/off */
  onAutomationToggle?: (automationId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Internal card type for priority-based rendering.
 */
type CardType = "alert" | "offline" | "event" | "automation";

/**
 * Internal card data structure with priority and render info.
 */
interface SmartCard {
  id: string;
  type: CardType;
  priority: number;
  data: Alert | ControllerSummary[] | ScheduledEvent | Automation;
}

/**
 * Severity color mappings for alerts and status indicators.
 */
const severityColors = {
  critical: {
    bg: "bg-destructive/10 dark:bg-red-950/50",
    border: "border-destructive/30",
    icon: "text-destructive",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.2)]",
  },
  warning: {
    bg: "bg-warning/10 dark:bg-amber-950/50",
    border: "border-warning/30",
    icon: "text-warning",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.2)]",
  },
  info: {
    bg: "bg-info/10 dark:bg-blue-950/50",
    border: "border-info/30",
    icon: "text-info",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.2)]",
  },
} as const;

/**
 * Status color mappings for automations.
 */
const automationStatusColors = {
  active: {
    bg: "bg-success/10 dark:bg-emerald-950/50",
    border: "border-success/30",
    icon: "text-success",
    badge: "bg-success text-white",
  },
  paused: {
    bg: "bg-warning/10 dark:bg-amber-950/50",
    border: "border-warning/30",
    icon: "text-warning",
    badge: "bg-warning text-white",
  },
  error: {
    bg: "bg-destructive/10 dark:bg-red-950/50",
    border: "border-destructive/30",
    icon: "text-destructive",
    badge: "bg-destructive text-white",
  },
} as const;

/**
 * Formats a relative time string from an ISO timestamp.
 * Returns human-readable strings like "2 min ago" or "in 4h 23m".
 *
 * @param isoTimestamp - ISO format timestamp string
 * @param isFuture - Whether to format as future time (default: false)
 * @returns Formatted relative time string
 */
function formatRelativeTime(isoTimestamp: string, isFuture = false): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = isFuture ? date.getTime() - now.getTime() : now.getTime() - date.getTime();

  if (diffMs < 0 && isFuture) {
    return "now";
  }

  const diffSecs = Math.floor(Math.abs(diffMs) / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return isFuture ? `in ${diffDays}d ${diffHours % 24}h` : `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return isFuture ? `in ${diffHours}h ${diffMins % 60}m` : `${diffHours}h ago`;
  }
  if (diffMins > 0) {
    return isFuture ? `in ${diffMins}m` : `${diffMins} min ago`;
  }
  return isFuture ? `in ${diffSecs}s` : "just now";
}

/**
 * Formats a time from an ISO timestamp into a readable format like "6:00 PM".
 *
 * @param isoTimestamp - ISO format timestamp string
 * @returns Formatted time string
 */
function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * GlassmorphicCard - Base card component with glass morphism styling.
 * Uses the glass-card class from the design system with enter animations.
 */
interface GlassmorphicCardProps {
  children: React.ReactNode;
  className?: string;
  colorScheme?: keyof typeof severityColors;
  animationDelay?: number;
}

function GlassmorphicCard({
  children,
  className,
  colorScheme,
  animationDelay = 0,
}: GlassmorphicCardProps): JSX.Element {
  const colors = colorScheme ? severityColors[colorScheme] : null;

  return (
    <div
      className={cn(
        // Base glass-card styling from design system
        "glass-card rounded-xl p-4",
        // Animation
        "opacity-0 animate-slide-up",
        // Interactive states
        "transition-all duration-200 hover:scale-[1.02]",
        // Color scheme if provided
        colors?.bg,
        colors?.border,
        colors?.glow,
        className
      )}
      style={{
        animationDelay: `${animationDelay * 100}ms`,
        animationFillMode: "forwards",
      }}
    >
      {children}
    </div>
  );
}

/**
 * AlertCard - Displays critical, warning, or info alerts with optional actions.
 */
interface AlertCardProps {
  alert: Alert;
  onDismiss?: (alertId: string) => void;
  animationDelay?: number;
}

function AlertCard({ alert, onDismiss, animationDelay = 0 }: AlertCardProps): JSX.Element {
  const colors = severityColors[alert.severity];

  const handleDismiss = useCallback(() => {
    onDismiss?.(alert.id);
  }, [onDismiss, alert.id]);

  return (
    <GlassmorphicCard colorScheme={alert.severity} animationDelay={animationDelay}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn("flex-shrink-0 p-1.5 rounded-lg", colors.bg)}>
          <AlertTriangle className={cn("h-5 w-5", colors.icon)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{alert.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              Dismiss
            </Button>
            {alert.actionable && alert.action && (
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2 text-xs", colors.icon)}
                onClick={alert.action.onClick}
              >
                {alert.action.label}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Dismiss X button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleDismiss}
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </GlassmorphicCard>
  );
}

/**
 * OfflineControllersCard - Shows offline controllers with troubleshooting action.
 */
interface OfflineControllersCardProps {
  controllers: ControllerSummary[];
  animationDelay?: number;
}

function OfflineControllersCard({
  controllers,
  animationDelay = 0,
}: OfflineControllersCardProps): JSX.Element {
  const count = controllers.length;
  const names = controllers.map((c) => c.name).join(", ");
  const truncatedNames = names.length > 40 ? `${names.substring(0, 40)}...` : names;

  return (
    <GlassmorphicCard colorScheme="warning" animationDelay={animationDelay}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn("flex-shrink-0 p-1.5 rounded-lg", severityColors.warning.bg)}>
          <WifiOff className={cn("h-5 w-5", severityColors.warning.icon)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">
            {count} controller{count !== 1 ? "s" : ""} offline
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5" title={names}>
            {truncatedNames}
          </p>

          {/* Action */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 px-2 text-xs", severityColors.warning.icon)}
            >
              <Wrench className="h-3 w-3 mr-1" />
              Troubleshoot
            </Button>
          </div>
        </div>
      </div>
    </GlassmorphicCard>
  );
}

/**
 * ScheduledEventCard - Shows next scheduled event with live countdown.
 */
interface ScheduledEventCardProps {
  event: ScheduledEvent;
  animationDelay?: number;
}

function ScheduledEventCard({ event, animationDelay = 0 }: ScheduledEventCardProps): JSX.Element {
  const [countdown, setCountdown] = useState(() => formatRelativeTime(event.time, true));

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatRelativeTime(event.time, true));
    }, 1000);

    return () => clearInterval(timer);
  }, [event.time]);

  const formattedTime = formatTime(event.time);

  return (
    <GlassmorphicCard
      className="bg-info/5 dark:bg-blue-950/30 border-info/20"
      animationDelay={animationDelay}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 p-1.5 rounded-lg bg-info/10">
          <Clock className="h-5 w-5 text-info" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">
            Next: {event.name} at {formattedTime}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{countdown}</p>
        </div>
      </div>
    </GlassmorphicCard>
  );
}

/**
 * AutomationCard - Shows automation status with pause/resume toggle.
 */
interface AutomationCardProps {
  automation: Automation;
  onToggle?: (automationId: string) => void;
  animationDelay?: number;
}

function AutomationCard({
  automation,
  onToggle,
  animationDelay = 0,
}: AutomationCardProps): JSX.Element {
  const colors = automationStatusColors[automation.status];
  const lastRunText = automation.lastRun
    ? `Last ran ${formatRelativeTime(automation.lastRun)}`
    : "Never run";

  const handleToggle = useCallback(() => {
    onToggle?.(automation.id);
  }, [onToggle, automation.id]);

  const isActive = automation.status === "active";
  const ToggleIcon = isActive ? Pause : Play;
  const toggleLabel = isActive ? "Pause" : "Resume";

  return (
    <GlassmorphicCard
      className={cn(colors.bg, colors.border)}
      animationDelay={animationDelay}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn("flex-shrink-0 p-1.5 rounded-lg", colors.bg)}>
          <Bot className={cn("h-5 w-5", colors.icon)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{automation.name}</h4>
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                colors.badge
              )}
            >
              {automation.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastRunText}
            {automation.roomName && ` - ${automation.roomName}`}
          </p>

          {/* Action */}
          {automation.status !== "error" && (
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2 text-xs", colors.icon)}
                onClick={handleToggle}
              >
                <ToggleIcon className="h-3 w-3 mr-1" />
                {toggleLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    </GlassmorphicCard>
  );
}

/**
 * SmartActionCards Component
 *
 * Displays 2-3 contextually relevant action cards based on current system state.
 * Cards are prioritized and filtered to show the most important information first.
 *
 * Priority order:
 * 1. Critical alerts (highest)
 * 2. Warning alerts
 * 3. Offline controllers
 * 4. Info alerts
 * 5. Scheduled events
 * 6. Active automations (lowest)
 *
 * Features:
 * - Glassmorphic card design matching dashboard aesthetic
 * - Smooth enter/exit animations with staggered delays
 * - Color-coded severity indicators
 * - One-tap controls for common actions
 * - Live countdown timer for scheduled events
 *
 * @example Basic usage
 * ```tsx
 * <SmartActionCards
 *   alerts={[{ id: "1", severity: "warning", title: "VPD trending high", ... }]}
 *   offlineControllers={[{ id: "c1", name: "Controller 1", lastSeen: "..." }]}
 *   nextScheduledEvent={{ name: "Lights off", time: "2024-01-01T18:00:00Z", type: "lights" }}
 * />
 * ```
 *
 * @example With automation controls
 * ```tsx
 * <SmartActionCards
 *   activeAutomations={[{ id: "a1", name: "VPD Control", status: "active" }]}
 *   onAutomationToggle={(id) => console.log("Toggle automation:", id)}
 * />
 * ```
 */
export function SmartActionCards({
  alerts = [],
  activeAutomations = [],
  offlineControllers = [],
  nextScheduledEvent,
  onAlertDismiss,
  onAutomationToggle,
  className,
}: SmartActionCardsProps): JSX.Element | null {
  // Track dismissed alerts locally for animation purposes
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  /**
   * Build and prioritize smart cards based on available data.
   * Priority system ensures most important cards appear first.
   */
  const smartCards = useMemo<SmartCard[]>(() => {
    const cards: SmartCard[] = [];

    // Filter out dismissed alerts
    const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));

    // Add critical alerts first (priority 1)
    visibleAlerts
      .filter((a) => a.severity === "critical")
      .forEach((alert) => {
        cards.push({ id: `alert-${alert.id}`, type: "alert", priority: 1, data: alert });
      });

    // Add warning alerts (priority 2)
    visibleAlerts
      .filter((a) => a.severity === "warning")
      .forEach((alert) => {
        cards.push({ id: `alert-${alert.id}`, type: "alert", priority: 2, data: alert });
      });

    // Add offline controllers as a single card (priority 3)
    if (offlineControllers.length > 0) {
      cards.push({
        id: "offline-controllers",
        type: "offline",
        priority: 3,
        data: offlineControllers,
      });
    }

    // Add info alerts (priority 4)
    visibleAlerts
      .filter((a) => a.severity === "info")
      .forEach((alert) => {
        cards.push({ id: `alert-${alert.id}`, type: "alert", priority: 4, data: alert });
      });

    // Add next scheduled event (priority 5)
    if (nextScheduledEvent) {
      // Only show if event is in the future
      const eventTime = new Date(nextScheduledEvent.time);
      if (eventTime > new Date()) {
        cards.push({
          id: "next-event",
          type: "event",
          priority: 5,
          data: nextScheduledEvent,
        });
      }
    }

    // Add active/paused automations (priority 6)
    activeAutomations
      .filter((a) => a.status === "active" || a.status === "paused")
      .slice(0, 2) // Limit to 2 automations to avoid overwhelming the UI
      .forEach((automation) => {
        cards.push({
          id: `automation-${automation.id}`,
          type: "automation",
          priority: 6,
          data: automation,
        });
      });

    // Sort by priority and limit to 3 cards
    return cards.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }, [alerts, activeAutomations, offlineControllers, nextScheduledEvent, dismissedAlerts]);

  /**
   * Handle alert dismissal - update local state and notify parent.
   */
  const handleAlertDismiss = useCallback(
    (alertId: string) => {
      setDismissedAlerts((prev) => new Set(prev).add(alertId));
      onAlertDismiss?.(alertId);
    },
    [onAlertDismiss]
  );

  // Don't render anything if no cards to show
  if (smartCards.length === 0) {
    return null;
  }

  return (
    <div className={cn("grid gap-3", className)}>
      {smartCards.map((card, index) => {
        switch (card.type) {
          case "alert":
            return (
              <AlertCard
                key={card.id}
                alert={card.data as Alert}
                onDismiss={handleAlertDismiss}
                animationDelay={index}
              />
            );
          case "offline":
            return (
              <OfflineControllersCard
                key={card.id}
                controllers={card.data as ControllerSummary[]}
                animationDelay={index}
              />
            );
          case "event":
            return (
              <ScheduledEventCard
                key={card.id}
                event={card.data as ScheduledEvent}
                animationDelay={index}
              />
            );
          case "automation":
            return (
              <AutomationCard
                key={card.id}
                automation={card.data as Automation}
                onToggle={onAutomationToggle}
                animationDelay={index}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/**
 * SmartActionCardsSkeleton - Loading skeleton for the SmartActionCards component.
 * Displays placeholder cards while data is being fetched.
 */
export function SmartActionCardsSkeleton({
  count = 2,
  className,
}: {
  count?: number;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn("grid gap-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "glass-card rounded-xl p-4",
            "opacity-0 animate-slide-up"
          )}
          style={{
            animationDelay: `${i * 100}ms`,
            animationFillMode: "forwards",
          }}
        >
          <div className="flex items-start gap-3">
            {/* Icon skeleton */}
            <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-muted animate-pulse" />
            {/* Content skeleton */}
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              <div className="h-3 w-48 bg-muted rounded animate-pulse" />
              <div className="h-7 w-20 bg-muted rounded animate-pulse mt-3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SmartActionCards;
