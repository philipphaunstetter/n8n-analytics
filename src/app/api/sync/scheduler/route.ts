import { NextRequest, NextResponse } from 'next/server'
import { workflowScheduler } from '@/lib/sync/workflow-scheduler'

// GET /api/sync/scheduler - Get scheduler status
export async function GET(request: NextRequest) {
  try {
    const status = workflowScheduler.getStatus()
    
    return NextResponse.json({
      success: true,
      data: status
    })
  } catch (error) {
    console.error('Failed to get scheduler status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/sync/scheduler - Control scheduler (start/stop/force_sync)
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    switch (action) {
      case 'start':
        await workflowScheduler.start()
        return NextResponse.json({
          success: true,
          message: 'Workflow sync scheduler started'
        })
        
      case 'stop':
        workflowScheduler.stop()
        return NextResponse.json({
          success: true,
          message: 'Workflow sync scheduler stopped'
        })
        
      case 'force_sync':
        await workflowScheduler.forcSync()
        return NextResponse.json({
          success: true,
          message: 'Force sync completed'
        })
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, or force_sync' },
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