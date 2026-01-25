/**
 * HelpTooltip Component
 *
 * Reusable tooltip and help system for form fields and UI elements.
 * Provides contextual help with:
 * - Hover tooltips for quick reference
 * - Click/tap to expand full help modal
 * - External documentation links
 * - Keyboard accessible (Tab, Enter, Escape)
 * - Mobile-friendly (touch and tap support)
 *
 * Usage:
 * ```tsx
 * <Label htmlFor="name">
 *   Controller Name
 *   <HelpTooltip id="controller-name" />
 * </Label>
 * ```
 */

"use client";

import { useState, useCallback } from "react";
import { HelpCircle, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getHelpContent, type HelpContent } from "@/lib/help-content";

export interface HelpTooltipProps {
  /**
   * ID of the help content to display (from help-content.ts registry)
   */
  id: string;

  /**
   * Display variant
   * - "icon": Show help icon only (default)
   * - "text": Show "Help" text with icon
   * - "inline": Show icon inline with surrounding text
   */
  variant?: "icon" | "text" | "inline";

  /**
   * Size of the help icon
   */
  size?: "sm" | "md" | "lg";

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Position of the tooltip relative to the trigger
   */
  side?: "top" | "right" | "bottom" | "left";

  /**
   * Whether to show the full modal on click (default: true)
   */
  showModal?: boolean;

  /**
   * Override content (for custom help not in registry)
   */
  content?: Partial<HelpContent>;
}

const sizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

/**
 * HelpTooltip - Shows contextual help with tooltip and optional modal
 */
export function HelpTooltip({
  id,
  variant = "icon",
  size = "sm",
  className,
  side = "top",
  showModal = true,
  content: customContent,
}: HelpTooltipProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Get help content from registry or use custom content
  const helpContent = customContent
    ? ({ id, ...customContent } as HelpContent)
    : getHelpContent(id);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (showModal) {
        e.preventDefault();
        e.stopPropagation();
        setModalOpen(true);
      }
    },
    [showModal]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showModal && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        e.stopPropagation();
        setModalOpen(true);
      }
    },
    [showModal]
  );

  if (!helpContent) {
    console.warn(`HelpTooltip: No help content found for id "${id}"`);
    return null;
  }

  // Tooltip content - show short description if available, otherwise first 120 chars of description
  const tooltipText =
    helpContent.shortDescription ||
    (helpContent.description.length > 120
      ? `${helpContent.description.slice(0, 120)}...`
      : helpContent.description);

  const iconElement = (
    <HelpCircle
      className={cn(
        sizeClasses[size],
        "text-muted-foreground transition-colors",
        showModal && "cursor-pointer hover:text-foreground"
      )}
    />
  );

  const triggerContent = (
    <div
      className={cn(
        "inline-flex items-center gap-1",
        variant === "inline" ? "" : "ml-1.5",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={showModal ? "button" : undefined}
      tabIndex={showModal ? 0 : undefined}
      aria-label={`Help: ${helpContent.title}`}
    >
      {helpContent.icon && variant !== "icon" && (
        <span className="text-sm">{helpContent.icon}</span>
      )}
      {variant === "text" && (
        <span className="text-xs text-muted-foreground">Help</span>
      )}
      {iconElement}
    </div>
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{triggerContent}</span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p className="text-sm">{tooltipText}</p>
          {showModal && (
            <p className="text-xs text-muted-foreground mt-1">
              Click for more details
            </p>
          )}
        </TooltipContent>
      </Tooltip>

      {showModal && (
        <HelpModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          content={helpContent}
        />
      )}
    </>
  );
}

/**
 * HelpModal - Full help content with links
 */
interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: HelpContent;
}

function HelpModal({ open, onOpenChange, content }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {content.icon && <span className="text-xl">{content.icon}</span>}
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-left pt-2">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        {content.links && content.links.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Learn more:</p>
            <div className="flex flex-col gap-2">
              {content.links.map((link, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="justify-start"
                  asChild
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {link.text}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * InlineHelp - Lightweight inline help text without tooltip
 * Useful for supplementary hints that don't need a modal
 */
export interface InlineHelpProps {
  children: React.ReactNode;
  className?: string;
}

export function InlineHelp({ children, className }: InlineHelpProps) {
  return (
    <p className={cn("text-xs text-muted-foreground mt-1", className)}>
      {children}
    </p>
  );
}
