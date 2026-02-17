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

interface ACInfinityPort {
  port: number;
  portName?: string;
  speak?: number;        // Power level 0-10
  online?: number;       // 1 = online, 0 = offline
  loadType?: number;     // Device type (0=fan, 2=humidifier, 128=light)
  surplus?: number;
}

interface ACInfinityDeviceInfo {
  temperatureF?: number;   // Fahrenheit × 100
  humidity?: number;       // Percentage × 100
  vpdnums?: number;        // kPa × 100
  ports?: ACInfinityPort[];
}

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
  // Full device info (includes ports)
  deviceInfo?: ACInfinityDeviceInfo;
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

  // Deprecated: writing history is now handled by /api/cron/poll-sensors only.
  // Keep this endpoint as a compatibility shim to avoid duplicate writes.
  return NextResponse.json({
    success: true,
    skipped: true,
    message: 'Deprecated endpoint. History writes are handled by /api/cron/poll-sensors.',
    saved: 0,
    duration: Date.now() - startTime
  });

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
    const acInfinityToken = process.env.AC_INFINITY_TOKEN ?? '';
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

    const headers = new Headers({
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4',
    });
    headers.set('token', acInfinityToken);

    const response = await fetch('http://www.acinfinityserver.com/api/user/devInfoListAll', {
      method: 'POST',
      headers,
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
      throw new Error(`Failed to fetch controllers: ${controllerError?.message || 'Unknown error'}`);
    }

    const controllersList = controllers ?? [];

    if (controllersList.length === 0) {
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
    for (const controller of controllersList) {
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
      const controllerId = deviceToControllerMap.get(device.devId)?.id;
      if (!controllerId) {
        continue;
      }

      // Extract sensor readings (convert from hundredths)
      const temperature = device.temperature;
      if (typeof temperature === 'number') {
        readings.push({
          controller_id: controllerId,
          port: null,
          sensor_type: 'temperature',
          value: temperature! / 100,  // Convert from hundredths
          unit: '°F',
          is_stale: false,
          recorded_at: timestamp
        });
      }

      const humidity = device.humidity;
      if (typeof humidity === 'number') {
        readings.push({
          controller_id: controllerId,
          port: null,
          sensor_type: 'humidity',
          value: humidity! / 100,  // Convert from hundredths
          unit: '%',
          is_stale: false,
          recorded_at: timestamp
        });
      }

      const vpd = device.vpd;
      if (typeof vpd === 'number') {
        readings.push({
          controller_id: controllerId,
          port: null,
          sensor_type: 'vpd',
          value: vpd! / 100,  // Convert from hundredths
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
      throw new Error(`Failed to insert sensor readings: ${insertError?.message || 'Unknown error'}`);
    }

    log('info', `Successfully saved ${readings.length} sensor readings`);

    // =========================================================
    // Track Device State Changes (for waveform chart)
    // =========================================================
    // Note: We query the database for previous state instead of using in-memory cache
    // because serverless functions may cold-start and lose the cache.
    let deviceStateChanges = 0;
    const deviceStateRecords = [];

    // Collect all controller IDs we need to query
    const controllerIds = Array.from(new Set(
      devices
        .map(d => deviceToControllerMap.get(d.devId)?.id)
        .filter((id): id is string => !!id)
    ));

    // Fetch the most recent state for each device from the database
    const previousStatesMap = new Map<string, { state: boolean; speed: number }>();
    if (controllerIds.length > 0) {
      // Get the latest state for each controller+port combination
      const { data: latestStates } = await supabase
        .from('device_state_log')
        .select('controller_id, port_number, state, speed')
        .in('controller_id', controllerIds)
        .order('recorded_at', { ascending: false });

      const latestStatesList = latestStates ?? [];

      // Build a map of the most recent state per controller:port
      // Since we ordered by recorded_at desc, the first occurrence for each key is the latest
      for (const entry of latestStatesList) {
        const key = `${entry.controller_id}:${entry.port_number}`;
        if (!previousStatesMap.has(key)) {
          previousStatesMap.set(key, { state: entry.state, speed: entry.speed || 0 });
        }
      }
    }

    for (const device of devices) {
      const controllerId = deviceToControllerMap.get(device.devId)?.id;
      if (!controllerId) continue;

      // Get ports from deviceInfo (preferred) or fallback
      const ports = device.deviceInfo?.ports || [];

      for (const port of ports) {
        const portNum = port.port;
        const portName = port.portName || `Port ${portNum}`;
        const speed = (port.speak || 0) * 10;  // Convert 0-10 to 0-100%
        const state = speed > 0;

        const cacheKey = `${controllerId}:${portNum}`;
        const previousState = previousStatesMap.get(cacheKey);

        // Log if state changed OR if this is the first reading for this device
        const stateChanged =
          previousState === undefined ||
          previousState?.state !== state ||
          previousState?.speed !== speed;

        // Also log periodic snapshots every 15 minutes for waveform chart
        // This ensures continuous activity shows in the chart even without state changes
        const currentMinute = new Date().getMinutes();
        const shouldLogSnapshot = !stateChanged && (currentMinute % 15 === 0);

        if (stateChanged || shouldLogSnapshot) {
          deviceStateRecords.push({
            controller_id: controllerId,
            port_number: portNum,
            device_name: portName,
            state: state,
            speed: speed,
            trigger: 'auto',  // Could be native mode (AUTO/VPD/SCHEDULE)
            recorded_at: timestamp
          });
          deviceStateChanges++;
        }
      }
    }

    // Insert device state changes if any
    if (deviceStateRecords.length > 0) {
      const { error: stateInsertError } = await supabase
        .from('device_state_log')
        .insert(deviceStateRecords);

      if (stateInsertError) {
        // Log but don't fail - table might not exist yet
        log('warn', `Failed to insert device state changes: ${stateInsertError?.message || 'Unknown error'}`);
      } else {
        log('info', `Logged ${deviceStateRecords.length} device state changes`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Saved ${readings.length} sensor readings from ${devices.length} devices`,
      saved: readings.length,
      deviceStateChanges,
      devices: devices.length,
      duration: Date.now() - startTime
    });

  } catch (error) {
    log('error', 'Cron execution error', { error });
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      saved: 0,
      duration: Date.now() - startTime
    }, { status: 500 });
  }
}
