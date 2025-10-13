/**
 * Application startup initialization
 * This runs when the container starts to set up background services
 */

import { syncScheduler } from './sync/scheduler'

export async function initializeApp() {
  console.log('🚀 Initializing Elova application...')
  
  try {
    // Start the sync scheduler to continuously archive executions
    console.log('📅 Starting execution sync scheduler...')
    syncScheduler.start()
    
    console.log('✅ Application initialization complete')
    console.log('📊 Execution sync will run every 15 minutes to preserve data beyond n8n\'s 24h limit')
    
  } catch (error) {
    console.error('❌ Application initialization failed:', error)
    // Don't fail the entire startup - the app can still work without sync
  }
}

// Export scheduler for API access
export { syncScheduler }