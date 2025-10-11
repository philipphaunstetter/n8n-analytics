import { 
  Provider, 
  Workflow, 
  Execution, 
  WorkflowGraph, 
  ExecutionFilters,
  WorkflowFilters,
  PaginatedResponse,
  ApiResponse 
} from '@/types'

/**
 * Abstract base class for all automation platform providers
 * Each provider (n8n, Zapier, Make, etc.) implements this interface
 */
export abstract class ProviderAdapter {
  protected provider: Provider

  constructor(provider: Provider) {
    this.provider = provider
  }

  /**
   * Test connection to the provider
   * @returns Promise with connection status and metadata
   */
  abstract testConnection(): Promise<ApiResponse<{
    version?: string
    status: 'healthy' | 'warning' | 'error'
    metadata?: Record<string, unknown>
  }>>

  /**
   * Get provider information (version, health, etc.)
   */
  abstract getProviderInfo(): Promise<ApiResponse<{
    version: string
    health: 'healthy' | 'warning' | 'error'
    uptime?: number
    features?: string[]
    limits?: Record<string, number>
  }>>

  /**
   * Authenticate with the provider (if needed beyond API key)
   */
  async authenticate(): Promise<ApiResponse<boolean>> {
    // Default implementation - most providers just use API keys
    return { success: true, data: true }
  }

  /**
   * List all workflows from the provider
   */
  abstract getWorkflows(filters?: WorkflowFilters): Promise<ApiResponse<PaginatedResponse<Workflow>>>

  /**
   * Get a specific workflow by provider ID
   */
  abstract getWorkflow(providerWorkflowId: string): Promise<ApiResponse<Workflow>>

  /**
   * Get workflow graph/flow definition
   */
  abstract getWorkflowGraph(providerWorkflowId: string): Promise<ApiResponse<WorkflowGraph>>

  /**
   * List executions for a workflow or all workflows
   */
  abstract getExecutions(filters?: ExecutionFilters): Promise<ApiResponse<PaginatedResponse<Execution>>>

  /**
   * Get a specific execution by provider ID
   */
  abstract getExecution(providerExecutionId: string): Promise<ApiResponse<Execution>>

  /**
   * Trigger a workflow execution (if supported)
   */
  async triggerWorkflow(providerWorkflowId: string, inputData?: Record<string, unknown>): Promise<ApiResponse<Execution>> {
    return {
      success: false,
      error: 'Workflow triggering not supported by this provider'
    }
  }

  /**
   * Stop a running execution (if supported)
   */
  async stopExecution(providerExecutionId: string): Promise<ApiResponse<boolean>> {
    return {
      success: false,
      error: 'Execution stopping not supported by this provider'
    }
  }

  // Utility methods for data transformation

  /**
   * Convert provider-specific workflow data to our standard format
   */
  protected abstract transformWorkflow(providerData: unknown): Workflow

  /**
   * Convert provider-specific execution data to our standard format
   */
  protected abstract transformExecution(providerData: unknown): Execution

  /**
   * Convert provider-specific graph data to our standard format
   */
  protected abstract transformGraph(providerData: unknown): WorkflowGraph

  /**
   * Make HTTP request to provider API with authentication
   */
  protected async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.provider.baseUrl.replace(/\/$/, '')}${endpoint}`
    
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers,
    }

    try {
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Provider API request failed: ${url}`, error)
      throw error
    }
  }

  /**
   * Get authentication headers for API requests
   */
  protected abstract getAuthHeaders(): Record<string, string>

  /**
   * Validate provider configuration
   */
  protected validateConfig(): void {
    if (!this.provider.baseUrl) {
      throw new Error('Provider base URL is required')
    }
    if (!this.provider.apiKey) {
      throw new Error('Provider API key is required')
    }
  }

  /**
   * Get provider type-specific capabilities
   */
  abstract getCapabilities(): ProviderCapabilities
}

export interface ProviderCapabilities {
  canTriggerWorkflows: boolean
  canStopExecutions: boolean
  canGetRealTimeStatus: boolean
  canGetWorkflowGraph: boolean
  canGetExecutionLogs: boolean
  supportsWebhooks: boolean
  supportsScheduling: boolean
  maxExecutionsPerRequest: number
  maxWorkflowsPerRequest: number
  rateLimit?: {
    requests: number
    per: 'second' | 'minute' | 'hour'
  }
}

/**
 * Registry for managing provider adapters
 */
export class ProviderRegistry {
  private static adapters = new Map<string, new (provider: Provider) => ProviderAdapter>()

  static register<T extends ProviderAdapter>(type: string, adapterClass: new (provider: Provider) => T) {
    this.adapters.set(type, adapterClass)
  }

  static create(provider: Provider): ProviderAdapter {
    const AdapterClass = this.adapters.get(provider.type)
    if (!AdapterClass) {
      throw new Error(`No adapter found for provider type: ${provider.type}`)
    }
    return new AdapterClass(provider)
  }

  static getSupportedTypes(): string[] {
    return Array.from(this.adapters.keys())
  }
}
