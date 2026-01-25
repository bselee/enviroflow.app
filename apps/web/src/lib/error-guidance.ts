/**
 * Error Guidance System
 *
 * Provides user-friendly error messages with actionable troubleshooting steps.
 * This system transforms technical errors into helpful guidance that empowers
 * users to resolve issues themselves.
 *
 * Philosophy: Every error should tell the user:
 * 1. WHAT went wrong (in plain language)
 * 2. WHY it might have happened (common causes)
 * 3. HOW to fix it (specific steps)
 * 4. WHERE to get help (if self-service fails)
 */

// ============================================
// Error Types
// ============================================

export type ErrorCategory =
  | 'auth'           // Authentication/login issues
  | 'credentials'    // Invalid or expired credentials
  | 'network'        // Network connectivity problems
  | 'offline'        // Controller/device is offline
  | 'not_found'      // Resource doesn't exist
  | 'rate_limit'     // Too many requests
  | 'validation'     // Invalid input data
  | 'server'         // Server-side errors
  | 'configuration'  // Missing config (encryption key, etc.)
  | 'timeout'        // Request timed out
  | 'unknown'        // Unknown error

export interface ErrorGuidance {
  /** Error category for styling/icons */
  category: ErrorCategory
  /** Short, user-friendly title */
  title: string
  /** Detailed explanation of what went wrong */
  message: string
  /** Specific troubleshooting steps */
  steps: string[]
  /** Primary action the user should take */
  primaryAction?: {
    label: string
    action: 'retry' | 'login' | 'update_credentials' | 'check_status' | 'contact_support' | 'wait' | 'refresh'
  }
  /** Whether the user should retry */
  retryable: boolean
  /** How long to wait before retry (in seconds) */
  retryAfter?: number
  /** Link to documentation or help */
  helpUrl?: string
  /** Support contact info */
  supportInfo?: string
  /** Whether a brand-specific guide is available */
  brandGuideAvailable?: boolean
}

// ============================================
// Error Classification
// ============================================

/**
 * Classify an error based on its message or status code
 */
export function classifyError(
  error: string | Error | { error?: string; message?: string; status?: number },
  statusCode?: number
): ErrorCategory {
  const message = typeof error === 'string'
    ? error.toLowerCase()
    : error instanceof Error
      ? error.message.toLowerCase()
      : (error.error || error.message || '').toLowerCase()

  const status = statusCode || (typeof error === 'object' && 'status' in error ? error.status : undefined)

  // Auth errors
  if (status === 401 || status === 403 ||
      message.includes('unauthorized') ||
      message.includes('invalid token') ||
      message.includes('session expired')) {
    return 'auth'
  }

  // Credential errors
  if (message.includes('invalid email') ||
      message.includes('invalid password') ||
      message.includes('credentials') ||
      message.includes('email not found') ||
      message.includes('authentication failed') ||
      message.includes('login failed')) {
    return 'credentials'
  }

  // Network errors
  if (message.includes('network') ||
      message.includes('fetch') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('connection refused') ||
      message.includes('dns')) {
    return 'network'
  }

  // Offline errors
  if (message.includes('offline') ||
      message.includes('unreachable') ||
      message.includes('not connected') ||
      message.includes('controller is offline')) {
    return 'offline'
  }

  // Not found errors
  if (status === 404 ||
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('no devices found')) {
    return 'not_found'
  }

  // Rate limit errors
  if (status === 429 ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('slow down')) {
    return 'rate_limit'
  }

  // Validation errors
  if (status === 400 ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('validation')) {
    return 'validation'
  }

  // Configuration errors
  if (message.includes('configuration') ||
      message.includes('encryption') ||
      message.includes('not configured') ||
      message.includes('missing key')) {
    return 'configuration'
  }

  // Timeout errors
  if (message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('took too long')) {
    return 'timeout'
  }

  // Server errors
  if (status && status >= 500) {
    return 'server'
  }

  return 'unknown'
}

// ============================================
// Guidance Templates
// ============================================

const GUIDANCE_TEMPLATES: Record<ErrorCategory, Omit<ErrorGuidance, 'message'>> = {
  auth: {
    category: 'auth',
    title: 'Session Expired',
    steps: [
      'Your login session has expired',
      'Click "Log In" to sign in again',
      'If the problem persists, try clearing your browser cookies'
    ],
    primaryAction: { label: 'Log In', action: 'login' },
    retryable: false,
    helpUrl: '/login'
  },

  credentials: {
    category: 'credentials',
    title: 'Authentication Failed',
    steps: [
      'Double-check your email address is correct',
      'Verify your password (try logging into the official app)',
      'If you recently changed your password, use the new one',
      'Some brands require API keys instead of passwords',
      'Reset your password if you\'ve forgotten it'
    ],
    primaryAction: { label: 'Update Credentials', action: 'update_credentials' },
    retryable: true,
    helpUrl: '/reset-password'
  },

  network: {
    category: 'network',
    title: 'Connection Problem',
    steps: [
      'Check your internet connection is working',
      'Verify the controller brand\'s cloud service is online',
      'If using VPN, try disabling it temporarily',
      'Check if your firewall is blocking the connection',
      'Try from a different network (mobile hotspot)',
      'Contact your network administrator if on corporate network'
    ],
    primaryAction: { label: 'Try Again', action: 'retry' },
    retryable: true,
    retryAfter: 5,
    helpUrl: '/troubleshooting/network'
  },

  offline: {
    category: 'offline',
    title: 'Device Offline',
    steps: [
      'Check if the controller is powered on and display is lit',
      'Verify the controller shows online in its official app',
      'Check if the WiFi/cloud indicator light is on',
      'Ensure your WiFi router is working properly',
      'Try power cycling the controller (unplug, wait 10 seconds, plug back in)',
      'Move the controller closer to your WiFi router if signal is weak',
      'For WiFi controllers: ensure you\'re on 2.4GHz network, not 5GHz'
    ],
    primaryAction: { label: 'Refresh Status', action: 'refresh' },
    retryable: true,
    retryAfter: 30,
    helpUrl: '/troubleshooting/offline'
  },

  not_found: {
    category: 'not_found',
    title: 'Not Found',
    steps: [
      'The item you\'re looking for doesn\'t exist or was removed',
      'If this is a controller, it may have been deleted',
      'Try refreshing the page to see the latest data'
    ],
    primaryAction: { label: 'Refresh', action: 'refresh' },
    retryable: false
  },

  rate_limit: {
    category: 'rate_limit',
    title: 'Too Many Requests',
    steps: [
      'You\'ve made too many requests in a short time',
      'The controller brand\'s API has rate limits to prevent abuse',
      'Please wait 60 seconds before trying again',
      'If this happens frequently, reduce your polling frequency',
      'Close other apps that might be using the same account',
      'This limit protects the service for all users'
    ],
    primaryAction: { label: 'Wait & Retry', action: 'wait' },
    retryable: true,
    retryAfter: 60
  },

  validation: {
    category: 'validation',
    title: 'Invalid Input',
    steps: [
      'Please check your input and correct any errors',
      'Make sure all required fields are filled in',
      'Check that email addresses and other formats are correct'
    ],
    primaryAction: { label: 'Fix & Retry', action: 'retry' },
    retryable: true
  },

  server: {
    category: 'server',
    title: 'Service Temporarily Unavailable',
    steps: [
      'The controller brand\'s servers are experiencing issues',
      'This could also be a temporary EnviroFlow server problem',
      'This is usually temporary - please try again in a few minutes',
      'Check if the controller brand\'s app is working',
      'If only EnviroFlow is affected, check our status page',
      'If the problem persists for more than 30 minutes, contact support'
    ],
    primaryAction: { label: 'Try Again', action: 'retry' },
    retryable: true,
    retryAfter: 30,
    helpUrl: '/troubleshooting/server-errors',
    supportInfo: 'support@enviroflow.app'
  },

  configuration: {
    category: 'configuration',
    title: 'Configuration Error',
    steps: [
      'There\'s a problem with the server configuration',
      'This is not something you can fix yourself',
      'Please contact support so we can resolve this quickly'
    ],
    primaryAction: { label: 'Contact Support', action: 'contact_support' },
    retryable: false,
    supportInfo: 'support@enviroflow.app'
  },

  timeout: {
    category: 'timeout',
    title: 'Request Timed Out',
    steps: [
      'The request took too long to complete',
      'This could be due to slow internet or a busy server',
      'Please try again in a moment'
    ],
    primaryAction: { label: 'Try Again', action: 'retry' },
    retryable: true,
    retryAfter: 10
  },

  unknown: {
    category: 'unknown',
    title: 'Something Went Wrong',
    steps: [
      'An unexpected error occurred',
      'Try refreshing the page',
      'If the problem continues, please contact support with details about what you were doing'
    ],
    primaryAction: { label: 'Try Again', action: 'retry' },
    retryable: true,
    supportInfo: 'support@enviroflow.app'
  }
}

// ============================================
// Brand-Specific Guidance
// ============================================

export type ControllerBrand = 'ac_infinity' | 'inkbird' | 'csv_upload' | 'mqtt' | string

interface BrandGuidance {
  connectionSteps: string[]
  credentialHelp: string
  offlineSteps: string[]
  appName: string
  supportUrl?: string
}

const BRAND_GUIDANCE: Record<string, BrandGuidance> = {
  ac_infinity: {
    appName: 'AC Infinity',
    connectionSteps: [
      'Verify you have a WiFi-capable controller (69 WiFi, 69 Pro, 69 Pro+, or AI+)',
      'Make sure your controller is connected to 2.4GHz WiFi (not 5GHz)',
      'Check that the WiFi/cloud icon appears in the AC Infinity app',
      'Try logging out and back into the AC Infinity app to refresh',
      'Bluetooth-only controllers (67, base 69) are NOT supported'
    ],
    credentialHelp: 'Use the same email and password you use to log into the AC Infinity app. If you recently changed your password, use the new one.',
    offlineSteps: [
      'Open the AC Infinity app and check if the controller shows online',
      'Verify the WiFi/cloud icon is visible on the controller screen',
      'Power cycle the controller (unplug for 10 seconds, then plug back in)',
      'Check your router - the controller requires a stable 2.4GHz connection',
      'Move the controller closer to your WiFi router if signal is weak',
      'Make sure your controller firmware is up to date via the AC Infinity app'
    ],
    supportUrl: 'https://www.acinfinity.com/contact/'
  },

  inkbird: {
    appName: 'Inkbird',
    connectionSteps: [
      'Inkbird devices use the Tuya platform',
      'Currently, direct cloud connection is not supported',
      'Use CSV Upload to manually import your sensor data',
      'Full Inkbird support is coming soon!'
    ],
    credentialHelp: 'Inkbird integration is coming soon. For now, please use CSV Upload.',
    offlineSteps: [
      'Check if the device shows online in the Inkbird app',
      'Ensure the device is connected to your WiFi network',
      'Try power cycling the device'
    ],
    supportUrl: 'https://www.inkbird.com/pages/contact-us'
  },

  csv_upload: {
    appName: 'CSV Upload',
    connectionSteps: [
      'CSV Upload doesn\'t require a network connection',
      'Download our CSV template to ensure correct formatting',
      'Fill in your sensor readings and upload the file'
    ],
    credentialHelp: 'CSV Upload doesn\'t require credentials - just upload your data file.',
    offlineSteps: [
      'CSV Upload data is manually entered',
      'To update readings, upload a new CSV file',
      'Consider connecting a WiFi-enabled controller for automatic updates'
    ]
  },

  mqtt: {
    appName: 'MQTT',
    connectionSteps: [
      'Verify your MQTT broker URL is correct (include ws:// or wss://)',
      'Check that your broker supports WebSocket connections',
      'Confirm your username and password are correct',
      'Verify the topic path matches your device configuration'
    ],
    credentialHelp: 'You need your MQTT broker URL, credentials (if required), and the topic for your device.',
    offlineSteps: [
      'Check if your MQTT broker is running',
      'Verify the device is publishing to the correct topic',
      'Check broker logs for connection issues',
      'Ensure firewall allows WebSocket connections'
    ]
  }
}

// ============================================
// Main Guidance Function
// ============================================

/**
 * Get comprehensive error guidance for a given error
 */
export function getErrorGuidance(
  error: string | Error | { error?: string; message?: string; status?: number; details?: string },
  options?: {
    brand?: ControllerBrand
    context?: 'connection' | 'sensors' | 'discovery' | 'general'
    statusCode?: number
  }
): ErrorGuidance {
  const category = classifyError(error, options?.statusCode)
  const template = GUIDANCE_TEMPLATES[category]
  const brandInfo = options?.brand ? BRAND_GUIDANCE[options.brand] : undefined

  // Extract the actual error message
  const errorMessage = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : error.error || error.message || 'An unexpected error occurred'

  // Build the guidance
  const guidance: ErrorGuidance = {
    ...template,
    message: errorMessage
  }

  // Add brand-specific steps for certain error types
  if (brandInfo) {
    if (category === 'credentials') {
      guidance.steps = [
        brandInfo.credentialHelp,
        ...template.steps,
        `View the ${brandInfo.appName} Connection Guide for detailed troubleshooting`
      ]
    } else if (category === 'offline') {
      guidance.steps = [
        ...brandInfo.offlineSteps,
        `Check the ${brandInfo.appName} Connection Guide for more help`
      ]
    } else if (category === 'network' && options?.context === 'connection') {
      guidance.steps = [
        ...brandInfo.connectionSteps,
        `See the ${brandInfo.appName} Connection Guide for step-by-step instructions`
      ]
    }

    // Add brand support URL if available
    if (brandInfo.supportUrl && (category === 'offline' || category === 'credentials')) {
      guidance.helpUrl = brandInfo.supportUrl
    }

    // Add link to brand-specific guide
    // This will be rendered as a button in the ErrorGuidance component
    guidance.brandGuideAvailable = true
  }

  // Context-specific adjustments
  if (options?.context === 'discovery') {
    if (category === 'not_found') {
      guidance.title = 'No Devices Found'
      guidance.steps = [
        `Make sure you have devices registered in the ${brandInfo?.appName || 'controller'} app`,
        'Try logging out and back into the official app to refresh devices',
        'New devices may take a few minutes to appear after setup'
      ]
    }
  }

  return guidance
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get a simple user-friendly message for quick display (e.g., toasts)
 */
export function getSimpleErrorMessage(
  error: string | Error | { error?: string; message?: string },
  brand?: ControllerBrand
): string {
  const guidance = getErrorGuidance(error, { brand })
  return `${guidance.title}: ${guidance.steps[0]}`
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(
  error: string | Error | { error?: string; message?: string; status?: number }
): boolean {
  const category = classifyError(error)
  return GUIDANCE_TEMPLATES[category].retryable
}

/**
 * Get icon name for an error category (for use with Lucide icons)
 */
export function getErrorIcon(category: ErrorCategory): string {
  const icons: Record<ErrorCategory, string> = {
    auth: 'LogIn',
    credentials: 'KeyRound',
    network: 'WifiOff',
    offline: 'PowerOff',
    not_found: 'SearchX',
    rate_limit: 'Clock',
    validation: 'AlertCircle',
    server: 'ServerCrash',
    configuration: 'Settings',
    timeout: 'Timer',
    unknown: 'HelpCircle'
  }
  return icons[category]
}

/**
 * Get color class for an error category (Tailwind classes)
 */
export function getErrorColor(category: ErrorCategory): {
  bg: string
  text: string
  border: string
  icon: string
} {
  const colors: Record<ErrorCategory, { bg: string; text: string; border: string; icon: string }> = {
    auth: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-500' },
    credentials: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-500' },
    network: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-800 dark:text-red-200', border: 'border-red-200 dark:border-red-800', icon: 'text-red-500' },
    offline: { bg: 'bg-gray-50 dark:bg-gray-900', text: 'text-gray-800 dark:text-gray-200', border: 'border-gray-200 dark:border-gray-700', icon: 'text-gray-500' },
    not_found: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-200 dark:border-blue-800', icon: 'text-blue-500' },
    rate_limit: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-500' },
    validation: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-500' },
    server: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-800 dark:text-red-200', border: 'border-red-200 dark:border-red-800', icon: 'text-red-500' },
    configuration: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-800 dark:text-red-200', border: 'border-red-200 dark:border-red-800', icon: 'text-red-500' },
    timeout: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-200 dark:border-amber-800', icon: 'text-amber-500' },
    unknown: { bg: 'bg-gray-50 dark:bg-gray-900', text: 'text-gray-800 dark:text-gray-200', border: 'border-gray-200 dark:border-gray-700', icon: 'text-gray-500' }
  }
  return colors[category]
}

// ============================================
// Connection Diagnostics
// ============================================

/**
 * Connection diagnostic steps for troubleshooting controller discovery
 */
export interface ConnectionDiagnostics {
  title: string
  checks: Array<{
    step: string
    description: string
    expected: string
    troubleshoot?: string
  }>
}

/**
 * Get connection diagnostic guide for controller discovery issues
 */
export function getConnectionDiagnostics(brand: ControllerBrand): ConnectionDiagnostics {
  const diagnostics: Record<string, ConnectionDiagnostics> = {
    ac_infinity: {
      title: 'AC Infinity Connection Diagnostics',
      checks: [
        {
          step: '1. Verify controller compatibility',
          description: 'Check if your controller model supports WiFi/cloud features',
          expected: 'Controller should be 69 WiFi, 69 Pro, 69 Pro+, or AI+ model',
          troubleshoot: 'Bluetooth-only controllers (67, base 69) are NOT supported. Upgrade to a WiFi-capable model.'
        },
        {
          step: '2. Check WiFi connection',
          description: 'Verify the controller is connected to your 2.4GHz WiFi network',
          expected: 'WiFi/cloud icon should be visible on the controller screen',
          troubleshoot: 'AC Infinity controllers only support 2.4GHz WiFi, not 5GHz. Reconnect via the AC Infinity app.'
        },
        {
          step: '3. Verify cloud connectivity',
          description: 'Ensure the controller appears online in the AC Infinity app',
          expected: 'Controller shows "Online" status in the app',
          troubleshoot: 'Try logging out and back into the AC Infinity app to refresh the connection.'
        },
        {
          step: '4. Test credentials',
          description: 'Verify you can log into the AC Infinity app with the same credentials',
          expected: 'Login succeeds in the official app',
          troubleshoot: 'If login fails, reset your password at acinfinity.com'
        },
        {
          step: '5. Check firewall',
          description: 'Ensure your network allows connections to acinfinity.com',
          expected: 'No firewall blocking API requests',
          troubleshoot: 'Try from a different network (mobile hotspot) to rule out firewall issues.'
        }
      ]
    },
    ecowitt: {
      title: 'Ecowitt Connection Diagnostics',
      checks: [
        {
          step: '1. Verify API key',
          description: 'Check that you have generated an Application Key in the Ecowitt app',
          expected: 'Application Key and API Key visible in app settings',
          troubleshoot: 'Generate keys: Ecowitt app > Menu > Settings > API'
        },
        {
          step: '2. Check gateway status',
          description: 'Verify the weather station gateway is online',
          expected: 'Gateway shows online in Ecowitt app with recent data',
          troubleshoot: 'Power cycle the gateway and check WiFi connection'
        },
        {
          step: '3. Verify sensor data',
          description: 'Check that sensors are reporting data to the gateway',
          expected: 'Recent readings visible in Ecowitt app',
          troubleshoot: 'Replace sensor batteries or move sensors closer to gateway'
        },
        {
          step: '4. Test MAC address',
          description: 'Enter the gateway MAC address correctly (no colons or dashes)',
          expected: 'MAC address format: ABC123DEF456',
          troubleshoot: 'Find MAC on gateway label or in Ecowitt app device info'
        }
      ]
    },
    inkbird: {
      title: 'Inkbird Connection Diagnostics',
      checks: [
        {
          step: '1. Note: Limited support',
          description: 'Inkbird direct cloud integration is not yet available',
          expected: 'Use CSV Upload to import Inkbird data manually',
          troubleshoot: 'Full Inkbird support is planned for a future update.'
        }
      ]
    },
    mqtt: {
      title: 'MQTT Connection Diagnostics',
      checks: [
        {
          step: '1. Verify broker URL',
          description: 'Check that the broker URL includes the protocol (ws:// or wss://)',
          expected: 'Format: ws://broker.example.com:9001 or wss://broker.example.com',
          troubleshoot: 'MQTT over WebSockets requires ws:// (insecure) or wss:// (secure) protocol'
        },
        {
          step: '2. Test broker accessibility',
          description: 'Ensure the MQTT broker is running and accepting connections',
          expected: 'Broker responds to connection attempts',
          troubleshoot: 'Check broker logs and ensure WebSocket port is open'
        },
        {
          step: '3. Verify credentials',
          description: 'If broker requires authentication, check username/password',
          expected: 'Credentials match broker configuration',
          troubleshoot: 'Some brokers allow anonymous connections - try without credentials first'
        },
        {
          step: '4. Check topic',
          description: 'Verify the MQTT topic matches your device configuration',
          expected: 'Topic format: enviroflow/sensors/# or similar',
          troubleshoot: 'Use MQTT client tool (like MQTT Explorer) to verify topic structure'
        }
      ]
    },
    csv_upload: {
      title: 'CSV Upload Guide',
      checks: [
        {
          step: '1. Download template',
          description: 'Use our CSV template for correct formatting',
          expected: 'Template includes all required columns',
          troubleshoot: 'Download from: /api/controllers/csv-template'
        },
        {
          step: '2. Format data correctly',
          description: 'Ensure timestamps are in ISO 8601 format',
          expected: 'Example: 2024-01-24T12:00:00Z',
          troubleshoot: 'Use Excel or Google Sheets to format dates properly'
        },
        {
          step: '3. Upload file',
          description: 'Select your CSV file and upload',
          expected: 'File size under 10MB, valid CSV format',
          troubleshoot: 'Remove extra columns not in the template'
        }
      ]
    }
  }

  return diagnostics[brand] || {
    title: 'Connection Diagnostics',
    checks: [
      {
        step: '1. Verify credentials',
        description: 'Check that your credentials are correct',
        expected: 'Login works in the official app',
        troubleshoot: 'Try resetting your password'
      },
      {
        step: '2. Check device status',
        description: 'Verify the device is online',
        expected: 'Device shows online in the official app',
        troubleshoot: 'Power cycle the device and check network connection'
      }
    ]
  }
}

/**
 * Get last seen time formatted for display
 */
export function formatLastSeen(lastSeen: string | Date | null): string {
  if (!lastSeen) {
    return 'Never'
  }

  const date = typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 1000 / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) {
    return 'Just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleDateString()
  }
}
