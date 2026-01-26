/**
 * useControllerCapabilities Hook
 *
 * Fetches and manages controller I/O capabilities for workflow builder.
 * Provides sensors and devices available from connected controllers.
 *
 * @example
 * ```tsx
 * const { capabilities, loading, error, refresh } = useControllerCapabilities();
 * const { capabilities: singleController } = useControllerCapabilities('controller-id');
 * ```
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ============================================
// Types
// ============================================

export interface SensorCapability {
  type: string;
  name: string;
  port?: number;
  currentValue?: number;
  unit: string;
  isStale: boolean;
  timestamp?: string;
}

export interface DeviceCapability {
  port: number;
  type: string;
  name: string;
  isOn: boolean;
  level: number;
  supportsDimming: boolean;
  isOnline: boolean;
  portType?: number;
  devType?: number;
}

export interface ControllerCapabilities {
  controller_id: string;
  controller_name: string;
  brand: string;
  status: 'online' | 'offline' | 'error' | 'initializing';
  sensors: SensorCapability[];
  devices: DeviceCapability[];
  metadata: {
    model: string;
    firmwareVersion?: string;
    lastSeen?: string;
  };
  timestamp: string;
  cached?: boolean;
}

export interface UseControllerCapabilitiesOptions {
  /** Specific controller ID to fetch (if omitted, fetches all) */
  controllerId?: string;
  /** Auto-refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
}

interface UseControllerCapabilitiesResult {
  /** Capabilities data - single controller or map of all controllers */
  capabilities: ControllerCapabilities | Map<string, ControllerCapabilities> | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Manually refresh capabilities */
  refresh: () => Promise<void>;
  /** Check if a specific controller has any sensors */
  hasSensors: (controllerId: string) => boolean;
  /** Check if a specific controller has any devices */
  hasDevices: (controllerId: string) => boolean;
}

// Cache for capabilities with 5-minute TTL
interface CacheEntry {
  data: ControllerCapabilities;
  timestamp: number;
}

const capabilitiesCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Custom hook for fetching controller I/O capabilities
 */
export function useControllerCapabilities(
  options: UseControllerCapabilitiesOptions = {}
): UseControllerCapabilitiesResult {
  const { controllerId, refreshInterval = 0 } = options;

  const [capabilities, setCapabilities] = useState<
    ControllerCapabilities | Map<string, ControllerCapabilities> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch capabilities for a single controller
   */
  const fetchSingleController = useCallback(async (id: string): Promise<ControllerCapabilities | null> => {
    // Check cache first
    const cached = capabilitiesCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Capabilities] Using cached data for controller ${id}`);
      return cached.data;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        return null;
      }

      const response = await fetch(`/api/controllers/${id}/capabilities`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[Capabilities] Controller ${id} not found`);
          return null;
        }
        throw new Error(`Failed to fetch capabilities: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Cache the result
        capabilitiesCache.set(id, {
          data,
          timestamp: Date.now(),
        });
        return data;
      } else {
        throw new Error(data.error || 'Failed to fetch capabilities');
      }
    } catch (err) {
      console.error(`[Capabilities] Error fetching controller ${id}:`, err);
      throw err;
    }
  }, []);

  /**
   * Fetch capabilities for all controllers
   */
  const fetchAllControllers = useCallback(async (): Promise<Map<string, ControllerCapabilities>> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        return new Map();
      }

      // Get list of all controllers
      const { data: controllers, error: listError } = await supabase
        .from('controllers')
        .select('id, name, brand')
        .eq('user_id', session.user.id);

      if (listError) {
        throw new Error(listError.message);
      }

      if (!controllers || controllers.length === 0) {
        return new Map();
      }

      // Fetch capabilities for each controller
      const results = await Promise.allSettled(
        controllers.map((c) => fetchSingleController(c.id))
      );

      const capabilitiesMap = new Map<string, ControllerCapabilities>();

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          capabilitiesMap.set(controllers[index].id, result.value);
        } else if (result.status === 'rejected') {
          console.error(
            `[Capabilities] Failed to fetch controller ${controllers[index].id}:`,
            result.reason
          );
        }
      });

      return capabilitiesMap;
    } catch (err) {
      console.error('[Capabilities] Error fetching all controllers:', err);
      throw err;
    }
  }, [fetchSingleController]);

  /**
   * Main fetch function
   */
  const fetchCapabilities = useCallback(async () => {
    try {
      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }

      if (controllerId) {
        // Fetch single controller
        const data = await fetchSingleController(controllerId);
        if (isMounted.current) {
          setCapabilities(data);
        }
      } else {
        // Fetch all controllers
        const data = await fetchAllControllers();
        if (isMounted.current) {
          setCapabilities(data);
        }
      }
    } catch (err) {
      console.error('[Capabilities] Error:', err);
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch capabilities');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [controllerId, fetchSingleController, fetchAllControllers]);

  /**
   * Check if a controller has sensors
   */
  const hasSensors = useCallback(
    (id: string): boolean => {
      if (!capabilities) return false;

      if (capabilities instanceof Map) {
        const ctrl = capabilities.get(id);
        return ctrl ? ctrl.sensors.length > 0 : false;
      } else {
        return capabilities.controller_id === id && capabilities.sensors.length > 0;
      }
    },
    [capabilities]
  );

  /**
   * Check if a controller has devices
   */
  const hasDevices = useCallback(
    (id: string): boolean => {
      if (!capabilities) return false;

      if (capabilities instanceof Map) {
        const ctrl = capabilities.get(id);
        return ctrl ? ctrl.devices.length > 0 : false;
      } else {
        return capabilities.controller_id === id && capabilities.devices.length > 0;
      }
    },
    [capabilities]
  );

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    fetchCapabilities();

    return () => {
      isMounted.current = false;
    };
  }, [fetchCapabilities]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchCapabilities();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [refreshInterval, fetchCapabilities]);

  // Realtime subscription for controller changes
  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        return null;
      }

      // Subscribe to controller status changes
      const channel = supabase
        .channel('controller-capabilities-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'controllers',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            console.log('[Capabilities] Controller updated, invalidating cache');
            // Invalidate cache for updated controller
            if (payload.new && 'id' in payload.new) {
              capabilitiesCache.delete(payload.new.id as string);
              // Refresh if we're watching this controller or all controllers
              if (!controllerId || controllerId === payload.new.id) {
                fetchCapabilities();
              }
            }
          }
        )
        .subscribe();

      return channel;
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    setupRealtimeSubscription().then((ch) => {
      channel = ch;
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [controllerId, fetchCapabilities]);

  return {
    capabilities,
    loading,
    error,
    refresh: fetchCapabilities,
    hasSensors,
    hasDevices,
  };
}
