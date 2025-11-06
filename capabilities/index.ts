/**
 * Capabilities Index
 * Export all capabilities from this file
 */

import type { CapabilityConfig, CapabilityContext } from '../types/capability.js'
import { createTestCapability } from './test.js'
import { createTradeCapability } from './trade.js'

/**
 * Get all capabilities for the agent
 * @param context - Capability context with environment
 * @returns Array of capability configurations
 */
export function getAllCapabilities(context: CapabilityContext): CapabilityConfig[] {
  return [
    createTestCapability(context),
    createTradeCapability(context),
  ]
}

