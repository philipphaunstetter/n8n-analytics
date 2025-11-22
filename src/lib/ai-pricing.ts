/**
 * AI Pricing Configuration
 * Centralized source of truth for AI model pricing
 */

export interface PricingEntry {
    input: number  // Cost per 1K input tokens
    output: number // Cost per 1K output tokens
}

export interface PricingTable {
    [model: string]: PricingEntry
}

// Pricing as of January 2025 (USD per 1K tokens)
// Using OpenAI Standard tier pricing
export const AI_PRICING: PricingTable = {
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
 * Normalize model names to match pricing table keys
 */
export function normalizeModelName(model: string | null): string | null {
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
    const normalizedModel = normalizeModelName(model)

    if (!normalizedModel || !AI_PRICING[normalizedModel]) {
        // Use average pricing
        const avgPricing = { input: 0.002, output: 0.006 }
        return (inputTokens / 1000) * avgPricing.input + (outputTokens / 1000) * avgPricing.output
    }

    const pricing = AI_PRICING[normalizedModel]
    return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output
}

/**
 * Get pricing information for a specific model
 */
export function getModelPricing(model: string): PricingEntry | null {
    const normalized = normalizeModelName(model)
    return normalized ? (AI_PRICING[normalized] || null) : null
}
