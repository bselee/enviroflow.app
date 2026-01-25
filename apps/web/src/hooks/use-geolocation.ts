/**
 * Geolocation Hook
 *
 * Provides timezone detection and geolocation information for user convenience.
 * Falls back gracefully when geolocation is unavailable or denied.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Geolocation coordinates
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Geolocation hook return type
 */
export interface UseGeolocationReturn {
  /** Detected timezone (IANA format, e.g., "America/Los_Angeles") */
  timezone: string;
  /** Geolocation coordinates (if available and permitted) */
  coordinates: Coordinates | null;
  /** Whether geolocation is being requested */
  isLoading: boolean;
  /** Error message if geolocation failed */
  error: string | null;
  /** Request geolocation permission and coordinates */
  requestLocation: () => void;
  /** Whether geolocation permission was denied */
  isDenied: boolean;
}

/**
 * Custom hook for timezone detection and geolocation.
 *
 * Features:
 * - Auto-detects timezone from browser (always available)
 * - Optionally requests geolocation for lat/long (requires permission)
 * - Graceful fallback when geolocation is denied or unavailable
 * - Non-blocking: timezone is available immediately, location is optional
 *
 * @param autoRequestLocation - Whether to automatically request location on mount (default: false)
 * @returns Geolocation state and functions
 *
 * @example
 * ```tsx
 * const { timezone, coordinates, requestLocation } = useGeolocation();
 *
 * // Timezone is always available
 * console.log(timezone); // "America/Los_Angeles"
 *
 * // Coordinates require explicit request
 * <button onClick={requestLocation}>Get Location</button>
 * ```
 */
export function useGeolocation(autoRequestLocation = false): UseGeolocationReturn {
  // Timezone is always available via browser API
  const [timezone, setTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDenied, setIsDenied] = useState(false);

  /**
   * Request geolocation permission and coordinates.
   * This is separate from timezone detection for privacy.
   */
  const requestLocation = useCallback(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsDenied(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setIsLoading(false);
      },
      (err) => {
        let errorMessage = "Failed to get location";

        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = "Location permission denied";
            setIsDenied(true);
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case err.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }

        setError(errorMessage);
        setIsLoading(false);
      },
      {
        // Options for geolocation request
        enableHighAccuracy: false, // Don't need GPS precision
        timeout: 10000, // 10 second timeout
        maximumAge: 300000, // Accept cached location up to 5 minutes old
      }
    );
  }, []);

  // Auto-request location on mount if enabled
  useEffect(() => {
    if (autoRequestLocation) {
      requestLocation();
    }
  }, [autoRequestLocation, requestLocation]);

  // Update timezone if browser timezone changes (e.g., user travels)
  useEffect(() => {
    const checkTimezone = () => {
      const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (currentTimezone !== timezone) {
        setTimezone(currentTimezone);
      }
    };

    // Check timezone on visibility change (when user returns to tab)
    document.addEventListener("visibilitychange", checkTimezone);

    return () => {
      document.removeEventListener("visibilitychange", checkTimezone);
    };
  }, [timezone]);

  return {
    timezone,
    coordinates,
    isLoading,
    error,
    requestLocation,
    isDenied,
  };
}
