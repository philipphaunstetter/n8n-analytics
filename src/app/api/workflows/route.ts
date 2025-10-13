import { NextRequest, NextResponse } from 'next/server'
import { n8nApi, N8nWorkflow } from '@/lib/n8n-api'
import { authenticateRequest } from '@/lib/api-auth'
import { Workflow } from '@/types'

// GET /api/workflows - List workflows from n8n API
export async function GET(request: NextRequest) {
  try {
    console.log('📋 GET /api/workflows - Fetching workflows from n8n API')
    
    // Authenticate the request
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const isActiveFilter = searchParams.get('isActive')
    const isArchivedFilter = searchParams.get('isArchived')

    // Fetch workflows from n8n API
    let n8nWorkflows: N8nWorkflow[] = []
    
    try {
      n8nWorkflows = await n8nApi.getWorkflows()
      console.log(`✅ Found ${n8nWorkflows.length} workflows from n8n API`)
    } catch (error) {
      console.error('❌ Failed to fetch n8n workflows:', error)
      return NextResponse.json(
        { error: 'Failed to connect to n8n API. Please check your n8n configuration.' },
        { status: 503 }
      )
    }
    
    // Helper function to determine if a workflow is archived
    const isWorkflowArchived = (workflow: N8nWorkflow): boolean => {
      if (workflow.active) {
        return false // Active workflows are never archived
      }
      
      const now = new Date()
      const updatedAt = new Date(workflow.updatedAt)
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24))
      
      // Consider inactive workflows archived if they haven't been updated in 90 days
      return daysSinceUpdate > 90
    }
    
    // Convert to API format and apply filtering
    let apiWorkflows = n8nWorkflows.map(workflow => ({
      id: workflow.id, // Use workflow ID directly
      providerId: 'n8n-main',
      providerWorkflowId: workflow.id,
      name: workflow.name,
      description: '', // n8n workflows don't have descriptions in the API response
      isActive: workflow.active,
      isArchived: isWorkflowArchived(workflow),
      tags: workflow.tags || [],
      createdAt: new Date(workflow.createdAt),
      updatedAt: new Date(workflow.updatedAt),
      lastExecutedAt: undefined, // Would need to be calculated from executions
      totalExecutions: 0, // Would need to be calculated from executions  
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      avgDuration: undefined,
      metadata: {
        nodeCount: workflow.nodes?.length || 0,
        n8nWorkflowId: workflow.id,
        connections: workflow.connections
      }
    } as Workflow))
    
    // Apply isActive filter if specified
    if (isActiveFilter !== null) {
      const isActiveValue = isActiveFilter.toLowerCase() === 'true'
      apiWorkflows = apiWorkflows.filter(workflow => workflow.isActive === isActiveValue)
      console.log(`🔍 Filtered to ${apiWorkflows.length} workflows with isActive=${isActiveValue}`)
    }
    
    // Apply isArchived filter if specified
    if (isArchivedFilter !== null) {
      const isArchivedValue = isArchivedFilter.toLowerCase() === 'true'
      apiWorkflows = apiWorkflows.filter(workflow => workflow.isArchived === isArchivedValue)
      console.log(`🔍 Filtered to ${apiWorkflows.length} workflows with isArchived=${isArchivedValue}`)
    }
    
    return NextResponse.json({
      success: true,
      data: {
        items: apiWorkflows,
        total: apiWorkflows.length,
        page: 1,
        limit: apiWorkflows.length,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })
  } catch (error) {
    console.error('❌ Failed to fetch workflows:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}