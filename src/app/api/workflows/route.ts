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
    
    // Convert to API format
    const apiWorkflows = n8nWorkflows.map(workflow => ({
      id: `n8n-${workflow.id}`, // Prefix to avoid ID conflicts
      providerId: 'n8n-main',
      providerWorkflowId: workflow.id,
      name: workflow.name,
      description: '', // n8n workflows don't have descriptions in the API response
      isActive: workflow.active,
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