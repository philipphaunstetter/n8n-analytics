import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { TimeRange, Execution } from '@/types'
import { n8nApi, N8nExecution, N8nWorkflow } from '@/lib/n8n-api'
import { ExecutionStatus } from '@/types'

// Convert n8n executions to internal format (same as other APIs)
function convertN8nExecutions(n8nExecutions: N8nExecution[], workflows: N8nWorkflow[]): Execution[] {
  const workflowMap = new Map(workflows.map(w => [w.id, w]))
  
  return n8nExecutions.map(n8nExec => {
    const workflow = workflowMap.get(n8nExec.workflowId)
    const startedAt = new Date(n8nExec.startedAt)
    const stoppedAt = n8nExec.stoppedAt ? new Date(n8nExec.stoppedAt) : undefined
    const duration = stoppedAt ? stoppedAt.getTime() - startedAt.getTime() : undefined
    
    let status: ExecutionStatus = 'unknown'
    switch (n8nExec.status) {
      case 'success': status = 'success'; break
      case 'failed':
      case 'error':
      case 'crashed': status = 'error'; break
      case 'running': status = 'running'; break
      case 'waiting': status = 'waiting'; break
      case 'canceled': status = 'canceled'; break
      case 'new': status = 'waiting'; break
      default: status = 'unknown'
    }
    
    return {
      id: n8nExec.id,
      providerId: 'n8n-main',
      workflowId: n8nExec.workflowId,
      providerExecutionId: n8nExec.id,
      providerWorkflowId: n8nExec.workflowId,
      status,
      startedAt,
      stoppedAt,
      duration,
      mode: 'unknown',
      metadata: {
        workflowName: workflow?.name || 'Unknown Workflow',
        n8nWorkflowId: n8nExec.workflowId,
        finished: n8nExec.finished
      }
    }
  })
}

// Apply time range filters (same as other APIs)
function applyTimeRangeFilter(executions: Execution[], timeRange: TimeRange): Execution[] {
  if (timeRange === 'custom') return executions
  
  const now = new Date()
  let startDate: Date
  
  switch (timeRange) {
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
  
  return executions.filter(exec => exec.startedAt >= startDate)
}

export interface ChartDataPoint {
  date: string
  timestamp: number
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  successRate: number
  avgResponseTime: number | null
}

/**
 * Aggregate execution data into time series for charts
 */
async function generateChartData(timeRange: TimeRange): Promise<ChartDataPoint[]> {
  try {
    // Fetch executions using the same approach as other APIs
    const [n8nExecutions, n8nWorkflows] = await Promise.all([
      n8nApi.getExecutions(), // No limit, let filtering handle it
      n8nApi.getWorkflows()
    ])
    
    // Convert to internal format (same as dashboard stats API)
    const allExecutions = convertN8nExecutions(n8nExecutions.data, n8nWorkflows)
    
    // Apply time range filtering (same as dashboard stats API)
    const filteredExecutions = applyTimeRangeFilter(allExecutions, timeRange)
    
    // Determine granularity based on time range
    let granularity: 'hour' | 'day' | 'week'
    switch (timeRange) {
      case '1h':
      case '24h':
        granularity = 'hour'
        break
      case '7d':
      case '30d':
        granularity = 'day'
        break
      case '90d':
      default:
        granularity = 'week'
    }

    // Create time buckets based on granularity
    const timeBuckets = new Map<string, {
      date: string
      timestamp: number
      executions: Execution[]
    }>()

    for (const execution of filteredExecutions) {
      const executionDate = execution.startedAt // Already a Date object
      let bucketKey: string
      let bucketDate: Date

      if (granularity === 'hour') {
        // Round to nearest hour
        bucketDate = new Date(executionDate.getFullYear(), executionDate.getMonth(), 
          executionDate.getDate(), executionDate.getHours())
        bucketKey = bucketDate.toISOString()
      } else if (granularity === 'day') {
        // Round to day
        bucketDate = new Date(executionDate.getFullYear(), executionDate.getMonth(), 
          executionDate.getDate())
        bucketKey = bucketDate.toISOString().split('T')[0]
      } else {
        // Week - round to beginning of week (Monday)
        const dayOfWeek = executionDate.getDay()
        const mondayDate = new Date(executionDate)
        mondayDate.setDate(executionDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
        bucketDate = new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate())
        bucketKey = bucketDate.toISOString().split('T')[0]
      }

      if (!timeBuckets.has(bucketKey)) {
        timeBuckets.set(bucketKey, {
          date: bucketKey,
          timestamp: bucketDate.getTime(),
          executions: []
        })
      }

      timeBuckets.get(bucketKey)!.executions.push(execution)
    }

    // Generate chart data points
    const chartData: ChartDataPoint[] = []
    
    // Sort buckets chronologically
    const sortedBuckets = Array.from(timeBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))

    for (const [bucketKey, bucket] of sortedBuckets) {
      const totalExecutions = bucket.executions.length
      const successfulExecutions = bucket.executions.filter(e => e.status === 'success').length
      const failedExecutions = bucket.executions.filter(e => e.status === 'error').length
      const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0

      // Calculate average response time using duration from internal format
      const completedExecutions = bucket.executions.filter(e => e.duration !== undefined)
      let avgResponseTime: number | null = null

      if (completedExecutions.length > 0) {
        const totalDuration = completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0)
        avgResponseTime = Math.round(totalDuration / completedExecutions.length)
      }

      chartData.push({
        date: bucketKey,
        timestamp: bucket.timestamp,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate,
        avgResponseTime
      })
    }

    return chartData
  } catch (error) {
    console.error('Error generating chart data:', error)
    throw error
  }
}

// GET /api/dashboard/charts - Get time series chart data
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const timeRange = (searchParams.get('timeRange') as TimeRange) || '24h'

    // Require authentication
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate chart data from real n8n data
    try {
      const chartData = await generateChartData(timeRange)
      
      return NextResponse.json({
        success: true,
        data: chartData,
        timeRange,
        count: chartData.length
      })
    } catch (error) {
      console.error('Failed to generate chart data:', error)
      
      // Fallback to empty chart data
      return NextResponse.json({
        success: true,
        data: [],
        timeRange,
        count: 0
      })
    }
  } catch (error) {
    console.error('Failed to fetch chart data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}