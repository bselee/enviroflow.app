/**
 * Built-in Workflow Templates
 * 
 * Pre-configured templates for common grow automation scenarios.
 * Each template contains:
 * - Metadata (name, description, category, tags)
 * - Node definitions with placeholder device references
 * - Edge connections between nodes
 * - Device requirements for mapping
 */

import type { WorkflowNode, WorkflowEdge } from "../types";

// Template metadata
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "climate" | "lighting" | "irrigation" | "safety" | "scheduling";
  tags: string[];
  /** Devices required by this template that need mapping */
  deviceRequirements: TemplateDeviceRequirement[];
  /** Sensor types this template reads from */
  sensorRequirements: TemplateSensorRequirement[];
  /** Preview image or icon */
  icon: string;
  /** Nodes with placeholder device IDs */
  nodes: WorkflowNode[];
  /** Edges connecting nodes */
  edges: WorkflowEdge[];
}

export interface TemplateDeviceRequirement {
  /** Placeholder ID used in template nodes */
  placeholderId: string;
  /** Human-readable name for mapping UI */
  label: string;
  /** Device type for auto-matching */
  deviceType: "fan" | "light" | "heater" | "cooler" | "humidifier" | "dehumidifier" | "outlet" | "pump" | "valve";
  /** Optional room hint for better auto-matching */
  roomHint?: string;
}

export interface TemplateSensorRequirement {
  /** Placeholder ID used in template nodes */
  placeholderId: string;
  /** Human-readable label */
  label: string;
  /** Sensor type */
  sensorType: "temperature" | "humidity" | "vpd" | "co2" | "light" | "soil_moisture" | "ph" | "ec";
}

/** Template category type */
export type TemplateCategory = "climate" | "lighting" | "irrigation" | "safety" | "scheduling";

/** Available template categories with labels */
export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategory; label: string }> = [
  { id: "climate", label: "Climate Control" },
  { id: "lighting", label: "Lighting" },
  { id: "irrigation", label: "Irrigation" },
  { id: "safety", label: "Safety" },
  { id: "scheduling", label: "Scheduling" },
];

// =============================================================================
// Built-in Templates
// =============================================================================

export const BUILTIN_TEMPLATES: WorkflowTemplate[] = [
  // -------------------------------------------------------------------------
  // VPD Control Template
  // -------------------------------------------------------------------------
  {
    id: "vpd-control",
    name: "VPD Control",
    description: "Automatically controls exhaust fan based on VPD readings. Maintains optimal VPD range (0.8-1.2 kPa) for healthy plant transpiration.",
    category: "climate",
    tags: ["vpd", "exhaust", "climate", "beginner"],
    icon: "thermometer",
    deviceRequirements: [
      { placeholderId: "exhaust_fan", label: "Exhaust Fan", deviceType: "fan" },
    ],
    sensorRequirements: [
      { placeholderId: "vpd_sensor", label: "VPD Sensor", sensorType: "vpd" },
    ],
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          label: "VPD Check",
          config: {
            triggerType: "sensor_threshold",
            sensorType: "vpd",
            operator: ">",
            threshold: 1.2,
            controllerId: "__PLACEHOLDER__vpd_sensor",
          },
        },
      },
      {
        id: "action-high",
        type: "action",
        position: { x: 400, y: 100 },
        data: {
          label: "Fan High",
          config: {
            controllerId: "__PLACEHOLDER__exhaust_fan",
            action: "set_speed",
            value: 80,
            deviceType: "fan",
          },
        },
      },
      {
        id: "trigger-2",
        type: "trigger",
        position: { x: 100, y: 400 },
        data: {
          label: "VPD Low",
          config: {
            triggerType: "sensor_threshold",
            sensorType: "vpd",
            operator: "<",
            threshold: 0.8,
            controllerId: "__PLACEHOLDER__vpd_sensor",
          },
        },
      },
      {
        id: "action-low",
        type: "action",
        position: { x: 400, y: 400 },
        data: {
          label: "Fan Low",
          config: {
            controllerId: "__PLACEHOLDER__exhaust_fan",
            action: "set_speed",
            value: 30,
            deviceType: "fan",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "action-high", sourceHandle: "output", targetHandle: "input" },
      { id: "e2", source: "trigger-2", target: "action-low", sourceHandle: "output", targetHandle: "input" },
    ],
  },

  // -------------------------------------------------------------------------
  // Lights Out Routine Template
  // -------------------------------------------------------------------------
  {
    id: "lights-out-routine",
    name: "Lights Out Routine",
    description: "Sequence of actions at lights-off time: dims lights gradually, reduces fan speed, adjusts humidity targets for nighttime.",
    category: "scheduling",
    tags: ["lights", "schedule", "night", "sequence"],
    icon: "moon",
    deviceRequirements: [
      { placeholderId: "grow_light", label: "Grow Light", deviceType: "light" },
      { placeholderId: "exhaust_fan", label: "Exhaust Fan", deviceType: "fan" },
    ],
    sensorRequirements: [],
    nodes: [
      {
        id: "trigger-schedule",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          label: "Lights Off Time",
          config: {
            triggerType: "schedule",
            simpleTime: "20:00",
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          },
        },
      },
      {
        id: "dim-lights",
        type: "action",
        position: { x: 350, y: 100 },
        data: {
          label: "Dim to 50%",
          config: {
            controllerId: "__PLACEHOLDER__grow_light",
            action: "set_level",
            value: 50,
            deviceType: "light",
          },
        },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 550, y: 100 },
        data: {
          label: "Wait 5 min",
          config: {
            duration: 5,
            unit: "minutes",
          },
        },
      },
      {
        id: "lights-off",
        type: "action",
        position: { x: 750, y: 100 },
        data: {
          label: "Lights Off",
          config: {
            controllerId: "__PLACEHOLDER__grow_light",
            action: "on_off",
            turnOn: false,
            deviceType: "light",
          },
        },
      },
      {
        id: "fan-low",
        type: "action",
        position: { x: 350, y: 300 },
        data: {
          label: "Fan to Night Mode",
          config: {
            controllerId: "__PLACEHOLDER__exhaust_fan",
            action: "set_speed",
            value: 40,
            deviceType: "fan",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-schedule", target: "dim-lights", sourceHandle: "output", targetHandle: "input" },
      { id: "e2", source: "dim-lights", target: "delay-1", sourceHandle: "output", targetHandle: "input" },
      { id: "e3", source: "delay-1", target: "lights-off", sourceHandle: "output", targetHandle: "input" },
      { id: "e4", source: "trigger-schedule", target: "fan-low", sourceHandle: "output", targetHandle: "input" },
    ],
  },

  // -------------------------------------------------------------------------
  // Heat Spike Response Template
  // -------------------------------------------------------------------------
  {
    id: "heat-spike-response",
    name: "Heat Spike Response",
    description: "Emergency cooling when temperature exceeds safe threshold. Maxes exhaust fan and sends notification. Includes 10-minute debounce to prevent flapping.",
    category: "safety",
    tags: ["temperature", "emergency", "safety", "exhaust"],
    icon: "flame",
    deviceRequirements: [
      { placeholderId: "exhaust_fan", label: "Exhaust Fan", deviceType: "fan" },
    ],
    sensorRequirements: [
      { placeholderId: "temp_sensor", label: "Temperature Sensor", sensorType: "temperature" },
    ],
    nodes: [
      {
        id: "trigger-heat",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          label: "Temp > 90°F",
          config: {
            triggerType: "sensor_threshold",
            sensorType: "temperature",
            operator: ">",
            threshold: 90,
            controllerId: "__PLACEHOLDER__temp_sensor",
          },
        },
      },
      {
        id: "debounce-1",
        type: "debounce",
        position: { x: 300, y: 200 },
        data: {
          label: "10 min cooldown",
          config: {
            cooldownSeconds: 600,
            executeOnLead: true,
            executeOnTrail: false,
          },
        },
      },
      {
        id: "action-max-fan",
        type: "action",
        position: { x: 500, y: 150 },
        data: {
          label: "Fan to MAX",
          config: {
            controllerId: "__PLACEHOLDER__exhaust_fan",
            action: "set_speed",
            value: 100,
            deviceType: "fan",
          },
        },
      },
      {
        id: "notify-1",
        type: "notification",
        position: { x: 500, y: 280 },
        data: {
          label: "Alert: High Temp",
          config: {
            message: "Temperature spike detected! Exhaust fan set to maximum.",
            priority: "high",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-heat", target: "debounce-1", sourceHandle: "output", targetHandle: "input" },
      { id: "e2", source: "debounce-1", target: "action-max-fan", sourceHandle: "output", targetHandle: "input" },
      { id: "e3", source: "debounce-1", target: "notify-1", sourceHandle: "output", targetHandle: "input" },
    ],
  },

  // -------------------------------------------------------------------------
  // Humidity Control Template
  // -------------------------------------------------------------------------
  {
    id: "humidity-control",
    name: "Humidity Control",
    description: "Coordinated control of humidifier and dehumidifier to maintain optimal humidity range (50-65% RH). Includes mutual exclusion to prevent both running simultaneously.",
    category: "climate",
    tags: ["humidity", "humidifier", "dehumidifier", "climate"],
    icon: "droplet",
    deviceRequirements: [
      { placeholderId: "humidifier", label: "Humidifier", deviceType: "humidifier" },
      { placeholderId: "dehumidifier", label: "Dehumidifier", deviceType: "dehumidifier" },
    ],
    sensorRequirements: [
      { placeholderId: "humidity_sensor", label: "Humidity Sensor", sensorType: "humidity" },
    ],
    nodes: [
      {
        id: "trigger-low-humidity",
        type: "trigger",
        position: { x: 100, y: 150 },
        data: {
          label: "Humidity < 50%",
          config: {
            triggerType: "sensor_threshold",
            sensorType: "humidity",
            operator: "<",
            threshold: 50,
            controllerId: "__PLACEHOLDER__humidity_sensor",
          },
        },
      },
      {
        id: "humidifier-on",
        type: "action",
        position: { x: 400, y: 100 },
        data: {
          label: "Humidifier ON",
          config: {
            controllerId: "__PLACEHOLDER__humidifier",
            action: "on_off",
            turnOn: true,
            deviceType: "humidifier",
          },
        },
      },
      {
        id: "dehumidifier-off-1",
        type: "action",
        position: { x: 400, y: 200 },
        data: {
          label: "Dehumidifier OFF",
          config: {
            controllerId: "__PLACEHOLDER__dehumidifier",
            action: "on_off",
            turnOn: false,
            deviceType: "dehumidifier",
          },
        },
      },
      {
        id: "trigger-high-humidity",
        type: "trigger",
        position: { x: 100, y: 400 },
        data: {
          label: "Humidity > 65%",
          config: {
            triggerType: "sensor_threshold",
            sensorType: "humidity",
            operator: ">",
            threshold: 65,
            controllerId: "__PLACEHOLDER__humidity_sensor",
          },
        },
      },
      {
        id: "dehumidifier-on",
        type: "action",
        position: { x: 400, y: 350 },
        data: {
          label: "Dehumidifier ON",
          config: {
            controllerId: "__PLACEHOLDER__dehumidifier",
            action: "on_off",
            turnOn: true,
            deviceType: "dehumidifier",
          },
        },
      },
      {
        id: "humidifier-off-1",
        type: "action",
        position: { x: 400, y: 450 },
        data: {
          label: "Humidifier OFF",
          config: {
            controllerId: "__PLACEHOLDER__humidifier",
            action: "on_off",
            turnOn: false,
            deviceType: "humidifier",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-low-humidity", target: "humidifier-on", sourceHandle: "output", targetHandle: "input" },
      { id: "e2", source: "trigger-low-humidity", target: "dehumidifier-off-1", sourceHandle: "output", targetHandle: "input" },
      { id: "e3", source: "trigger-high-humidity", target: "dehumidifier-on", sourceHandle: "output", targetHandle: "input" },
      { id: "e4", source: "trigger-high-humidity", target: "humidifier-off-1", sourceHandle: "output", targetHandle: "input" },
    ],
  },

  // -------------------------------------------------------------------------
  // Sunrise Wake-up Template
  // -------------------------------------------------------------------------
  {
    id: "sunrise-wakeup",
    name: "Sunrise Wake-up",
    description: "Gradual light increase at sunrise to simulate natural dawn. Ramps light from 0% to 100% over 30 minutes.",
    category: "lighting",
    tags: ["sunrise", "lights", "dawn", "gradual"],
    icon: "sunrise",
    deviceRequirements: [
      { placeholderId: "grow_light", label: "Grow Light", deviceType: "light" },
    ],
    sensorRequirements: [],
    nodes: [
      {
        id: "trigger-sunrise",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          label: "At Sunrise",
          config: {
            triggerType: "schedule",
            simpleTime: "06:00",
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          },
        },
      },
      {
        id: "light-25",
        type: "action",
        position: { x: 300, y: 200 },
        data: {
          label: "Light 25%",
          config: {
            controllerId: "__PLACEHOLDER__grow_light",
            action: "set_level",
            value: 25,
            deviceType: "light",
          },
        },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 450, y: 200 },
        data: {
          label: "Wait 10 min",
          config: { duration: 10, unit: "minutes" },
        },
      },
      {
        id: "light-50",
        type: "action",
        position: { x: 600, y: 200 },
        data: {
          label: "Light 50%",
          config: {
            controllerId: "__PLACEHOLDER__grow_light",
            action: "set_level",
            value: 50,
            deviceType: "light",
          },
        },
      },
      {
        id: "delay-2",
        type: "delay",
        position: { x: 750, y: 200 },
        data: {
          label: "Wait 10 min",
          config: { duration: 10, unit: "minutes" },
        },
      },
      {
        id: "light-75",
        type: "action",
        position: { x: 900, y: 200 },
        data: {
          label: "Light 75%",
          config: {
            controllerId: "__PLACEHOLDER__grow_light",
            action: "set_level",
            value: 75,
            deviceType: "light",
          },
        },
      },
      {
        id: "delay-3",
        type: "delay",
        position: { x: 1050, y: 200 },
        data: {
          label: "Wait 10 min",
          config: { duration: 10, unit: "minutes" },
        },
      },
      {
        id: "light-100",
        type: "action",
        position: { x: 1200, y: 200 },
        data: {
          label: "Light 100%",
          config: {
            controllerId: "__PLACEHOLDER__grow_light",
            action: "set_level",
            value: 100,
            deviceType: "light",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-sunrise", target: "light-25", sourceHandle: "output", targetHandle: "input" },
      { id: "e2", source: "light-25", target: "delay-1", sourceHandle: "output", targetHandle: "input" },
      { id: "e3", source: "delay-1", target: "light-50", sourceHandle: "output", targetHandle: "input" },
      { id: "e4", source: "light-50", target: "delay-2", sourceHandle: "output", targetHandle: "input" },
      { id: "e5", source: "delay-2", target: "light-75", sourceHandle: "output", targetHandle: "input" },
      { id: "e6", source: "light-75", target: "delay-3", sourceHandle: "output", targetHandle: "input" },
      { id: "e7", source: "delay-3", target: "light-100", sourceHandle: "output", targetHandle: "input" },
    ],
  },

  // -------------------------------------------------------------------------
  // CO2 Enrichment Template
  // -------------------------------------------------------------------------
  {
    id: "co2-enrichment",
    name: "CO2 Enrichment",
    description: "Maintains CO2 levels during lights-on period. Only activates when lights are on and CO2 drops below 800ppm.",
    category: "climate",
    tags: ["co2", "enrichment", "advanced"],
    icon: "wind",
    deviceRequirements: [
      { placeholderId: "co2_valve", label: "CO2 Solenoid/Valve", deviceType: "valve" },
    ],
    sensorRequirements: [
      { placeholderId: "co2_sensor", label: "CO2 Sensor", sensorType: "co2" },
    ],
    nodes: [
      {
        id: "trigger-co2-low",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          label: "CO2 < 800ppm",
          config: {
            triggerType: "sensor_threshold",
            sensorType: "co2",
            operator: "<",
            threshold: 800,
            controllerId: "__PLACEHOLDER__co2_sensor",
          },
        },
      },
      {
        id: "co2-on",
        type: "action",
        position: { x: 350, y: 150 },
        data: {
          label: "CO2 Valve ON",
          config: {
            controllerId: "__PLACEHOLDER__co2_valve",
            action: "on_off",
            turnOn: true,
            deviceType: "valve",
          },
        },
      },
      {
        id: "delay-co2",
        type: "delay",
        position: { x: 550, y: 150 },
        data: {
          label: "Dispense 30s",
          config: { duration: 30, unit: "seconds" },
        },
      },
      {
        id: "co2-off",
        type: "action",
        position: { x: 750, y: 150 },
        data: {
          label: "CO2 Valve OFF",
          config: {
            controllerId: "__PLACEHOLDER__co2_valve",
            action: "on_off",
            turnOn: false,
            deviceType: "valve",
          },
        },
      },
      {
        id: "debounce-co2",
        type: "debounce",
        position: { x: 350, y: 280 },
        data: {
          label: "5 min cooldown",
          config: {
            cooldownSeconds: 300,
            executeOnLead: true,
            executeOnTrail: false,
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-co2-low", target: "debounce-co2", sourceHandle: "output", targetHandle: "input" },
      { id: "e2", source: "debounce-co2", target: "co2-on", sourceHandle: "output", targetHandle: "input" },
      { id: "e3", source: "co2-on", target: "delay-co2", sourceHandle: "output", targetHandle: "input" },
      { id: "e4", source: "delay-co2", target: "co2-off", sourceHandle: "output", targetHandle: "input" },
    ],
  },

  // -------------------------------------------------------------------------
  // Lights On Routine Template
  // -------------------------------------------------------------------------
  {
    id: "lights-on-routine",
    name: "Lights On Routine",
    description: "Sequence of actions when lights turn on: boost exhaust fan for daytime cooling, enable CO2 enrichment, adjust humidity targets.",
    category: "lighting",
    tags: ["lights", "on", "daytime", "sequence", "event"],
    icon: "sunrise",
    deviceRequirements: [
      { placeholderId: "grow_light", label: "Grow Light", deviceType: "light" },
      { placeholderId: "exhaust_fan", label: "Exhaust Fan", deviceType: "fan" },
    ],
    sensorRequirements: [],
    nodes: [
      {
        id: "trigger-lights-on",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          label: "When Lights ON",
          config: {
            triggerType: "lights_on",
            controllerId: "__PLACEHOLDER__grow_light",
          },
        },
      },
      {
        id: "fan-daytime",
        type: "action",
        position: { x: 350, y: 150 },
        data: {
          label: "Fan to Day Mode",
          config: {
            controllerId: "__PLACEHOLDER__exhaust_fan",
            action: "set_speed",
            value: 70,
            deviceType: "fan",
          },
        },
      },
      {
        id: "notify-lights-on",
        type: "notification",
        position: { x: 350, y: 280 },
        data: {
          label: "Lights On Alert",
          config: {
            message: "Grow lights have turned ON. Daytime mode activated.",
            priority: "low",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-lights-on", target: "fan-daytime", sourceHandle: "output", targetHandle: "input" },
      { id: "e2", source: "trigger-lights-on", target: "notify-lights-on", sourceHandle: "output", targetHandle: "input" },
    ],
  },

  // -------------------------------------------------------------------------
  // Lights Off Routine Template
  // -------------------------------------------------------------------------
  {
    id: "lights-off-routine",
    name: "Lights Off Routine",
    description: "Sequence of actions when lights turn off: reduce exhaust fan for nighttime, disable CO2, lower humidity target to prevent mold.",
    category: "lighting",
    tags: ["lights", "off", "night", "sequence", "event"],
    icon: "moon",
    deviceRequirements: [
      { placeholderId: "grow_light", label: "Grow Light", deviceType: "light" },
      { placeholderId: "exhaust_fan", label: "Exhaust Fan", deviceType: "fan" },
    ],
    sensorRequirements: [],
    nodes: [
      {
        id: "trigger-lights-off",
        type: "trigger",
        position: { x: 100, y: 200 },
        data: {
          label: "When Lights OFF",
          config: {
            triggerType: "lights_off",
            controllerId: "__PLACEHOLDER__grow_light",
          },
        },
      },
      {
        id: "fan-nighttime",
        type: "action",
        position: { x: 350, y: 150 },
        data: {
          label: "Fan to Night Mode",
          config: {
            controllerId: "__PLACEHOLDER__exhaust_fan",
            action: "set_speed",
            value: 40,
            deviceType: "fan",
          },
        },
      },
      {
        id: "notify-lights-off",
        type: "notification",
        position: { x: 350, y: 280 },
        data: {
          label: "Lights Off Alert",
          config: {
            message: "Grow lights have turned OFF. Nighttime mode activated.",
            priority: "low",
          },
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-lights-off", target: "fan-nighttime", sourceHandle: "output", targetHandle: "input" },
      { id: "e2", source: "trigger-lights-off", target: "notify-lights-off", sourceHandle: "output", targetHandle: "input" },
    ],
  },
];

// =============================================================================
// Template Utilities
// =============================================================================

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: WorkflowTemplate["category"]): WorkflowTemplate[] {
  return BUILTIN_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get templates by tag
 */
export function getTemplatesByTag(tag: string): WorkflowTemplate[] {
  return BUILTIN_TEMPLATES.filter(t => t.tags.includes(tag.toLowerCase()));
}

/**
 * Search templates by name or description
 */
export function searchTemplates(query: string): WorkflowTemplate[] {
  const lowerQuery = query.toLowerCase();
  return BUILTIN_TEMPLATES.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.includes(lowerQuery))
  );
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return BUILTIN_TEMPLATES.find(t => t.id === id);
}

/**
 * Apply device mapping to a template, replacing placeholders with actual device IDs
 */
export function applyDeviceMapping(
  template: WorkflowTemplate,
  deviceMapping: Record<string, { controllerId: string; port?: number; controllerName?: string }>
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const mappedNodes = template.nodes.map(node => {
    const newNode = JSON.parse(JSON.stringify(node)) as WorkflowNode;
    
    // Replace placeholder IDs in node config
    if (newNode.data?.config) {
      const config = newNode.data.config as Record<string, unknown>;
      
      // Check for controller ID placeholders
      if (typeof config.controllerId === "string" && config.controllerId.startsWith("__PLACEHOLDER__")) {
        const placeholderId = config.controllerId.replace("__PLACEHOLDER__", "");
        const mapping = deviceMapping[placeholderId];
        if (mapping) {
          config.controllerId = mapping.controllerId;
          if (mapping.port !== undefined) {
            config.port = mapping.port;
          }
          if (mapping.controllerName) {
            config.controllerName = mapping.controllerName;
          }
        }
      }
    }
    
    return newNode;
  });

  return {
    nodes: mappedNodes,
    edges: [...template.edges],
  };
}

/**
 * Validate that all required devices are mapped
 */
export function validateDeviceMapping(
  template: WorkflowTemplate,
  deviceMapping: Record<string, { controllerId: string; port?: number }>
): { valid: boolean; missingDevices: string[] } {
  const missingDevices: string[] = [];
  
  for (const req of template.deviceRequirements) {
    if (!deviceMapping[req.placeholderId]) {
      missingDevices.push(req.label);
    }
  }
  
  for (const req of template.sensorRequirements) {
    if (!deviceMapping[req.placeholderId]) {
      missingDevices.push(req.label);
    }
  }
  
  return {
    valid: missingDevices.length === 0,
    missingDevices,
  };
}
