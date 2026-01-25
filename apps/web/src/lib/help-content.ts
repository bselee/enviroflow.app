/**
 * Help Content Registry
 *
 * Central repository for all contextual help content displayed in tooltips,
 * modals, and inline help elements throughout EnviroFlow.
 *
 * Each help item includes:
 * - title: Display name for the help topic
 * - description: Detailed explanation shown in tooltips and modals
 * - icon: Optional emoji/icon for visual scanning
 * - links: External documentation or support links
 * - shortDescription: Brief text shown in tooltips (description shown in modals)
 */

export interface HelpLink {
  text: string;
  url: string;
}

export interface HelpContent {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  icon?: string;
  links?: HelpLink[];
}

/**
 * Help content registry organized by domain
 */
export const HELP_CONTENT: Record<string, HelpContent> = {
  // Controller Setup
  "controller-name": {
    id: "controller-name",
    title: "Controller Name",
    icon: "📝",
    shortDescription: "A friendly name to identify this controller",
    description:
      "Give your controller a descriptive name to easily identify it in your dashboard. Good names include the location (e.g., 'Veg Room A'), device type (e.g., 'AC Infinity Controller 69'), or purpose (e.g., 'Flowering Tent Fan'). You can change this name later in the controller settings.",
    links: [],
  },

  "controller-credentials": {
    id: "controller-credentials",
    title: "Account Credentials",
    icon: "🔐",
    shortDescription: "Your controller app login (encrypted at rest)",
    description:
      "Enter the email and password you use to log into your controller's mobile app (e.g., AC Infinity app or Inkbird app). These credentials are encrypted using AES-256-GCM before storage and are never shared with third parties. EnviroFlow uses them only to connect to your devices through the manufacturer's API.",
    links: [
      {
        text: "How we protect your data",
        url: "https://enviroflow.app/docs/security",
      },
    ],
  },

  "controller-email": {
    id: "controller-email",
    title: "Account Email",
    icon: "📧",
    shortDescription: "Email for your controller app account",
    description:
      "The email address associated with your controller's mobile app account. This is the same email you use to log into the AC Infinity app, Inkbird app, or other manufacturer apps. EnviroFlow uses this to authenticate with the manufacturer's cloud API on your behalf.",
    links: [],
  },

  "controller-password": {
    id: "controller-password",
    title: "Account Password",
    icon: "🔑",
    shortDescription: "Password for your controller app account",
    description:
      "Your controller app password is encrypted using AES-256-GCM encryption before being stored in the database. It's only used to authenticate with the manufacturer's cloud API and is never logged or shared. For security, consider using a unique password for your controller app.",
    links: [
      {
        text: "Security best practices",
        url: "https://enviroflow.app/docs/security#best-practices",
      },
    ],
  },

  "room-assignment": {
    id: "room-assignment",
    title: "Room Assignment",
    icon: "🏠",
    shortDescription: "Organize controllers by physical location",
    description:
      "Rooms help you organize controllers by physical location or grow zone. For example, you might create rooms called 'Veg Room A', 'Flower Tent 1', or 'Propagation Area'. Assigning controllers to rooms makes it easier to monitor multiple zones and set up zone-specific automations. You can always change or remove room assignments later.",
    links: [],
  },

  "room-name": {
    id: "room-name",
    title: "Room Name",
    icon: "🏠",
    shortDescription: "A descriptive name for this physical space",
    description:
      "Choose a name that clearly identifies this physical space or grow zone. Examples: 'Veg Room A', 'Flower Tent 1', 'Propagation Station', 'Main Grow Room', etc. Good room names help you quickly identify which space you're monitoring when viewing dashboards or setting up automations.",
    links: [],
  },

  "device-port": {
    id: "device-port",
    title: "Device Port",
    icon: "🔌",
    shortDescription: "Physical port number on the controller",
    description:
      "The physical port number where your device is connected to the controller. For example, on an AC Infinity Controller 69, Port 1 might control an inline fan, Port 2 an oscillating fan, and Ports 3-4 outlets. Check your controller's physical labels or mobile app to identify which port number corresponds to each device.",
    links: [],
  },

  "device-type": {
    id: "device-type",
    title: "Device Type",
    icon: "⚡",
    shortDescription: "Type of device connected to this port",
    description:
      "Select the type of device connected to this port. This helps EnviroFlow understand how to control the device and what commands are available. For example, fans can be controlled with speed settings (0-10), lights may support dimming, and outlets are simple on/off switches. Choose the option that best matches your connected hardware.",
    links: [],
  },

  "sensor-type": {
    id: "sensor-type",
    title: "Sensor Type",
    icon: "🌡️",
    shortDescription: "Type of environmental measurement",
    description:
      "The type of environmental data this sensor measures. Common types include temperature, humidity, VPD (Vapor Pressure Deficit), CO2, light intensity, and more. EnviroFlow uses sensor types to display appropriate units, create relevant charts, and suggest intelligent automations based on your growing conditions.",
    links: [
      {
        text: "Understanding VPD",
        url: "https://enviroflow.app/docs/vpd-guide",
      },
    ],
  },

  "vpd-calculation": {
    id: "vpd-calculation",
    title: "VPD Calculation",
    icon: "💧",
    shortDescription: "Vapor Pressure Deficit calculation method",
    description:
      "VPD (Vapor Pressure Deficit) is automatically calculated from temperature and humidity readings. EnviroFlow uses the standard horticultural formula: VPD = (1 - RH/100) × SVP, where SVP is the saturated vapor pressure at the given temperature. VPD is a critical metric for optimizing plant transpiration and growth.",
    links: [
      {
        text: "VPD guide for growers",
        url: "https://enviroflow.app/docs/vpd-guide",
      },
      {
        text: "Optimal VPD ranges",
        url: "https://enviroflow.app/docs/vpd-ranges",
      },
    ],
  },

  // Workflow Builder
  "workflow-trigger": {
    id: "workflow-trigger",
    title: "Workflow Trigger",
    icon: "⚡",
    shortDescription: "Condition that starts this automation",
    description:
      "Triggers define when your automation runs. Common triggers include sensor thresholds (e.g., 'when temperature exceeds 80°F'), schedules (e.g., 'every day at 6 AM'), or time-based conditions (e.g., 'after sunset'). You can combine multiple triggers using AND/OR logic for complex automations.",
    links: [
      {
        text: "Workflow examples",
        url: "https://enviroflow.app/docs/workflow-examples",
      },
    ],
  },

  "workflow-action": {
    id: "workflow-action",
    title: "Workflow Action",
    icon: "🎯",
    shortDescription: "What happens when the trigger activates",
    description:
      "Actions are what your automation does when triggered. Common actions include turning devices on/off, setting fan speeds, dimming lights, or sending notifications. You can chain multiple actions together and add delays between them for sophisticated control sequences.",
    links: [],
  },

  "workflow-condition": {
    id: "workflow-condition",
    title: "Workflow Condition",
    icon: "🔀",
    shortDescription: "Additional rules to refine when automation runs",
    description:
      "Conditions add extra requirements that must be met before actions execute. For example, 'only run between 6 AM and 10 PM' or 'only if humidity is below 60%'. Conditions help prevent unwanted automation runs and create more intelligent, context-aware automations.",
    links: [],
  },

  // CSV Upload
  "csv-upload": {
    id: "csv-upload",
    title: "CSV Data Upload",
    icon: "📊",
    shortDescription: "Import sensor data from spreadsheets",
    description:
      "Upload historical sensor data from CSV files. This is useful for importing data from controllers without API access, migrating from other systems, or analyzing historical trends. The CSV must include columns for timestamp, sensor type, and value. Download the template to see the required format.",
    links: [
      {
        text: "CSV format guide",
        url: "https://enviroflow.app/docs/csv-format",
      },
    ],
  },

  "csv-template": {
    id: "csv-template",
    title: "CSV Template",
    icon: "📄",
    shortDescription: "Download a properly formatted example file",
    description:
      "The CSV template shows the exact format EnviroFlow expects for data imports. Required columns include: timestamp (ISO 8601 format), sensor_type (e.g., 'temperature', 'humidity'), value (numeric), and optionally unit (e.g., '°F', '%'). Use this template as a starting point for your own data imports.",
    links: [],
  },

  // Discovery
  "network-discovery": {
    id: "network-discovery",
    title: "Network Discovery",
    icon: "📡",
    shortDescription: "Automatically find devices on your account",
    description:
      "Network discovery scans your manufacturer's cloud account (AC Infinity, Inkbird, etc.) to find all registered devices. This is the fastest way to add multiple controllers at once. Enter your app credentials, and EnviroFlow will retrieve a list of all devices associated with your account, including their current status and capabilities.",
    links: [
      {
        text: "Supported devices",
        url: "https://enviroflow.app/docs/supported-devices",
      },
    ],
  },

  "discovered-device": {
    id: "discovered-device",
    title: "Discovered Device",
    icon: "✅",
    shortDescription: "Device found in your cloud account",
    description:
      "This device was automatically discovered through your manufacturer's cloud API. The name, model, and capabilities are pre-filled based on your cloud account settings. You can customize the name before adding it to EnviroFlow. Online status indicates whether the device is currently connected to the manufacturer's cloud.",
    links: [],
  },

  // Notifications
  "notification-settings": {
    id: "notification-settings",
    title: "Notification Settings",
    icon: "🔔",
    shortDescription: "Choose how you receive alerts",
    description:
      "Configure how EnviroFlow notifies you about important events like sensor threshold breaches, device offline status, or automation failures. You can enable browser push notifications (requires permission), in-app notifications, or both. Notification preferences can be customized per alert type.",
    links: [
      {
        text: "Notification guide",
        url: "https://enviroflow.app/docs/notifications",
      },
    ],
  },

  // Data Export
  "data-export": {
    id: "data-export",
    title: "Data Export",
    icon: "💾",
    shortDescription: "Download your sensor data",
    description:
      "Export your sensor readings and automation logs in CSV or JSON format. This is useful for external analysis, backup purposes, or sharing data with consultants. You can filter by date range, sensor type, and room before exporting. Exports include all available metadata like timestamps, sensor types, and units.",
    links: [],
  },

  // AI Insights
  "ai-insights": {
    id: "ai-insights",
    title: "AI Insights",
    icon: "🤖",
    shortDescription: "AI-powered analysis of your environment",
    description:
      "EnviroFlow's AI analyzes your sensor data to identify trends, detect anomalies, and suggest optimizations. Powered by Grok AI, insights can help you spot issues like temperature fluctuations, humidity problems, or suboptimal VPD levels. AI suggestions are based on best practices for controlled environment agriculture.",
    links: [
      {
        text: "Understanding AI insights",
        url: "https://enviroflow.app/docs/ai-insights",
      },
    ],
  },

  // Growth Stages
  "growth-stage": {
    id: "growth-stage",
    title: "Growth Stage",
    icon: "🌱",
    shortDescription: "Current phase of plant development",
    description:
      "Growth stages help EnviroFlow provide stage-specific recommendations for temperature, humidity, and VPD. Common stages include: Seedling/Clone (high humidity), Vegetative (moderate conditions), Early Flower, Mid Flower, and Late Flower/Harvest (lower humidity). Setting the correct stage helps the AI provide more relevant insights.",
    links: [
      {
        text: "Optimal conditions by stage",
        url: "https://enviroflow.app/docs/growth-stages",
      },
    ],
  },
};

/**
 * Get help content by ID
 */
export function getHelpContent(id: string): HelpContent | undefined {
  return HELP_CONTENT[id];
}

/**
 * Search help content by keyword
 */
export function searchHelpContent(query: string): HelpContent[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(HELP_CONTENT).filter(
    (content) =>
      content.title.toLowerCase().includes(lowerQuery) ||
      content.description.toLowerCase().includes(lowerQuery) ||
      content.shortDescription?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get all help content IDs
 */
export function getAllHelpIds(): string[] {
  return Object.keys(HELP_CONTENT);
}
