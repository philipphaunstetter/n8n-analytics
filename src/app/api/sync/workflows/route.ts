import { NextRequest, NextResponse } from 'next/server'
import { workflowSync } from '@/lib/sync/workflow-sync'

// POST /api/sync/workflows - Trigger manual workflow sync
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Manual workflow sync triggered')
    
    const result = await workflowSync.syncWorkflows()
    
    return NextResponse.json({
      success: true,
      message: 'Workflow sync completed',
      data: result
    })
  } catch (error) {
    console.error('Manual workflow sync failed:', error)
    return NextResponse.json(
      { 
        error: 'Workflow sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
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