/**
 * Device Icons Configuration
 *
 * Centralized icon definitions for all device types following the
 * EnviroFlow UI Icon Reference Guide (docs/spec/enviroflow-ui-icons.md).
 *
 * Icon Color Rules:
 * - Fans: #00d4ff (cyan)
 * - Lights: #ffd740 (yellow)
 * - Water/Humidity: #4fc3f7 (light blue)
 * - Heat: #ff5252 (red)
 * - Outlets: #ff9100 (orange)
 * - AC/Cooling: #80deea (teal)
 *
 * Icon Sizing:
 * - 12px: Meta inline (connectivity status)
 * - 14px: Port chips (inside 24x24 container)
 * - 16px: Port tiles, small contexts
 * - 20px: Card headers
 * - 28px: Feature cards
 * - 40px: Empty states
 */

import {
  Fan,              // Inline fan, clip fan, circulation
  Wind,             // Alternative for inline/duct fans
  Sun,              // Grow lights (LED panels, boards)
  Droplets,         // Humidifier
  Flame,            // Heater
  AirVent,          // Air conditioner / dehumidifier
  Plug,             // Outlet / control plug (generic)
  Thermometer,      // Hygrometer / sensor / heat mat
  Monitor,          // Controller device card icon
  Waves,            // Water pump
  Wifi,             // WiFi connected
  Bluetooth,        // Bluetooth connected
  AlertTriangle,    // Alarm active
  TrendingUp,       // Value increasing
  TrendingDown,     // Value decreasing
  Minus,            // Steady / no change
  Settings,         // Settings gear
  Plus,             // Add device / add automation
  ChevronLeft,      // Back navigation
  ChevronDown,      // Expand/collapse toggle
  Info,             // Help overlay
  FileDown,         // CSV export
  Share,            // Share device access
  BrainCircuit,     // AI controller variant
  PlugZap,          // Smart outlet controller
  Power,            // Generic power/outlet icon
  type LucideIcon,
} from 'lucide-react';

// ============================================
// Port Device Types
// ============================================

export type PortDeviceType =
  | 'fan'
  | 'inline_fan'
  | 'clip_fan'
  | 'light'
  | 'humidifier'
  | 'dehumidifier'
  | 'heater'
  | 'ac'
  | 'cooler'
  | 'outlet'
  | 'pump'
  | 'heatmat';

// ============================================
// Port Icon Map
// ============================================

export interface PortIconConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
  label: string;
}

/**
 * Complete port device type → icon + color mapping
 * Following the EnviroFlow UI Icon Reference Guide
 */
export const portIconMap: Record<string, PortIconConfig> = {
  // Fans - Cyan (#00d4ff)
  fan: {
    icon: Fan,
    color: '#00d4ff',
    bg: 'rgba(0,212,255,0.10)',
    label: 'Fan',
  },
  inline_fan: {
    icon: Wind,
    color: '#00d4ff',
    bg: 'rgba(0,212,255,0.10)',
    label: 'Inline Fan',
  },
  clip_fan: {
    icon: Fan,
    color: '#00d4ff',
    bg: 'rgba(0,212,255,0.10)',
    label: 'Clip Fan',
  },

  // Lights - Yellow (#ffd740)
  light: {
    icon: Sun,
    color: '#ffd740',
    bg: 'rgba(255,215,64,0.10)',
    label: 'Grow Light',
  },

  // Water/Humidity - Light Blue (#4fc3f7)
  humidifier: {
    icon: Droplets,
    color: '#4fc3f7',
    bg: 'rgba(79,195,247,0.10)',
    label: 'Humidifier',
  },
  dehumidifier: {
    icon: AirVent,
    color: '#4fc3f7',
    bg: 'rgba(79,195,247,0.10)',
    label: 'Dehumidifier',
  },
  pump: {
    icon: Waves,
    color: '#4fc3f7',
    bg: 'rgba(79,195,247,0.10)',
    label: 'Water Pump',
  },

  // Heat - Red (#ff5252)
  heater: {
    icon: Flame,
    color: '#ff5252',
    bg: 'rgba(255,82,82,0.10)',
    label: 'Heater',
  },
  heatmat: {
    icon: Thermometer,
    color: '#ff9100',
    bg: 'rgba(255,145,0,0.10)',
    label: 'Heat Mat',
  },

  // Cooling - Teal (#80deea)
  ac: {
    icon: AirVent,
    color: '#80deea',
    bg: 'rgba(128,222,234,0.10)',
    label: 'Air Conditioner',
  },
  cooler: {
    icon: AirVent,
    color: '#80deea',
    bg: 'rgba(128,222,234,0.10)',
    label: 'Cooler',
  },

  // Outlets - Orange (#ff9100)
  outlet: {
    icon: Plug,
    color: '#ff9100',
    bg: 'rgba(255,145,0,0.10)',
    label: 'Outlet',
  },
};

/**
 * Default icon config for unknown device types
 */
export const defaultPortIcon: PortIconConfig = {
  icon: Power,
  color: '#ff9100',
  bg: 'rgba(255,145,0,0.10)',
  label: 'Device',
};

/**
 * Get icon configuration for a device type
 */
export function getPortIconConfig(deviceType: string | undefined): PortIconConfig {
  if (!deviceType) return defaultPortIcon;
  const normalized = deviceType.toLowerCase().replace(/[\s-]/g, '_');
  return portIconMap[normalized] || defaultPortIcon;
}

// ============================================
// Controller/Device Types
// ============================================

export type ControllerDeviceType =
  | 'controller'
  | 'hygrometer'
  | 'sensor'
  | 'ai_controller'
  | 'smart_outlet';

export interface ControllerIconConfig {
  icon: LucideIcon;
  color: string;
  label: string;
}

/**
 * Controller device type → icon mapping
 */
export const controllerIconMap: Record<string, ControllerIconConfig> = {
  controller: {
    icon: Monitor,
    color: '#e8edf4',
    label: 'Controller',
  },
  hygrometer: {
    icon: Thermometer,
    color: '#e8edf4',
    label: 'Hygrometer',
  },
  sensor: {
    icon: Thermometer,
    color: '#e8edf4',
    label: 'Sensor',
  },
  ai_controller: {
    icon: BrainCircuit,
    color: '#b388ff',
    label: 'AI Controller',
  },
  smart_outlet: {
    icon: PlugZap,
    color: '#e8edf4',
    label: 'Smart Outlet',
  },
};

/**
 * Default controller icon config
 */
export const defaultControllerIcon: ControllerIconConfig = {
  icon: Monitor,
  color: '#e8edf4',
  label: 'Controller',
};

/**
 * Get icon configuration for a controller type
 */
export function getControllerIconConfig(controllerType: string | undefined): ControllerIconConfig {
  if (!controllerType) return defaultControllerIcon;
  const normalized = controllerType.toLowerCase().replace(/[\s-]/g, '_');
  return controllerIconMap[normalized] || defaultControllerIcon;
}

// ============================================
// Status Icons
// ============================================

export const statusIcons = {
  wifiConnected: Wifi,
  bluetooth: Bluetooth,
  alarm: AlertTriangle,
  trendUp: TrendingUp,
  trendDown: TrendingDown,
  steady: Minus,
};

export const statusColors = {
  online: '#00e676',
  stale: '#ff9100',
  offline: '#ff5252',
  alarm: '#ff5252',
  wifi: '#00d4ff',
};

// ============================================
// Navigation/Action Icons
// ============================================

export const navIcons = {
  settings: Settings,
  add: Plus,
  back: ChevronLeft,
  expand: ChevronDown,
  info: Info,
  export: FileDown,
  share: Share,
};

// ============================================
// Icon Size Presets
// ============================================

export const iconSizes = {
  meta: 12,      // Meta inline (connectivity status)
  portChip: 14,  // Inside 24x24 container for port chips
  portTile: 16,  // Port tiles, small contexts
  cardHeader: 20, // Card headers
  feature: 28,   // Feature cards
  empty: 40,     // Empty states
} as const;

// ============================================
// CSS Classes for Icon Containers
// ============================================

/**
 * Get container classes for port chip icons
 * Following spec: 24×24px container with rounded corners, 10% opacity bg
 */
export function getPortChipContainerClass(deviceType: string | undefined): string {
  const config = getPortIconConfig(deviceType);
  return `w-6 h-6 rounded-md flex items-center justify-center`;
}

/**
 * Get inline style for port chip container background
 */
export function getPortChipContainerStyle(deviceType: string | undefined): React.CSSProperties {
  const config = getPortIconConfig(deviceType);
  return { backgroundColor: config.bg };
}
