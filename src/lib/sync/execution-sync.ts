import { n8nApi } from '@/lib/n8n-api'
import type { N8nExecution, N8nWorkflow } from '@/lib/n8n-api'
import { Database } from 'sqlite3'
import { ConfigManager, getConfigManager } from '@/lib/config/config-manager'
import path from 'path'

// SQLite database for execution storage
let db: Database | null = null

function getSQLiteClient(): Database {
  if (!db) {
    const dbPath = ConfigManager.getDefaultDatabasePath()
    db = new Database(dbPath)
    
    // Initialize execution tables if they don't exist
    db.serialize(() => {
      db!.run(`
        CREATE TABLE IF NOT EXISTS providers (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          base_url TEXT NOT NULL,
          api_key_encrypted TEXT NOT NULL,
          is_connected BOOLEAN DEFAULT 1,
          status TEXT DEFAULT 'healthy',
          last_checked_at TEXT,
          metadata TEXT DEFAULT '{}'
        )
      `)
      
      db!.run(`
        CREATE TABLE IF NOT EXISTS workflows (
          id TEXT PRIMARY KEY,
          provider_id TEXT,
          provider_workflow_id TEXT,
          name TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          tags TEXT DEFAULT '[]',
          node_count INTEGER DEFAULT 0,
          workflow_data TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (provider_id) REFERENCES providers (id)
        )
      `)
      
      db!.run(`
        CREATE TABLE IF NOT EXISTS executions (
          id TEXT PRIMARY KEY,
          provider_id TEXT,
          workflow_id TEXT,
          provider_execution_id TEXT UNIQUE,
          provider_workflow_id TEXT,
          status TEXT,
          mode TEXT,
          started_at TEXT,
          stopped_at TEXT,
          duration INTEGER,
          finished BOOLEAN,
          retry_of TEXT,
          retry_success_id TEXT,
          metadata TEXT DEFAULT '{}',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (provider_id) REFERENCES providers (id),
          FOREIGN KEY (workflow_id) REFERENCES workflows (id)
        )
      `)
      
      db!.run(`
        CREATE TABLE IF NOT EXISTS sync_logs (
          id TEXT PRIMARY KEY,
          provider_id TEXT,
          sync_type TEXT,
          status TEXT,
          completed_at TEXT,
          records_processed INTEGER DEFAULT 0,
          records_inserted INTEGER DEFAULT 0,
          records_updated INTEGER DEFAULT 0,
          error_message TEXT,
          metadata TEXT DEFAULT '{}',
          last_cursor TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (provider_id) REFERENCES providers (id)
        )
      `)
    })
  }
  return db
}

export interface Provider {
  id: string
  user_id: string
  name: string
  base_url: string
  api_key_encrypted: string
  is_connected: boolean
  status: string
  last_checked_at?: string
  metadata?: any
}

export interface SyncOptions {
  provider?: Provider
  syncType?: 'executions' | 'workflows' | 'backups' | 'full'
  batchSize?: number
  maxRetries?: number
}

export class ExecutionSyncService {
  private readonly DEFAULT_BATCH_SIZE = 100
  private readonly MAX_RETRIES = 3
  
  /**
   * Sync executions from all active providers
   */
  async syncAllProviders(options: SyncOptions = {}) {
    console.log('🔄 Starting multi-client execution sync...')
    
    try {
      // Get all active providers across all users
      const db = getSQLiteClient()
      const providers = await new Promise<Provider[]>((resolve, reject) => {
        db.all(
          'SELECT * FROM providers WHERE is_connected = 1 AND status = ?',
          ['healthy'],
          (err, rows: Provider[]) => {
            if (err) reject(err)
            else resolve(rows || [])
          }
        )
      })
      
      if (providers.length === 0) {
        console.log('ℹ️ No active providers found')
        return { success: true, providers: 0 }
      }
      
      console.log(`📡 Found ${providers.length} active providers to sync`)
      
      // Process all providers concurrently (with error isolation)
      const results = await Promise.allSettled(
        providers.map(provider => this.syncProvider(provider, options))
      )
      
      // Log results
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      
      console.log(`✅ Sync completed: ${successful} successful, ${failed} failed`)
      
      return {
        success: true,
        providers: providers.length,
        successful,
        failed,
        results
      }
    } catch (error) {
      console.error('❌ Multi-provider sync failed:', error)
      throw error
    }
  }
  
  /**
   * Sync a single provider's data
   */
  async syncProvider(provider: Provider, options: SyncOptions = {}) {
    const syncType = options.syncType || 'executions'
    
    // Create sync log entry
    const syncLog = await this.createSyncLog(provider.id, syncType)
    
    try {
      console.log(`🔄 Syncing ${syncType} for provider: ${provider.name}`)
      
      let result
      switch (syncType) {
        case 'executions':
          result = await this.syncExecutions(provider, options)
          break
        case 'workflows':
          result = await this.syncWorkflows(provider, options)
          break
        case 'backups':
          result = await this.syncWorkflowBackups(provider, options)
          break
        case 'full':
          result = await this.syncFull(provider, options)
          break
        default:
          throw new Error(`Unknown sync type: ${syncType}`)
      }
      
      // Update sync log as successful
      if (syncLog) {
        await this.completeSyncLog(syncLog.id, 'success', result)
      }
      
      console.log(`✅ ${syncType} sync completed for ${provider.name}:`, result)
      return result
      
    } catch (error) {
      console.error(`❌ ${syncType} sync failed for ${provider.name}:`, error)
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Update sync log as failed
      if (syncLog) {
        await this.completeSyncLog(syncLog.id, 'error', {}, errorMessage)
      }
      
      // Update provider health status
      await this.updateProviderHealth(provider.id, 'error', errorMessage)
      
      throw error
    }
  }
  
  /**
   * Sync executions for a provider
   */
  private async syncExecutions(provider: Provider, options: SyncOptions) {
    // Get n8n configuration from ConfigManager instead of provider table
    const configManager = getConfigManager()
    await configManager.initialize()
    const host = await configManager.get('integrations.n8n.url') || provider.base_url
    const apiKey = await configManager.get('integrations.n8n.api_key') || provider.api_key_encrypted
    
    const n8nClient = this.createN8nClient(host, apiKey)
    
    let totalProcessed = 0
    let totalInserted = 0
    let totalUpdated = 0
    let cursor: string | undefined
    
    // Get the last sync cursor for incremental sync
    const lastSync = await this.getLastSyncCursor(provider.id, 'executions')
    cursor = lastSync?.last_cursor
    
    console.log(`📥 Fetching executions for ${provider.name}${cursor ? ` (cursor: ${cursor})` : ' (full sync)'}`)
    
    do {
      try {
        // Fetch batch of executions
        const response = await n8nClient.getExecutions({
          limit: options.batchSize || this.DEFAULT_BATCH_SIZE,
          cursor
        })
        
        if (!response.data || response.data.length === 0) {
          console.log(`✅ No more executions for ${provider.name}`)
          break
        }
        
        console.log(`📊 Processing ${response.data.length} executions for ${provider.name}`)
        
        // Process batch
        const batchResult = await this.processExecutionBatch(
          provider.id,
          response.data
        )
        
        totalProcessed += response.data.length
        totalInserted += batchResult.inserted
        totalUpdated += batchResult.updated
        cursor = response.nextCursor
        
        // Store cursor for next sync
        if (cursor) {
          await this.updateSyncCursor(provider.id, 'executions', cursor)
        }
        
      } catch (error) {
        console.error(`❌ Batch processing failed for ${provider.name}:`, error)
        // Continue with next batch instead of failing entire sync
        break
      }
      
    } while (cursor)
    
    return {
      type: 'executions',
      processed: totalProcessed,
      inserted: totalInserted,
      updated: totalUpdated
    }
  }
  
  /**
   * Sync workflows and their metadata
   */
  private async syncWorkflows(provider: Provider, options: SyncOptions) {
    // Get n8n configuration from ConfigManager instead of provider table
    const configManager = getConfigManager()
    await configManager.initialize()
    const host = await configManager.get('integrations.n8n.url') || provider.base_url
    const apiKey = await configManager.get('integrations.n8n.api_key') || provider.api_key_encrypted
    
    const n8nClient = this.createN8nClient(host, apiKey)
    
    console.log(`📋 Fetching workflows for ${provider.name}`)
    
    const workflows = await n8nClient.getWorkflows()
    let inserted = 0
    let updated = 0
    
    for (const n8nWorkflow of workflows) {
      try {
        const result = await this.upsertWorkflow(provider.id, n8nWorkflow)
        if (result.inserted) inserted++
        if (result.updated) updated++
      } catch (error) {
        console.error(`❌ Failed to sync workflow ${n8nWorkflow.name}:`, error)
      }
    }
    
    return {
      type: 'workflows',
      processed: workflows.length,
      inserted,
      updated
    }
  }
  
  /**
   * Sync full workflow definitions for backup
   */
  private async syncWorkflowBackups(provider: Provider, options: SyncOptions) {
    // Get n8n configuration from ConfigManager instead of provider table
    const configManager = getConfigManager()
    await configManager.initialize()
    const host = await configManager.get('integrations.n8n.url') || provider.base_url
    const apiKey = await configManager.get('integrations.n8n.api_key') || provider.api_key_encrypted
    
    const n8nClient = this.createN8nClient(host, apiKey)
    
    console.log(`💾 Creating workflow backups for ${provider.name}`)
    
    // Get workflow list first
    const workflows = await n8nClient.getWorkflows()
    let backedUp = 0
    
    for (const workflow of workflows) {
      try {
        // Fetch full workflow definition
        const fullWorkflow = await n8nClient.getWorkflow(workflow.id)
        
        // Store full backup with versioning
        await this.createWorkflowBackup(provider.id, fullWorkflow)
        backedUp++
        
      } catch (error) {
        console.error(`❌ Failed to backup workflow ${workflow.name}:`, error)
      }
    }
    
    return {
      type: 'backups',
      processed: workflows.length,
      backedUp
    }
  }
  
  /**
   * Full sync: executions + workflows + backups
   */
  private async syncFull(provider: Provider, options: SyncOptions) {
    console.log(`🔄 Performing full sync for ${provider.name}`)
    
    const [executions, workflows, backups] = await Promise.allSettled([
      this.syncExecutions(provider, options),
      this.syncWorkflows(provider, options),
      this.syncWorkflowBackups(provider, options)
    ])
    
    return {
      type: 'full',
      executions: executions.status === 'fulfilled' ? executions.value : { error: executions.reason },
      workflows: workflows.status === 'fulfilled' ? workflows.value : { error: workflows.reason },
      backups: backups.status === 'fulfilled' ? backups.value : { error: backups.reason }
    }
  }
  
  /**
   * Process a batch of executions
   */
  private async processExecutionBatch(providerId: string, executions: N8nExecution[]) {
    let inserted = 0
    let updated = 0
    
    // First, ensure all workflows exist
    const workflowIds = [...new Set(executions.map(e => e.workflowId))]
    await this.ensureWorkflowsExist(providerId, workflowIds)
    
    // Process executions
    for (const n8nExecution of executions) {
      try {
        const result = await this.upsertExecution(providerId, n8nExecution)
        if (result.inserted) inserted++
        if (result.updated) updated++
      } catch (error) {
        console.error(`❌ Failed to process execution ${n8nExecution.id}:`, error)
      }
    }
    
    return { inserted, updated }
  }
  
  /**
   * Upsert execution into database
   */
  private async upsertExecution(providerId: string, n8nExecution: N8nExecution) {
    // Get workflow UUID from provider workflow ID
    const db = getSQLiteClient()
    const workflow = await new Promise<{id: string} | null>((resolve, reject) => {
      db.get(
        'SELECT id FROM workflows WHERE provider_id = ? AND provider_workflow_id = ?',
        [providerId, n8nExecution.workflowId],
        (err, row: {id: string}) => {
          if (err) reject(err)
          else resolve(row || null)
        }
      )
    })
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${n8nExecution.workflowId}`)
    }
    
    const executionData = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      provider_id: providerId,
      workflow_id: workflow.id,
      provider_execution_id: n8nExecution.id,
      provider_workflow_id: n8nExecution.workflowId,
      status: this.mapN8nStatus(n8nExecution.status),
      mode: this.mapN8nMode(n8nExecution.mode),
      started_at: n8nExecution.startedAt,
      stopped_at: n8nExecution.stoppedAt,
      duration: n8nExecution.stoppedAt 
        ? new Date(n8nExecution.stoppedAt).getTime() - new Date(n8nExecution.startedAt).getTime()
        : null,
      finished: n8nExecution.finished ? 1 : 0,
      retry_of: n8nExecution.retryOf,
      retry_success_id: n8nExecution.retrySuccessId,
      metadata: JSON.stringify({
        waitTill: (n8nExecution as any).waitTill,
        originalData: n8nExecution
      })
    }
    
    // Check if execution exists
    const existing = await new Promise<{id: string} | null>((resolve, reject) => {
      db.get(
        'SELECT id FROM executions WHERE provider_id = ? AND provider_execution_id = ?',
        [providerId, n8nExecution.id],
        (err, row: {id: string}) => {
          if (err) reject(err)
          else resolve(row || null)
        }
      )
    })
    
    return new Promise<{updated: boolean, inserted: boolean}>((resolve, reject) => {
      if (existing) {
        // Update existing
        db.run(`
          UPDATE executions SET
            workflow_id = ?, status = ?, mode = ?, started_at = ?, stopped_at = ?,
            duration = ?, finished = ?, retry_of = ?, retry_success_id = ?, metadata = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          executionData.workflow_id, executionData.status, executionData.mode,
          executionData.started_at, executionData.stopped_at, executionData.duration,
          executionData.finished, executionData.retry_of, executionData.retry_success_id,
          executionData.metadata, existing.id
        ], function(err) {
          if (err) reject(err)
          else resolve({ updated: true, inserted: false })
        })
      } else {
        // Insert new
        db.run(`
          INSERT INTO executions (
            id, provider_id, workflow_id, provider_execution_id, provider_workflow_id,
            status, mode, started_at, stopped_at, duration, finished, retry_of,
            retry_success_id, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          executionData.id, executionData.provider_id, executionData.workflow_id,
          executionData.provider_execution_id, executionData.provider_workflow_id,
          executionData.status, executionData.mode, executionData.started_at,
          executionData.stopped_at, executionData.duration, executionData.finished,
          executionData.retry_of, executionData.retry_success_id, executionData.metadata
        ], function(err) {
          if (err) reject(err)
          else resolve({ inserted: true, updated: false })
        })
      }
    })
  }
  
  /**
   * Upsert workflow into database
   */
  private async upsertWorkflow(providerId: string, n8nWorkflow: N8nWorkflow) {
    const db = getSQLiteClient()
    const workflowData = {
      id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      provider_id: providerId,
      provider_workflow_id: n8nWorkflow.id,
      name: n8nWorkflow.name,
      is_active: n8nWorkflow.active ? 1 : 0,
      tags: JSON.stringify(n8nWorkflow.tags || []),
      node_count: n8nWorkflow.nodes?.length || 0
    }
    
    // Check if workflow exists
    const existing = await new Promise<{id: string} | null>((resolve, reject) => {
      db.get(
        'SELECT id FROM workflows WHERE provider_id = ? AND provider_workflow_id = ?',
        [providerId, n8nWorkflow.id],
        (err, row: {id: string}) => {
          if (err) reject(err)
          else resolve(row || null)
        }
      )
    })
    
    return new Promise<{updated: boolean, inserted: boolean}>((resolve, reject) => {
      if (existing) {
        // Update existing
        db.run(`
          UPDATE workflows SET
            name = ?, is_active = ?, tags = ?, node_count = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          workflowData.name, workflowData.is_active, workflowData.tags,
          workflowData.node_count, existing.id
        ], function(err) {
          if (err) reject(err)
          else resolve({ updated: true, inserted: false })
        })
      } else {
        // Insert new
        db.run(`
          INSERT INTO workflows (
            id, provider_id, provider_workflow_id, name, is_active, tags, node_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          workflowData.id, workflowData.provider_id, workflowData.provider_workflow_id,
          workflowData.name, workflowData.is_active, workflowData.tags, workflowData.node_count
        ], function(err) {
          if (err) reject(err)
          else resolve({ inserted: true, updated: false })
        })
      }
    })
  }
  
  /**
   * Create workflow backup with versioning
   */
  private async createWorkflowBackup(providerId: string, fullWorkflow: N8nWorkflow) {
    // Store in workflow_data field with timestamp
    const db = getSQLiteClient()
    const backupData = JSON.stringify({
      ...fullWorkflow,
      backup_timestamp: new Date().toISOString(),
      nodes: fullWorkflow.nodes,
      connections: fullWorkflow.connections
    })
    
    return new Promise<void>((resolve, reject) => {
      db.run(`
        UPDATE workflows SET 
          workflow_data = ?, updated_at = CURRENT_TIMESTAMP
        WHERE provider_id = ? AND provider_workflow_id = ?
      `, [backupData, providerId, fullWorkflow.id], function(err) {
        if (err) reject(err)
        else resolve()
      })
    })
  }
  
  /**
   * Ensure workflows exist before processing executions
   */
  private async ensureWorkflowsExist(providerId: string, workflowIds: string[]) {
    const db = getSQLiteClient()
    for (const workflowId of workflowIds) {
      const existing = await new Promise<{id: string} | null>((resolve, reject) => {
        db.get(
          'SELECT id FROM workflows WHERE provider_id = ? AND provider_workflow_id = ?',
          [providerId, workflowId],
          (err, row: {id: string}) => {
            if (err) reject(err)
            else resolve(row || null)
          }
        )
      })
      
      if (!existing) {
        // Create placeholder workflow
        await new Promise<void>((resolve, reject) => {
          const id = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          db.run(`
            INSERT INTO workflows (
              id, provider_id, provider_workflow_id, name, is_active
            ) VALUES (?, ?, ?, ?, ?)
          `, [id, providerId, workflowId, `Workflow ${workflowId}`, 1], function(err) {
            if (err) reject(err)
            else resolve()
          })
        })
      }
    }
  }
  
  // Helper methods
  private async createSyncLog(providerId: string, syncType: string): Promise<{ id: string } | null> {
    const db = getSQLiteClient()
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      await new Promise<void>((resolve, reject) => {
        db.run(`
          INSERT INTO sync_logs (id, provider_id, sync_type, status)
          VALUES (?, ?, ?, ?)
        `, [id, providerId, syncType, 'running'], function(err) {
          if (err) reject(err)
          else resolve()
        })
      })
      return { id }
    } catch (error) {
      console.error('Failed to create sync log:', error)
      return null
    }
  }
  
  private async completeSyncLog(logId: string, status: string, result: any, errorMessage?: string) {
    const db = getSQLiteClient()
    return new Promise<void>((resolve, reject) => {
      db.run(`
        UPDATE sync_logs SET
          status = ?, completed_at = CURRENT_TIMESTAMP,
          records_processed = ?, records_inserted = ?, records_updated = ?,
          error_message = ?, metadata = ?
        WHERE id = ?
      `, [
        status, result.processed || 0, result.inserted || 0, result.updated || 0,
        errorMessage, JSON.stringify(result), logId
      ], function(err) {
        if (err) reject(err)
        else resolve()
      })
    })
  }
  
  private async updateProviderHealth(providerId: string, status: string, errorMessage?: string) {
    const db = getSQLiteClient()
    const metadata = errorMessage ? JSON.stringify({ last_error: errorMessage }) : '{}'
    
    return new Promise<void>((resolve, reject) => {
      db.run(`
        UPDATE providers SET
          status = ?, last_checked_at = CURRENT_TIMESTAMP, metadata = ?
        WHERE id = ?
      `, [status, metadata, providerId], function(err) {
        if (err) reject(err)
        else resolve()
      })
    })
  }
  
  private async getLastSyncCursor(providerId: string, syncType: string): Promise<{ last_cursor: string } | null> {
    const db = getSQLiteClient()
    
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT last_cursor FROM sync_logs
        WHERE provider_id = ? AND sync_type = ? AND status = 'success'
        ORDER BY completed_at DESC
        LIMIT 1
      `, [providerId, syncType], (err, row: { last_cursor: string }) => {
        if (err) reject(err)
        else resolve(row || null)
      })
    })
  }
  
  private async updateSyncCursor(providerId: string, syncType: string, cursor: string) {
    // Store cursor in provider metadata
    const db = getSQLiteClient()
    
    // First get current metadata
    const currentMetadata = await new Promise<string>((resolve, reject) => {
      db.get(
        'SELECT metadata FROM providers WHERE id = ?',
        [providerId],
        (err, row: { metadata: string }) => {
          if (err) reject(err)
          else resolve(row?.metadata || '{}')
        }
      )
    })
    
    // Update metadata with cursor
    const metadata = JSON.parse(currentMetadata)
    metadata[`last_${syncType}_cursor`] = cursor
    
    return new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE providers SET metadata = ? WHERE id = ?',
        [JSON.stringify(metadata), providerId],
        function(err) {
          if (err) reject(err)
          else resolve()
        }
      )
    })
  }
  
  private mapN8nStatus(n8nStatus: string): string {
    switch (n8nStatus) {
      case 'success': return 'success'
      case 'failed':
      case 'error':
      case 'crashed': return 'error'
      case 'running': return 'running'
      case 'waiting': return 'waiting'
      case 'canceled': return 'canceled'
      case 'new': return 'waiting'
      default: return 'unknown'
    }
  }
  
  private mapN8nMode(n8nMode: string): string {
    switch (n8nMode) {
      case 'manual': return 'manual'
      case 'trigger': return 'trigger'
      case 'webhook': return 'webhook'
      case 'cron': return 'cron'
      default: return 'unknown'
    }
  }
  
  private async decryptApiKey(encryptedKey: string): Promise<string> {
    // TODO: Implement proper encryption/decryption
    // For now, return as-is (assuming base64 or similar)
    return encryptedKey
  }
  
  private createN8nClient(baseUrl: string, apiKey: string) {
    // Create n8n client instance with custom credentials
    return {
      async getExecutions(params: any) {
        const searchParams = new URLSearchParams()
        if (params.limit) searchParams.append('limit', params.limit.toString())
        if (params.cursor) searchParams.append('cursor', params.cursor)
        
        const response = await fetch(`${baseUrl}/api/v1/executions?${searchParams}`, {
          headers: {
            'X-N8N-API-KEY': apiKey,
            'Accept': 'application/json'
          }
        })
        
        if (!response.ok) throw new Error(`n8n API error: ${response.statusText}`)
        return response.json()
      },
      
      async getWorkflows() {
        const response = await fetch(`${baseUrl}/api/v1/workflows`, {
          headers: {
            'X-N8N-API-KEY': apiKey,
            'Accept': 'application/json'
          }
        })
        
        if (!response.ok) throw new Error(`n8n API error: ${response.statusText}`)
        const data = await response.json()
        return data.data || []
      },
      
      async getWorkflow(id: string) {
        const response = await fetch(`${baseUrl}/api/v1/workflows/${id}`, {
          headers: {
            'X-N8N-API-KEY': apiKey,
            'Accept': 'application/json'
          }
        })
        
        if (!response.ok) throw new Error(`n8n API error: ${response.statusText}`)
        return response.json()
      }
    }
  }
}

// Export singleton instance
export const executionSync = new ExecutionSyncService()