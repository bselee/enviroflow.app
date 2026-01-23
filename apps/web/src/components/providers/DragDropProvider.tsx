'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Drag-drop context value.
 */
interface DragDropContextType {
  /** Array of card IDs in display order, null if using default order */
  cardOrder: string[] | null;
  /** Set the card order */
  setCardOrder: (order: string[] | null) => void;
  /** Initialize card order from a list of room IDs */
  initializeOrder: (roomIds: string[]) => void;
  /** Index of the card currently being dragged */
  draggedCard: number | null;
  /** Set the dragged card index */
  setDraggedCard: (index: number | null) => void;
  /** Index of the card being dragged over */
  dragOverCard: number | null;
  /** Set the drag over card index */
  setDragOverCard: (index: number | null) => void;
  /** Whether edit mode is active (allows reordering) */
  isEditing: boolean;
  /** Toggle edit mode */
  setIsEditing: (editing: boolean) => void;
  /** Toggle edit mode on/off */
  toggleEditing: () => void;
  /** Reorder cards by moving from one index to another */
  reorderCards: (fromIndex: number, toIndex: number) => void;
  /** Reset card order to default */
  resetOrder: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'enviroflow-card-order';

// =============================================================================
// Context
// =============================================================================

const DragDropContext = createContext<DragDropContextType | undefined>(undefined);

// =============================================================================
// Provider Component
// =============================================================================

/**
 * DragDropProvider Component
 *
 * Provides drag-drop state management for reordering room cards:
 * - Tracks card order with localStorage persistence
 * - Manages drag state (which card is being dragged, which is being hovered)
 * - Provides edit mode toggle for enabling/disabling reordering
 * - Handles reordering logic
 *
 * @example
 * ```tsx
 * // In layout.tsx
 * <DragDropProvider>
 *   {children}
 * </DragDropProvider>
 *
 * // In RoomCard component
 * const { isEditing, draggedCard, setDraggedCard, reorderCards } = useDragDrop();
 * ```
 */
export function DragDropProvider({ children }: { children: ReactNode }): JSX.Element {
  const [cardOrder, setCardOrderState] = useState<string[] | null>(null);
  const [draggedCard, setDraggedCard] = useState<number | null>(null);
  const [dragOverCard, setDragOverCard] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Load saved order from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCardOrderState(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load card order from localStorage:', error);
    }
  }, []);

  // Persist order to localStorage when it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (cardOrder !== null) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cardOrder));
      } catch (error) {
        console.error('Failed to save card order to localStorage:', error);
      }
    }
  }, [cardOrder]);

  /**
   * Set card order directly.
   */
  const setCardOrder = useCallback((order: string[] | null) => {
    setCardOrderState(order);
  }, []);

  /**
   * Initialize card order from a list of room IDs.
   * Only sets the order if it hasn't been set yet or if the saved order
   * doesn't match the current rooms.
   */
  const initializeOrder = useCallback((roomIds: string[]) => {
    setCardOrderState((current) => {
      if (current === null) {
        // No saved order, use provided order
        return roomIds;
      }

      // Check if current order contains all room IDs
      const currentSet = new Set(current);
      const newSet = new Set(roomIds);

      // If rooms have changed, merge: keep existing order for known rooms,
      // add new rooms at the end, remove deleted rooms
      const hasChanges =
        roomIds.some((id) => !currentSet.has(id)) ||
        current.some((id) => !newSet.has(id));

      if (hasChanges) {
        // Keep existing rooms in their current order, add new ones at end
        const existing = current.filter((id) => newSet.has(id));
        const newRooms = roomIds.filter((id) => !currentSet.has(id));
        return [...existing, ...newRooms];
      }

      return current;
    });
  }, []);

  /**
   * Toggle edit mode.
   */
  const toggleEditing = useCallback(() => {
    setIsEditing((current) => !current);
    // Clear drag state when exiting edit mode
    setDraggedCard(null);
    setDragOverCard(null);
  }, []);

  /**
   * Reorder cards by moving a card from one index to another.
   */
  const reorderCards = useCallback((fromIndex: number, toIndex: number) => {
    setCardOrderState((current) => {
      if (current === null) return current;
      if (fromIndex === toIndex) return current;
      if (fromIndex < 0 || fromIndex >= current.length) return current;
      if (toIndex < 0 || toIndex >= current.length) return current;

      const newOrder = [...current];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);

      return newOrder;
    });
  }, []);

  /**
   * Reset card order to default (null).
   */
  const resetOrder = useCallback(() => {
    setCardOrderState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <DragDropContext.Provider
      value={{
        cardOrder,
        setCardOrder,
        initializeOrder,
        draggedCard,
        setDraggedCard,
        dragOverCard,
        setDragOverCard,
        isEditing,
        setIsEditing,
        toggleEditing,
        reorderCards,
        resetOrder,
      }}
    >
      {children}
    </DragDropContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access drag-drop context.
 *
 * @throws Error if used outside of DragDropProvider
 *
 * @example
 * ```tsx
 * function RoomCard({ room, index }: Props) {
 *   const {
 *     isEditing,
 *     draggedCard,
 *     setDraggedCard,
 *     setDragOverCard,
 *     reorderCards,
 *   } = useDragDrop();
 *
 *   const isDragging = draggedCard === index;
 *
 *   return (
 *     <div
 *       draggable={isEditing}
 *       onDragStart={() => setDraggedCard(index)}
 *       onDrop={() => {
 *         if (draggedCard !== null) {
 *           reorderCards(draggedCard, index);
 *         }
 *       }}
 *     >
 *       {room.name}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDragDrop(): DragDropContextType {
  const context = useContext(DragDropContext);

  if (context === undefined) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }

  return context;
}
