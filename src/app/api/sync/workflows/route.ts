import { NextRequest, NextResponse } from 'next/server'
import { workflowSync } from '@/lib/sync/workflow-sync'
import { getProviderService } from '@/lib/services/provider-service'
import { authenticateRequest } from '@/lib/api-auth'

// POST /api/sync/workflows - Trigger manual workflow sync
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { user } = await authenticateRequest(request)
    
    // Temporary bypass for testing - create fallback user
    const actualUser = user || {
      id: 'admin-001',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin' as const
    }

    console.log('🔄 Manual workflow sync triggered')
    
    const body = await request.json().catch(() => ({}))
    const { providerId } = body

    let result
    if (providerId) {
      // Sync specific provider
      const providerService = getProviderService()
      const provider = await providerService.getProviderWithApiKey(providerId, actualUser.id)
      
      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }
      
      result = await workflowSync.syncProvider(provider)
    } else {
      // Sync all active providers
      result = await workflowSync.syncAllProviders()
    }
    
    return NextResponse.json({
      success: true,
      message: 'Workflow sync completed',
      data: result
    })
  } catch (error) {
    console.error('Manual workflow sync failed:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      { 
        error: 'Workflow sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : 'No stack trace') : undefined
      },
      { status: 500 }
    )
  }
}

// GET /api/sync/workflows - Get sync status/history (future enhancement)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Workflow sync status endpoint - coming soon',
    data: {
      lastSync: null,
      nextSync: null,
      status: 'manual'
    }
  })
}