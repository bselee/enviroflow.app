/**
 * Performance Utility Functions
 *
 * Client-side and server-side utilities for monitoring and optimizing
 * application performance. Includes measurement helpers, memoization,
 * and performance tracking.
 */

// =============================================================================
// Performance Measurement
// =============================================================================

/**
 * Measures the execution time of an async function.
 * Logs the result and returns the duration in milliseconds.
 *
 * @param name - Descriptive name for the operation
 * @param fn - Async function to measure
 * @returns Duration in milliseconds
 *
 * @example
 * ```ts
 * const duration = await measurePerformance('fetchData', async () => {
 *   await fetch('/api/data')
 * })
 * console.log(`Fetch took ${duration}ms`)
 * ```
 */
export async function measurePerformance(
  name: string,
  fn: () => Promise<void>
): Promise<number> {
  const start = performance.now()
  await fn()
  const duration = performance.now() - start

  // Use performance mark API for better DevTools integration
  if (typeof window !== 'undefined' && window.performance) {
    performance.mark(`${name}-start`)
    performance.mark(`${name}-end`)
    performance.measure(name, `${name}-start`, `${name}-end`)
  }

  console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`)
  return duration
}

/**
 * Synchronous version of measurePerformance for non-async operations.
 *
 * @param name - Descriptive name for the operation
 * @param fn - Synchronous function to measure
 * @returns Duration in milliseconds
 */
export function measureSync(name: string, fn: () => void): number {
  const start = performance.now()
  fn()
  const duration = performance.now() - start

  console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`)
  return duration
}

/**
 * Records a custom performance metric.
 * Useful for tracking specific user interactions or business metrics.
 *
 * @param name - Metric name
 * @param value - Metric value (usually duration in ms)
 * @param metadata - Additional context
 */
export function recordMetric(
  name: string,
  value: number,
  metadata?: Record<string, unknown>
): void {
  // Send to analytics in production
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    // Could integrate with analytics service here
    console.debug(`[METRIC] ${name}: ${value}`, metadata)
  } else {
    console.log(`[METRIC] ${name}: ${value}`, metadata)
  }
}

// =============================================================================
// Component Performance Monitoring
// =============================================================================

/**
 * Performance observer for tracking Core Web Vitals.
 * Automatically reports LCP, FID, CLS, FCP, TTFB.
 */
export function observeCoreWebVitals(): void {
  if (typeof window === 'undefined' || !window.PerformanceObserver) {
    return
  }

  try {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
        renderTime?: number
        loadTime?: number
        element?: HTMLElement
      }
      recordMetric('LCP', lastEntry.renderTime || lastEntry.loadTime || 0, {
        element: lastEntry.element?.tagName,
      })
    })
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        const fidEntry = entry as PerformanceEventTiming
        recordMetric('FID', fidEntry.processingStart - fidEntry.startTime)
      })
    })
    fidObserver.observe({ entryTypes: ['first-input'] })

    // Cumulative Layout Shift (CLS)
    let clsScore = 0
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
        if (!layoutShift.hadRecentInput) {
          clsScore += layoutShift.value || 0
        }
      })
      recordMetric('CLS', clsScore)
    })
    clsObserver.observe({ entryTypes: ['layout-shift'] })

    // First Contentful Paint (FCP)
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        recordMetric('FCP', entry.startTime)
      })
    })
    fcpObserver.observe({ entryTypes: ['paint'] })
  } catch (error) {
    console.warn('Performance monitoring not available:', error)
  }
}

/**
 * Reports navigation timing metrics.
 * Call this after page load to track DNS, connection, and load times.
 */
export function reportNavigationTiming(): void {
  if (typeof window === 'undefined' || !window.performance?.timing) {
    return
  }

  // Wait for page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      const timing = performance.timing
      const metrics = {
        'DNS Lookup': timing.domainLookupEnd - timing.domainLookupStart,
        'TCP Connection': timing.connectEnd - timing.connectStart,
        'Request': timing.responseStart - timing.requestStart,
        'Response': timing.responseEnd - timing.responseStart,
        'DOM Processing': timing.domComplete - timing.domLoading,
        'Total Load': timing.loadEventEnd - timing.navigationStart,
      }

      Object.entries(metrics).forEach(([name, value]) => {
        recordMetric(name, value)
      })
    }, 0)
  })
}

// =============================================================================
// Debounce & Throttle
// =============================================================================

/**
 * Debounces a function to prevent excessive calls.
 * Useful for search inputs, window resize handlers, etc.
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Throttles a function to limit execution rate.
 * Useful for scroll handlers, mouse move, etc.
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between executions in ms
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

// =============================================================================
// Data Optimization
// =============================================================================

/**
 * Chunks an array into smaller batches for processing.
 * Reduces memory pressure when dealing with large datasets.
 *
 * @param array - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Limits the number of data points for charting to prevent performance issues.
 * Uses sampling to maintain data shape while reducing point count.
 *
 * @param data - Time series data
 * @param maxPoints - Maximum number of points to return
 * @returns Downsampled data
 */
export function downsampleTimeSeries<T extends { timestamp: string; value: number }>(
  data: T[],
  maxPoints: number
): T[] {
  if (data.length <= maxPoints) {
    return data
  }

  // Calculate sampling interval
  const interval = Math.ceil(data.length / maxPoints)
  const sampled: T[] = []

  for (let i = 0; i < data.length; i += interval) {
    sampled.push(data[i])
  }

  // Always include the last point
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1])
  }

  return sampled
}

/**
 * Creates a memoized version of a function with LRU cache.
 * Useful for expensive calculations with repeated inputs.
 *
 * @param fn - Function to memoize
 * @param keyFn - Function to generate cache key from arguments
 * @param maxSize - Maximum cache size (default: 100)
 * @returns Memoized function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn: (...args: Parameters<T>) => string,
  maxSize = 100
): T {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>()

  return function memoized(...args: Parameters<T>): ReturnType<T> {
    const key = keyFn(...args)

    // Check cache
    if (cache.has(key)) {
      const cached = cache.get(key)!
      return cached.value
    }

    // Calculate and cache
    const value = fn(...args) as ReturnType<T>
    cache.set(key, { value, timestamp: Date.now() })

    // Enforce size limit with LRU eviction
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value as string
      cache.delete(firstKey)
    }

    return value
  } as T
}

// =============================================================================
// Bundle Analysis Helpers
// =============================================================================

/**
 * Logs the size of serialized data.
 * Useful for identifying large payloads that could be optimized.
 *
 * @param name - Data identifier
 * @param data - Data to measure
 */
export function logDataSize(name: string, data: unknown): void {
  try {
    const json = JSON.stringify(data)
    const bytes = new TextEncoder().encode(json).length
    const kb = (bytes / 1024).toFixed(2)
    console.log(`[SIZE] ${name}: ${kb} KB (${bytes} bytes)`)
  } catch (error) {
    console.warn(`[SIZE] Could not measure ${name}:`, error)
  }
}

/**
 * Monitors component render count for detecting unnecessary re-renders.
 * Use in development to identify optimization opportunities.
 *
 * @param componentName - Name of the component
 * @returns Cleanup function
 */
export function trackRenderCount(componentName: string): () => void {
  if (process.env.NODE_ENV !== 'development') {
    return () => {}
  }

  const key = `render-count-${componentName}`
  const count = (parseInt(sessionStorage.getItem(key) || '0', 10) + 1)
  sessionStorage.setItem(key, count.toString())

  console.log(`[RENDER] ${componentName}: ${count} renders`)

  return () => {
    sessionStorage.removeItem(key)
  }
}

// =============================================================================
// Image Optimization
// =============================================================================

/**
 * Preloads critical images to improve LCP.
 *
 * @param urls - Array of image URLs to preload
 */
export function preloadImages(urls: string[]): void {
  if (typeof window === 'undefined') return

  urls.forEach((url) => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = url
    document.head.appendChild(link)
  })
}

/**
 * Lazy loads images with Intersection Observer.
 *
 * @param selector - CSS selector for images to lazy load
 */
export function setupLazyImages(selector = 'img[data-src]'): void {
  if (typeof window === 'undefined' || !window.IntersectionObserver) {
    return
  }

  const images = document.querySelectorAll(selector)

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement
        const src = img.getAttribute('data-src')
        if (src) {
          img.src = src
          img.removeAttribute('data-src')
          observer.unobserve(img)
        }
      }
    })
  })

  images.forEach((img) => observer.observe(img))
}

// =============================================================================
// Memory Management
// =============================================================================

/**
 * Monitors memory usage in the browser.
 * Only works in browsers that support performance.memory (Chrome).
 */
export function logMemoryUsage(): void {
  if (typeof window === 'undefined') return

  const memory = (performance as Performance & { memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }}).memory

  if (!memory) {
    console.warn('[MEMORY] Memory monitoring not available in this browser')
    return
  }

  const used = (memory.usedJSHeapSize / 1048576).toFixed(2)
  const total = (memory.totalJSHeapSize / 1048576).toFixed(2)
  const limit = (memory.jsHeapSizeLimit / 1048576).toFixed(2)

  console.log(`[MEMORY] Used: ${used} MB | Total: ${total} MB | Limit: ${limit} MB`)
}

/**
 * Sets up periodic memory monitoring.
 *
 * @param intervalMs - Interval in milliseconds (default: 30000 / 30s)
 * @returns Cleanup function to stop monitoring
 */
export function monitorMemory(intervalMs = 30000): () => void {
  const intervalId = setInterval(logMemoryUsage, intervalMs)
  return () => clearInterval(intervalId)
}
