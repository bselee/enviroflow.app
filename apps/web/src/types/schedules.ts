/**
 * Schedule-related types for device automation
 *
 * Re-exports canonical types from /types/index.ts and defines
 * schedule-specific types like templates and recommendations.
 */

// Re-export canonical schedule types from index.ts
export type {
  DeviceScheduleTrigger as ScheduleTriggerType,
  DeviceScheduleAction as ScheduleAction,
  DeviceScheduleConfig as ScheduleConfig,
  DeviceSchedule,
  CreateDeviceScheduleInput,
  UpdateDeviceScheduleInput,
  DeviceScheduleWithController,
  SchedulePreview,
} from './index';

// Import types needed for local interface definitions
import type { DeviceScheduleConfig, DeviceScheduleTrigger } from './index';

/**
 * Schedule template structure
 */
export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  category: 'lighting' | 'climate' | 'irrigation' | 'general';
  icon?: string;
  featured: boolean;
  schedules: TemplateScheduleItem[];
  metadata?: {
    author?: string;
    tags?: string[];
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    requiredDevices?: string[];
  };
}

/**
 * Individual schedule item in a template
 */
export interface TemplateScheduleItem {
  device_type: string; // 'light', 'fan', 'outlet', etc.
  device_port?: number; // Optional specific port
  trigger_type: DeviceScheduleTrigger;
  schedule: DeviceScheduleConfig;
  name: string;
  description?: string;
}

/**
 * AI recommendation for schedule optimization
 */
export interface ScheduleRecommendation {
  recommendation: string;
  rationale: string;
  confidence: number; // 0-100
  suggestedSchedules: TemplateScheduleItem[];
  basedOn: {
    sensorHistory?: {
      avgTemperature?: number;
      avgHumidity?: number;
      avgVpd?: number;
      timeRange?: string;
    };
    growthStage?: string;
    currentConditions?: Record<string, unknown>;
  };
}
