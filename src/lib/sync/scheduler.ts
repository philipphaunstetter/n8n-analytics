/**
 * Sync Scheduler
 * 
 * This handles automatic background syncing of n8n data from all client instances.
 * Different sync types run at different intervals based on data importance and change frequency.
 */

import { executionSync } from './execution-sync'

export class SyncScheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  
  /**
   * Start all scheduled sync jobs
   */
  start() {
    console.log('🕐 Starting sync scheduler...')
    
    // Critical: Execution sync every 15 minutes (due to 24h retention limit)
    this.scheduleJob('executions', this.syncExecutions.bind(this), 15 * 60 * 1000)
    
    // Moderate: Workflow metadata sync every 6 hours  
    this.scheduleJob('workflows', this.syncWorkflows.bind(this), 6 * 60 * 60 * 1000)
    
    // Low priority: Full workflow backups daily
    this.scheduleJob('backups', this.syncBackups.bind(this), 24 * 60 * 60 * 1000)
    
    console.log('✅ All sync jobs scheduled')
  }
  
  /**
   * Stop all scheduled sync jobs
   */
  stop() {
    console.log('🛑 Stopping sync scheduler...')
    
    for (const [name, interval] of this.intervals) {
      clearInterval(interval)
      console.log(`✅ Stopped ${name} sync job`)
    }
    
    this.intervals.clear()
    console.log('✅ All sync jobs stopped')
  }
  
  /**
   * Schedule a sync job
   */
  private scheduleJob(name: string, syncFunction: () => Promise<void>, intervalMs: number) {
    // Run immediately on startup
    console.log(`🚀 Starting initial ${name} sync...`)
    syncFunction().catch(error => {
      console.error(`❌ Initial ${name} sync failed:`, error)
    })
    
    // Then schedule regular intervals
    const interval = setInterval(async () => {
      try {
        console.log(`⏰ Scheduled ${name} sync starting...`)
        await syncFunction()
        console.log(`✅ Scheduled ${name} sync completed`)
      } catch (error) {
        console.error(`❌ Scheduled ${name} sync failed:`, error)
      }
    }, intervalMs)
    
    this.intervals.set(name, interval)
    
    const nextRun = new Date(Date.now() + intervalMs)
    console.log(`📅 ${name} sync scheduled every ${intervalMs/1000}s, next run: ${nextRun.toISOString()}`)
  }
  
  /**
   * Sync executions from all providers
   */
  private async syncExecutions(): Promise<void> {
    await executionSync.syncAllProviders({ 
      syncType: 'executions',
      batchSize: 100 
    })
  }
  
  /**
   * Sync workflow metadata from all providers
   */
  private async syncWorkflows(): Promise<void> {
    await executionSync.syncAllProviders({ 
      syncType: 'workflows',
      batchSize: 50 
    })
  }
  
  /**
   * Sync full workflow backups from all providers
   */
  private async syncBackups(): Promise<void> {
    await executionSync.syncAllProviders({ 
      syncType: 'backups',
      batchSize: 20 
    })
  }
  
  /**
   * Trigger immediate sync of specific type
   */
  async triggerSync(syncType: 'executions' | 'workflows' | 'backups' | 'full') {
    console.log(`🎯 Triggering immediate ${syncType} sync...`)
    
    try {
      const result = await executionSync.syncAllProviders({ 
        syncType,
        batchSize: syncType === 'executions' ? 200 : 100 // Larger batches for manual triggers
      })
      
      console.log(`✅ Manual ${syncType} sync completed:`, result)
      return result
    } catch (error) {
      console.error(`❌ Manual ${syncType} sync failed:`, error)
      throw error
    }
  }
  
  /**
   * Get scheduler status
   */
  getStatus() {
    const jobs = Array.from(this.intervals.keys())
    return {
      running: jobs.length > 0,
      activeJobs: jobs,
      nextRuns: {
        executions: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        workflows: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        backups: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    }
  }
}

// Export singleton instance
export const syncScheduler = new SyncScheduler()

/**
 * Development helper: Start scheduler in development mode
 * In production, this would be handled by your deployment platform (Vercel Cron, etc.)
 */
if (process.env.NODE_ENV === 'development' && process.env.ENABLE_SYNC_SCHEDULER === 'true') {
  console.log('🔧 Development mode: Starting sync scheduler')
  syncScheduler.start()
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('👋 Gracefully shutting down sync scheduler...')
    syncScheduler.stop()
    process.exit(0)
  })
  
  process.on('SIGTERM', () => {
    console.log('👋 Gracefully shutting down sync scheduler...')
    syncScheduler.stop()
    process.exit(0)
  })
}