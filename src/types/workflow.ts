/**
 * Workflow-related type definitions for Elova
 * These types represent n8n workflows in a provider-agnostic way
 */

// Core workflow interfaces
export interface WorkflowNode {
  id: string
  name: string
  type: string
  typeVersion?: number
  position: [number, number]
  parameters: Record<string, any>
  credentials?: Record<string, string>
  disabled?: boolean
  notes?: string
  notesInFlow?: boolean
  color?: string
  continueOnFail?: boolean
  alwaysOutputData?: boolean
  executeOnce?: boolean
  retryOnFail?: boolean
  maxTries?: number
  waitBetweenTries?: number
  onError?: 'stopWorkflow' | 'continueRegularOutput' | 'continueErrorOutput'
}

export interface WorkflowConnection {
  node: string
  type: string
  index: number
}

export interface WorkflowConnections {
  [nodeName: string]: {
    [outputType: string]: WorkflowConnection[][]
  }
}

export interface WorkflowSettings {
  executionOrder?: 'v0' | 'v1'
  saveManualExecutions?: boolean
  callerPolicy?: string
  errorWorkflow?: string
  timezone?: string
  saveExecutionProgress?: boolean
  saveDataErrorExecution?: 'all' | 'none'
  saveDataSuccessExecution?: 'all' | 'none'
}

export interface WorkflowMetadata {
  instanceId?: string
  templateId?: number
  templateCredsSetupCompleted?: boolean
  [key: string]: any
}

// Complete n8n workflow structure
export interface N8nWorkflow {
  id?: string
  name: string
  nodes: WorkflowNode[]
  connections: WorkflowConnections
  active: boolean
  settings?: WorkflowSettings
  staticData?: Record<string, any>
  meta?: WorkflowMetadata
  pinData?: Record<string, any>
  versionId?: string
  triggerCount?: number
  createdAt?: string
  updatedAt?: string
  tags?: string[]
}

// Elova's workflow representation
export interface ElovaWorkflow {
  id: string
  providerId: string
  providerWorkflowId: string
  name: string
  active: boolean
  description?: string
  tags: string[]
  
  // Workflow structure
  workflowJson: N8nWorkflow
  nodeCount: number
  connectionCount: number
  
  // Statistics
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  lastExecutedAt?: string
  averageDuration?: number
  successRate: number
  
  // Metadata
  createdAt: string
  updatedAt: string
  lastSyncedAt: string
  
  // Provider-specific data
  providerData?: {
    versionId?: string
    triggerCount?: number
    pinData?: Record<string, any>
    settings?: WorkflowSettings
  }
}

// Workflow list item for table/card views
export interface WorkflowListItem {
  id: string
  name: string
  active: boolean
  tags: string[]
  nodeCount: number
  totalExecutions: number
  successRate: number
  lastExecutedAt?: string
  updatedAt: string
}

// Workflow statistics
export interface WorkflowStats {
  totalWorkflows: number
  activeWorkflows: number
  inactiveWorkflows: number
  averageSuccessRate: number
  totalExecutions: number
  mostActiveWorkflows: WorkflowListItem[]
  recentlyUpdated: WorkflowListItem[]
}

// Workflow visualization data
export interface WorkflowVisualization {
  nodes: VisualizationNode[]
  connections: VisualizationConnection[]
  layout: {
    width: number
    height: number
    bounds: {
      minX: number
      maxX: number
      minY: number
      maxY: number
    }
  }
}

export interface VisualizationNode {
  id: string
  name: string
  type: string
  position: {
    x: number
    y: number
  }
  size: {
    width: number
    height: number
  }
  disabled?: boolean
  hasError?: boolean
  isStartNode?: boolean
  isTrigger?: boolean
  color?: string
  icon?: string
  parameters?: Record<string, any>
}

export interface VisualizationConnection {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type: 'main' | 'error'
  animated?: boolean
}

// API response types
export interface WorkflowSyncResponse {
  success: boolean
  synced: number
  updated: number
  errors: string[]
  workflows: ElovaWorkflow[]
}

export interface WorkflowDetailResponse {
  workflow: ElovaWorkflow
  visualization: WorkflowVisualization
  recentExecutions: any[] // Will be typed separately
}

// Sync configuration
export interface WorkflowSyncConfig {
  includeInactive?: boolean
  syncSettings?: boolean
  syncPinData?: boolean
  batchSize?: number
  maxWorkflows?: number
}

// Provider-specific workflow formats
export interface ProviderWorkflow {
  n8n: N8nWorkflow
  // Future: zapier, make, etc.
}

// Workflow export/import types
export interface WorkflowExport {
  format: 'n8n' | 'elova'
  version: string
  workflow: N8nWorkflow | ElovaWorkflow
  metadata: {
    exportedAt: string
    exportedBy: string
    source: string
  }
}

// Search and filtering
export interface WorkflowFilter {
  active?: boolean
  tags?: string[]
  search?: string
  nodeTypes?: string[]
  dateRange?: {
    start: string
    end: string
  }
  sortBy?: 'name' | 'updated' | 'executions' | 'successRate'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface WorkflowSearchResult {
  workflows: WorkflowListItem[]
  total: number
  hasMore: boolean
  filters: WorkflowFilter
}