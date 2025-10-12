import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { DashboardStats, TimeRange } from '@/types'
import { n8nApi } from '@/lib/n8n-api'

/**
 * Fetch dashboard statistics from n8n API
 */
async function fetchN8nDashboardStats(timeRange: TimeRange): Promise<DashboardStats> {
  try {
    // Calculate time range for filtering
    const now = new Date()
    let startTime: Date
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    // Fetch workflows and executions in parallel
    const [workflowsResponse, executionsResponse] = await Promise.all([
      n8nApi.getWorkflows(),
      n8nApi.getExecutions({ limit: 100 }) // Fetch recent executions
    ])

    // Filter executions by time range
    const filteredExecutions = executionsResponse.data.filter(execution => 
      new Date(execution.startedAt) >= startTime
    )

    // Calculate basic stats
    const totalExecutions = filteredExecutions.length
    const successfulExecutions = filteredExecutions.filter(e => e.status === 'success').length
    const failedExecutions = filteredExecutions.filter(e => ['failed', 'error', 'crashed'].includes(e.status)).length
    const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0

    // Calculate average response time (duration)
    const completedExecutions = filteredExecutions.filter(e => e.stoppedAt && e.startedAt)
    let avgResponseTime: number | undefined
    
    if (completedExecutions.length > 0) {
      const totalDuration = completedExecutions.reduce((sum, e) => {
        const duration = new Date(e.stoppedAt!).getTime() - new Date(e.startedAt).getTime()
        return sum + duration
      }, 0)
      avgResponseTime = Math.round(totalDuration / completedExecutions.length)
    }

    // Create workflow lookup map
    const workflowMap = new Map(workflowsResponse.map(w => [w.id, w.name]))

    // Get recent failures
    const recentFailures = filteredExecutions
      .filter(e => ['failed', 'error', 'crashed'].includes(e.status))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 5)
      .map(execution => ({
        executionId: execution.id,
        workflowName: workflowMap.get(execution.workflowId) || 'Unknown Workflow',
        error: 'Execution failed', // n8n API doesn't provide detailed error in list view
        timestamp: new Date(execution.startedAt)
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
          name: workflowMap.get(workflowId) || 'Unknown Workflow',
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
    // Parse query parameters first
    const searchParams = request.nextUrl.searchParams
    const timeRange = (searchParams.get('timeRange') as TimeRange) || '24h'
    const providerId = searchParams.get('providerId') || undefined

    // Always use real n8n data - no demo mode

    // Check if n8n is configured (we'll check during the fetch, no need to warn here)
    // The n8n API client now loads configuration from database dynamically
    
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