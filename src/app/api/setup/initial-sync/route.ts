import { NextRequest, NextResponse } from 'next/server'
import { executionSync } from '@/lib/sync/execution-sync'
import { getConfigManager } from '@/lib/config/config-manager'

export async function POST(request: NextRequest) {
  const config = getConfigManager()
  await config.initialize()

  try {
    console.log('Starting initial sync after setup...')

    // Mark sync as in progress
    await config.upsert('sync.initial.status', 'in_progress', 'string', 'system', 'Initial sync status')
    await config.upsert('sync.initial.started_at', new Date().toISOString(), 'string', 'system', 'Initial sync start time')
    await config.upsert('sync.initial.error', '', 'string', 'system', 'Initial sync error message')

    // Perform unified sync (workflows + executions) using enhanced execution sync service
    console.log('Starting unified initial sync...')
    const syncResult = await executionSync.syncAllProviders({ syncType: 'full' })
    console.log('Initial sync result:', syncResult)

    // Mark sync as completed
    await config.upsert('sync.initial.status', 'completed', 'string', 'system', 'Initial sync status')
    await config.upsert('sync.initial.completed_at', new Date().toISOString(), 'string', 'system', 'Initial sync completion time')

    return NextResponse.json({
      success: true,
      message: 'Initial sync completed successfully',
      results: syncResult
    })

  } catch (error) {
    console.error('Initial sync failed:', error)

    // Mark sync as failed
    await config.upsert('sync.initial.status', 'failed', 'string', 'system', 'Initial sync status')
    await config.upsert('sync.initial.error', error instanceof Error ? error.message : 'Unknown error', 'string', 'system', 'Initial sync error message')

    return NextResponse.json({
      success: false,
      message: 'Initial sync failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}