/**
 * Dashboard Components Index
 *
 * Re-exports all dashboard-related components for convenient importing.
 *
 * @example
 * ```tsx
 * import {
 *   RoomCard,
 *   RoomCardSkeleton,
 *   AddRoomCard,
 *   AddRoomDialog,
 *   ActivityLog,
 *   DashboardContent,
 *   ViewModeSelector,
 * } from "@/components/dashboard";
 * ```
 */

// Core room components
export { RoomCard, RoomCardSkeleton } from "./RoomCard";
export { AddRoomCard } from "./AddRoomCard";
export { AddRoomDialog } from "./AddRoomDialog";
export { ActivityLog } from "./ActivityLog";

// View mode system
export {
  DashboardContent,
  ViewModeSelector,
  useViewMode,
  PrimaryMiniLayout,
  GridLayout,
  GridLayoutSkeleton,
  CarouselLayout,
  SplitScreenLayout,
} from "./DashboardContent";
export type { ViewMode } from "./ViewModeSelector";

// Layout components (direct access if needed)
export { PrimaryMiniLayout as PrimaryMiniLayoutDirect } from "./layouts/PrimaryMiniLayout";
export { GridLayout as GridLayoutDirect, GridLayoutSkeleton as GridLayoutSkeletonDirect } from "./layouts/GridLayout";
export { CarouselLayout as CarouselLayoutDirect } from "./layouts/CarouselLayout";
export { SplitScreenLayout as SplitScreenLayoutDirect } from "./layouts/SplitScreenLayout";
