import { NextRequest, NextResponse } from 'next/server'
import { ProviderRegistry } from '@/lib/providers'
import { Provider, ExecutionFilters, ExecutionStatus, Execution } from '@/types'
import { authenticateRequest } from '@/lib/api-auth'
import { n8nApi, N8nExecution, N8nWorkflow } from '@/lib/n8n-api'

// GET /api/executions - List executions across all providers
// Supports query parameters:
// - limit: Number of executions to fetch (default: 500, max recommended: 1000)
// - cursor: Pagination cursor for fetching next page
// - workflowId: Filter by specific workflow
// - status: Filter by execution status (comma-separated)
// - timeRange: Filter by time range (1h, 24h, 7d, 30d, 90d)
// - search: Search in execution ID, workflow name, or error message
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request (handles both dev and Supabase auth)
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    let limit = parseInt(searchParams.get('limit') || '500') // Increased default from 100 to 500
    const cursor = searchParams.get('cursor') || undefined
    
    // Validate and cap the limit to prevent performance issues
    if (limit > 2000) {
      console.warn(`Execution limit ${limit} exceeds maximum of 2000, capping to 2000`)
      limit = 2000
    }
    if (limit < 1) {
      limit = 500 // Reset to default if invalid
    }
    
    const filters: ExecutionFilters = {
      providerId: searchParams.get('providerId') || undefined,
      workflowId: searchParams.get('workflowId') || undefined,
      status: searchParams.get('status')?.split(',') as any || undefined,
      timeRange: searchParams.get('timeRange') as any || '24h',
      search: searchParams.get('search') || undefined
    }

    // Parse custom time range if provided
    const customStart = searchParams.get('customStart')
    const customEnd = searchParams.get('customEnd')
    if (customStart && customEnd) {
      filters.customTimeRange = {
        start: new Date(customStart),
        end: new Date(customEnd)
      }
      filters.timeRange = 'custom'
    }

    // Fetch executions from n8n API - always use real data
    let allExecutions: Execution[] = []
    let totalCount = 0
    let nextCursor: string | null = null

    try {
      console.log(`Fetching real executions from n8n API (limit: ${limit})...`)
      const executionsResponse = await n8nApi.getExecutions({ 
        limit, 
        cursor,
        ...(filters.workflowId && { workflowId: filters.workflowId })
      })
      const n8nWorkflows = await n8nApi.getWorkflows()
      
      nextCursor = executionsResponse.nextCursor
      
      // Convert n8n executions to our internal format
      allExecutions = convertN8nExecutions(executionsResponse.data, n8nWorkflows)
      totalCount = allExecutions.length
      
      console.log(`Fetched ${allExecutions.length} real executions from n8n`)
    } catch (error) {
      console.error('Failed to fetch n8n executions:', error)
      return NextResponse.json(
        { error: 'Failed to connect to n8n API. Please check your n8n configuration.' },
        { status: 503 }
      )
    }

    // Apply filters
    const filteredExecutions = applyExecutionFilters(allExecutions, filters)
    totalCount = filteredExecutions.length

    // Sort executions by startedAt (most recent first)
    filteredExecutions.sort((a, b) => {
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    })

    return NextResponse.json({
      success: true,
      data: {
        items: filteredExecutions,
        total: totalCount,
        limit: limit,
        cursor: cursor,
        nextCursor: nextCursor,
        hasNextPage: !!nextCursor,
        hasPreviousPage: !!cursor
      }
    })
  } catch (error) {
    console.error('Failed to fetch executions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to apply filters to executions
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
  
  // Filter by provider ID
  if (filters.providerId) {
    filtered = filtered.filter(exec => exec.providerId === filters.providerId)
  }
  
  // Filter by workflow ID
  if (filters.workflowId) {
    filtered = filtered.filter(exec => exec.workflowId === filters.workflowId)
  }
  
  // Filter by search query (search in execution ID, workflow name, or error message)
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase()
    filtered = filtered.filter(exec => {
      // Search in execution ID
      if (exec.id.toLowerCase().includes(searchTerm) || 
          exec.providerExecutionId.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      // Search in workflow name from metadata
      const workflowName = exec.metadata?.workflowName || ''
      if (typeof workflowName === 'string' && workflowName.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      // Search in error message
      if (exec.error && exec.error.message.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      return false
    })
  }
  
  return filtered
}

/**
 * Extract first node information for better mode display
 * Now properly detects scheduled triggers (cron, interval)
 */
function getFirstNodeInfo(nodes: any[]): { type?: string; name?: string } | undefined {
  if (!nodes || nodes.length === 0) return undefined;
  
  // Find trigger nodes - prioritize scheduled triggers
  const scheduledTriggerNode = nodes.find(node => 
    node.type && (
      node.type.includes('cronTrigger') ||
      node.type.includes('intervalTrigger') ||
      node.type.includes('scheduleTrigger') ||
      (node.type.includes('trigger') && node.parameters?.rule?.interval) // Some triggers have interval in parameters
    )
  );
  
  // Find other trigger types
  const triggerNode = scheduledTriggerNode || nodes.find(node => 
    node.type && (
      node.type.includes('trigger') ||
      node.type.includes('webhook') ||
      node.type.includes('manual')
    )
  );
  
  const firstNode = triggerNode || nodes[0];
  if (!firstNode) return undefined;
  
  // Extract the node type and create a friendly display name
  const nodeType = firstNode.type || 'Unknown';
  const displayName = getScheduledTriggerDisplayName(nodeType, firstNode.parameters);
  
  return {
    type: nodeType,
    name: displayName
  };
}

/**
 * Convert node type to display name with enhanced scheduled trigger detection
 */
function getScheduledTriggerDisplayName(nodeType: string, parameters?: any): string {
  // First, check for scheduled triggers specifically
  if (nodeType.includes('cronTrigger') || nodeType.includes('cron')) {
    return 'Scheduled (Cron)';
  }
  
  if (nodeType.includes('intervalTrigger')) {
    // Try to extract interval details from parameters
    if (parameters?.interval) {
      const interval = parameters.interval;
      if (typeof interval === 'number') {
        if (interval < 60) return `Scheduled (${interval}s)`;
        if (interval < 3600) return `Scheduled (${Math.round(interval/60)}m)`;
        return `Scheduled (${Math.round(interval/3600)}h)`;
      }
    }
    return 'Scheduled (Interval)';
  }
  
  if (nodeType.includes('scheduleTrigger') || nodeType.includes('schedule')) {
    return 'Scheduled';
  }
  
  // Check if it's a generic trigger with scheduling parameters
  if (nodeType.includes('trigger') && parameters) {
    if (parameters.rule?.interval || parameters.interval) {
      return 'Scheduled (Timer)';
    }
    if (parameters.cron || parameters.cronExpression) {
      return 'Scheduled (Cron)';
    }
  }
  
  // Fall back to the original node display name logic
  return getNodeDisplayName(nodeType);
}

/**
 * Original node type to display name converter
 */
function getNodeDisplayName(nodeType: string): string {
  // Extract meaningful name from node type
  // e.g., 'n8n-nodes-base.googleGmail' -> 'Google Gmail'
  
  if (nodeType.includes('googleGmail')) return 'Google Gmail';
  if (nodeType.includes('googleSheets')) return 'Google Sheets';
  if (nodeType.includes('googleDrive')) return 'Google Drive';
  if (nodeType.includes('slack')) return 'Slack';
  if (nodeType.includes('discord')) return 'Discord';
  if (nodeType.includes('webhook')) return 'Webhook';
  if (nodeType.includes('httpRequest')) return 'HTTP Request';
  if (nodeType.includes('cron')) return 'Cron Job';
  if (nodeType.includes('manual')) return 'Manual';
  if (nodeType.includes('trigger')) return 'Trigger';
  if (nodeType.includes('airtable')) return 'Airtable';
  if (nodeType.includes('notion')) return 'Notion';
  if (nodeType.includes('trello')) return 'Trello';
  if (nodeType.includes('github')) return 'GitHub';
  if (nodeType.includes('gitlab')) return 'GitLab';
  
  // Try to extract from the base name
  const parts = nodeType.split('.');
  const baseName = parts[parts.length - 1];
  
  // Convert camelCase to Title Case
  const titleCase = baseName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
  
  return titleCase || 'Unknown';
}

/**
 * Convert n8n executions to our internal format
 */
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
    
    // Map n8n mode to our internal mode format with enhanced scheduled detection
    let mode: 'manual' | 'trigger' | 'webhook' | 'cron' | 'unknown' = 'unknown'
    
    // First check if it's a scheduled trigger based on workflow nodes
    const firstNodeInfo = getFirstNodeInfo(workflow?.nodes || [])
    const isScheduledTrigger = firstNodeInfo?.name?.includes('Scheduled') || 
                              firstNodeInfo?.type?.includes('cron') ||
                              firstNodeInfo?.type?.includes('interval') ||
                              firstNodeInfo?.type?.includes('schedule')
    
    if (isScheduledTrigger) {
      mode = 'cron' // Use 'cron' for all scheduled triggers
    } else {
      // Fall back to n8n's mode classification
      switch (n8nExec.mode) {
        case 'manual':
          mode = 'manual'
          break
        case 'trigger':
          mode = 'trigger'
          break
        case 'webhook':
          mode = 'webhook'
          break
        case 'cron':
          mode = 'cron'
          break
        default:
          mode = 'unknown'
      }
    }
    
    const execution: Execution = {
      id: n8nExec.id, // Use execution ID directly
      providerId: 'n8n-main', // Static provider ID for n8n instance
      workflowId: n8nExec.workflowId, // Use workflow ID directly
      providerExecutionId: n8nExec.id,
      providerWorkflowId: n8nExec.workflowId,
      status,
      startedAt,
      stoppedAt,
      duration,
      mode,
      // Add error information if execution failed
      error: status === 'error' ? {
        message: `Execution failed with status: ${n8nExec.status}`,
        timestamp: stoppedAt || startedAt
      } : undefined,
      // Add workflow name and other metadata
      metadata: {
        workflowName: workflow?.name || 'Unknown Workflow',
        n8nWorkflowId: n8nExec.workflowId,
        finished: n8nExec.finished,
        retryOf: n8nExec.retryOf,
        retrySuccessId: n8nExec.retrySuccessId,
        firstNode: getFirstNodeInfo(workflow?.nodes || [])
      }
    }
    
    return execution
  })
}
