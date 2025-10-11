const N8N_HOST = process.env.N8N_HOST || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.warn('N8N_API_KEY is not set. Please add it to your .env.local file.');
}

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
    };
    executionData?: any;
  };
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
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
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = N8N_HOST;
    this.apiKey = N8N_API_KEY || '';
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey }),
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
  }): Promise<ExecutionsResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.cursor) searchParams.append('cursor', params.cursor);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.workflowId) searchParams.append('workflowId', params.workflowId);

    const queryString = searchParams.toString();
    const endpoint = `/executions${queryString ? `?${queryString}` : ''}`;

    return this.request<ExecutionsResponse>(endpoint);
  }

  async getExecution(id: string): Promise<N8nExecution> {
    return this.request<N8nExecution>(`/executions/${id}`);
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