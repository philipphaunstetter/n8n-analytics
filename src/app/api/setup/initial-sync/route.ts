import { NextRequest, NextResponse } from 'next/server'
import { workflowSync } from '@/lib/sync/workflow-sync'
import { executionSync } from '@/lib/sync/execution-sync'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting initial sync after setup...')
    
    // Sync workflows first (they're usually fewer and faster)
    console.log('Syncing workflows...')
    const workflowResult = await workflowSync.syncWorkflows()
    console.log('Workflow sync result:', workflowResult)
    
    // Then sync executions (more data, might take longer)
    console.log('Syncing executions...')
    const executionResult = await executionSync.syncAllProviders({ syncType: 'executions' })
    console.log('Execution sync result:', executionResult)
    
    return NextResponse.json({
      success: true,
      message: 'Initial sync completed successfully',
      results: {
        workflows: workflowResult,
        executions: executionResult
      }
    })
    
  } catch (error) {
    console.error('Initial sync failed:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Initial sync failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}