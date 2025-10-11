import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { ProviderRegistry } from '@/lib/providers'
import { Provider, DashboardStats, TimeRange, ExecutionFilters } from '@/types'
import { generateDemoDashboardStats, isDemoMode } from '@/lib/demo-data'

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const timeRange = (searchParams.get('timeRange') as TimeRange) || '24h'
    const providerId = searchParams.get('providerId') || undefined

    // Return demo data if demo mode is enabled
    if (isDemoMode()) {
      const demoStats = generateDemoDashboardStats(timeRange)
      return NextResponse.json({
        success: true,
        data: demoStats
      })
    }

    // TODO: Fetch user's providers from database
    // For now, return empty stats since we don't have providers set up yet
    const providers: Provider[] = []

    const stats: DashboardStats = {
      providerId,
      timeRange,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      successRate: 0,
      topWorkflows: [],
      recentFailures: []
    }

    if (providers.length === 0) {
      // Return empty stats when no providers are configured
      return NextResponse.json({
        success: true,
        data: stats
      })
    }

    // Create execution filters based on time range
    const filters: ExecutionFilters = {
      providerId,
      timeRange
    }

    const allExecutions = []

    // Fetch executions from each provider
    for (const provider of providers) {
      if (providerId && provider.id !== providerId) {
        continue // Skip this provider if filtering by specific provider
      }

      if (!provider.isConnected) {
        continue // Skip disconnected providers
      }

      try {
        const adapter = ProviderRegistry.create(provider)
        const result = await adapter.getExecutions(filters)

        if (result.success && result.data) {
          allExecutions.push(...result.data.items)
        }
      } catch (error) {
        console.error(`Failed to fetch executions from provider ${provider.name}:`, error)
        // Continue with other providers
      }
    }

    // Calculate stats
    stats.totalExecutions = allExecutions.length
    stats.successfulExecutions = allExecutions.filter(e => e.status === 'success').length
    stats.failedExecutions = allExecutions.filter(e => e.status === 'error').length
    stats.successRate = stats.totalExecutions > 0 
      ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100) 
      : 0

    // Calculate average response time
    const completedExecutions = allExecutions.filter(e => e.duration)
    if (completedExecutions.length > 0) {
      const totalDuration = completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0)
      stats.avgResponseTime = Math.round(totalDuration / completedExecutions.length)
    }

    // Get recent failures (last 10)
    const recentFailures = allExecutions
      .filter(e => e.status === 'error')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 10)

    stats.recentFailures = recentFailures.map(execution => ({
      executionId: execution.id,
      workflowName: 'Unknown Workflow', // We'd need to fetch workflow names
      error: execution.error?.message || 'Unknown error',
      timestamp: execution.startedAt
    }))

    // Group executions by workflow to get top workflows
    const workflowStats = new Map()
    
    for (const execution of allExecutions) {
      const workflowId = execution.workflowId
      if (!workflowStats.has(workflowId)) {
        workflowStats.set(workflowId, {
          workflowId,
          name: 'Unknown Workflow', // We'd need to fetch workflow names
          executions: 0,
          successes: 0
        })
      }
      
      const workflow = workflowStats.get(workflowId)
      workflow.executions++
      if (execution.status === 'success') {
        workflow.successes++
      }
    }

    // Calculate success rates and sort by execution count
    stats.topWorkflows = Array.from(workflowStats.values())
      .map(w => ({
        ...w,
        successRate: w.executions > 0 ? Math.round((w.successes / w.executions) * 100) : 0
      }))
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 5) // Top 5 workflows

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}