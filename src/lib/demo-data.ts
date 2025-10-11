import { 
  Provider, 
  Workflow, 
  Execution, 
  WorkflowGraph,
  DashboardStats,
  ExecutionStatus,
  GraphNode,
  GraphConnection,
  TimeRange 
} from '@/types'

// Demo provider instances
export const DEMO_PROVIDERS: Provider[] = [
  {
    id: 'demo-n8n-1',
    name: 'Production n8n',
    type: 'n8n',
    baseUrl: 'https://n8n.company.com',
    isConnected: true,
    lastChecked: new Date(),
    version: '1.19.4',
    status: 'healthy',
    userId: 'demo-user',
    metadata: {
      instanceId: 'prod-n8n-001',
      executionsMode: 'regular'
    }
  },
  {
    id: 'demo-n8n-2', 
    name: 'Staging n8n',
    type: 'n8n',
    baseUrl: 'https://n8n-staging.company.com',
    isConnected: true,
    lastChecked: new Date(),
    version: '1.19.3',
    status: 'warning',
    userId: 'demo-user',
    metadata: {
      instanceId: 'staging-n8n-001',
      executionsMode: 'regular'
    }
  }
]

// Demo workflows
export const DEMO_WORKFLOWS: Workflow[] = [
  {
    id: 'demo-workflow-1',
    providerId: 'demo-n8n-1',
    providerWorkflowId: '1',
    name: 'Customer Onboarding',
    description: 'Automated customer onboarding workflow with email notifications and CRM updates',
    isActive: true,
    tags: ['customer', 'crm', 'email'],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-03-10'),
    lastExecutedAt: new Date(),
    totalExecutions: 1247,
    successCount: 1198,
    failureCount: 49,
    successRate: 96.1,
    avgDuration: 4500, // 4.5 seconds
  },
  {
    id: 'demo-workflow-2',
    providerId: 'demo-n8n-1', 
    providerWorkflowId: '2',
    name: 'Daily Sales Report',
    description: 'Generate and send daily sales reports to management team',
    isActive: true,
    tags: ['reports', 'sales', 'automation'],
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-03-05'),
    lastExecutedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    totalExecutions: 89,
    successCount: 87,
    failureCount: 2,
    successRate: 97.8,
    avgDuration: 12000, // 12 seconds
  },
  {
    id: 'demo-workflow-3',
    providerId: 'demo-n8n-1',
    providerWorkflowId: '3', 
    name: 'Inventory Alert System',
    description: 'Monitor inventory levels and send alerts when stock is low',
    isActive: false,
    tags: ['inventory', 'alerts', 'monitoring'],
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-02-15'),
    lastExecutedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    totalExecutions: 324,
    successCount: 298,
    failureCount: 26,
    successRate: 92.0,
    avgDuration: 2800, // 2.8 seconds
  },
  {
    id: 'demo-workflow-4',
    providerId: 'demo-n8n-2',
    providerWorkflowId: '4',
    name: 'Lead Qualification',
    description: 'Qualify incoming leads and route to appropriate sales team',
    isActive: true,
    tags: ['leads', 'sales', 'qualification'],
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-03-08'),
    lastExecutedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    totalExecutions: 567,
    successCount: 523,
    failureCount: 44,
    successRate: 92.2,
    avgDuration: 6700, // 6.7 seconds
  }
]

// Generate demo executions
export function generateDemoExecutions(count: number = 50): Execution[] {
  const executions: Execution[] = []
  const statuses: ExecutionStatus[] = ['success', 'error', 'running', 'canceled']
  const statusWeights = [0.85, 0.10, 0.03, 0.02] // 85% success, 10% error, 3% running, 2% canceled
  
  for (let i = 0; i < count; i++) {
    const workflow = DEMO_WORKFLOWS[Math.floor(Math.random() * DEMO_WORKFLOWS.length)]
    const startTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Last 30 days
    const duration = Math.random() * 30000 + 1000 // 1-30 seconds
    const endTime = new Date(startTime.getTime() + duration)
    
    // Weighted random status
    let status: ExecutionStatus = 'success'
    const rand = Math.random()
    let cumWeight = 0
    for (let j = 0; j < statuses.length; j++) {
      cumWeight += statusWeights[j]
      if (rand <= cumWeight) {
        status = statuses[j]
        break
      }
    }
    
    const execution: Execution = {
      id: `demo-execution-${i + 1}`,
      providerId: workflow.providerId,
      workflowId: workflow.id,
      providerExecutionId: `exec-${i + 1}`,
      providerWorkflowId: workflow.providerWorkflowId,
      status,
      startedAt: startTime,
      stoppedAt: status === 'running' ? undefined : endTime,
      duration: status === 'running' ? undefined : duration,
      mode: Math.random() > 0.7 ? 'manual' : 'trigger',
      error: status === 'error' ? {
        message: generateRandomError(),
        timestamp: endTime
      } : undefined
    }
    
    executions.push(execution)
  }
  
  return executions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
}

// Generate random error messages
function generateRandomError(): string {
  const errors = [
    'HTTP request failed with status 404: Not Found',
    'Database connection timeout after 30 seconds',
    'Invalid API key provided for external service',
    'JSON parsing failed: Unexpected token at position 42',
    'Rate limit exceeded: 100 requests per minute',
    'Required field "email" is missing from input data',
    'External webhook endpoint returned 500 Internal Server Error',
    'Authentication failed: Invalid credentials',
    'Network timeout: Unable to reach external service',
    'Data validation failed: Invalid email format'
  ]
  
  return errors[Math.floor(Math.random() * errors.length)]
}

// Generate demo dashboard stats
export function generateDemoDashboardStats(timeRange: TimeRange = '24h'): DashboardStats {
  const executions = generateDemoExecutions(100)
  
  // Filter by time range
  const now = new Date()
  let filterDate: Date
  
  switch (timeRange) {
    case '1h':
      filterDate = new Date(now.getTime() - 60 * 60 * 1000)
      break
    case '24h':
      filterDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case '7d':
      filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    default:
      filterDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  }
  
  const filteredExecutions = executions.filter(e => e.startedAt >= filterDate)
  
  const totalExecutions = filteredExecutions.length
  const successfulExecutions = filteredExecutions.filter(e => e.status === 'success').length
  const failedExecutions = filteredExecutions.filter(e => e.status === 'error').length
  const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0
  
  // Calculate average response time
  const completedExecutions = filteredExecutions.filter(e => e.duration)
  const avgResponseTime = completedExecutions.length > 0 
    ? Math.round(completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / completedExecutions.length)
    : undefined
  
  // Get recent failures
  const recentFailures = filteredExecutions
    .filter(e => e.status === 'error')
    .slice(0, 5)
    .map(e => ({
      executionId: e.id,
      workflowName: DEMO_WORKFLOWS.find(w => w.id === e.workflowId)?.name || 'Unknown Workflow',
      error: e.error?.message || 'Unknown error',
      timestamp: e.startedAt
    }))
  
  // Get top workflows
  const workflowStats = new Map()
  filteredExecutions.forEach(e => {
    if (!workflowStats.has(e.workflowId)) {
      const workflow = DEMO_WORKFLOWS.find(w => w.id === e.workflowId)
      workflowStats.set(e.workflowId, {
        workflowId: e.workflowId,
        name: workflow?.name || 'Unknown',
        executions: 0,
        successes: 0
      })
    }
    const stats = workflowStats.get(e.workflowId)
    stats.executions++
    if (e.status === 'success') stats.successes++
  })
  
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
}

// Sample workflow graph
export const DEMO_WORKFLOW_GRAPH: WorkflowGraph = {
  nodes: [
    {
      id: 'webhook',
      name: 'Webhook',
      type: 'webhook',
      position: { x: 100, y: 100 },
      parameters: {
        path: '/customer-signup',
        method: 'POST'
      }
    },
    {
      id: 'validate-data',
      name: 'Validate Data',
      type: 'code',
      position: { x: 300, y: 100 },
      parameters: {
        code: 'if (!input.email || !input.name) throw new Error("Missing required fields")'
      }
    },
    {
      id: 'create-customer',
      name: 'Create Customer',
      type: 'http-request',
      position: { x: 500, y: 100 },
      parameters: {
        url: 'https://api.crm.com/customers',
        method: 'POST'
      }
    },
    {
      id: 'send-welcome-email',
      name: 'Send Welcome Email',
      type: 'email',
      position: { x: 700, y: 100 },
      parameters: {
        to: '{{ $json.email }}',
        subject: 'Welcome to our platform!'
      }
    }
  ],
  connections: [
    { sourceNodeId: 'webhook', targetNodeId: 'validate-data' },
    { sourceNodeId: 'validate-data', targetNodeId: 'create-customer' },
    { sourceNodeId: 'create-customer', targetNodeId: 'send-welcome-email' }
  ],
  metadata: {
    version: '1.0',
    lastModified: new Date('2024-03-10')
  }
}

// Check if demo mode is enabled
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === 'true'
}