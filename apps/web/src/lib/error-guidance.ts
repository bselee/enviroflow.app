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
    title: 'Invalid Credentials',
    steps: [
      'Double-check your email address is correct',
      'Verify your password (try logging into the official app)',
      'If you recently changed your password, use the new one',
      'Reset your password if you\'ve forgotten it'
    ],
    primaryAction: { label: 'Update Credentials', action: 'update_credentials' },
    retryable: true
  },

  network: {
    category: 'network',
    title: 'Connection Problem',
    steps: [
      'Check your internet connection',
      'Try refreshing the page',
      'If using VPN, try disabling it temporarily',
      'Check if other websites are working'
    ],
    primaryAction: { label: 'Try Again', action: 'retry' },
    retryable: true,
    retryAfter: 5
  },

  offline: {
    category: 'offline',
    title: 'Controller Offline',
    steps: [
      'Check if the controller is powered on',
      'Verify the controller\'s WiFi connection',
      'Check if the WiFi indicator light is on',
      'Try power cycling the controller (unplug, wait 10 seconds, plug back in)',
      'Ensure your router is working properly'
    ],
    primaryAction: { label: 'Refresh Status', action: 'refresh' },
    retryable: true,
    retryAfter: 30
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
      'Please wait a moment before trying again',
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
      'Our servers are experiencing issues',
      'This is usually temporary - please try again in a few minutes',
      'If the problem persists, check our status page'
    ],
    primaryAction: { label: 'Check Status', action: 'check_status' },
    retryable: true,
    retryAfter: 30,
    helpUrl: 'https://status.enviroflow.app',
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
        ...template.steps
      ]
    } else if (category === 'offline') {
      guidance.steps = brandInfo.offlineSteps
    } else if (category === 'network' && options?.context === 'connection') {
      guidance.steps = brandInfo.connectionSteps
    }

    // Add brand support URL if available
    if (brandInfo.supportUrl && (category === 'offline' || category === 'credentials')) {
      guidance.helpUrl = brandInfo.supportUrl
    }
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
