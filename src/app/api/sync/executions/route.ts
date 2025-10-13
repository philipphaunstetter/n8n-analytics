import { NextRequest, NextResponse } from 'next/server'
import { executionSync } from '@/lib/sync/execution-sync'
import { authenticateRequest } from '@/lib/api-auth'

// POST /api/sync/executions - Trigger execution sync specifically
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🚀 Triggering executions sync via API...')
    
    const body = await request.json().catch(() => ({}))
    const { 
      providerId,
      batchSize = 100
    } = body

    const options = {
      syncType: 'executions' as const,
      batchSize
    }

    let result
    if (providerId) {
      // Sync specific provider - for now use demo data since we don't have provider management
      const provider = {
        id: providerId,
        user_id: user.id || 'demo-user',
        name: 'N8N Instance',
        base_url: 'http://localhost:5678', // Will be loaded from ConfigManager by sync process
        api_key_encrypted: 'demo-key', // Will be loaded from ConfigManager by sync process
        is_connected: true,
        status: 'healthy'
      }
      
      result = await executionSync.syncProvider(provider, options)
    } else {
      // Sync all providers
      result = await executionSync.syncAllProviders(options)
    }

    return NextResponse.json({
      success: true,
      message: 'Executions sync completed successfully',
      data: result
    })

  } catch (error) {
    console.error('❌ Execution sync API failed:', error)
    return NextResponse.json({
      error: 'Execution sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}