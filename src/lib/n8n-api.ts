import { getConfigManager } from './config/config-manager';

// Configuration will be loaded from database when needed

export interface N8nExecution {
  id: string;
  mode: string;
  retryOf: string | null;
  retrySuccessId: string | null;
  status: 'success' | 'failed' | 'error' | 'canceled' | 'crashed' | 'new' | 'running' | 'waiting';
  startedAt: string;
  stoppedAt: string | null;
  workflowId: string;
  workflowName?: string;
  finished: boolean;
  data?: {
    resultData?: {
      runData?: Record<string, any[]>;
      error?: any;
      lastNodeExecuted?: string;
    };
    executionData?: any;
    startData?: any;
  };
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: any[];
  connections: any;
  tags: any[];
}

export interface ExecutionsResponse {
  data: N8nExecution[];
  nextCursor: string | null;
}

class N8nApiClient {
  private configManager = getConfigManager();

  private async getConfig() {
    await this.configManager.initialize();
    const host = await this.configManager.get('integrations.n8n.url') || 'http://localhost:5678';
    const apiKey = await this.configManager.get('integrations.n8n.api_key') || '';
    return { host, apiKey };
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const { host, apiKey } = await this.getConfig();
    const url = `${host}/api/v1${endpoint}`;
    
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(apiKey && { 'X-N8N-API-KEY': apiKey }),
      ...options?.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('n8n API request failed:', error);
      throw error;
    }
  }

  async getExecutions(params?: {
    limit?: number;
    cursor?: string;
    status?: string;
    workflowId?: string;
    includeData?: boolean;
  }): Promise<ExecutionsResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.cursor) searchParams.append('cursor', params.cursor);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.workflowId) searchParams.append('workflowId', params.workflowId);
    if (params?.includeData) searchParams.append('includeData', 'true');

    const queryString = searchParams.toString();
    const endpoint = `/executions${queryString ? `?${queryString}` : ''}`;

    return this.request<ExecutionsResponse>(endpoint);
  }

  async getExecution(id: string, includeData: boolean = false): Promise<N8nExecution> {
    const params = includeData ? '?includeData=true' : '';
    return this.request<N8nExecution>(`/executions/${id}${params}`);
  }

  async getExecutionWithData(id: string): Promise<N8nExecution> {
    return this.getExecution(id, true);
  }

  async getWorkflows(): Promise<N8nWorkflow[]> {
    const response = await this.request<{ data: N8nWorkflow[] }>('/workflows');
    return response.data;
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    return this.request<N8nWorkflow>(`/workflows/${id}`);
  }
}

export const n8nApi = new N8nApiClient();