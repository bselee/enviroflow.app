/**
 * use-bulk-selection Hook
 *
 * Reusable hook for managing bulk selection state with support for:
 * - Individual item selection
 * - Select all / clear all
 * - Shift+Click range selection
 * - Keyboard shortcuts (Cmd/Ctrl+A)
 *
 * Generic implementation that works with any item type.
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface UseBulkSelectionOptions<T> {
  /** Array of items available for selection */
  items: T[];
  /** Function to extract unique key from each item */
  getKey: (item: T) => string;
  /** Initial selected item IDs */
  initialSelected?: Set<string>;
  /** Enable keyboard shortcuts (default: true) */
  enableKeyboardShortcuts?: boolean;
}

export interface UseBulkSelectionReturn<T> {
  /** Set of selected item IDs */
  selectedIds: Set<string>;
  /** Number of selected items */
  selectedCount: number;
  /** Check if a specific item is selected */
  isSelected: (id: string) => boolean;
  /** Check if all items are selected */
  isAllSelected: boolean;
  /** Check if some (but not all) items are selected */
  isIndeterminate: boolean;
  /** Toggle selection of a single item */
  toggleItem: (id: string, event?: React.MouseEvent) => void;
  /** Select all items */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Select a range of items between two IDs */
  selectRange: (fromId: string, toId: string) => void;
  /** Get array of selected items */
  getSelectedItems: () => T[];
  /** Set selected IDs directly */
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useBulkSelection<T>({
  items,
  getKey,
  initialSelected = new Set<string>(),
  enableKeyboardShortcuts = true,
}: UseBulkSelectionOptions<T>): UseBulkSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelected);
  const lastSelectedIdRef = useRef<string | null>(null);

  // Calculate derived state
  const selectedCount = selectedIds.size;
  const isAllSelected = items.length > 0 && selectedIds.size === items.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < items.length;

  // Check if a specific item is selected
  const isSelected = useCallback(
    (id: string): boolean => {
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  // Select a range of items between two IDs
  const selectRange = useCallback(
    (fromId: string, toId: string) => {
      const fromIndex = items.findIndex((item) => getKey(item) === fromId);
      const toIndex = items.findIndex((item) => getKey(item) === toId);

      if (fromIndex === -1 || toIndex === -1) return;

      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(getKey(items[i]));
        }
        return next;
      });

      lastSelectedIdRef.current = toId;
    },
    [items, getKey]
  );

  // Toggle selection of a single item
  const toggleItem = useCallback(
    (id: string, event?: React.MouseEvent) => {
      // Handle Shift+Click for range selection
      if (event?.shiftKey && lastSelectedIdRef.current) {
        selectRange(lastSelectedIdRef.current, id);
        return;
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          // If deselecting, don't update lastSelectedId
        } else {
          next.add(id);
          lastSelectedIdRef.current = id;
        }
        return next;
      });
    },
    [selectRange]
  );

  // Select all items
  const selectAll = useCallback(() => {
    const allIds = new Set(items.map(getKey));
    setSelectedIds(allIds);
    if (items.length > 0) {
      lastSelectedIdRef.current = getKey(items[items.length - 1]);
    }
  }, [items, getKey]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIdRef.current = null;
  }, []);

  // Get array of selected items
  const getSelectedItems = useCallback((): T[] => {
    return items.filter((item) => selectedIds.has(getKey(item)));
  }, [items, getKey, selectedIds]);

  // Keyboard shortcuts handler
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl+A to select all
      if ((event.metaKey || event.ctrlKey) && event.key === "a") {
        // Only intercept if not in an input/textarea
        const target = event.target as HTMLElement;
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          !target.isContentEditable
        ) {
          event.preventDefault();
          selectAll();
        }
      }

      // Escape to clear selection
      if (event.key === "Escape" && selectedIds.size > 0) {
        event.preventDefault();
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcuts, selectAll, clearSelection, selectedIds.size]);

  // Clear selection when items array changes significantly
  // (but preserve selection for items that still exist)
  useEffect(() => {
    setSelectedIds((prev) => {
      const itemIds = new Set(items.map(getKey));
      const filtered = new Set(
        Array.from(prev).filter((id) => itemIds.has(id))
      );
      // Only update if something changed
      return filtered.size !== prev.size ? filtered : prev;
    });
  }, [items, getKey]);

  return {
    selectedIds,
    selectedCount,
    isSelected,
    isAllSelected,
    isIndeterminate,
    toggleItem,
    selectAll,
    clearSelection,
    selectRange,
    getSelectedItems,
    setSelectedIds,
  };
}
