/**
 * AI Metrics Extractor
 * Extracts token usage and calculates costs from n8n execution data
 * Supports: OpenAI, Anthropic, Google AI, Azure OpenAI
 */

export interface AIMetrics {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  aiCost: number
  aiProvider: string | null
  nodeBreakdown?: Array<{
    nodeName: string
    nodeType: string
    tokens: number
    cost: number
  }>
}

interface PricingEntry {
  input: number  // Cost per 1K input tokens
  output: number // Cost per 1K output tokens
}

interface PricingTable {
  [model: string]: PricingEntry
}

// Pricing as of January 2025 (USD per 1K tokens)
// Using OpenAI Standard tier pricing
const AI_PRICING: PricingTable = {
  // OpenAI GPT-4o Models
  'gpt-4o': { input: 0.0025, output: 0.010 },
  'gpt-4o-2024-11-20': { input: 0.0025, output: 0.010 },
  'gpt-4o-2024-08-06': { input: 0.0025, output: 0.010 },
  'gpt-4o-2024-05-13': { input: 0.005, output: 0.015 },
  'gpt-4o-audio-preview': { input: 0.0025, output: 0.010 }, // text tokens
  'gpt-4o-audio-preview-2024-12-17': { input: 0.0025, output: 0.010 },
  'gpt-4o-audio-preview-2024-10-01': { input: 0.0025, output: 0.010 },
  'chatgpt-4o-latest': { input: 0.005, output: 0.015 },
  
  // OpenAI GPT-4o mini Models
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o-mini-2024-07-18': { input: 0.00015, output: 0.0006 },
  
  // OpenAI o1 Models (reasoning)
  'o1': { input: 0.015, output: 0.060 },
  'o1-2024-12-17': { input: 0.015, output: 0.060 },
  'o1-preview': { input: 0.015, output: 0.060 },
  'o1-preview-2024-09-12': { input: 0.015, output: 0.060 },
  'o1-mini': { input: 0.003, output: 0.012 },
  'o1-mini-2024-09-12': { input: 0.003, output: 0.012 },
  
  // OpenAI GPT-4 Turbo Models
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-2024-04-09': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4-0125-preview': { input: 0.01, output: 0.03 },
  'gpt-4-1106-preview': { input: 0.01, output: 0.03 },
  'gpt-4-vision-preview': { input: 0.01, output: 0.03 },
  
  // OpenAI GPT-4 Models
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-0613': { input: 0.03, output: 0.06 },
  'gpt-4-32k': { input: 0.06, output: 0.12 },
  'gpt-4-32k-0613': { input: 0.06, output: 0.12 },
  
  // OpenAI GPT-3.5 Turbo Models
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-1106': { input: 0.001, output: 0.002 },
  'gpt-3.5-turbo-instruct': { input: 0.0015, output: 0.002 },
  
  // Anthropic Claude Models (October 2025 pricing - Standard tier)
  
  // Claude 4.x (Latest models)
  'claude-opus-4.1': { input: 0.015, output: 0.075 },
  'opus-4.1': { input: 0.015, output: 0.075 },
  'claude-sonnet-4.5': { input: 0.003, output: 0.015 }, // ≤200K tokens
  'sonnet-4.5': { input: 0.003, output: 0.015 },
  'claude-haiku-4.5': { input: 0.001, output: 0.005 },
  'haiku-4.5': { input: 0.001, output: 0.005 },
  
  // Claude 4.x Legacy
  'claude-opus-4': { input: 0.015, output: 0.075 },
  'opus-4': { input: 0.015, output: 0.075 },
  'claude-sonnet-4': { input: 0.003, output: 0.015 },
  'sonnet-4': { input: 0.003, output: 0.015 },
  
  // Claude 3.x (Legacy)
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet-latest': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-sonnet-3.7': { input: 0.003, output: 0.015 },
  'sonnet-3.7': { input: 0.003, output: 0.015 },
  
  'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
  'claude-3-5-haiku-latest': { input: 0.0008, output: 0.004 },
  'claude-3-5-haiku': { input: 0.0008, output: 0.004 },
  'claude-haiku-3.5': { input: 0.0008, output: 0.004 },
  'haiku-3.5': { input: 0.0008, output: 0.004 },
  
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-opus-latest': { input: 0.015, output: 0.075 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-opus-3': { input: 0.015, output: 0.075 },
  'opus-3': { input: 0.015, output: 0.075 },
  
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-haiku-3': { input: 0.00025, output: 0.00125 },
  'haiku-3': { input: 0.00025, output: 0.00125 },
  
  // Claude 2 (legacy)
  'claude-2.1': { input: 0.008, output: 0.024 },
  'claude-2.0': { input: 0.008, output: 0.024 },
  'claude-2': { input: 0.008, output: 0.024 },
  'claude-instant-1.2': { input: 0.0008, output: 0.0024 },
  'claude-instant': { input: 0.0008, output: 0.0024 },
  
  // Google Gemini Models
  'gemini-2.0-flash-exp': { input: 0, output: 0 }, // Free during preview
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-pro-latest': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-flash-latest': { input: 0.000075, output: 0.0003 },
  'gemini-1.0-pro': { input: 0.0005, output: 0.0015 },
  
  // Legacy Google models
  'gemini-pro': { input: 0.0005, output: 0.0015 },
  'gemini-pro-vision': { input: 0.0005, output: 0.0015 },
  
  // Azure OpenAI (typically same as OpenAI pricing)
  'azure-gpt-4o': { input: 0.0025, output: 0.010 },
  'azure-gpt-4': { input: 0.03, output: 0.06 },
  'azure-gpt-35-turbo': { input: 0.0005, output: 0.0015 }
}

/**
 * Extract AI metrics from n8n execution data
 */
export function extractAIMetrics(executionData: any): AIMetrics {
  const metrics: AIMetrics = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    aiCost: 0,
    aiProvider: null,
    nodeBreakdown: []
  }

  if (!executionData || !executionData.data || !executionData.data.resultData) {
    return metrics
  }

  const runData = executionData.data.resultData.runData || {}
  
  // Iterate through all nodes in the execution
  for (const [nodeName, nodeRuns] of Object.entries(runData)) {
    if (!Array.isArray(nodeRuns)) continue
    
    // Process each run of the node
    for (const run of nodeRuns) {
      if (!run || !run.data) continue
      
      const nodeMetrics = extractNodeMetrics(nodeName, run)
      
      if (nodeMetrics) {
        metrics.totalTokens += nodeMetrics.tokens
        metrics.inputTokens += nodeMetrics.inputTokens
        metrics.outputTokens += nodeMetrics.outputTokens
        metrics.aiCost += nodeMetrics.cost
        
        // Set provider from first AI node encountered
        if (!metrics.aiProvider && nodeMetrics.provider) {
          metrics.aiProvider = nodeMetrics.provider
        }
        
        if (metrics.nodeBreakdown && nodeMetrics.tokens > 0) {
          metrics.nodeBreakdown.push({
            nodeName,
            nodeType: nodeMetrics.nodeType,
            tokens: nodeMetrics.tokens,
            cost: nodeMetrics.cost
          })
        }
      }
    }
  }

  return metrics
}

interface NodeMetrics {
  tokens: number
  inputTokens: number
  outputTokens: number
  cost: number
  provider: string | null
  nodeType: string
}

/**
 * Extract metrics from a single node execution
 */
function extractNodeMetrics(nodeName: string, nodeRun: any): NodeMetrics | null {
  const metrics: NodeMetrics = {
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    provider: null,
    nodeType: 'unknown'
  }

  // Get node data - check both main and ai_languageModel paths
  const dataSources = [
    nodeRun.data?.main?.[0] || [],
    nodeRun.data?.ai_languageModel?.[0] || []
  ]
  
  for (const dataSource of dataSources) {
    for (const output of dataSource) {
      if (!output || !output.json) continue
      
      const json = output.json
      
      // Try different patterns for token usage
      const tokenData = extractTokenData(json)
      
      if (tokenData) {
        metrics.tokens = tokenData.total
        metrics.inputTokens = tokenData.input
        metrics.outputTokens = tokenData.output
        metrics.provider = tokenData.provider
        metrics.nodeType = tokenData.nodeType
        
        // Calculate cost based on model
        const model = tokenData.model
        if (model && AI_PRICING[model]) {
          const pricing = AI_PRICING[model]
          metrics.cost = 
            (metrics.inputTokens / 1000) * pricing.input +
            (metrics.outputTokens / 1000) * pricing.output
        } else {
          // Use average pricing if model unknown
          const avgPricing = { input: 0.002, output: 0.006 }
          metrics.cost = 
            (metrics.inputTokens / 1000) * avgPricing.input +
            (metrics.outputTokens / 1000) * avgPricing.output
        }
        
        return metrics
      }
    }
  }

  return null
}

interface TokenData {
  total: number
  input: number
  output: number
  model: string | null
  provider: string | null
  nodeType: string
}

/**
 * Extract token data from various AI provider response formats
 */
function extractTokenData(json: any): TokenData | null {
  // OpenAI format: response.usage
  if (json.usage) {
    const usage = json.usage
    return {
      total: usage.total_tokens || 0,
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
      model: normalizeModelName(json.model || null),
      provider: 'openai',
      nodeType: 'openai'
    }
  }

  // LangChain/AI Agent format: response.tokenUsage
  if (json.response?.tokenUsage) {
    const usage = json.response.tokenUsage
    return {
      total: usage.totalTokens || 0,
      input: usage.promptTokens || 0,
      output: usage.completionTokens || 0,
      model: normalizeModelName(json.model || json.response.model || null),
      provider: 'openai', // LangChain typically uses OpenAI
      nodeType: 'ai-agent'
    }
  }

  // Direct tokenUsage format (some n8n AI nodes)
  if (json.tokenUsage) {
    const usage = json.tokenUsage
    return {
      total: usage.totalTokens || 0,
      input: usage.promptTokens || 0,
      output: usage.completionTokens || 0,
      model: normalizeModelName(json.model || null),
      provider: 'openai',
      nodeType: 'openai'
    }
  }

  // Anthropic format: response.usage
  if (json.usage && json.usage.input_tokens !== undefined) {
    const usage = json.usage
    const inputTokens = usage.input_tokens || 0
    const outputTokens = usage.output_tokens || 0
    return {
      total: inputTokens + outputTokens,
      input: inputTokens,
      output: outputTokens,
      model: normalizeModelName(json.model || null),
      provider: 'anthropic',
      nodeType: 'anthropic'
    }
  }

  // Google AI format: response.usageMetadata
  if (json.usageMetadata) {
    const usage = json.usageMetadata
    const inputTokens = usage.promptTokenCount || 0
    const outputTokens = usage.candidatesTokenCount || 0
    return {
      total: usage.totalTokenCount || (inputTokens + outputTokens),
      input: inputTokens,
      output: outputTokens,
      model: normalizeModelName(json.model || null),
      provider: 'google',
      nodeType: 'google-ai'
    }
  }

  // Alternative paths for nested responses
  if (json.response) {
    return extractTokenData(json.response)
  }

  if (json.data) {
    return extractTokenData(json.data)
  }

  return null
}

/**
 * Normalize model names to match pricing table keys
 */
function normalizeModelName(model: string | null): string | null {
  if (!model) return null
  
  const normalized = model.toLowerCase().trim()
  
  // Map common variations to standard names
  const modelMappings: { [key: string]: string } = {
    'gpt-4-turbo-2024-04-09': 'gpt-4-turbo',
    'gpt-4-0125-preview': 'gpt-4-turbo-preview',
    'gpt-4-1106-preview': 'gpt-4-turbo-preview',
    'gpt-4o-2024-08-06': 'gpt-4o',
    'gpt-4o-mini-2024-07-18': 'gpt-4o-mini',
    'gpt-3.5-turbo-0125': 'gpt-3.5-turbo',
    'claude-3-opus-20240229': 'claude-3-opus',
    'claude-3-sonnet-20240229': 'claude-3-sonnet',
    'claude-3-haiku-20240307': 'claude-3-haiku',
    'gemini-1.5-pro-latest': 'gemini-1.5-pro',
    'gemini-1.5-flash-latest': 'gemini-1.5-flash'
  }
  
  return modelMappings[normalized] || normalized
}

/**
 * Calculate estimated cost for given tokens and model
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string | null
): number {
  if (!model || !AI_PRICING[model]) {
    // Use average pricing
    const avgPricing = { input: 0.002, output: 0.006 }
    return (inputTokens / 1000) * avgPricing.input + (outputTokens / 1000) * avgPricing.output
  }
  
  const pricing = AI_PRICING[model]
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output
}

/**
 * Get list of supported AI providers
 */
export function getSupportedProviders(): string[] {
  return ['openai', 'anthropic', 'google', 'azure-openai']
}

/**
 * Get pricing information for a specific model
 */
export function getModelPricing(model: string): PricingEntry | null {
  const normalized = normalizeModelName(model)
  return normalized ? (AI_PRICING[normalized] || null) : null
}
