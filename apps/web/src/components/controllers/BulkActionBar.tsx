/**
 * BulkActionBar Component
 *
 * Floating action bar that appears when controllers are selected.
 * Provides bulk operations: Delete, Assign to Room, Test Connection.
 *
 * Features:
 * - Sticky bottom positioning on desktop
 * - Selection count display
 * - Quick clear all action
 * - Responsive mobile layout
 * - Modal-based bulk operations with enhanced UX
 */
"use client";

import { useState } from "react";
import { X, Trash2, Home, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BulkAssignModal } from "./BulkAssignModal";
import { BulkTestModal } from "./BulkTestModal";
import { BulkDeleteModal } from "./BulkDeleteModal";
import type { Controller, RoomBasic } from "@/types";

interface BulkActionBarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Total number of items */
  totalCount: number;
  /** Array of selected controllers */
  selectedControllers: Controller[];
  /** Available rooms for assignment */
  rooms: RoomBasic[];
  /** Callback to clear selection */
  onClearSelection: () => void;
  /** Callback when operations complete successfully */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  selectedControllers,
  rooms,
  onClearSelection,
  onSuccess,
  className,
}: BulkActionBarProps) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Don't render if no selection
  if (selectedCount === 0) return null;

  const handleSuccess = () => {
    onClearSelection();
    onSuccess?.();
  };

  return (
    <>
      {/* Floating action bar */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          "shadow-lg transition-all duration-200 ease-in-out",
          className
        )}
      >
        <div className="container mx-auto px-4 py-3 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            {/* Selection info */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearSelection}
                className="h-8 w-8 shrink-0"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-sm font-medium">
                  {selectedCount} of {totalCount} selected
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {selectedCount === totalCount ? "All controllers" : "controllers"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Mobile: Show icons only */}
              <div className="flex items-center gap-1 sm:hidden">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAssignModal(true)}
                  className="h-8 w-8"
                  title="Assign to Room"
                >
                  <Home className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowTestModal(true)}
                  className="h-8 w-8"
                  title="Test Connection"
                >
                  <Wifi className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowDeleteModal(true)}
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Desktop: Show full buttons */}
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssignModal(true)}
                  className="h-9"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Assign to Room
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTestModal(true)}
                  className="h-9"
                >
                  <Wifi className="h-4 w-4 mr-2" />
                  Test Connections
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                  className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer to prevent content from being hidden behind the bar */}
      <div className="h-16" aria-hidden="true" />

      {/* Bulk operation modals */}
      <BulkAssignModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        selectedControllers={selectedControllers}
        rooms={rooms}
        onSuccess={handleSuccess}
      />

      <BulkTestModal
        open={showTestModal}
        onOpenChange={setShowTestModal}
        selectedControllers={selectedControllers}
        onSuccess={onSuccess}
      />

      <BulkDeleteModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        selectedControllers={selectedControllers}
        onSuccess={handleSuccess}
      />
    </>
  );
}
