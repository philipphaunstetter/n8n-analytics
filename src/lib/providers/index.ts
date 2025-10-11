// Provider Registry - Register all available provider adapters
import { ProviderRegistry } from './base'
import { N8nAdapter } from './n8n'

// Register all provider adapters
ProviderRegistry.register('n8n', N8nAdapter)

// Re-export for convenience
export { ProviderRegistry, ProviderAdapter, type ProviderCapabilities } from './base'
export { N8nAdapter } from './n8n'

// Export types for use throughout the app
export * from '@/types'