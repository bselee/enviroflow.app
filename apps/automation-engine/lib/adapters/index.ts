/**
 * Controller Adapters - Factory and Exports
 */

import { ACInfinityAdapter } from './ACInfinityAdapter'
import { InkbirdAdapter } from './InkbirdAdapter'
import { GenericWiFiAdapter } from './GenericWiFiAdapter'
import type { ControllerAdapter } from './ControllerAdapter'
import type { ControllerBrand } from '../types/controller'

export { ControllerAdapter, BaseControllerAdapter } from './ControllerAdapter'
export { ACInfinityAdapter } from './ACInfinityAdapter'
export { InkbirdAdapter } from './InkbirdAdapter'
export { GenericWiFiAdapter } from './GenericWiFiAdapter'

// Adapter instance cache for reuse
const adapterInstances = new Map<ControllerBrand, ControllerAdapter>()

/**
 * Factory function to get adapter instance by brand
 * Reuses instances for efficiency
 */
export function createAdapter(brand: ControllerBrand): ControllerAdapter {
  let adapter = adapterInstances.get(brand)

  if (!adapter) {
    switch (brand) {
      case 'ac_infinity':
        adapter = new ACInfinityAdapter()
        break
      case 'inkbird':
        adapter = new InkbirdAdapter()
        break
      case 'generic_wifi':
        adapter = new GenericWiFiAdapter()
        break
      default:
        throw new Error(`Unknown controller brand: ${brand}`)
    }

    adapterInstances.set(brand, adapter)
  }

  return adapter
}

/**
 * Get a fresh adapter instance (not cached)
 * Use when you need isolated state
 */
export function createFreshAdapter(brand: ControllerBrand): ControllerAdapter {
  switch (brand) {
    case 'ac_infinity':
      return new ACInfinityAdapter()
    case 'inkbird':
      return new InkbirdAdapter()
    case 'generic_wifi':
      return new GenericWiFiAdapter()
    default:
      throw new Error(`Unknown controller brand: ${brand}`)
  }
}

/**
 * Clear adapter cache (useful for testing)
 */
export function clearAdapterCache(): void {
  adapterInstances.clear()
}

/**
 * Check if a brand is supported
 */
export function isSupportedBrand(brand: string): brand is ControllerBrand {
  return ['ac_infinity', 'inkbird', 'generic_wifi'].includes(brand)
}

/**
 * Get list of supported brands with status
 */
export function getSupportedBrands(): Array<{
  brand: ControllerBrand
  name: string
  status: 'implemented' | 'partial' | 'stub'
  description: string
}> {
  return [
    {
      brand: 'ac_infinity',
      name: 'AC Infinity',
      status: 'implemented',
      description: 'Full support for Controller 67, 69, and UIS series',
    },
    {
      brand: 'inkbird',
      name: 'Inkbird',
      status: 'stub',
      description: 'Coming soon - requires Bluetooth bridge or Tuya integration',
    },
    {
      brand: 'generic_wifi',
      name: 'Generic WiFi',
      status: 'implemented',
      description: 'Connect any REST API-based controller with custom configuration',
    },
  ]
}
