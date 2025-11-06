/**
 * Shared types for capabilities
 */

export interface CapabilityConfig {
  name: string
  description: string
  schema: any // Zod schema
  run: (context: { args: any; action?: any }) => Promise<string>
}

export interface CapabilityContext {
  env: NodeJS.ProcessEnv
}

