import { NextRequest, NextResponse } from 'next/server'
import { workflowSync } from '@/lib/sync/workflow-sync'

// PATCH /api/workflows/[id] - Update workflow settings (archive, backup toggle)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, ...data } = body

    console.log(`🔧 Workflow action: ${action} for workflow ${id}`)

    switch (action) {
      case 'archive':
        await workflowSync.archiveWorkflow(id, data.reason)
        return NextResponse.json({
          success: true,
          message: 'Workflow archived successfully'
        })

      case 'toggle_backup':
        await workflowSync.toggleWorkflowBackup(id, data.backupEnabled)
        return NextResponse.json({
          success: true,
          message: `Backup ${data.backupEnabled ? 'enabled' : 'disabled'} for workflow`
        })

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Failed to update workflow:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/workflows/[id] - Delete workflow backup from database
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    console.log(`🗑️ Deleting workflow backup: ${id}`)
    
    await workflowSync.deleteWorkflowBackup(id)
    
    return NextResponse.json({
      success: true,
      message: 'Workflow backup deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete workflow backup:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}