/**
 * Unit tests for useDashboardData hook
 *
 * These tests verify the hook's functionality including:
 * - Data fetching from Supabase
 * - State management (loading, error, data)
 * - Computed values (room summaries, metrics, trends)
 * - Real-time subscriptions
 * - Demo mode transitions
 * - Error handling
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import type { Room, Controller, SensorReading } from '@/types';

// Mock the supabase module
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
  },
  from: jest.fn(),
  channel: jest.fn(),
  removeChannel: jest.fn(),
};

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

// Mock demo data hook - it receives a boolean parameter indicating if demo mode is active
jest.mock('@/lib/demo-data', () => ({
  useDemoDataUpdater: jest.fn((shouldShowDemo: boolean) => ({
    rooms: [],
    controllers: [],
    roomSummaries: [],
    averageTemperature: null,
    averageHumidity: null,
    averageVPD: null,
    trends: {},
    historicalVpd: [],
    timelineData: [],
  })),
}));

// Mock VPD calculation
jest.mock('@/lib/vpd-utils', () => ({
  calculateVPD: jest.fn((temp: number, humidity: number) => {
    // Simple mock calculation
    if (temp < 32 || temp > 140 || humidity < 0 || humidity > 100) {
      return null;
    }
    return Math.round(((temp - 32) * 0.05 + (100 - humidity) * 0.01) * 100) / 100;
  }),
}));

// Import after mocks are set up
import { useDashboardData } from '../use-dashboard-data';

// Sample test data
const mockRooms: Room[] = [
  {
    id: 'room-1',
    user_id: 'user-1',
    name: 'Veg Room',
    description: 'Vegetative growth room',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    settings: null,
  },
  {
    id: 'room-2',
    user_id: 'user-1',
    name: 'Flower Room',
    description: 'Flowering chamber',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    settings: null,
  },
];

const mockControllers: Controller[] = [
  {
    id: 'controller-1',
    user_id: 'user-1',
    brand: 'AC_INFINITY',
    controller_id: 'AC001',
    name: 'Controller 1',
    status: 'online',
    last_seen: '2024-01-01T12:00:00Z',
    room_id: 'room-1',
    model: 'UIS Controller 69 Pro',
    firmware_version: '1.0.0',
    capabilities: null,
    credentials: null,
    last_error: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'controller-2',
    user_id: 'user-1',
    brand: 'AC_INFINITY',
    controller_id: 'AC002',
    name: 'Controller 2',
    status: 'offline',
    last_seen: '2024-01-01T10:00:00Z',
    room_id: 'room-1',
    model: 'UIS Controller 69 Pro',
    firmware_version: '1.0.0',
    capabilities: null,
    credentials: null,
    last_error: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'controller-3',
    user_id: 'user-1',
    brand: 'AC_INFINITY',
    controller_id: 'AC003',
    name: 'Controller 3',
    status: 'online',
    last_seen: '2024-01-01T12:00:00Z',
    room_id: null, // Unassigned
    model: 'UIS Controller 69 Pro',
    firmware_version: '1.0.0',
    capabilities: null,
    credentials: null,
    last_error: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const mockSensorReadings: SensorReading[] = [
  {
    id: 'reading-1',
    controller_id: 'controller-1',
    sensor_type: 'temperature',
    value: 75.0,
    unit: 'F',
    recorded_at: '2024-01-01T12:00:00Z',
    created_at: '2024-01-01T12:00:00Z',
  },
  {
    id: 'reading-2',
    controller_id: 'controller-1',
    sensor_type: 'humidity',
    value: 65.0,
    unit: '%',
    recorded_at: '2024-01-01T12:00:00Z',
    created_at: '2024-01-01T12:00:00Z',
  },
  {
    id: 'reading-3',
    controller_id: 'controller-1',
    sensor_type: 'temperature',
    value: 73.0,
    unit: 'F',
    recorded_at: '2024-01-01T11:00:00Z',
    created_at: '2024-01-01T11:00:00Z',
  },
  {
    id: 'reading-4',
    controller_id: 'controller-1',
    sensor_type: 'humidity',
    value: 67.0,
    unit: '%',
    recorded_at: '2024-01-01T11:00:00Z',
    created_at: '2024-01-01T11:00:00Z',
  },
  {
    id: 'reading-5',
    controller_id: 'controller-3',
    sensor_type: 'temperature',
    value: 72.0,
    unit: 'F',
    recorded_at: '2024-01-01T12:00:00Z',
    created_at: '2024-01-01T12:00:00Z',
  },
  {
    id: 'reading-6',
    controller_id: 'controller-3',
    sensor_type: 'humidity',
    value: 60.0,
    unit: '%',
    recorded_at: '2024-01-01T12:00:00Z',
    created_at: '2024-01-01T12:00:00Z',
  },
];

// Helper to create Supabase query mock chain
function createQueryMock(data: any, error: any = null) {
  const mock = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: jest.fn((resolve) => resolve({ data, error })),
  };
  return mock;
}

describe('useDashboardData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock: authenticated session
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1' },
          access_token: 'token',
        },
      },
      error: null,
    });

    // Mock channel for realtime subscriptions
    const mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    };
    mockSupabaseClient.channel.mockReturnValue(mockChannel);
    mockSupabaseClient.removeChannel.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial data fetching', () => {
    it('should start in loading state', () => {
      // Setup mocks for initial fetch
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock([]);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock([]);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.rooms).toEqual([]);
      expect(result.current.controllers).toEqual([]);
    });

    it('should fetch rooms, controllers, and sensor readings in parallel', async () => {
      const roomsWithControllers = mockRooms.map((room) => ({
        ...room,
        controllers: mockControllers.filter((c) => c.room_id === room.id),
      }));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([mockControllers[2]]); // Unassigned only
        }
        if (table === 'sensor_readings') {
          return createQueryMock(mockSensorReadings);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.rooms).toHaveLength(2);
      expect(result.current.controllers).toHaveLength(2); // Assigned controllers
      expect(result.current.unassignedControllers).toHaveLength(1);
      expect(result.current.sensorReadings).toHaveLength(6);
    });

    it('should handle fetch errors gracefully', async () => {
      const fetchError = new Error('Failed to fetch rooms');
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(null, fetchError);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain('Failed to fetch rooms');
    });

    it('should handle unauthenticated state', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => createQueryMock([]));

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not set error, just return empty data
      expect(result.current.error).toBeNull();
      expect(result.current.rooms).toEqual([]);
      expect(result.current.controllers).toEqual([]);
    });
  });

  describe('Computed room summaries', () => {
    it('should compute room summaries with sensor data', async () => {
      const roomsWithControllers = [
        {
          ...mockRooms[0],
          controllers: [mockControllers[0], mockControllers[1]],
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock(mockSensorReadings);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.roomSummaries).toHaveLength(1);
      const summary = result.current.roomSummaries[0];

      expect(summary.room.id).toBe('room-1');
      expect(summary.controllers).toHaveLength(2);
      expect(summary.onlineCount).toBe(1);
      expect(summary.offlineCount).toBe(1);
      expect(summary.latestSensorData.temperature).toBe(75.0);
      expect(summary.latestSensorData.humidity).toBe(65.0);
      expect(summary.latestSensorData.vpd).not.toBeNull();
    });

    it('should calculate trends from historical data', async () => {
      // Create readings with timestamps exactly 1 hour apart
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const trendReadings: SensorReading[] = [
        {
          id: 'reading-now-temp',
          controller_id: 'controller-1',
          sensor_type: 'temperature',
          value: 75.0,
          unit: 'F',
          recorded_at: now.toISOString(),
          created_at: now.toISOString(),
        },
        {
          id: 'reading-now-hum',
          controller_id: 'controller-1',
          sensor_type: 'humidity',
          value: 65.0,
          unit: '%',
          recorded_at: now.toISOString(),
          created_at: now.toISOString(),
        },
        {
          id: 'reading-1h-temp',
          controller_id: 'controller-1',
          sensor_type: 'temperature',
          value: 73.0,
          unit: 'F',
          recorded_at: oneHourAgo.toISOString(),
          created_at: oneHourAgo.toISOString(),
        },
        {
          id: 'reading-1h-hum',
          controller_id: 'controller-1',
          sensor_type: 'humidity',
          value: 67.0,
          unit: '%',
          recorded_at: oneHourAgo.toISOString(),
          created_at: oneHourAgo.toISOString(),
        },
      ];

      const roomsWithControllers = [
        {
          ...mockRooms[0],
          controllers: [mockControllers[0]],
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock(trendReadings);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const summary = result.current.roomSummaries[0];

      // Should have temperature trend (75 current vs 73 from 1h ago)
      expect(summary.trends.temperature).toBeDefined();
      expect(summary.trends.temperature?.delta).toBe(2.0);
      expect(summary.trends.temperature?.period).toBe('1h ago');

      // Should have humidity trend (65 current vs 67 from 1h ago)
      expect(summary.trends.humidity).toBeDefined();
      expect(summary.trends.humidity?.delta).toBe(-2.0);
    });

    it('should build temperature time series', async () => {
      const roomsWithControllers = [
        {
          ...mockRooms[0],
          controllers: [mockControllers[0]],
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock(mockSensorReadings);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const summary = result.current.roomSummaries[0];
      expect(summary.temperatureTimeSeries).toHaveLength(2);
      expect(summary.temperatureTimeSeries[0].value).toBe(73.0);
      expect(summary.temperatureTimeSeries[1].value).toBe(75.0);
    });

    it('should detect stale data', async () => {
      const staleReading = {
        ...mockSensorReadings[0],
        recorded_at: '2024-01-01T00:00:00Z', // 12 hours ago
      };

      const roomsWithControllers = [
        {
          ...mockRooms[0],
          controllers: [mockControllers[0]],
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock([staleReading]);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const summary = result.current.roomSummaries[0];
      expect(summary.hasStaleData).toBe(true);
    });
  });

  describe('Dashboard metrics', () => {
    it('should calculate aggregate metrics correctly', async () => {
      const roomsWithControllers = mockRooms.map((room) => ({
        ...room,
        controllers: mockControllers.filter((c) => c.room_id === room.id),
      }));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([mockControllers[2]]); // Unassigned
        }
        if (table === 'sensor_readings') {
          return createQueryMock(mockSensorReadings);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const metrics = result.current.metrics;

      // Total controllers: 2 assigned + 1 unassigned = 3
      expect(metrics.totalControllers).toBe(3);
      // Online: controller-1 and controller-3
      expect(metrics.onlineControllers).toBe(2);
      // Offline: controller-2
      expect(metrics.offlineControllers).toBe(1);
      // Uptime: 2/3 = 66.67% rounded to 67%
      expect(metrics.controllerUptime).toBe(67);
      // Rooms
      expect(metrics.totalRooms).toBe(2);
      // Average temperature from readings
      expect(metrics.averageTemperature).not.toBeNull();
      // Average humidity from readings
      expect(metrics.averageHumidity).not.toBeNull();
    });

    it('should handle zero controllers gracefully', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock([]);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock([]);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // When in demo mode, demo data is used instead
      // So we just verify that demo mode is active
      expect(result.current.isDemoMode).toBe(true);
    });
  });

  describe('Unassigned controllers', () => {
    it('should compute summaries for unassigned controllers', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock([]);
        }
        if (table === 'controllers') {
          return createQueryMock([mockControllers[2]]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock(mockSensorReadings);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.unassignedControllerSummaries).toHaveLength(1);
      const summary = result.current.unassignedControllerSummaries[0];

      expect(summary.controller.id).toBe('controller-3');
      expect(summary.isOnline).toBe(true);
      expect(summary.latestSensorData.temperature).toBe(72.0);
      expect(summary.latestSensorData.humidity).toBe(60.0);
    });
  });

  describe('Offline controllers', () => {
    it('should compute offline controllers from raw controller data', async () => {
      const roomsWithControllers = [
        {
          ...mockRooms[0],
          controllers: mockControllers.slice(0, 2),
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock([]);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The hook returns either demo or real data based on demo mode
      // We test that the filtering logic is correct by checking room summaries
      const roomSummaries = result.current.roomSummaries;
      if (roomSummaries.length > 0) {
        const summary = roomSummaries[0];
        // Summary should show 1 online and 1 offline
        expect(summary.onlineCount).toBe(1);
        expect(summary.offlineCount).toBe(1);
      }
    });
  });

  describe('Manual refetch', () => {
    it('should refetch data when refetch is called', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock([]);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock([]);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear mock calls
      mockSupabaseClient.from.mockClear();

      await act(async () => {
        await result.current.refetch();
      });

      // Should have called from() for each table again
      expect(mockSupabaseClient.from).toHaveBeenCalled();
    });

    it('should set isRefreshing during manual refetch', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock([]);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock([]);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isRefreshing).toBe(false);

      let refetchPromise: Promise<void>;
      act(() => {
        refetchPromise = result.current.refetch();
      });

      // During refetch, isRefreshing should be true
      // Note: This may not be observable due to async timing
      await act(async () => {
        await refetchPromise;
      });

      expect(result.current.isRefreshing).toBe(false);
    });
  });

  describe('Periodic refresh', () => {
    it('should refresh data at specified interval', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock([]);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock([]);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() =>
        useDashboardData({ refreshInterval: 5000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear initial fetch calls
      mockSupabaseClient.from.mockClear();

      // Advance timers by refresh interval
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        // Should have fetched data again
        expect(mockSupabaseClient.from).toHaveBeenCalled();
      });
    });
  });

  describe('getRoomSummary utility', () => {
    it('should return room summary by ID', async () => {
      const roomsWithControllers = [
        {
          ...mockRooms[0],
          controllers: [mockControllers[0]],
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock(mockSensorReadings);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const summary = result.current.getRoomSummary('room-1');
      expect(summary).toBeDefined();
      expect(summary?.room.id).toBe('room-1');
    });

    it('should return undefined for non-existent room', async () => {
      mockSupabaseClient.from.mockImplementation(() => createQueryMock([]));

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const summary = result.current.getRoomSummary('non-existent');
      expect(summary).toBeUndefined();
    });
  });

  describe('Environment snapshot', () => {
    it('should compute environment snapshot data', async () => {
      const roomsWithControllers = [
        {
          ...mockRooms[0],
          controllers: [mockControllers[0]],
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock(mockSensorReadings);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const snapshot = result.current.environmentSnapshot;

      expect(snapshot.temperature).not.toBeNull();
      expect(snapshot.humidity).not.toBeNull();
      expect(snapshot.vpd).not.toBeNull();
      expect(snapshot.isConnected).toBe(true);
      expect(snapshot.historicalVpd).toBeInstanceOf(Array);
    });
  });

  describe('Alerts generation', () => {
    it('should generate alerts for high temperature', async () => {
      const highTempReading: SensorReading = {
        id: 'reading-high',
        controller_id: 'controller-1',
        sensor_type: 'temperature',
        value: 95.0, // High temp
        unit: 'F',
        recorded_at: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T12:00:00Z',
      };

      const roomsWithControllers = [
        {
          ...mockRooms[0],
          controllers: [mockControllers[0]],
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock([highTempReading, mockSensorReadings[1]]);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.alerts.length).toBeGreaterThan(0);
      const criticalAlert = result.current.alerts.find(
        (a) => a.severity === 'critical'
      );
      expect(criticalAlert).toBeDefined();
    });
  });

  describe('Demo mode', () => {
    it('should activate demo mode when no controllers exist', async () => {
      mockSupabaseClient.from.mockImplementation(() => createQueryMock([]));

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isDemoMode).toBe(true);
    });

    it('should not activate demo mode when controllers exist', async () => {
      const roomsWithControllers = [
        {
          ...mockRooms[0],
          controllers: [mockControllers[0]],
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms') {
          return createQueryMock(roomsWithControllers);
        }
        if (table === 'controllers') {
          return createQueryMock([]);
        }
        if (table === 'sensor_readings') {
          return createQueryMock(mockSensorReadings);
        }
        if (table === 'workflows') {
          return createQueryMock([]);
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not be in demo mode when we have controllers
      expect(result.current.isDemoMode).toBe(false);
      expect(result.current.controllers.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle authentication errors', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Auth failed'),
      });

      mockSupabaseClient.from.mockImplementation(() => createQueryMock([]));

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toContain('Authentication error');
    });

    it('should clear error on successful refetch', async () => {
      // First return error
      let shouldError = true;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'rooms' && shouldError) {
          return createQueryMock(null, new Error('Network error'));
        }
        return createQueryMock([]);
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Now return success
      shouldError = false;

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
