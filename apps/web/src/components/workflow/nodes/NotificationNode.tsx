"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Bell,
  BellRing,
  Mail,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  NotificationNodeData,
  NotificationPriority,
  NotificationChannel,
} from "../types";
import {
  NOTIFICATION_PRIORITY_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
} from "../types";

/**
 * NotificationNode - Send notification node for workflows
 *
 * This node sends push notifications, emails, or SMS when triggered.
 * Configuration options:
 * - Message template with variable support
 * - Notification priority (low, normal, high, critical)
 * - Channels (push, email, sms)
 *
 * Visual Design:
 * - Purple border to indicate "notification" semantics
 * - Bell icon in header
 * - Priority badge with appropriate color
 * - Has only input handle (it's a terminal action)
 */

/** Icons for notification channels */
const CHANNEL_ICONS: Record<NotificationChannel, React.ComponentType<{ className?: string }>> = {
  push: BellRing,
  email: Mail,
  sms: MessageSquare,
};

/** Priority badge configurations */
const PRIORITY_CONFIG: Record<
  NotificationPriority,
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  low: {
    icon: Info,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  normal: {
    icon: Bell,
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  high: {
    icon: AlertCircle,
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  critical: {
    icon: AlertTriangle,
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

interface NotificationNodeProps {
  data: NotificationNodeData;
  selected?: boolean;
  id: string;
}

export function NotificationNode({ data, selected, id }: NotificationNodeProps) {
  const config = data.config;
  const priority = config.priority ?? "normal";
  const priorityConfig = PRIORITY_CONFIG[priority];
  const PriorityIcon = priorityConfig.icon;

  /**
   * Truncates the message for display in the node.
   * Shows first 50 characters with ellipsis if longer.
   */
  const getTruncatedMessage = (): string => {
    if (!config.message) {
      return "No message set";
    }
    if (config.message.length <= 50) {
      return config.message;
    }
    return `${config.message.slice(0, 50)}...`;
  };

  /**
   * Renders the channel icons for enabled channels.
   */
  const renderChannels = (): React.ReactNode => {
    const channels = config.channels ?? [];

    if (channels.length === 0) {
      return (
        <span className="text-xs text-muted-foreground italic">
          No channels selected
        </span>
      );
    }

    return (
      <div className="flex items-center gap-1">
        {channels.map((channel) => {
          const ChannelIcon = CHANNEL_ICONS[channel];
          return (
            <div
              key={channel}
              className="flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5"
              title={NOTIFICATION_CHANNEL_LABELS[channel]}
            >
              <ChannelIcon className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {channel === "push" ? "Push" : channel === "email" ? "Email" : "SMS"}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "min-w-[200px] max-w-[280px] rounded-lg border-2 bg-card shadow-md transition-all",
        "border-purple-500 dark:border-purple-400",
        selected && "ring-2 ring-purple-500/50 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Input Handle - positioned on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={cn(
          "!h-3 !w-3 !border-2 !border-purple-500 !bg-background",
          "dark:!border-purple-400"
        )}
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-purple-500/10 px-3 py-2 dark:bg-purple-400/10">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-white dark:bg-purple-400">
          <Bell className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Notification"}
        </span>
        {/* Delete button visible on hover */}
        <button
          className="hidden h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:flex group-hover:opacity-100"
          aria-label="Delete node"
          data-delete-node={id}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Node Body */}
      <div className="px-3 py-2">
        {/* Priority Badge */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Priority
          </span>
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5",
              priorityConfig.className
            )}
          >
            <PriorityIcon className="h-3 w-3" />
            <span className="text-[10px] font-medium">
              {NOTIFICATION_PRIORITY_LABELS[priority]}
            </span>
          </div>
        </div>

        {/* Channels */}
        <div className="mb-2">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            Channels
          </span>
          {renderChannels()}
        </div>

        {/* Message Preview */}
        <div className="rounded-md bg-muted/30 p-2">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            Message
          </span>
          <p className="text-xs text-foreground/80 line-clamp-2">
            {getTruncatedMessage()}
          </p>
        </div>
      </div>

      {/* Output Handle - positioned on the right side (for chaining multiple notifications) */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!h-3 !w-3 !border-2 !border-purple-500 !bg-background",
          "dark:!border-purple-400"
        )}
      />
    </div>
  );
}

NotificationNode.displayName = "NotificationNode";

export default NotificationNode;
