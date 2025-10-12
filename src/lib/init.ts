import { workflowScheduler } from './sync/workflow-scheduler'

let initialized = false

/**
 * Initialize application services
 * This should be called when the app starts
 */
export async function initializeApp() {
  if (initialized) {
    console.log('⚠️ App already initialized, skipping...')
    return
  }

  console.log('🚀 Initializing Elova application services...')

  try {
    // Start workflow sync scheduler
    await workflowScheduler.start()
    
    initialized = true
    console.log('✅ Elova application services initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize app services:', error)
    // Don't throw error - app should still work without scheduler
  }
}

/**
 * Cleanup application services
 * This should be called when the app shuts down
 */
export function cleanupApp() {
  if (!initialized) {
    return
  }

  console.log('🛑 Shutting down Elova application services...')
  
  try {
    workflowScheduler.stop()
    initialized = false
    console.log('✅ App services shut down successfully')
  } catch (error) {
    console.error('❌ Error during app cleanup:', error)
  }
}

// Handle process shutdown gracefully
if (typeof process !== 'undefined') {
  process.on('SIGINT', cleanupApp)
  process.on('SIGTERM', cleanupApp)
  process.on('exit', cleanupApp)
}