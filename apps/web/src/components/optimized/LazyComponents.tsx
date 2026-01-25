/**
 * Lazy-Loaded Components
 *
 * Heavy components that are loaded on-demand to improve initial page load.
 * Each component includes a loading skeleton for better UX.
 */

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// =============================================================================
// Loading Skeletons
// =============================================================================

export function ChartSkeleton() {
  return (
    <div className="relative w-full h-[300px] rounded-lg border bg-card">
      <Skeleton className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading chart...</span>
        </div>
      </div>
    </div>
  )
}

export function WorkflowBuilderSkeleton() {
  return (
    <div className="relative w-full h-[600px] rounded-lg border bg-card">
      <Skeleton className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading workflow builder...</span>
        </div>
      </div>
    </div>
  )
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[200px] w-full rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
    </div>
  )
}

// =============================================================================
// Lazy-Loaded Components
// =============================================================================

/**
 * Sensor Chart - Heavy charting library (Recharts)
 * Used in: Dashboard, Analytics, Room Detail
 */
export const LazySensorChart = dynamic(
  () => import('@/components/charts/SensorChart').then(mod => ({ default: mod.SensorChart })),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Charts don't need SSR
  }
)

/**
 * Workflow Builder - Heavy flow library (@xyflow/react)
 * Used in: Automation Builder
 */
export const LazyWorkflowBuilder = dynamic(
  () => import('@/components/workflow/WorkflowBuilder'),
  {
    loading: () => <WorkflowBuilderSkeleton />,
    ssr: false, // Interactive component, no SSR needed
  }
)

/**
 * MiniSparkline - Lightweight chart for cards
 * Used in: Room Cards, Metric Cards
 */
export const LazyMiniSparkline = dynamic(
  () => import('@/components/charts/MiniSparkline'),
  {
    loading: () => <Skeleton className="h-8 w-full rounded" />,
    ssr: false,
  }
)

/**
 * Intelligent Timeline - Complex data visualization
 * Used in: Dashboard
 */
export const LazyIntelligentTimeline = dynamic(
  () => import('@/components/dashboard/IntelligentTimeline'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

/**
 * Analytics Page - Heavy data processing and charts
 * Used in: Analytics route
 */
export const LazyAnalytics = dynamic(
  () => import('@/app/analytics/page'),
  {
    loading: () => <AnalyticsSkeleton />,
    ssr: false,
  }
)

/**
 * Network Discovery - Complex network scanning component
 * Used in: Controller onboarding
 */
export const LazyNetworkDiscovery = dynamic(
  () => import('@/components/controllers/NetworkDiscovery'),
  {
    loading: () => (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading discovery...</span>
        </div>
      </div>
    ),
    ssr: false,
  }
)

/**
 * VPD Dial - Complex visualization with calculations
 * Used in: Dashboard Environment Snapshot
 */
export const LazyVPDDial = dynamic(
  () => import('@/components/dashboard/VPDDial'),
  {
    loading: () => <Skeleton className="w-[220px] h-[220px] rounded-full mx-auto" />,
    ssr: false,
  }
)

/**
 * Activity Log - Large list with real-time updates
 * Used in: Dashboard
 */
export const LazyActivityLog = dynamic(
  () => import('@/components/dashboard/ActivityLog'),
  {
    loading: () => (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    ),
    ssr: false,
  }
)

/**
 * Settings Sheet - Complex form with multiple sections
 * Used in: Dashboard, globally
 */
export const LazySettingsSheet = dynamic(
  () => import('@/components/settings/SettingsSheet'),
  {
    loading: () => null, // Settings triggered by user, no skeleton needed
    ssr: false,
  }
)

// =============================================================================
// Export All
// =============================================================================

export const LazyComponents = {
  SensorChart: LazySensorChart,
  WorkflowBuilder: LazyWorkflowBuilder,
  MiniSparkline: LazyMiniSparkline,
  IntelligentTimeline: LazyIntelligentTimeline,
  Analytics: LazyAnalytics,
  NetworkDiscovery: LazyNetworkDiscovery,
  VPDDial: LazyVPDDial,
  ActivityLog: LazyActivityLog,
  SettingsSheet: LazySettingsSheet,
}
