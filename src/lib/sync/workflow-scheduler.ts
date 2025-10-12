import { workflowSync } from './workflow-sync'
import { getConfigManager } from '@/lib/config/config-manager'

export class WorkflowScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private configManager = getConfigManager()

  /**
   * Start the workflow sync scheduler
   */
  async start() {
    if (this.intervalId) {
      console.log('⚠️ Workflow scheduler already running')
      return
    }

    await this.configManager.initialize()
    
    // Get sync interval from config (default 15 minutes)
    const syncIntervalMinutes = await this.configManager.get('features.workflow_sync_interval_minutes') || 15
    const syncInterval = syncIntervalMinutes * 60 * 1000 // Convert to milliseconds
    
    console.log(`🕒 Starting workflow sync scheduler (every ${syncIntervalMinutes} minutes)`)
    
    // Run initial sync
    this.runSync()
    
    // Schedule regular syncs
    this.intervalId = setInterval(() => {
      this.runSync()
    }, syncInterval)
  }

  /**
   * Stop the workflow sync scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('🛑 Workflow sync scheduler stopped')
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: !!this.intervalId,
      currentlyExecuting: this.isRunning,
      nextSync: this.intervalId ? new Date(Date.now() + 15 * 60 * 1000) : null
    }
  }

  /**
   * Run a single sync cycle
   */
  private async runSync() {
    if (this.isRunning) {
      console.log('⏳ Previous workflow sync still running, skipping...')
      return
    }

    this.isRunning = true
    const startTime = Date.now()
    
    try {
      console.log('🔄 Starting scheduled workflow sync...')
      
      const result = await workflowSync.syncWorkflows()
      const duration = Date.now() - startTime
      
      console.log(`✅ Scheduled workflow sync completed in ${duration}ms:`, {
        synced: result.synced,
        created: result.created,
        updated: result.updated,
        archived: result.archived,
        errors: result.errors.length
      })
      
      // Log any errors
      if (result.errors.length > 0) {
        console.error('❌ Sync errors:', result.errors)
      }
      
    } catch (error) {
      console.error('❌ Scheduled workflow sync failed:', error)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Force sync now (bypasses running check)
   */
  async forcSync() {
    console.log('🚀 Force triggering workflow sync...')
    this.isRunning = false // Reset running state
    await this.runSync()
  }
}

// Export singleton instance
export const workflowScheduler = new WorkflowScheduler()