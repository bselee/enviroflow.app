/**
 * Logger Utility for EnviroFlow
 * Structured logging with levels, context, and optional external output
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  source?: string
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel
  source?: string
  includeTimestamp: boolean
  outputJson: boolean
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'info',
  includeTimestamp: true,
  outputJson: false, // Set to true for production/log aggregation
}

/**
 * Logger class with configurable output
 */
export class Logger {
  private config: LoggerConfig

  constructor(source?: string, config?: Partial<LoggerConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      source,
    }
  }

  /**
   * Create a child logger with additional source prefix
   */
  child(source: string): Logger {
    const childSource = this.config.source
      ? `${this.config.source}:${source}`
      : source

    return new Logger(childSource, this.config)
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  /**
   * Log at info level
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  /**
   * Log at error level
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    const errorContext: LogContext = { ...context }

    if (error) {
      if (error instanceof Error) {
        errorContext.errorMessage = error.message
        errorContext.errorStack = error.stack
        errorContext.errorName = error.name
      } else {
        errorContext.error = String(error)
      }
    }

    this.log('error', message, errorContext)
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Check minimum level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source: this.config.source,
      context: context && Object.keys(context).length > 0 ? context : undefined,
    }

    this.output(entry)
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (this.config.outputJson) {
      // JSON output for log aggregation
      console.log(JSON.stringify(entry))
    } else {
      // Human-readable output
      const parts: string[] = []

      if (this.config.includeTimestamp) {
        parts.push(`[${entry.timestamp}]`)
      }

      parts.push(`[${entry.level.toUpperCase()}]`)

      if (entry.source) {
        parts.push(`[${entry.source}]`)
      }

      parts.push(entry.message)

      if (entry.context) {
        parts.push(JSON.stringify(entry.context))
      }

      const output = parts.join(' ')

      switch (entry.level) {
        case 'debug':
          console.debug(output)
          break
        case 'info':
          console.info(output)
          break
        case 'warn':
          console.warn(output)
          break
        case 'error':
          console.error(output)
          break
      }
    }
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.config.minLevel = level
  }

  /**
   * Enable/disable JSON output
   */
  setJsonOutput(enabled: boolean): void {
    this.config.outputJson = enabled
  }
}

// Default logger instance
const defaultLogger = new Logger('EnviroFlow')

// Export convenience methods
export const debug = (message: string, context?: LogContext) =>
  defaultLogger.debug(message, context)
export const info = (message: string, context?: LogContext) =>
  defaultLogger.info(message, context)
export const warn = (message: string, context?: LogContext) =>
  defaultLogger.warn(message, context)
export const error = (message: string, err?: unknown, context?: LogContext) =>
  defaultLogger.error(message, err, context)

/**
 * Create a logger for a specific module/function
 */
export function createLogger(source: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger(source, config)
}

/**
 * Configure the default logger
 */
export function configureDefaultLogger(config: Partial<LoggerConfig>): void {
  if (config.minLevel) {
    defaultLogger.setMinLevel(config.minLevel)
  }
  if (config.outputJson !== undefined) {
    defaultLogger.setJsonOutput(config.outputJson)
  }
}

export default defaultLogger
