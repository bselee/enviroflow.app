/**
 * Sensor History Save Cron Endpoint
 *
 * GET /api/cron/save-history - Fetch live sensor data and save to history
 *
 * Vercel Cron runs every 5 minutes (see vercel.json)
 *
 * This endpoint:
 * 1. Fetches live sensor data from AC Infinity API
 * 2. Saves readings to sensor_readings table (if Supabase is configured)
 * 3. Returns summary of what was saved
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

// Lazy Supabase client
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

// ============================================
// Types (matching AC Infinity API response format)
// ============================================

interface ACInfinityDevice {
  devId: string;
  devName: string;
  devType: number;
  online: number;  // 1 = online, 0 = offline
  devTimeZone?: string;
  // Sensor data at device level (in hundredths)
  temperature?: number;  // Hundredths of Fahrenheit
  humidity?: number;     // Hundredths of percent
  vpd?: number;          // Hundredths of kPa
}

interface ACInfinityResponse {
  code: number;
  msg: string;
  data: ACInfinityDevice[];  // Flat array of devices
}

// ============================================
// Logging Utility
// ============================================

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const prefix = `[SaveHistoryCron][${timestamp}]`;

  if (level === 'error') {
    console.error(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  } else {
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// ============================================
// Main Endpoint
// ============================================

/**
 * GET /api/cron/save-history
 * Fetch live sensor data and save to history
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret (optional - only if configured)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        log('warn', 'Unauthorized cron request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log('info', 'Supabase not configured, skipping history save');
      return NextResponse.json({
        success: true,
        message: 'Supabase not configured, skipping history save',
        saved: 0,
        duration: Date.now() - startTime
      });
    }

    // Check if AC Infinity token is configured
    const acInfinityToken = process.env.AC_INFINITY_TOKEN;
    if (!acInfinityToken) {
      log('info', 'AC_INFINITY_TOKEN not configured, skipping history save');
      return NextResponse.json({
        success: true,
        message: 'AC_INFINITY_TOKEN not configured, skipping history save',
        saved: 0,
        duration: Date.now() - startTime
      });
    }

    // Fetch data from AC Infinity API
    // Note: AC Infinity API uses HTTP (no SSL cert on their API server)
    // Consistent with adapter: http://www.acinfinityserver.com
    log('info', 'Fetching live sensor data from AC Infinity API');

    const response = await fetch('http://www.acinfinityserver.com/api/user/devInfoListAll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Token': acInfinityToken,
        'User-Agent': 'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4',
      },
      body: `userId=${acInfinityToken}`,
    });

    if (!response.ok) {
      throw new Error(`AC Infinity API error: ${response.status} ${response.statusText}`);
    }

    const apiData = await response.json() as ACInfinityResponse;

    // AC Infinity API uses code 200 for success
    if (apiData.code !== 200 || !apiData.data) {
      throw new Error(`AC Infinity API returned error code: ${apiData.code} - ${apiData.msg}`);
    }

    const devices = apiData.data;
    log('info', `Fetched ${devices.length} devices from AC Infinity API`);

    if (devices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No devices found',
        saved: 0,
        duration: Date.now() - startTime
      });
    }

    // Get Supabase client
    const supabase = getSupabase();

    // Get all AC Infinity controllers from database to map device IDs to controller IDs
    const { data: controllers, error: controllerError } = await supabase
      .from('controllers')
      .select('id, controller_id, name, brand')
      .eq('brand', 'ac_infinity');

    if (controllerError) {
      throw new Error(`Failed to fetch controllers: ${controllerError.message}`);
    }

    if (!controllers || controllers.length === 0) {
      log('info', 'No AC Infinity controllers found in database');
      return NextResponse.json({
        success: true,
        message: 'No AC Infinity controllers registered',
        saved: 0,
        duration: Date.now() - startTime
      });
    }

    // Create device ID to controller ID map
    const deviceToControllerMap = new Map<string, { id: string; name: string }>();
    for (const controller of controllers) {
      deviceToControllerMap.set(controller.controller_id, {
        id: controller.id,
        name: controller.name
      });
    }

    // Prepare sensor readings for insertion
    // Note: AC Infinity API returns values in hundredths (e.g., 7500 = 75.00°F)
    const readings = [];
    const timestamp = new Date().toISOString();

    for (const device of devices) {
      // Skip devices not in our database
      const controller = deviceToControllerMap.get(device.devId);
      if (!controller) {
        continue;
      }

      // Extract sensor readings (convert from hundredths)
      if (device.temperature !== undefined) {
        readings.push({
          controller_id: controller.id,
          port: null,
          sensor_type: 'temperature',
          value: device.temperature / 100,  // Convert from hundredths
          unit: '°F',
          is_stale: false,
          recorded_at: timestamp
        });
      }

      if (device.humidity !== undefined) {
        readings.push({
          controller_id: controller.id,
          port: null,
          sensor_type: 'humidity',
          value: device.humidity / 100,  // Convert from hundredths
          unit: '%',
          is_stale: false,
          recorded_at: timestamp
        });
      }

      if (device.vpd !== undefined) {
        readings.push({
          controller_id: controller.id,
          port: null,
          sensor_type: 'vpd',
          value: device.vpd / 100,  // Convert from hundredths
          unit: 'kPa',
          is_stale: false,
          recorded_at: timestamp
        });
      }
    }

    if (readings.length === 0) {
      log('info', 'No sensor readings to save');
      return NextResponse.json({
        success: true,
        message: 'No sensor readings found',
        saved: 0,
        duration: Date.now() - startTime
      });
    }

    // Insert readings into database
    log('info', `Inserting ${readings.length} sensor readings into database`);

    const { error: insertError } = await supabase
      .from('sensor_readings')
      .insert(readings);

    if (insertError) {
      throw new Error(`Failed to insert sensor readings: ${insertError.message}`);
    }

    log('info', `Successfully saved ${readings.length} sensor readings`);

    return NextResponse.json({
      success: true,
      message: `Saved ${readings.length} sensor readings from ${devices.length} devices`,
      saved: readings.length,
      devices: devices.length,
      duration: Date.now() - startTime
    });

  } catch (error) {
    log('error', 'Cron execution error', { error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      saved: 0,
      duration: Date.now() - startTime
    }, { status: 500 });
  }
}
