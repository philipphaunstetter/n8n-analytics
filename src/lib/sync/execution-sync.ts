import { createClient } from '@supabase/supabase-js'
import { n8nApi } from '@/lib/n8n-api'
import type { N8nExecution, N8nWorkflow } from '@/lib/n8n-api'

// Supabase client with service role for background operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
      const { data: providers, error } = await supabase
        .from('providers')
        .select('*')
        .eq('is_connected', true)
        .eq('status', 'healthy')
      
      if (error) throw error
      if (!providers || providers.length === 0) {
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
    const { data: syncLog } = await this.createSyncLog(provider.id, syncType)
    
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
      
      // Update sync log as failed
      if (syncLog) {
        await this.completeSyncLog(syncLog.id, 'error', {}, error.message)
      }
      
      // Update provider health status
      await this.updateProviderHealth(provider.id, 'error', error.message)
      
      throw error
    }
  }
  
  /**
   * Sync executions for a provider
   */
  private async syncExecutions(provider: Provider, options: SyncOptions) {
    const apiKey = await this.decryptApiKey(provider.api_key_encrypted)
    const n8nClient = this.createN8nClient(provider.base_url, apiKey)
    
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
    const apiKey = await this.decryptApiKey(provider.api_key_encrypted)
    const n8nClient = this.createN8nClient(provider.base_url, apiKey)
    
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
    const apiKey = await this.decryptApiKey(provider.api_key_encrypted)
    const n8nClient = this.createN8nClient(provider.base_url, apiKey)
    
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
    const { data: workflow } = await supabase
      .from('workflows')
      .select('id')
      .eq('provider_id', providerId)
      .eq('provider_workflow_id', n8nExecution.workflowId)
      .single()
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${n8nExecution.workflowId}`)
    }
    
    const executionData = {
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
      finished: n8nExecution.finished,
      retry_of: n8nExecution.retryOf,
      retry_success_id: n8nExecution.retrySuccessId,
      metadata: {
        waitTill: n8nExecution.waitTill,
        originalData: n8nExecution
      }
    }
    
    // Check if execution exists
    const { data: existing } = await supabase
      .from('executions')
      .select('id')
      .eq('provider_id', providerId)
      .eq('provider_execution_id', n8nExecution.id)
      .single()
    
    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('executions')
        .update(executionData)
        .eq('id', existing.id)
      
      if (error) throw error
      return { updated: true, inserted: false }
    } else {
      // Insert new
      const { error } = await supabase
        .from('executions')
        .insert(executionData)
      
      if (error) throw error
      return { inserted: true, updated: false }
    }
  }
  
  /**
   * Upsert workflow into database
   */
  private async upsertWorkflow(providerId: string, n8nWorkflow: N8nWorkflow) {
    const workflowData = {
      provider_id: providerId,
      provider_workflow_id: n8nWorkflow.id,
      name: n8nWorkflow.name,
      is_active: n8nWorkflow.active,
      tags: n8nWorkflow.tags || [],
      node_count: n8nWorkflow.nodes?.length || 0,
      updated_at: new Date().toISOString()
    }
    
    // Check if workflow exists
    const { data: existing } = await supabase
      .from('workflows')
      .select('id')
      .eq('provider_id', providerId)
      .eq('provider_workflow_id', n8nWorkflow.id)
      .single()
    
    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('workflows')
        .update(workflowData)
        .eq('id', existing.id)
      
      if (error) throw error
      return { updated: true, inserted: false }
    } else {
      // Insert new
      const { error } = await supabase
        .from('workflows')
        .insert({
          ...workflowData,
          created_at: new Date().toISOString()
        })
      
      if (error) throw error
      return { inserted: true, updated: false }
    }
  }
  
  /**
   * Create workflow backup with versioning
   */
  private async createWorkflowBackup(providerId: string, fullWorkflow: N8nWorkflow) {
    // Store in workflow_data field with timestamp
    const { error } = await supabase
      .from('workflows')
      .update({
        workflow_data: {
          ...fullWorkflow,
          backup_timestamp: new Date().toISOString(),
          nodes: fullWorkflow.nodes,
          connections: fullWorkflow.connections
        }
      })
      .eq('provider_id', providerId)
      .eq('provider_workflow_id', fullWorkflow.id)
    
    if (error) throw error
  }
  
  /**
   * Ensure workflows exist before processing executions
   */
  private async ensureWorkflowsExist(providerId: string, workflowIds: string[]) {
    for (const workflowId of workflowIds) {
      const { data: existing } = await supabase
        .from('workflows')
        .select('id')
        .eq('provider_id', providerId)
        .eq('provider_workflow_id', workflowId)
        .single()
      
      if (!existing) {
        // Create placeholder workflow
        await supabase
          .from('workflows')
          .insert({
            provider_id: providerId,
            provider_workflow_id: workflowId,
            name: `Workflow ${workflowId}`,
            is_active: true
          })
      }
    }
  }
  
  // Helper methods
  private async createSyncLog(providerId: string, syncType: string) {
    const { data, error } = await supabase
      .from('sync_logs')
      .insert({
        provider_id: providerId,
        sync_type: syncType,
        status: 'running'
      })
      .select('id')
      .single()
    
    if (error) console.error('Failed to create sync log:', error)
    return { data }
  }
  
  private async completeSyncLog(logId: string, status: string, result: any, errorMessage?: string) {
    await supabase
      .from('sync_logs')
      .update({
        status,
        completed_at: new Date().toISOString(),
        records_processed: result.processed || 0,
        records_inserted: result.inserted || 0,
        records_updated: result.updated || 0,
        error_message: errorMessage,
        metadata: result
      })
      .eq('id', logId)
  }
  
  private async updateProviderHealth(providerId: string, status: string, errorMessage?: string) {
    await supabase
      .from('providers')
      .update({
        status,
        last_checked_at: new Date().toISOString(),
        metadata: errorMessage ? { last_error: errorMessage } : {}
      })
      .eq('id', providerId)
  }
  
  private async getLastSyncCursor(providerId: string, syncType: string) {
    const { data } = await supabase
      .from('sync_logs')
      .select('last_cursor')
      .eq('provider_id', providerId)
      .eq('sync_type', syncType)
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()
    
    return data
  }
  
  private async updateSyncCursor(providerId: string, syncType: string, cursor: string) {
    // This would typically be done in the sync log completion
    // For now, we'll store it in provider metadata
    const { data: provider } = await supabase
      .from('providers')
      .select('metadata')
      .eq('id', providerId)
      .single()
    
    const metadata = provider?.metadata || {}
    metadata[`last_${syncType}_cursor`] = cursor
    
    await supabase
      .from('providers')
      .update({ metadata })
      .eq('id', providerId)
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
  
  private async decryptApiKey(encryptedKey: string): string {
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