import { NextRequest, NextResponse } from 'next/server'
import { executionSync } from '@/lib/sync/execution-sync'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting initial sync after setup...')
    
    // Perform unified sync (workflows + executions) using enhanced execution sync service
    console.log('Starting unified initial sync...')
    const syncResult = await executionSync.syncAllProviders({ syncType: 'full' })
    console.log('Initial sync result:', syncResult)
    
    return NextResponse.json({
      success: true,
      message: 'Initial sync completed successfully',
      results: syncResult
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