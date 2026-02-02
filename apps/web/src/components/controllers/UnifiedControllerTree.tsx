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
import type { ControllerWithRoom, LiveSensor } from "@/types";

// ============================================
// Types
// ============================================

interface UnifiedControllerTreeProps {
  controllers: ControllerWithRoom[];
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onAssignRoom: (controller: ControllerWithRoom) => void;
  /** Live sensor data from Direct API (bypasses database) */
  liveSensors?: LiveSensor[];
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
  liveSensors,
}: UnifiedControllerTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Create maps for looking up LiveSensor by ID or name
  const liveSensorById = new Map<string, LiveSensor>();
  const liveSensorByName = new Map<string, LiveSensor>();
  if (liveSensors) {
    for (const sensor of liveSensors) {
      liveSensorById.set(sensor.id, sensor);
      // Also index by name (lowercased) as fallback
      liveSensorByName.set(sensor.name.toLowerCase().trim(), sensor);
    }
  }

  // Helper to find matching live sensor for a controller
  const findLiveSensor = (controller: ControllerWithRoom): LiveSensor | undefined => {
    // Try exact ID match first
    const byId = liveSensorById.get(controller.controller_id);
    if (byId) return byId;
    
    // Fall back to name match
    const byName = liveSensorByName.get(controller.name.toLowerCase().trim());
    if (byName) return byName;
    
    return undefined;
  };

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
          liveSensor={findLiveSensor(controller)}
        />
      ))}
    </div>
  );
}
