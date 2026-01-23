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
 *   VPDDial,
 *   SensorMetricCard,
 *   RealTimeIndicator,
 *   RoomDetailPanel,
 * } from "@/components/dashboard";
 * ```
 */

// Core room components
export { RoomCard, RoomCardSkeleton } from "./RoomCard";
export { AddRoomCard } from "./AddRoomCard";
export { AddRoomDialog } from "./AddRoomDialog";
export { ActivityLog } from "./ActivityLog";

// New sensor visualization components
export { VPDDial, VPDDialSkeleton } from "./VPDDial";
export type { VPDDialProps } from "./VPDDial";
export { RealTimeIndicator, REALTIME_STATUS_CONFIG } from "./RealTimeIndicator";
export type { RealTimeIndicatorProps } from "./RealTimeIndicator";
export { SensorMetricCard, SensorMetricCardSkeleton } from "./SensorMetricCard";
export type { SensorMetricCardProps } from "./SensorMetricCard";
export { RoomDetailPanel, RoomDetailPanelSkeleton } from "./RoomDetailPanel";
export type { RoomDetailPanelProps, RoomDetailData } from "./RoomDetailPanel";

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

// Other dashboard components
export { KPICards } from "./KPICards";
export { SmartActionCards } from "./SmartActionCards";
export { EnvironmentSnapshot } from "./EnvironmentSnapshot";
export { IntelligentTimeline } from "./IntelligentTimeline";
export { DemoModeTransition } from "./DemoMode";
