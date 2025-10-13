import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { DashboardStats, TimeRange, ExecutionFilters, Execution } from '@/types'
import { n8nApi, N8nExecution, N8nWorkflow } from '@/lib/n8n-api'
import { ExecutionStatus } from '@/types'

// Helper function to apply filters to executions (copied from executions API)
function applyExecutionFilters(executions: Execution[], filters: ExecutionFilters): Execution[] {
  let filtered = executions
  
  // Filter by status
  if (filters.status && filters.status.length > 0) {
    filtered = filtered.filter(exec => filters.status!.includes(exec.status))
  }
  
  // Filter by time range
  if (filters.timeRange && filters.timeRange !== 'custom') {
    const now = new Date()
    let startDate: Date
    
    switch (filters.timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }
    
    filtered = filtered.filter(exec => exec.startedAt >= startDate)
  }
  
  // Filter by custom time range
  if (filters.timeRange === 'custom' && filters.customTimeRange) {
    const { start, end } = filters.customTimeRange
    filtered = filtered.filter(exec => 
      exec.startedAt >= start && exec.startedAt <= end
    )
  }
  
  return filtered
}

// Convert n8n executions to internal format (copied from executions API)
function convertN8nExecutions(n8nExecutions: N8nExecution[], workflows: N8nWorkflow[]): Execution[] {
  // Create workflow lookup map for faster access
  const workflowMap = new Map(workflows.map(w => [w.id, w]))
  
  return n8nExecutions.map(n8nExec => {
    const workflow = workflowMap.get(n8nExec.workflowId)
    const startedAt = new Date(n8nExec.startedAt)
    const stoppedAt = n8nExec.stoppedAt ? new Date(n8nExec.stoppedAt) : undefined
    const duration = stoppedAt ? stoppedAt.getTime() - startedAt.getTime() : undefined
    
    // Map n8n status to our internal status format
    let status: ExecutionStatus = 'unknown'
    switch (n8nExec.status) {
      case 'success':
        status = 'success'
        break
      case 'failed':
      case 'error':
      case 'crashed':
        status = 'error'
        break
      case 'running':
        status = 'running'
        break
      case 'waiting':
        status = 'waiting'
        break
      case 'canceled':
        status = 'canceled'
        break
      case 'new':
        status = 'waiting'
        break
      default:
        status = 'unknown'
    }
    
    const execution: Execution = {
      id: n8nExec.id,
      providerId: 'n8n-main',
      workflowId: n8nExec.workflowId,
      providerExecutionId: n8nExec.id,
      providerWorkflowId: n8nExec.workflowId,
      status,
      startedAt,
      stoppedAt,
      duration,
      mode: 'unknown', // Simplified for dashboard
      metadata: {
        workflowName: workflow?.name || 'Unknown Workflow',
        n8nWorkflowId: n8nExec.workflowId,
        finished: n8nExec.finished
      }
    }
    
    return execution
  })
}

/**
 * Fetch dashboard statistics from n8n API
 */
async function fetchN8nDashboardStats(timeRange: TimeRange): Promise<DashboardStats> {
  try {
    // Fetch executions from n8n API using the same approach as executions endpoint
    const [n8nExecutions, n8nWorkflows] = await Promise.all([
      n8nApi.getExecutions(), // Remove arbitrary limit, let filtering handle it
      n8nApi.getWorkflows()
    ])
    
    // Convert n8n executions to our internal format (same as executions API)
    const allExecutions = convertN8nExecutions(n8nExecutions.data, n8nWorkflows)
    
    // Create filters object using same structure as executions API
    const filters: ExecutionFilters = {
      timeRange: timeRange === 'custom' ? '24h' : timeRange // Handle 'custom' case
    }
    
    // Apply filters using the same function as executions API
    const filteredExecutions = applyExecutionFilters(allExecutions, filters)
    
    // Calculate basic stats
    const totalExecutions = filteredExecutions.length
    const successfulExecutions = filteredExecutions.filter(e => e.status === 'success').length
    const failedExecutions = filteredExecutions.filter(e => e.status === 'error').length
    const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0

    // Calculate average response time (duration)
    const completedExecutions = filteredExecutions.filter(e => e.duration !== undefined)
    let avgResponseTime: number | undefined
    
    if (completedExecutions.length > 0) {
      const totalDuration = completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0)
      avgResponseTime = Math.round(totalDuration / completedExecutions.length)
    }

    // Get recent failures
    const recentFailures = filteredExecutions
      .filter(e => e.status === 'error')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 5)
      .map(execution => ({
        executionId: execution.id,
        workflowName: (execution.metadata?.workflowName as string) || 'Unknown Workflow',
        error: execution.error?.message || 'Execution failed',
        timestamp: execution.startedAt
      }))

    // Calculate top workflows by execution count
    const workflowStats = new Map<string, {
      workflowId: string
      name: string
      executions: number
      successes: number
    }>()

    for (const execution of filteredExecutions) {
      const workflowId = execution.workflowId
      if (!workflowStats.has(workflowId)) {
        workflowStats.set(workflowId, {
          workflowId,
          name: (execution.metadata?.workflowName as string) || 'Unknown Workflow',
          executions: 0,
          successes: 0
        })
      }
      
      const stats = workflowStats.get(workflowId)!
      stats.executions++
      if (execution.status === 'success') {
        stats.successes++
      }
    }

    const topWorkflows = Array.from(workflowStats.values())
      .map(w => ({
        ...w,
        successRate: w.executions > 0 ? Math.round((w.successes / w.executions) * 100) : 0
      }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 5)

    return {
      timeRange,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate,
      avgResponseTime,
      topWorkflows,
      recentFailures
    }
  } catch (error) {
    console.error('Error fetching n8n dashboard stats:', error)
    throw error
  }
}

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const timeRange = (searchParams.get('timeRange') as TimeRange) || '24h'
    const providerId = searchParams.get('providerId') || undefined

    // Require authentication for all requests
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch real data from n8n instance
    try {
      const n8nStats = await fetchN8nDashboardStats(timeRange)
      
      return NextResponse.json({
        success: true,
        data: n8nStats
      })
    } catch (error) {
      console.error('Failed to fetch n8n data:', error)
      
      // Fallback to empty stats
      const emptyStats: DashboardStats = {
        providerId,
        timeRange,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        topWorkflows: [],
        recentFailures: []
      }
      
      return NextResponse.json({
        success: true,
        data: emptyStats
      })
    }
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
