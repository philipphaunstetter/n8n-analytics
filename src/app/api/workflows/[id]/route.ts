import { NextRequest, NextResponse } from 'next/server'
import { workflowSync } from '@/lib/sync/workflow-sync'
import { n8nApi } from '@/lib/n8n-api'
import { authenticateRequest } from '@/lib/api-auth'

// GET /api/workflows/[id] - Get individual workflow details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    console.log(`📋 GET /api/workflows/${id} - Fetching workflow details`)
    
    // Authenticate the request
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch workflow from n8n API
    let n8nWorkflow
    try {
      n8nWorkflow = await n8nApi.getWorkflow(id)
      console.log(`✅ Found workflow: ${n8nWorkflow.name}`)
    } catch (error) {
      console.error('❌ Failed to fetch workflow from n8n:', error)
      return NextResponse.json(
        { error: 'Workflow not found or failed to connect to n8n API' },
        { status: 404 }
      )
    }
    
    // Helper function to determine if a workflow is archived
    const isWorkflowArchived = (workflow: any): boolean => {
      if (workflow.active) {
        return false // Active workflows are never archived
      }
      
      const now = new Date()
      const updatedAt = new Date(workflow.updatedAt)
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24))
      
      // Consider inactive workflows archived if they haven't been updated in 90 days
      return daysSinceUpdate > 90
    }
    
    // Convert to API format with full workflow JSON
    const workflowData = {
      id: n8nWorkflow.id,
      providerId: 'n8n-main',
      providerWorkflowId: n8nWorkflow.id,
      name: n8nWorkflow.name,
      description: '', // n8n workflows don't have descriptions in the API response
      isActive: n8nWorkflow.active,
      isArchived: isWorkflowArchived(n8nWorkflow),
      tags: n8nWorkflow.tags || [],
      createdAt: new Date(n8nWorkflow.createdAt),
      updatedAt: new Date(n8nWorkflow.updatedAt),
      lastExecutedAt: undefined, // Would need to be calculated from executions
      totalExecutions: 0, // Would need to be calculated from executions
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      avgDuration: undefined,
      workflowJson: n8nWorkflow, // Include the full n8n workflow JSON
      metadata: {
        nodeCount: n8nWorkflow.nodes?.length || 0,
        n8nWorkflowId: n8nWorkflow.id,
        connections: n8nWorkflow.connections
      }
    }
    
    return NextResponse.json({
      success: true,
      data: workflowData
    })
  } catch (error) {
    console.error('❌ Failed to fetch workflow:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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