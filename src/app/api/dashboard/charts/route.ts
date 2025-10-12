import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { TimeRange } from '@/types'
import { n8nApi } from '@/lib/n8n-api'

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
    // Calculate time range and granularity
    const now = new Date()
    let startTime: Date
    let granularity: 'hour' | 'day' | 'week'
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
        granularity = 'hour' // Show by 5-minute intervals for 1 hour
        break
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        granularity = 'hour'
        break
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        granularity = 'day'
        break
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        granularity = 'day'
        break
      case '90d':
        startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        granularity = 'week'
        break
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        granularity = 'hour'
    }

    // Fetch executions from n8n API
    const executionsResponse = await n8nApi.getExecutions({ 
      limit: 1000, // Fetch more data for better chart granularity
      // Note: n8n API doesn't have built-in date filtering, so we'll filter client-side
    })

    // Filter executions by time range
    const filteredExecutions = executionsResponse.data.filter(execution => 
      new Date(execution.startedAt) >= startTime
    )

    // Create time buckets based on granularity
    const timeBuckets = new Map<string, {
      date: string
      timestamp: number
      executions: typeof filteredExecutions
    }>()

    for (const execution of filteredExecutions) {
      const executionDate = new Date(execution.startedAt)
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
    
    // Fill in missing time periods with zero values
    const sortedBuckets = Array.from(timeBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))

    for (const [bucketKey, bucket] of sortedBuckets) {
      const totalExecutions = bucket.executions.length
      const successfulExecutions = bucket.executions.filter(e => e.status === 'success').length
      const failedExecutions = bucket.executions.filter(e => ['failed', 'error', 'crashed'].includes(e.status)).length
      const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0

      // Calculate average response time
      const completedExecutions = bucket.executions.filter(e => e.stoppedAt && e.startedAt)
      let avgResponseTime: number | null = null

      if (completedExecutions.length > 0) {
        const totalDuration = completedExecutions.reduce((sum, e) => {
          const duration = new Date(e.stoppedAt!).getTime() - new Date(e.startedAt).getTime()
          return sum + duration
        }, 0)
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

    // Fill gaps in timeline for smoother charts
    if (chartData.length > 1) {
      const filledData: ChartDataPoint[] = []
      const interval = granularity === 'hour' ? 60 * 60 * 1000 : 
                     granularity === 'day' ? 24 * 60 * 60 * 1000 :
                     7 * 24 * 60 * 60 * 1000

      let currentTime = chartData[0].timestamp
      const endTime = chartData[chartData.length - 1].timestamp

      while (currentTime <= endTime) {
        const existingPoint = chartData.find(d => d.timestamp === currentTime)
        if (existingPoint) {
          filledData.push(existingPoint)
        } else {
          // Add zero-value point for missing time periods
          filledData.push({
            date: new Date(currentTime).toISOString().split('T')[0],
            timestamp: currentTime,
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            successRate: 0,
            avgResponseTime: null
          })
        }
        currentTime += interval
      }

      return filledData
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