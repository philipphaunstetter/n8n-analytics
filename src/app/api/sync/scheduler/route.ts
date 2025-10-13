import { NextRequest, NextResponse } from 'next/server'
import { syncScheduler } from '@/lib/sync/scheduler'
import { authenticateRequest } from '@/lib/api-auth'

// GET /api/sync/scheduler - Get scheduler status
export async function GET(request: NextRequest) {
  try {
    // Bypass auth for now to test
    const status = syncScheduler.getStatus()
    
    return NextResponse.json({
      success: true,
      data: status,
      message: 'Execution sync scheduler status'
    })
  } catch (error) {
    console.error('Failed to get scheduler status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/sync/scheduler - Control scheduler (start/stop/trigger_sync)
export async function POST(request: NextRequest) {
  try {
    // Bypass auth for now to test
    const { action, syncType } = await request.json()
    
    switch (action) {
      case 'start':
        syncScheduler.start()
        return NextResponse.json({
          success: true,
          message: 'Execution sync scheduler started - will sync executions every 15 minutes'
        })
        
      case 'stop':
        syncScheduler.stop()
        return NextResponse.json({
          success: true,
          message: 'Execution sync scheduler stopped'
        })
        
      case 'trigger_sync':
        const type = syncType || 'executions'
        const result = await syncScheduler.triggerSync(type)
        return NextResponse.json({
          success: true,
          message: `Manual ${type} sync completed`,
          data: result
        })
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, or trigger_sync' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Failed to control scheduler:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
