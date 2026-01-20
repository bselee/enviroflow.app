/**
 * EnviroFlow Automation Engine Library
 * Main entry point for shared library exports
 */

// Types
export * from './types/index'

// Adapters
export {
  createAdapter,
  createFreshAdapter,
  clearAdapterCache,
  isSupportedBrand,
  getSupportedBrands,
  ACInfinityAdapter,
  InkbirdAdapter,
  GenericWiFiAdapter,
} from './adapters/index'

export type { ControllerAdapter } from './adapters/ControllerAdapter'

// Utilities
export {
  encrypt,
  decrypt,
  generateEncryptionKey,
  hash,
  encryptCredentials,
  decryptCredentials,
  isEncrypted,
} from './utils/encryption'

export {
  Logger,
  createLogger,
  configureDefaultLogger,
  debug,
  info,
  warn,
  error,
} from './utils/logger'

export {
  calculateVPD,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  parseTimeToMinutes,
  minutesToTime,
  isTimeInRange,
  sleep,
  retryWithBackoff,
  safeJsonParse,
  generateUUID,
} from './utils/index'
