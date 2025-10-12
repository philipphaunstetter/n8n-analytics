import { NextRequest, NextResponse } from 'next/server'
import { ProviderRegistry } from '@/lib/providers'
import { Provider, WorkflowFilters } from '@/types'
import { authenticateRequest } from '@/lib/api-auth'
import { n8nApi, N8nWorkflow } from '@/lib/n8n-api'

// GET /api/workflows - List workflows across all providers
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request (handles both dev and Supabase auth)
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const filters: WorkflowFilters = {
      providerId: searchParams.get('providerId') || undefined,
      isActive: searchParams.get('active') ? searchParams.get('active') === 'true' : undefined,
      search: searchParams.get('search') || undefined
    }

    // Fetch workflows from n8n API - always use real data
    let allWorkflows: any[] = []
    let totalCount = 0

    try {
      console.log('Fetching real workflows from n8n API...')
      const n8nWorkflows = await n8nApi.getWorkflows()
      const n8nExecutions = await n8nApi.getExecutions({ limit: 1000 }) // Get more executions for workflow stats
      
      // Convert n8n workflows to our internal format
      allWorkflows = convertN8nWorkflows(n8nWorkflows, n8nExecutions.data)
      totalCount = allWorkflows.length
      
      console.log(`Fetched ${allWorkflows.length} real workflows from n8n`)
    } catch (error) {
      console.error('Failed to fetch n8n workflows:', error)
      return NextResponse.json(
        { error: 'Failed to connect to n8n API. Please check your n8n configuration.' },
        { status: 503 }
      )
    }

    // Apply filters
    const filteredWorkflows = applyWorkflowFilters(allWorkflows, filters)

    totalCount = filteredWorkflows.length

    // Sort workflows by lastExecutionAt (most recent first), then by name
    filteredWorkflows.sort((a, b) => {
      if (a.lastExecutionAt && b.lastExecutionAt) {
        return new Date(b.lastExecutionAt).getTime() - new Date(a.lastExecutionAt).getTime()
      }
      if (a.lastExecutionAt && !b.lastExecutionAt) return -1
      if (!a.lastExecutionAt && b.lastExecutionAt) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      success: true,
      data: {
        items: filteredWorkflows,
        total: totalCount,
        page: 1,
        limit: filteredWorkflows.length,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })
  } catch (error) {
    console.error('Failed to fetch workflows:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to convert n8n workflows to our internal format
function convertN8nWorkflows(n8nWorkflows: N8nWorkflow[], executions: any[]): any[] {
  return n8nWorkflows.map(workflow => {
    // Find executions for this workflow to calculate stats
    const workflowExecutions = executions.filter(exec => exec.workflowId === workflow.id)
    const lastExecution = workflowExecutions.length > 0 
      ? workflowExecutions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
      : null

    return {
      id: `n8n-${workflow.id}`,
      name: workflow.name,
      active: workflow.active,
      tags: workflow.tags || [],
      createdAt: new Date(workflow.createdAt),
      updatedAt: new Date(workflow.updatedAt),
      executionCount: workflowExecutions.length,
      lastExecutionStatus: lastExecution?.status || undefined,
      lastExecutionAt: lastExecution ? new Date(lastExecution.startedAt) : undefined
    }
  })
}


// Helper function to apply filters to workflows
function applyWorkflowFilters(workflows: any[], filters: WorkflowFilters): any[] {
  let filtered = workflows
  
  // Filter by active status
  if (filters.isActive !== undefined) {
    filtered = filtered.filter(workflow => workflow.active === filters.isActive)
  }
  
  // Filter by search query (search in workflow name and tags)
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase()
    filtered = filtered.filter(workflow => {
      // Search in workflow name
      if (workflow.name.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      // Search in tags
      if (workflow.tags && workflow.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm))) {
        return true
      }
      
      // Search in workflow ID
      if (workflow.id.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      return false
    })
  }
  
  return filtered
}
