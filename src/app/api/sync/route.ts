import { NextRequest, NextResponse } from 'next/server'
import { executionSync } from '@/lib/sync/execution-sync'

// POST /api/sync - Trigger sync for all providers or specific provider
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { 
      syncType = 'executions',
      providerId,
      batchSize = 100
    } = body

    // Validate sync type
    const validSyncTypes = ['executions', 'workflows', 'backups', 'full']
    if (!validSyncTypes.includes(syncType)) {
      return NextResponse.json({
        error: `Invalid sync type. Must be one of: ${validSyncTypes.join(', ')}`
      }, { status: 400 })
    }

    console.log(`🚀 Triggering ${syncType} sync via API...`)
    
    const options = {
      syncType: syncType as 'executions' | 'workflows' | 'backups' | 'full',
      batchSize
    }

    let result
    if (providerId) {
      // Sync specific provider
      console.log(`🎯 Syncing specific provider: ${providerId}`)
      
      // TODO: Get provider from database
      const provider = {
        id: providerId,
        user_id: 'demo-user',
        name: 'Demo Provider',
        base_url: process.env.N8N_HOST!,
        api_key_encrypted: process.env.N8N_API_KEY!,
        is_connected: true,
        status: 'healthy'
      }
      
      result = await executionSync.syncProvider(provider, options)
    } else {
      // Sync all providers
      console.log('🌐 Syncing all providers')
      result = await executionSync.syncAllProviders(options)
    }

    return NextResponse.json({
      success: true,
      message: `${syncType} sync completed successfully`,
      data: result
    })

  } catch (error) {
    console.error('❌ Sync API failed:', error)
    return NextResponse.json({
      error: 'Sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/sync - Get sync status and recent sync logs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const providerId = searchParams.get('providerId')
    const limit = parseInt(searchParams.get('limit') || '10')

    // For now, return a simple status
    // TODO: Implement actual sync status checking from Supabase
    
    return NextResponse.json({
      success: true,
      data: {
        status: 'idle', // 'running', 'idle', 'error'
        lastSync: new Date().toISOString(),
        nextSync: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
        recentSyncs: [
          {
            id: '1',
            type: 'executions',
            status: 'success',
            startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            completedAt: new Date(Date.now() - 29 * 60 * 1000).toISOString(),
            recordsProcessed: 25,
            recordsInserted: 5,
            recordsUpdated: 20
          }
        ]
      }
    })

  } catch (error) {
    console.error('❌ Sync status API failed:', error)
    return NextResponse.json({
      error: 'Failed to get sync status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}