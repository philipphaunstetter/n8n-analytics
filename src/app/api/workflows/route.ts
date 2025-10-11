import { NextRequest, NextResponse } from 'next/server'
import { ProviderRegistry } from '@/lib/providers'
import { Provider, WorkflowFilters } from '@/types'
import { authenticateRequest } from '@/lib/api-auth'
import { n8nApi, N8nWorkflow } from '@/lib/n8n-api'
import { isDemoMode } from '@/lib/demo-data'

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

    // Fetch workflows from n8n API or use demo data as fallback
    let allWorkflows: any[] = []
    let totalCount = 0

    // Try to fetch real n8n data first if not in demo mode
    if (!isDemoMode()) {
      try {
        console.log('Fetching real workflows from n8n API...')
        const n8nWorkflows = await n8nApi.getWorkflows()
        const n8nExecutions = await n8nApi.getExecutions({ limit: 1000 }) // Get more executions for workflow stats
        
        // Convert n8n workflows to our internal format
        allWorkflows = convertN8nWorkflows(n8nWorkflows, n8nExecutions.data)
        totalCount = allWorkflows.length
        
        console.log(`Fetched ${allWorkflows.length} real workflows from n8n`)
      } catch (error) {
        console.error('Failed to fetch real n8n workflows, falling back to demo data:', error)
        // Fall back to demo workflows if n8n API fails
        allWorkflows = generateDemoWorkflows()
      }
    } else if (isDemoMode()) {
      console.log('Using demo mode - generating demo workflows')
      allWorkflows = generateDemoWorkflows()
    } else {
      console.log('No n8n configuration available, using demo data')
      allWorkflows = generateDemoWorkflows()
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

// Helper function to generate demo workflows (fallback)
function generateDemoWorkflows(): any[] {
  return [
    {
      id: 'demo-workflow-1',
      name: 'Daily Sales Report',
      active: true,
      tags: ['sales', 'reports', 'daily'],
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-02-01T14:30:00Z'),
      executionCount: 45,
      lastExecutionStatus: 'success',
      lastExecutionAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    },
    {
      id: 'demo-workflow-2', 
      name: 'User Onboarding Email Sequence',
      active: true,
      tags: ['email', 'onboarding', 'automation'],
      createdAt: new Date('2024-01-20T09:15:00Z'),
      updatedAt: new Date('2024-01-25T16:45:00Z'),
      executionCount: 127,
      lastExecutionStatus: 'success',
      lastExecutionAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
    },
    {
      id: 'demo-workflow-3',
      name: 'Invoice Processing',
      active: false,
      tags: ['finance', 'invoices'],
      createdAt: new Date('2024-01-10T11:30:00Z'),
      updatedAt: new Date('2024-01-12T09:20:00Z'),
      executionCount: 8,
      lastExecutionStatus: 'error',
      lastExecutionAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    },
    {
      id: 'demo-workflow-4',
      name: 'Slack Notifications',
      active: true,
      tags: ['notifications', 'slack'],
      createdAt: new Date('2024-02-01T08:45:00Z'),
      updatedAt: new Date('2024-02-05T12:10:00Z'),
      executionCount: 203,
      lastExecutionStatus: 'success',
      lastExecutionAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
    },
    {
      id: 'demo-workflow-5',
      name: 'Database Backup',
      active: true,
      tags: ['backup', 'database', 'maintenance'],
      createdAt: new Date('2024-01-05T15:20:00Z'),
      updatedAt: new Date('2024-01-28T11:55:00Z'),
      executionCount: 12,
      lastExecutionStatus: 'success', 
      lastExecutionAt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
    }
  ]
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
