import { NextRequest, NextResponse } from 'next/server'
import { ExecutionFilters, ExecutionStatus, Execution } from '@/types'
import { authenticateRequest } from '@/lib/api-auth'
import { Database } from 'sqlite3'
import { ConfigManager } from '@/lib/config/config-manager'

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

    // Fetch executions from local SQLite database for long-term storage
    let allExecutions: Execution[] = []
    let totalCount = 0
    let nextCursor: string | null = null

    try {
      console.log(`Fetching executions from SQLite database (limit: ${limit})...`)
      
      const dbPath = ConfigManager.getDefaultDatabasePath()
      const db = new Database(dbPath)
      
      // Build SQL query with filters
      let sql = `
        SELECT 
          e.id,
          e.provider_id,
          e.workflow_id,
          e.provider_execution_id,
          e.provider_workflow_id,
          e.status,
          e.mode,
          e.started_at,
          e.stopped_at,
          e.duration,
          e.finished,
          e.retry_of,
          e.retry_success_id,
          e.metadata,
          w.name as workflow_name,
          p.name as provider_name
        FROM executions e
        LEFT JOIN workflows w ON e.workflow_id = w.id
        LEFT JOIN providers p ON e.provider_id = p.id
        WHERE 1=1
      `
      
      const params: any[] = []
      
      // Add filters
      if (filters.workflowId) {
        sql += ' AND w.provider_workflow_id = ?'
        params.push(filters.workflowId)
      }
      
      if (filters.status && filters.status.length > 0) {
        const placeholders = filters.status.map(() => '?').join(',')
        sql += ` AND e.status IN (${placeholders})`
        params.push(...filters.status)
      }
      
      // Add time range filter
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
        sql += ' AND e.started_at >= ?'
        params.push(startDate.toISOString())
      }
      
      // Custom time range
      if (filters.timeRange === 'custom' && filters.customTimeRange) {
        sql += ' AND e.started_at >= ? AND e.started_at <= ?'
        params.push(
          filters.customTimeRange.start.toISOString(),
          filters.customTimeRange.end.toISOString()
        )
      }
      
      // Add search filter
      if (filters.search) {
        sql += ` AND (
          e.id LIKE ? OR 
          e.provider_execution_id LIKE ? OR
          w.name LIKE ?
        )`
        const searchTerm = `%${filters.search}%`
        params.push(searchTerm, searchTerm, searchTerm)
      }
      
      // Order by most recent first and add limit
      sql += ' ORDER BY e.started_at DESC LIMIT ?'
      params.push(limit)
      
      // Execute query
      const rows = await new Promise<any[]>((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) {
            console.error('Database query error:', err)
            reject(err)
          } else {
            resolve(rows || [])
          }
        })
      })
      
      db.close()
      
      // Convert database results to internal Execution format
      allExecutions = rows.map(row => {
        const metadata = row.metadata ? JSON.parse(row.metadata) : {}
        return {
          id: row.id,
          providerId: row.provider_id,
          workflowId: row.workflow_id,
          providerExecutionId: row.provider_execution_id,
          providerWorkflowId: row.provider_workflow_id,
          status: row.status as ExecutionStatus,
          startedAt: new Date(row.started_at),
          stoppedAt: row.stopped_at ? new Date(row.stopped_at) : undefined,
          duration: row.duration,
          mode: row.mode as any,
          error: row.status === 'error' ? {
            message: `Execution failed`,
            timestamp: row.stopped_at ? new Date(row.stopped_at) : new Date(row.started_at)
          } : undefined,
          metadata: {
            workflowName: row.workflow_name || 'Unknown Workflow',
            providerName: row.provider_name || 'Unknown Provider',
            finished: Boolean(row.finished),
            retryOf: row.retry_of,
            retrySuccessId: row.retry_success_id,
            ...metadata
          }
        } as Execution
      })
      
      totalCount = allExecutions.length
      
      console.log(`Fetched ${allExecutions.length} executions from SQLite database`)
      
      // If no executions found, suggest running sync
      if (allExecutions.length === 0) {
        console.log('⚠️  No executions found in database. Consider running sync to fetch from n8n.')
      }
      
    } catch (error) {
      console.error('Failed to fetch executions from database:', error)
      return NextResponse.json(
        { error: 'Failed to fetch executions from database. Please run sync to populate data.' },
        { status: 500 }
      )
    }

    // Executions are already filtered and sorted in the SQL query
    const filteredExecutions = allExecutions

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
