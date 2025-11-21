import { getDb } from '@/lib/db'
import { getConfigManager } from '@/lib/config/config-manager'
import { getProviderService } from '@/lib/services/provider-service'
import { v4 as uuidv4 } from 'uuid'

/**
 * Migration: Convert old single n8n config to providers table
 * 
 * This migration:
 * 1. Checks if old config exists (integrations.n8n.url and integrations.n8n.api_key)
 * 2. Creates a default provider entry if config exists
 * 3. Updates all existing workflows and executions to reference the new provider
 */
export async function migrateToProviders(userId: string = 'default-user'): Promise<{
  success: boolean
  message: string
  providerId?: string
}> {
  const configManager = getConfigManager()
  const providerService = getProviderService()
  const db = getDb()

  try {
    console.log('🔄 Starting migration to multi-provider system...')

    // Check if providers already exist
    const existingProviders = await providerService.listProviders(userId)
    if (existingProviders.length > 0) {
      console.log('✅ Providers already exist, skipping migration')
      return {
        success: true,
        message: 'Migration already completed - providers exist',
        providerId: existingProviders[0].id
      }
    }

    // Get old n8n configuration
    const n8nUrl = await configManager.get('integrations.n8n.url')
    const n8nApiKey = await configManager.get('integrations.n8n.api_key')

    if (!n8nUrl || !n8nApiKey) {
      console.log('⚠️  No existing n8n configuration found')
      return {
        success: true,
        message: 'No existing configuration to migrate'
      }
    }

    console.log(`📦 Found existing n8n config: ${n8nUrl}`)

    // Test connection before migrating
    console.log('🔌 Testing connection to existing n8n instance...')
    const connectionTest = await providerService.testConnection(n8nUrl, n8nApiKey)

    if (!connectionTest.success) {
      console.warn('⚠️  Connection test failed, but continuing with migration:', connectionTest.error)
    }

    // Create default provider
    console.log('➕ Creating default provider entry...')
    const provider = await providerService.createProvider(userId, {
      name: 'Default n8n',
      baseUrl: n8nUrl,
      apiKey: n8nApiKey,
      metadata: {
        migratedFrom: 'legacy-config',
        migratedAt: new Date().toISOString()
      }
    })

    // Update connection status
    await providerService.updateConnectionStatus(
      provider.id,
      userId,
      connectionTest.success,
      connectionTest.success ? 'healthy' : 'warning',
      connectionTest.version
    )

    console.log(`✅ Created provider: ${provider.id}`)

    // Update existing workflows to reference new provider
    const updateWorkflowsResult = await new Promise<{ changes: number }>((resolve, reject) => {
      db.run(
        `UPDATE workflows SET provider_id = ? WHERE provider_id IS NULL OR provider_id = ''`,
        [provider.id],
        function (err) {
          if (err) {
            reject(err)
          } else {
            resolve({ changes: this.changes })
          }
        }
      )
    })

    console.log(`✅ Updated ${updateWorkflowsResult.changes} workflows`)

    // Update existing executions to reference new provider
    const updateExecutionsResult = await new Promise<{ changes: number }>((resolve, reject) => {
      db.run(
        `UPDATE executions SET provider_id = ? WHERE provider_id IS NULL OR provider_id = ''`,
        [provider.id],
        function (err) {
          if (err) {
            reject(err)
          } else {
            resolve({ changes: this.changes })
          }
        }
      )
    })

    console.log(`✅ Updated ${updateExecutionsResult.changes} executions`)

    // Mark old config keys as deprecated (optional - keep them for now for backward compatibility)
    await configManager.upsert(
      'integrations.n8n._migrated',
      'true',
      'boolean',
      'integration',
      'Migration to providers table completed'
    )

    console.log('✅ Migration completed successfully!')

    return {
      success: true,
      message: `Successfully migrated to multi-provider system. Created provider "${provider.name}" and updated ${updateWorkflowsResult.changes} workflows and ${updateExecutionsResult.changes} executions.`,
      providerId: provider.id
    }
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Migration failed'
    }
  }
}

/**
 * Check if migration is needed
 */
export async function checkMigrationNeeded(userId: string = 'default-user'): Promise<boolean> {
  try {
    const configManager = getConfigManager()
    const providerService = getProviderService()

    // Check if providers exist
    const existingProviders = await providerService.listProviders(userId)
    if (existingProviders.length > 0) {
      return false // Migration not needed
    }

    // Check if old config exists
    const n8nUrl = await configManager.get('integrations.n8n.url')
    const n8nApiKey = await configManager.get('integrations.n8n.api_key')

    // Migration needed if old config exists but no providers
    return !!(n8nUrl && n8nApiKey)
  } catch (error) {
    console.error('Failed to check migration status:', error)
    return false
  }
}

/**
 * Auto-run migration on app startup if needed
 */
export async function autoMigrate(userId: string = 'default-user'): Promise<void> {
  try {
    const migrationNeeded = await checkMigrationNeeded(userId)

    if (migrationNeeded) {
      console.log('🚀 Auto-running provider migration...')
      const result = await migrateToProviders(userId)

      if (result.success) {
        console.log('✅ Auto-migration completed:', result.message)
      } else {
        console.error('❌ Auto-migration failed:', result.message)
      }
    }
  } catch (error) {
    console.error('Failed to auto-migrate:', error)
    // Don't throw - allow app to continue even if migration fails
  }
}
