/**
 * Sun Calculator Utility
 *
 * Provides sunrise/sunset calculations using the suncalc library.
 * Includes caching to the sunrise_sunset_cache table to minimize
 * repeated calculations for the same location and date.
 *
 * @module sun-calculator
 */

import * as SunCalc from 'suncalc';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

/**
 * Sun times for a specific location and date.
 * Times can be in UTC or local timezone depending on how retrieved.
 */
export interface SunTimes {
  /** The sunrise time */
  sunrise: Date;
  /** The sunset time */
  sunset: Date;
  /** Solar noon (sun at highest point) */
  solarNoon: Date;
  /** Length of daylight in hours */
  dayLength: number;
  /** The timezone the times are expressed in (undefined = UTC) */
  timezone?: string;
}

/**
 * Result type for sun time operations.
 * Follows the { success, data?, error? } pattern.
 */
export interface SunTimesResult {
  success: boolean;
  data?: SunTimes;
  error?: string;
}

/**
 * Geographic coordinates for sun calculations.
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Cached sun times from the database.
 */
interface CachedSunTimes {
  room_id: string;
  date: string;
  sunrise_time: string;
  sunset_time: string;
  solar_noon: string | null;
  day_length_hours: number | null;
}

/**
 * Room data with location information.
 */
interface RoomWithLocation {
  id: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Valid latitude range: -90 to 90 degrees.
 */
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;

/**
 * Valid longitude range: -180 to 180 degrees.
 */
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

/**
 * Polar latitude threshold. Beyond this, midnight sun or polar night occurs.
 * Arctic Circle: ~66.5 degrees
 */
const POLAR_LATITUDE_THRESHOLD = 66.5;

// =============================================================================
// Timezone Conversion Functions
// =============================================================================

/**
 * Converts a UTC Date to local time in the specified timezone.
 *
 * This function uses Intl.DateTimeFormat to properly handle DST transitions
 * and timezone offsets. The returned Date object represents the same instant
 * in time, but its getHours/getMinutes/etc methods will return the local values.
 *
 * Note: JavaScript Date objects are always UTC internally. This function creates
 * a new Date whose UTC values match the local time values for the given timezone.
 * This is necessary because workflow triggers compare hours/minutes directly.
 *
 * @param utcDate - The Date object in UTC
 * @param timezone - IANA timezone identifier (e.g., 'America/New_York', 'Europe/London')
 * @returns A new Date object with local time values
 *
 * @example
 * // Convert UTC noon to Eastern Time (UTC-5 during standard time)
 * const utc = new Date('2026-01-21T12:00:00Z');
 * const local = convertToLocalTime(utc, 'America/New_York');
 * // local.getHours() will return 7 (12:00 UTC = 7:00 EST)
 */
export function convertToLocalTime(utcDate: Date, timezone: string): Date {
  // Create a formatter for the target timezone that extracts all date/time parts
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Parse the formatted parts back into a Date object
  const parts = formatter.formatToParts(utcDate);
  const get = (type: string): string =>
    parts.find(p => p.type === type)?.value || '0';

  // Construct a new Date using the local time values
  // Note: We use Date.UTC to avoid the local system timezone affecting the result,
  // then subtract nothing - we want a Date whose getHours etc return local values.
  // The trick is to create the date as if the local time parts were UTC parts.
  return new Date(
    parseInt(get('year'), 10),
    parseInt(get('month'), 10) - 1, // Months are 0-indexed
    parseInt(get('day'), 10),
    parseInt(get('hour'), 10),
    parseInt(get('minute'), 10),
    parseInt(get('second'), 10)
  );
}

/**
 * Validates a timezone string is a valid IANA timezone identifier.
 *
 * @param timezone - The timezone string to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * isValidTimezone('America/New_York'); // true
 * isValidTimezone('Invalid/Timezone'); // false
 * isValidTimezone('EST'); // false (abbreviations not supported)
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== 'string') {
    return false;
  }

  try {
    // Intl.DateTimeFormat will throw for invalid timezone identifiers
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates geographic coordinates.
 *
 * @param latitude - The latitude in degrees (-90 to 90)
 * @param longitude - The longitude in degrees (-180 to 180)
 * @returns An error message if invalid, or null if valid
 */
export function validateCoordinates(
  latitude: number,
  longitude: number
): string | null {
  if (typeof latitude !== 'number' || isNaN(latitude)) {
    return 'Latitude must be a valid number';
  }

  if (typeof longitude !== 'number' || isNaN(longitude)) {
    return 'Longitude must be a valid number';
  }

  if (latitude < MIN_LATITUDE || latitude > MAX_LATITUDE) {
    return `Latitude must be between ${MIN_LATITUDE} and ${MAX_LATITUDE} degrees`;
  }

  if (longitude < MIN_LONGITUDE || longitude > MAX_LONGITUDE) {
    return `Longitude must be between ${MIN_LONGITUDE} and ${MAX_LONGITUDE} degrees`;
  }

  return null;
}

/**
 * Checks if a location is in a polar region where midnight sun or polar night
 * can occur during certain times of year.
 *
 * @param latitude - The latitude in degrees
 * @returns true if the location is in a polar region
 */
export function isPolarRegion(latitude: number): boolean {
  return Math.abs(latitude) >= POLAR_LATITUDE_THRESHOLD;
}

// =============================================================================
// Core Calculation Functions
// =============================================================================

/**
 * Calculate sunrise, sunset, solar noon, and day length for a given location and date.
 *
 * This function uses the suncalc library for astronomical calculations.
 * All returned times are in UTC.
 *
 * @param latitude - The latitude in degrees (-90 to 90)
 * @param longitude - The longitude in degrees (-180 to 180)
 * @param date - The date to calculate for (defaults to today)
 * @returns SunTimesResult with success status and data or error
 *
 * @example
 * // Get sun times for Denver, CO
 * const result = getSunTimes(39.7392, -104.9903);
 * if (result.success && result.data) {
 *   console.log(`Sunrise: ${result.data.sunrise.toISOString()}`);
 *   console.log(`Day length: ${result.data.dayLength.toFixed(2)} hours`);
 * }
 *
 * @example
 * // Get sun times for a specific date
 * const summerSolstice = new Date('2026-06-21');
 * const result = getSunTimes(39.7392, -104.9903, summerSolstice);
 */
export function getSunTimes(
  latitude: number,
  longitude: number,
  date: Date = new Date()
): SunTimesResult {
  // Validate coordinates
  const validationError = validateCoordinates(latitude, longitude);
  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }

  try {
    // Get sun times from suncalc
    const times = SunCalc.getTimes(date, latitude, longitude);

    // Check for polar day/night conditions
    // suncalc returns NaN for times when the sun doesn't rise or set
    if (isNaN(times.sunrise.getTime()) || isNaN(times.sunset.getTime())) {
      // Determine if it's polar day (midnight sun) or polar night
      const position = SunCalc.getPosition(date, latitude, longitude);
      const isPolarDay = position.altitude > 0;

      return {
        success: false,
        error: isPolarDay
          ? 'Polar day detected: The sun does not set at this location on this date'
          : 'Polar night detected: The sun does not rise at this location on this date',
      };
    }

    // Calculate day length in hours
    const dayLengthMs = times.sunset.getTime() - times.sunrise.getTime();
    const dayLengthHours = dayLengthMs / (1000 * 60 * 60);

    return {
      success: true,
      data: {
        sunrise: times.sunrise,
        sunset: times.sunset,
        solarNoon: times.solarNoon,
        dayLength: Math.round(dayLengthHours * 100) / 100, // Round to 2 decimal places
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown calculation error';
    return {
      success: false,
      error: `Sun calculation failed: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Database Caching Functions
// =============================================================================

/**
 * Get Supabase client for database operations.
 * Uses service role key to bypass RLS for cron job operations.
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, key);
}

/**
 * Format a Date object to a date string (YYYY-MM-DD) for database queries.
 *
 * @param date - The date to format
 * @returns The formatted date string
 */
function formatDateForDb(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a Date object to a time string (HH:MM:SS) for database storage.
 *
 * @param date - The date/time to format
 * @returns The formatted time string
 */
function formatTimeForDb(date: Date): string {
  return date.toISOString().split('T')[1].split('.')[0];
}

/**
 * Parse a time string (HH:MM:SS) from the database into a Date object
 * for a specific date.
 *
 * @param timeStr - The time string from the database
 * @param dateStr - The date string (YYYY-MM-DD)
 * @returns The Date object with the combined date and time
 */
function parseDbTimeToDate(timeStr: string, dateStr: string): Date {
  return new Date(`${dateStr}T${timeStr}Z`);
}

/**
 * Options for getCachedSunTimes function.
 */
export interface GetSunTimesOptions {
  /** The date to get sun times for (defaults to today) */
  date?: Date;
  /**
   * Whether to convert times to the room's local timezone.
   * When true, returned times will be in the room's timezone.
   * When false or omitted, returned times are in UTC.
   * Defaults to true for workflow trigger evaluation.
   */
  convertToLocalTimezone?: boolean;
}

/**
 * Get cached or calculated sun times for a room.
 *
 * This function first checks the sunrise_sunset_cache table for existing data.
 * If not found, it calculates the times using suncalc and caches the result.
 *
 * IMPORTANT: By default, times are converted to the room's local timezone.
 * This is critical for workflow triggers to fire at the correct local time.
 * Set convertToLocalTimezone: false to get UTC times (for display/storage).
 *
 * @param roomId - The UUID of the room
 * @param options - Optional configuration (date, timezone conversion)
 * @returns SunTimesResult with success status and data or error
 *
 * @example
 * // Get sun times in room's local timezone (default for triggers)
 * const result = await getCachedSunTimes('room-uuid-here');
 * if (result.success && result.data) {
 *   // Times are in local timezone - safe to compare with local Date
 *   const isSunrise = isWithinTimeWindow(result.data.sunrise, 1);
 *   if (isSunrise) {
 *     // Trigger sunrise workflow
 *   }
 * }
 *
 * @example
 * // Get sun times in UTC (for storage or display)
 * const result = await getCachedSunTimes('room-uuid-here', {
 *   convertToLocalTimezone: false
 * });
 */
export async function getCachedSunTimes(
  roomId: string,
  options: GetSunTimesOptions = {}
): Promise<SunTimesResult> {
  const { date = new Date(), convertToLocalTimezone = true } = options;
  const dateStr = formatDateForDb(date);

  try {
    const supabase = getSupabaseClient();

    // Step 1: Always fetch room data first (we need timezone for conversion)
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, latitude, longitude, timezone')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return {
        success: false,
        error: roomError?.message || 'Room not found',
      };
    }

    const roomData = room as RoomWithLocation;
    const roomTimezone = roomData.timezone || 'UTC';

    // Validate timezone if we're going to convert
    if (convertToLocalTimezone && !isValidTimezone(roomTimezone)) {
      console.warn(
        `Invalid timezone "${roomTimezone}" for room ${roomId}, falling back to UTC`
      );
    }

    // Step 2: Check cache for pre-calculated times
    const { data: cached, error: cacheError } = await supabase
      .from('sunrise_sunset_cache')
      .select('*')
      .eq('room_id', roomId)
      .eq('date', dateStr)
      .single();

    if (!cacheError && cached) {
      // Cache hit - parse and optionally convert cached data
      const cachedData = cached as CachedSunTimes;

      // Parse UTC times from cache
      const sunriseUtc = parseDbTimeToDate(cachedData.sunrise_time, dateStr);
      const sunsetUtc = parseDbTimeToDate(cachedData.sunset_time, dateStr);
      const solarNoonUtc = cachedData.solar_noon
        ? parseDbTimeToDate(cachedData.solar_noon, dateStr)
        : parseDbTimeToDate('12:00:00', dateStr);

      // Convert to local timezone if requested
      const shouldConvert = convertToLocalTimezone && isValidTimezone(roomTimezone);

      return {
        success: true,
        data: {
          sunrise: shouldConvert ? convertToLocalTime(sunriseUtc, roomTimezone) : sunriseUtc,
          sunset: shouldConvert ? convertToLocalTime(sunsetUtc, roomTimezone) : sunsetUtc,
          solarNoon: shouldConvert ? convertToLocalTime(solarNoonUtc, roomTimezone) : solarNoonUtc,
          dayLength: cachedData.day_length_hours ?? 12,
          timezone: shouldConvert ? roomTimezone : 'UTC',
        },
      };
    }

    // Step 3: Cache miss - validate coordinates exist
    if (roomData.latitude === null || roomData.longitude === null) {
      return {
        success: false,
        error: 'Room does not have latitude/longitude coordinates configured',
      };
    }

    // Step 4: Calculate sun times (returns UTC)
    const calcResult = getSunTimes(roomData.latitude, roomData.longitude, date);

    if (!calcResult.success || !calcResult.data) {
      return calcResult;
    }

    // Step 5: Cache the result for future use (always store UTC in cache)
    const cacheEntry = {
      room_id: roomId,
      date: dateStr,
      sunrise_time: formatTimeForDb(calcResult.data.sunrise),
      sunset_time: formatTimeForDb(calcResult.data.sunset),
      solar_noon: formatTimeForDb(calcResult.data.solarNoon),
      day_length_hours: calcResult.data.dayLength,
    };

    // Upsert to handle race conditions (unique constraint on room_id + date)
    const { error: insertError } = await supabase
      .from('sunrise_sunset_cache')
      .upsert(cacheEntry, {
        onConflict: 'room_id,date',
        ignoreDuplicates: false,
      });

    if (insertError) {
      // Log but don't fail - we still have the calculated data
      console.warn('Failed to cache sun times:', insertError.message);
    }

    // Step 6: Convert to local timezone if requested
    const shouldConvert = convertToLocalTimezone && isValidTimezone(roomTimezone);

    if (shouldConvert) {
      return {
        success: true,
        data: {
          sunrise: convertToLocalTime(calcResult.data.sunrise, roomTimezone),
          sunset: convertToLocalTime(calcResult.data.sunset, roomTimezone),
          solarNoon: convertToLocalTime(calcResult.data.solarNoon, roomTimezone),
          dayLength: calcResult.data.dayLength,
          timezone: roomTimezone,
        },
      };
    }

    // Return UTC times
    return {
      success: true,
      data: {
        ...calcResult.data,
        timezone: 'UTC',
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to get sun times: ${errorMessage}`,
    };
  }
}

// =============================================================================
// Trigger Evaluation Helpers
// =============================================================================

/**
 * Check if the current time is within a window of a target time.
 * Useful for determining if a sunrise/sunset trigger should fire.
 *
 * When comparing timezone-converted times, this function compares the
 * hours and minutes directly, which is correct because both times have
 * been converted to represent the same local timezone context.
 *
 * @param targetTime - The target time (e.g., sunrise or sunset in local timezone)
 * @param windowMinutes - The window size in minutes (default: 1 minute)
 * @param timezone - Optional timezone for current time conversion (if targetTime is local)
 * @returns true if current time is within the window of target time
 *
 * @example
 * // Check if we're within 1 minute of sunrise (times in room's timezone)
 * const sunTimes = await getCachedSunTimes(roomId);
 * if (sunTimes.success && isWithinTimeWindow(sunTimes.data.sunrise, 1, sunTimes.data.timezone)) {
 *   // Trigger sunrise automation
 * }
 */
export function isWithinTimeWindow(
  targetTime: Date,
  windowMinutes: number = 1,
  timezone?: string
): boolean {
  // Get current time, converting to local timezone if specified
  const now = new Date();
  const currentTime = timezone && isValidTimezone(timezone)
    ? convertToLocalTime(now, timezone)
    : now;

  // Compare using hours and minutes for timezone-converted dates
  // This works because both dates now represent "wall clock" time in the same timezone
  const targetMinutes = targetTime.getHours() * 60 + targetTime.getMinutes();
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  const diffMinutes = Math.abs(currentMinutes - targetMinutes);

  // Handle midnight wraparound (e.g., 23:59 vs 00:01 is 2 minutes, not 1438)
  const wrappedDiff = Math.min(diffMinutes, 1440 - diffMinutes);

  return wrappedDiff <= windowMinutes;
}

/**
 * Get the offset sunrise or sunset time (e.g., 30 minutes before sunrise).
 *
 * @param baseTime - The base time (sunrise or sunset)
 * @param offsetMinutes - The offset in minutes (positive = after, negative = before)
 * @returns The offset time
 *
 * @example
 * // Get time 30 minutes before sunrise
 * const preSunrise = getOffsetTime(sunTimes.sunrise, -30);
 *
 * // Get time 1 hour after sunset
 * const postSunset = getOffsetTime(sunTimes.sunset, 60);
 */
export function getOffsetTime(baseTime: Date, offsetMinutes: number): Date {
  return new Date(baseTime.getTime() + offsetMinutes * 60 * 1000);
}

/**
 * Clean up expired cache entries (dates in the past).
 * Should be called periodically to prevent cache table growth.
 *
 * @returns The number of deleted cache entries
 */
export async function cleanupExpiredSunTimesCache(): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    const today = formatDateForDb(new Date());

    const { count, error } = await supabase
      .from('sunrise_sunset_cache')
      .delete({ count: 'exact' })
      .lt('date', today);

    if (error) {
      console.error('Failed to cleanup sun times cache:', error.message);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error('Cache cleanup error:', err);
    return 0;
  }
}
