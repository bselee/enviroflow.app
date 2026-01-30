'use client'

import { useEffect } from 'react'

// Increment this version to force cache clear on all clients
const APP_VERSION = '2.0.0'
const VERSION_KEY = 'enviroflow_app_version'

/**
 * CacheInvalidator Component
 *
 * Automatically clears browser caches and updates service workers
 * when a new version is deployed. Runs once on app load.
 */
export function CacheInvalidator() {
  useEffect(() => {
    async function invalidateCaches() {
      try {
        const storedVersion = localStorage.getItem(VERSION_KEY)

        // If version changed or first visit, clear everything
        if (storedVersion !== APP_VERSION) {
          console.log(`[CacheInvalidator] Version change detected: ${storedVersion} -> ${APP_VERSION}`)

          // 1. Clear all Cache API caches
          if ('caches' in window) {
            const cacheNames = await caches.keys()
            console.log(`[CacheInvalidator] Clearing ${cacheNames.length} caches`)
            await Promise.all(
              cacheNames.map(name => {
                console.log(`[CacheInvalidator] Deleting cache: ${name}`)
                return caches.delete(name)
              })
            )
          }

          // 2. Unregister all service workers and re-register fresh
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations()
            console.log(`[CacheInvalidator] Found ${registrations.length} service workers`)

            for (const registration of registrations) {
              // Send message to clear caches before unregistering
              if (registration.active) {
                registration.active.postMessage({ type: 'CLEAR_CACHE' })
              }

              // Force update and skip waiting
              await registration.update()

              // If there's a waiting worker, tell it to activate
              if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' })
              }
            }
          }

          // 3. Store new version
          localStorage.setItem(VERSION_KEY, APP_VERSION)

          // 4. Hard reload to get fresh assets (only if we actually cleared something)
          if (storedVersion !== null) {
            console.log('[CacheInvalidator] Reloading for fresh assets...')
            // Small delay to ensure service worker messages are processed
            setTimeout(() => {
              window.location.reload()
            }, 100)
          }
        }
      } catch (error) {
        console.error('[CacheInvalidator] Error:', error)
        // Still update version to prevent infinite loops
        localStorage.setItem(VERSION_KEY, APP_VERSION)
      }
    }

    invalidateCaches()
  }, [])

  return null
}
