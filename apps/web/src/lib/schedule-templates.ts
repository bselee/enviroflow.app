/**
 * Built-in schedule templates for common automation scenarios
 */

import type { ScheduleTemplate } from '@/types/schedules';

/**
 * Built-in schedule templates gallery
 * These templates provide pre-configured schedules for common use cases
 */
export const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: 'day-night-18-6',
    name: 'Day/Night Mode (18/6)',
    description: 'Standard 18-hour light, 6-hour dark cycle with coordinated fan control',
    category: 'lighting',
    icon: '☀️🌙',
    featured: true,
    schedules: [
      {
        device_type: 'light',
        name: 'Lights ON - Morning',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '06:00',
          action: 'on',
          level: 100,
        },
      },
      {
        device_type: 'light',
        name: 'Lights OFF - Night',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '00:00',
          action: 'off',
        },
      },
      {
        device_type: 'fan',
        name: 'Fan HIGH - Day',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '06:00',
          action: 'set_level',
          level: 75,
        },
      },
      {
        device_type: 'fan',
        name: 'Fan LOW - Night',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '00:00',
          action: 'set_level',
          level: 25,
        },
      },
    ],
    metadata: {
      tags: ['vegetative', 'lighting', 'basic'],
      difficulty: 'beginner',
      requiredDevices: ['light', 'fan'],
    },
  },
  {
    id: 'day-night-12-12',
    name: 'Day/Night Mode (12/12)',
    description: 'Flowering cycle with 12-hour light, 12-hour dark',
    category: 'lighting',
    icon: '🌸',
    featured: true,
    schedules: [
      {
        device_type: 'light',
        name: 'Lights ON - Flowering Day',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '06:00',
          action: 'on',
          level: 100,
        },
      },
      {
        device_type: 'light',
        name: 'Lights OFF - Flowering Night',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '18:00',
          action: 'off',
        },
      },
      {
        device_type: 'fan',
        name: 'Fan HIGH - Day',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '06:00',
          action: 'set_level',
          level: 80,
        },
      },
      {
        device_type: 'fan',
        name: 'Fan MEDIUM - Night',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '18:00',
          action: 'set_level',
          level: 40,
        },
      },
    ],
    metadata: {
      tags: ['flowering', 'lighting', 'basic'],
      difficulty: 'beginner',
      requiredDevices: ['light', 'fan'],
    },
  },
  {
    id: 'sunrise-ramp',
    name: 'Sunrise Ramp-Up',
    description: 'Gradual light increase simulating natural sunrise over 2 hours',
    category: 'lighting',
    icon: '🌅',
    featured: true,
    schedules: [
      {
        device_type: 'light',
        name: 'Sunrise Start - 0%',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '06:00',
          action: 'set_level',
          level: 0,
        },
      },
      {
        device_type: 'light',
        name: 'Sunrise 25%',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '06:30',
          action: 'set_level',
          level: 25,
        },
      },
      {
        device_type: 'light',
        name: 'Sunrise 50%',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '07:00',
          action: 'set_level',
          level: 50,
        },
      },
      {
        device_type: 'light',
        name: 'Sunrise 75%',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '07:30',
          action: 'set_level',
          level: 75,
        },
      },
      {
        device_type: 'light',
        name: 'Full Light - 100%',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '08:00',
          action: 'set_level',
          level: 100,
        },
      },
    ],
    metadata: {
      tags: ['lighting', 'gradual', 'advanced'],
      difficulty: 'intermediate',
      requiredDevices: ['light'],
    },
  },
  {
    id: 'sunset-winddown',
    name: 'Evening Wind-Down',
    description: 'Gradual light decrease simulating natural sunset',
    category: 'lighting',
    icon: '🌇',
    featured: true,
    schedules: [
      {
        device_type: 'light',
        name: 'Evening Start - 100%',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '18:00',
          action: 'set_level',
          level: 100,
        },
      },
      {
        device_type: 'light',
        name: 'Sunset 75%',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '19:00',
          action: 'set_level',
          level: 75,
        },
      },
      {
        device_type: 'light',
        name: 'Sunset 50%',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '20:00',
          action: 'set_level',
          level: 50,
        },
      },
      {
        device_type: 'light',
        name: 'Sunset 25%',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '21:00',
          action: 'set_level',
          level: 25,
        },
      },
      {
        device_type: 'light',
        name: 'Lights OFF',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '22:00',
          action: 'off',
        },
      },
    ],
    metadata: {
      tags: ['lighting', 'gradual', 'advanced'],
      difficulty: 'intermediate',
      requiredDevices: ['light'],
    },
  },
  {
    id: 'plant-cloning',
    name: 'Plant Cloning Environment',
    description: '24-hour light with high humidity and gentle airflow for cuttings',
    category: 'general',
    icon: '🌱',
    featured: false,
    schedules: [
      {
        device_type: 'light',
        name: 'Continuous Light',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '00:00',
          action: 'set_level',
          level: 60, // Lower intensity for clones
        },
      },
      {
        device_type: 'humidifier',
        name: 'High Humidity',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '00:00',
          action: 'on',
        },
      },
      {
        device_type: 'fan',
        name: 'Gentle Airflow',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '00:00',
          action: 'set_level',
          level: 30, // Low fan speed
        },
      },
    ],
    metadata: {
      tags: ['cloning', 'propagation', 'specialized'],
      difficulty: 'intermediate',
      requiredDevices: ['light', 'humidifier', 'fan'],
    },
  },
  {
    id: 'weekend-only',
    name: 'Weekend Only Operation',
    description: 'Run devices only on weekends (Saturday & Sunday)',
    category: 'general',
    icon: '📅',
    featured: false,
    schedules: [
      {
        device_type: 'light',
        name: 'Weekend Lights ON',
        trigger_type: 'time',
        schedule: {
          days: [0, 6], // Sunday and Saturday
          start_time: '08:00',
          action: 'on',
          level: 100,
        },
      },
      {
        device_type: 'light',
        name: 'Weekend Lights OFF',
        trigger_type: 'time',
        schedule: {
          days: [0, 6],
          start_time: '20:00',
          action: 'off',
        },
      },
    ],
    metadata: {
      tags: ['schedule', 'weekend', 'basic'],
      difficulty: 'beginner',
      requiredDevices: ['light'],
    },
  },
  {
    id: 'natural-sunrise-sunset',
    name: 'Natural Sunrise/Sunset',
    description: 'Follow natural daylight patterns using location-based sunrise/sunset',
    category: 'lighting',
    icon: '🌍',
    featured: true,
    schedules: [
      {
        device_type: 'light',
        name: 'Sunrise Trigger',
        trigger_type: 'sunrise',
        schedule: {
          days: [],
          action: 'on',
          level: 100,
          offset_minutes: 0, // Turn on at sunrise
        },
      },
      {
        device_type: 'light',
        name: 'Sunset Trigger',
        trigger_type: 'sunset',
        schedule: {
          days: [],
          action: 'off',
          offset_minutes: 0, // Turn off at sunset
        },
      },
      {
        device_type: 'fan',
        name: 'Day Fan',
        trigger_type: 'sunrise',
        schedule: {
          days: [],
          action: 'set_level',
          level: 70,
        },
      },
      {
        device_type: 'fan',
        name: 'Night Fan',
        trigger_type: 'sunset',
        schedule: {
          days: [],
          action: 'set_level',
          level: 30,
        },
      },
    ],
    metadata: {
      tags: ['natural', 'location', 'advanced'],
      difficulty: 'advanced',
      requiredDevices: ['light', 'fan'],
    },
  },
  {
    id: 'irrigation-daily',
    name: 'Daily Irrigation',
    description: 'Automated watering schedule with morning and evening cycles',
    category: 'irrigation',
    icon: '💧',
    featured: false,
    schedules: [
      {
        device_type: 'pump',
        name: 'Morning Water - ON',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '07:00',
          action: 'on',
        },
      },
      {
        device_type: 'pump',
        name: 'Morning Water - OFF',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '07:15', // 15-minute watering
          action: 'off',
        },
      },
      {
        device_type: 'pump',
        name: 'Evening Water - ON',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '19:00',
          action: 'on',
        },
      },
      {
        device_type: 'pump',
        name: 'Evening Water - OFF',
        trigger_type: 'time',
        schedule: {
          days: [0, 1, 2, 3, 4, 5, 6],
          start_time: '19:15',
          action: 'off',
        },
      },
    ],
    metadata: {
      tags: ['irrigation', 'watering', 'intermediate'],
      difficulty: 'intermediate',
      requiredDevices: ['pump'],
    },
  },
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): ScheduleTemplate | undefined {
  return SCHEDULE_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get featured templates for the gallery
 */
export function getFeaturedTemplates(): ScheduleTemplate[] {
  return SCHEDULE_TEMPLATES.filter((t) => t.featured);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: ScheduleTemplate['category']
): ScheduleTemplate[] {
  return SCHEDULE_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Search templates by name or tags
 */
export function searchTemplates(query: string): ScheduleTemplate[] {
  const lowerQuery = query.toLowerCase();
  return SCHEDULE_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.metadata?.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get all categories with counts
 */
export function getCategories(): Array<{
  category: ScheduleTemplate['category'];
  count: number;
}> {
  const categories = new Map<ScheduleTemplate['category'], number>();

  SCHEDULE_TEMPLATES.forEach((t) => {
    categories.set(t.category, (categories.get(t.category) || 0) + 1);
  });

  return Array.from(categories.entries()).map(([category, count]) => ({
    category,
    count,
  }));
}
