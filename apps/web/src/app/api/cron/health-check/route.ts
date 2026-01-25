/**
 * Controller Health Check Cron Endpoint
 *
 * GET /api/cron/health-check - Calculate health scores for all controllers (called by Vercel Cron)
 *
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/health-check",
 *     "schedule": "0 * * * *"  // Every hour
 *   }]
 * }
 *
 * This endpoint:
 * 1. Fetches all controllers across all users
 * 2. Calculates health scores for each controller
 * 3. Saves scores to controller_health table
 * 4. Detects sudden score drops (>20 points)
 * 5. Triggers alerts for critical health drops
 * 6. Cleans up old health data (>7 days)
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  calculateHealthScore,
  saveHealthScore,
  detectHealthScoreDrop,
  getHealthIndicator,
} from '@/lib/health-scoring';
import type { Controller } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

// Lazy Supabase client (service role for cron jobs)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Supabase credentials not configured');
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

// =============================================================================
// Alert System
// =============================================================================

interface HealthAlert {
  controllerId: string;
  controllerName: string;
  userId: string;
  currentScore: number;
  previousScore: number;
  dropAmount: number;
}

/**
 * Create an activity log entry for health alerts
 */
async function logHealthAlert(
  alert: HealthAlert,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert({
    user_id: alert.userId,
    controller_id: alert.controllerId,
    action_type: 'alert_triggered',
    action_data: {
      alert_type: 'health_score_drop',
      controller_name: alert.controllerName,
      current_score: alert.currentScore,
      previous_score: alert.previousScore,
      drop_amount: alert.dropAmount,
      severity: alert.currentScore < 70 ? 'critical' : 'warning',
    },
    result: 'success',
  });

  if (error) {
    console.error('Error logging health alert:', error);
  }
}

/**
 * Create AI insight for health degradation
 */
async function createHealthInsight(
  alert: HealthAlert,
  metrics: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<void> {
  const indicator = getHealthIndicator(alert.currentScore);

  // Determine likely cause based on metrics
  let likelyCause = 'Unknown issue';
  if (metrics.freshnessScore && typeof metrics.freshnessScore === 'number' && metrics.freshnessScore < 50) {
    likelyCause = 'Stale sensor data - controller may not be reporting';
  } else if (metrics.errorRate && typeof metrics.errorRate === 'number' && metrics.errorRate > 20) {
    likelyCause = 'High error rate in recent operations';
  } else if (metrics.uptimePercent && typeof metrics.uptimePercent === 'number' && metrics.uptimePercent < 80) {
    likelyCause = 'Low uptime - controller frequently offline';
  } else if (metrics.syncLagScore && typeof metrics.syncLagScore === 'number' && metrics.syncLagScore < 60) {
    likelyCause = 'High sync lag - network or communication issues';
  }

  const { error } = await supabase.from('ai_insights').insert({
    user_id: alert.userId,
    controller_id: alert.controllerId,
    insight_type: 'health_alert',
    insight_data: {
      message: `Controller "${alert.controllerName}" health dropped from ${alert.previousScore} to ${alert.currentScore} (${indicator.emoji} ${indicator.level})`,
      likely_cause: likelyCause,
      current_score: alert.currentScore,
      previous_score: alert.previousScore,
      drop_amount: alert.dropAmount,
      metrics,
    },
    confidence: 0.85,
    source: 'health_monitoring_system',
  });

  if (error) {
    console.error('Error creating health insight:', error);
  }
}

// =============================================================================
// Main Cron Handler
// =============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret (REQUIRED for security)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();

    // Step 1: Fetch all controllers
    const { data: controllers, error: controllerError } = await supabase
      .from('controllers')
      .select('*')
      .order('created_at', { ascending: false });

    if (controllerError) {
      throw new Error(`Failed to fetch controllers: ${controllerError.message}`);
    }

    if (!controllers || controllers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No controllers to check',
        processed: 0,
        alerts: 0,
        duration: Date.now() - startTime,
      });
    }

    // Step 2: Calculate health scores for all controllers
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      alerts: [] as HealthAlert[],
      errors: [] as string[],
    };

    for (const controller of controllers as Controller[]) {
      try {
        results.processed++;

        // Calculate health score
        const healthScore = await calculateHealthScore(controller);

        // Save to database
        const saveResult = await saveHealthScore(controller.id, healthScore);

        if (!saveResult.success) {
          results.failed++;
          results.errors.push(
            `Failed to save health score for ${controller.name}: ${saveResult.error}`
          );
          continue;
        }

        results.succeeded++;

        // Detect score drops
        const dropDetection = await detectHealthScoreDrop(controller.id);

        if (dropDetection.dropped && dropDetection.currentScore !== null && dropDetection.previousScore !== null && dropDetection.dropAmount !== null) {
          const alert: HealthAlert = {
            controllerId: controller.id,
            controllerName: controller.name,
            userId: controller.user_id,
            currentScore: dropDetection.currentScore,
            previousScore: dropDetection.previousScore,
            dropAmount: dropDetection.dropAmount,
          };

          results.alerts.push(alert);

          // Log the alert
          await logHealthAlert(alert, supabase);

          // Create AI insight
          await createHealthInsight(alert, healthScore.metrics as unknown as Record<string, unknown>, supabase);

          console.log(
            `HEALTH ALERT: ${controller.name} dropped from ${dropDetection.previousScore} to ${dropDetection.currentScore} (-${dropDetection.dropAmount})`
          );
        }
      } catch (error) {
        results.failed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Error processing ${controller.name}: ${errorMessage}`);
        console.error(`Error processing controller ${controller.id}:`, error);
      }
    }

    // Step 3: Cleanup old health data (>7 days)
    try {
      const { data: cleanupResult, error: cleanupError } = await supabase.rpc(
        'cleanup_old_controller_health'
      );

      if (cleanupError) {
        console.error('Error cleaning up old health data:', cleanupError);
      } else {
        console.log(`Cleaned up ${cleanupResult || 0} old health records`);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }

    const duration = Date.now() - startTime;

    // Return summary
    return NextResponse.json({
      success: true,
      message: `Health check complete: ${results.succeeded}/${results.processed} controllers`,
      processed: results.processed,
      succeeded: results.succeeded,
      failed: results.failed,
      alerts: results.alerts.length,
      alertDetails: results.alerts.map((alert) => ({
        controller: alert.controllerName,
        score: alert.currentScore,
        drop: alert.dropAmount,
      })),
      errors: results.errors.length > 0 ? results.errors : undefined,
      duration,
    });
  } catch (error) {
    console.error('Health check cron error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
