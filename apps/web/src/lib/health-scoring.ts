/**
 * Controller Health Scoring System
 *
 * Calculates health scores (0-100) for controllers based on multiple metrics:
 * - Uptime percentage (40%)
 * - Sensor data freshness (30%)
 * - Error rate (20%)
 * - Sync lag (10%)
 */

import { createServerClient } from '@/lib/supabase';
import type { Controller, SensorReading, ActivityLog } from '@/types';

// =============================================================================
// Types
// =============================================================================

export interface HealthMetrics {
  uptimePercent: number;
  freshnessScore: number;
  errorRate: number;
  syncLagScore: number;
  uptimeHours: number;
  totalHours: number;
  latestReadingAge: number | null;
  errorCount: number;
  totalActions: number;
  avgSyncLag: number | null;
}

export interface HealthScore {
  score: number;
  metrics: HealthMetrics;
  calculatedAt: Date;
}

export interface HealthScoreWithController extends HealthScore {
  controllerId: string;
  controllerName: string;
}

export type HealthLevel = 'healthy' | 'warning' | 'critical';

export interface HealthIndicator {
  emoji: string;
  level: HealthLevel;
  color: string;
  bgColor: string;
}

// =============================================================================
// Constants
// =============================================================================

const WEIGHTS = {
  UPTIME: 0.4, // 40%
  FRESHNESS: 0.3, // 30%
  ERROR_RATE: 0.2, // 20%
  SYNC_LAG: 0.1, // 10%
} as const;

const THRESHOLDS = {
  FRESHNESS_EXCELLENT: 5 * 60 * 1000, // 5 minutes
  FRESHNESS_GOOD: 15 * 60 * 1000, // 15 minutes
  FRESHNESS_FAIR: 60 * 60 * 1000, // 1 hour
  SYNC_LAG_EXCELLENT: 2 * 60 * 1000, // 2 minutes
  SYNC_LAG_GOOD: 5 * 60 * 1000, // 5 minutes
  SYNC_LAG_FAIR: 15 * 60 * 1000, // 15 minutes
  HEALTH_EXCELLENT: 90,
  HEALTH_GOOD: 70,
  SCORE_DROP_THRESHOLD: 20,
} as const;

const ANALYSIS_WINDOW_HOURS = 24;

// =============================================================================
// Health Score Calculation
// =============================================================================

/**
 * Calculate uptime score based on controller availability
 */
function calculateUptimeScore(
  controller: Controller,
  activityLogs: ActivityLog[]
): { score: number; uptimeHours: number; totalHours: number } {
  const now = new Date();
  const windowStart = new Date(now.getTime() - ANALYSIS_WINDOW_HOURS * 60 * 60 * 1000);
  const createdAt = new Date(controller.created_at);
  const actualStart = createdAt > windowStart ? createdAt : windowStart;

  const totalHours =
    (now.getTime() - actualStart.getTime()) / (1000 * 60 * 60);

  // Calculate downtime from error status periods
  let downtimeHours = 0;

  // If currently offline or in error state, count time since last_seen
  if (controller.status === 'offline' || controller.status === 'error') {
    const lastSeen = controller.last_seen
      ? new Date(controller.last_seen)
      : actualStart;

    if (lastSeen > actualStart) {
      downtimeHours += (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);
    }
  }

  // Calculate uptime percentage
  const uptimeHours = Math.max(0, totalHours - downtimeHours);
  const uptimePercent = totalHours > 0 ? (uptimeHours / totalHours) * 100 : 0;

  return {
    score: Math.round(uptimePercent),
    uptimeHours,
    totalHours,
  };
}

/**
 * Calculate freshness score based on sensor reading age
 */
function calculateFreshnessScore(sensorReadings: SensorReading[]): {
  score: number;
  latestReadingAge: number | null;
} {
  if (sensorReadings.length === 0) {
    return { score: 0, latestReadingAge: null };
  }

  // Find the most recent reading
  const latestReading = sensorReadings.reduce((latest, reading) => {
    const readingTime = new Date(reading.recorded_at).getTime();
    const latestTime = new Date(latest.recorded_at).getTime();
    return readingTime > latestTime ? reading : latest;
  });

  const now = Date.now();
  const latestReadingAge = now - new Date(latestReading.recorded_at).getTime();

  // Score based on age thresholds
  let score: number;
  if (latestReadingAge <= THRESHOLDS.FRESHNESS_EXCELLENT) {
    score = 100;
  } else if (latestReadingAge <= THRESHOLDS.FRESHNESS_GOOD) {
    // Linear interpolation: 100 -> 80
    const ratio =
      (latestReadingAge - THRESHOLDS.FRESHNESS_EXCELLENT) /
      (THRESHOLDS.FRESHNESS_GOOD - THRESHOLDS.FRESHNESS_EXCELLENT);
    score = 100 - ratio * 20;
  } else if (latestReadingAge <= THRESHOLDS.FRESHNESS_FAIR) {
    // Linear interpolation: 80 -> 50
    const ratio =
      (latestReadingAge - THRESHOLDS.FRESHNESS_GOOD) /
      (THRESHOLDS.FRESHNESS_FAIR - THRESHOLDS.FRESHNESS_GOOD);
    score = 80 - ratio * 30;
  } else {
    // Older than 1 hour: rapidly declining
    const hoursOld = latestReadingAge / (1000 * 60 * 60);
    score = Math.max(0, 50 - hoursOld * 10);
  }

  return {
    score: Math.round(score),
    latestReadingAge,
  };
}

/**
 * Calculate error rate score based on recent activity logs
 */
function calculateErrorScore(activityLogs: ActivityLog[]): {
  score: number;
  errorRate: number;
  errorCount: number;
  totalActions: number;
} {
  const controllerActions = activityLogs.filter(
    (log) =>
      log.action_type === 'device_controlled' ||
      log.action_type === 'sensor_reading'
  );

  const totalActions = controllerActions.length;

  if (totalActions === 0) {
    // No actions = no errors, perfect score
    return { score: 100, errorRate: 0, errorCount: 0, totalActions: 0 };
  }

  const errorCount = controllerActions.filter(
    (log) => log.result === 'failed'
  ).length;

  const errorRate = (errorCount / totalActions) * 100;

  // Invert error rate for score (0% errors = 100 score)
  const score = Math.max(0, 100 - errorRate);

  return {
    score: Math.round(score),
    errorRate,
    errorCount,
    totalActions,
  };
}

/**
 * Calculate sync lag score based on reading timestamps vs recorded_at
 */
function calculateSyncLagScore(sensorReadings: SensorReading[]): {
  score: number;
  avgSyncLag: number | null;
} {
  if (sensorReadings.length === 0) {
    return { score: 100, avgSyncLag: null }; // No data = no lag
  }

  // Calculate average lag between when data was recorded and when we received it
  // This requires the timestamp field (actual sensor time) vs recorded_at (DB insert time)
  const lagsMs: number[] = [];

  sensorReadings.forEach((reading) => {
    if (reading.timestamp) {
      const sensorTime = new Date(reading.timestamp).getTime();
      const dbTime = new Date(reading.recorded_at).getTime();
      const lag = Math.abs(dbTime - sensorTime);
      lagsMs.push(lag);
    }
  });

  if (lagsMs.length === 0) {
    // No timestamp data available, assume good sync
    return { score: 90, avgSyncLag: null };
  }

  const avgSyncLag = lagsMs.reduce((sum, lag) => sum + lag, 0) / lagsMs.length;

  // Score based on lag thresholds
  let score: number;
  if (avgSyncLag <= THRESHOLDS.SYNC_LAG_EXCELLENT) {
    score = 100;
  } else if (avgSyncLag <= THRESHOLDS.SYNC_LAG_GOOD) {
    // Linear interpolation: 100 -> 80
    const ratio =
      (avgSyncLag - THRESHOLDS.SYNC_LAG_EXCELLENT) /
      (THRESHOLDS.SYNC_LAG_GOOD - THRESHOLDS.SYNC_LAG_EXCELLENT);
    score = 100 - ratio * 20;
  } else if (avgSyncLag <= THRESHOLDS.SYNC_LAG_FAIR) {
    // Linear interpolation: 80 -> 60
    const ratio =
      (avgSyncLag - THRESHOLDS.SYNC_LAG_GOOD) /
      (THRESHOLDS.SYNC_LAG_FAIR - THRESHOLDS.SYNC_LAG_GOOD);
    score = 80 - ratio * 20;
  } else {
    // Poor sync: declining score
    const minutesLag = avgSyncLag / (1000 * 60);
    score = Math.max(0, 60 - minutesLag * 2);
  }

  return {
    score: Math.round(score),
    avgSyncLag,
  };
}

/**
 * Calculate overall health score for a controller
 */
export async function calculateHealthScore(
  controller: Controller
): Promise<HealthScore> {
  const supabase = createServerClient();
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - ANALYSIS_WINDOW_HOURS * 60 * 60 * 1000
  );

  // Fetch sensor readings for the analysis window
  const { data: sensorReadings } = await supabase
    .from('sensor_readings')
    .select('*')
    .eq('controller_id', controller.id)
    .gte('recorded_at', windowStart.toISOString())
    .order('recorded_at', { ascending: false });

  // Fetch activity logs for the analysis window
  const { data: activityLogs } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('controller_id', controller.id)
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: false });

  // Calculate individual component scores
  const uptime = calculateUptimeScore(controller, activityLogs || []);
  const freshness = calculateFreshnessScore(sensorReadings || []);
  const error = calculateErrorScore(activityLogs || []);
  const syncLag = calculateSyncLagScore(sensorReadings || []);

  // Calculate weighted overall score
  const overallScore = Math.round(
    uptime.score * WEIGHTS.UPTIME +
      freshness.score * WEIGHTS.FRESHNESS +
      error.score * WEIGHTS.ERROR_RATE +
      syncLag.score * WEIGHTS.SYNC_LAG
  );

  const metrics: HealthMetrics = {
    uptimePercent: uptime.score,
    freshnessScore: freshness.score,
    errorRate: error.errorRate,
    syncLagScore: syncLag.score,
    uptimeHours: uptime.uptimeHours,
    totalHours: uptime.totalHours,
    latestReadingAge: freshness.latestReadingAge,
    errorCount: error.errorCount,
    totalActions: error.totalActions,
    avgSyncLag: syncLag.avgSyncLag,
  };

  return {
    score: overallScore,
    metrics,
    calculatedAt: now,
  };
}

/**
 * Calculate health scores for all controllers of a user
 */
export async function calculateAllHealthScores(
  userId: string
): Promise<HealthScoreWithController[]> {
  const supabase = createServerClient();

  // Fetch all controllers for the user
  const { data: controllers, error } = await supabase
    .from('controllers')
    .select('*')
    .eq('user_id', userId);

  if (error || !controllers) {
    console.error('Error fetching controllers:', error);
    return [];
  }

  // Calculate health score for each controller
  const healthScores = await Promise.all(
    controllers.map(async (controller) => {
      const healthScore = await calculateHealthScore(controller);
      return {
        ...healthScore,
        controllerId: controller.id,
        controllerName: controller.name,
      };
    })
  );

  return healthScores;
}

// =============================================================================
// Health Indicators
// =============================================================================

/**
 * Get health indicator based on score
 */
export function getHealthIndicator(score: number): HealthIndicator {
  if (score >= THRESHOLDS.HEALTH_EXCELLENT) {
    return {
      emoji: '🟢',
      level: 'healthy',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    };
  } else if (score >= THRESHOLDS.HEALTH_GOOD) {
    return {
      emoji: '🟡',
      level: 'warning',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    };
  } else {
    return {
      emoji: '🔴',
      level: 'critical',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    };
  }
}

/**
 * Get health description based on level
 */
export function getHealthDescription(level: HealthLevel): string {
  switch (level) {
    case 'healthy':
      return 'All systems operational';
    case 'warning':
      return 'Minor issues detected';
    case 'critical':
      return 'Immediate attention required';
  }
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Save health score to database
 */
export async function saveHealthScore(
  controllerId: string,
  healthScore: HealthScore
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient();

  const { error } = await supabase.from('controller_health').insert({
    controller_id: controllerId,
    score: healthScore.score,
    metrics_snapshot: healthScore.metrics,
    calculated_at: healthScore.calculatedAt.toISOString(),
  });

  if (error) {
    console.error('Error saving health score:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get latest health score from database
 */
export async function getLatestHealthScore(
  controllerId: string
): Promise<HealthScore | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('controller_health')
    .select('*')
    .eq('controller_id', controllerId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    score: data.score,
    metrics: data.metrics_snapshot as HealthMetrics,
    calculatedAt: new Date(data.calculated_at),
  };
}

/**
 * Detect sudden health score drops
 */
export async function detectHealthScoreDrop(
  controllerId: string
): Promise<{
  dropped: boolean;
  currentScore: number | null;
  previousScore: number | null;
  dropAmount: number | null;
}> {
  const supabase = createServerClient();

  // Get the two most recent health scores
  const { data, error } = await supabase
    .from('controller_health')
    .select('score, calculated_at')
    .eq('controller_id', controllerId)
    .order('calculated_at', { ascending: false })
    .limit(2);

  if (error || !data || data.length < 2) {
    return {
      dropped: false,
      currentScore: data?.[0]?.score || null,
      previousScore: null,
      dropAmount: null,
    };
  }

  const currentScore = data[0].score;
  const previousScore = data[1].score;
  const dropAmount = previousScore - currentScore;

  return {
    dropped: dropAmount > THRESHOLDS.SCORE_DROP_THRESHOLD,
    currentScore,
    previousScore,
    dropAmount,
  };
}
