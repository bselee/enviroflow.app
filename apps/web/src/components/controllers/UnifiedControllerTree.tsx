"use client";

/**
 * UnifiedControllerTree Component
 *
 * Main component that renders all controllers in an expandable tree structure.
 * Each controller can be expanded to show its connected devices with inline controls.
 * Expansion state is persisted in localStorage.
 */

import { useState, useEffect, useCallback } from "react";
import { ControllerTreeItem } from "./ControllerTreeItem";
import type { ControllerWithRoom } from "@/types";

// ============================================
// Types
// ============================================

interface UnifiedControllerTreeProps {
  controllers: ControllerWithRoom[];
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onAssignRoom: (controller: ControllerWithRoom) => void;
}

// Storage key for persisted expand state
const STORAGE_KEY = "enviroflow-expanded-controllers";

// ============================================
// Component
// ============================================

export function UnifiedControllerTree({
  controllers,
  onRefresh,
  onDelete,
  onAssignRoom,
}: UnifiedControllerTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Load persisted expand state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
          setExpandedIds(new Set(ids));
        }
      }
    } catch (err) {
      console.warn("[UnifiedControllerTree] Failed to load expand state:", err);
    }
    setIsInitialized(true);
  }, []);

  // Persist expand state to localStorage
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...expandedIds]));
    } catch (err) {
      console.warn("[UnifiedControllerTree] Failed to save expand state:", err);
    }
  }, [expandedIds, isInitialized]);

  const handleToggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Don't render until we've loaded persisted state to avoid flicker
  if (!isInitialized) {
    return null;
  }

  return (
    <div className="space-y-3">
      {controllers.map((controller, index) => (
        <ControllerTreeItem
          key={controller.id}
          controller={controller}
          isExpanded={expandedIds.has(controller.id)}
          onToggleExpanded={handleToggleExpanded}
          onDelete={onDelete}
          onAssignRoom={onAssignRoom}
          onRefresh={onRefresh}
          index={index}
        />
      ))}
    </div>
  );
}
