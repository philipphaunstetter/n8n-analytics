import { NextRequest, NextResponse } from 'next/server'
import { ProviderRegistry } from '@/lib/providers'
import { Provider } from '@/types'
import { authenticateRequest } from '@/lib/api-auth'

// GET /api/providers - List user's providers
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Fetch user's providers from database
    // For now, return empty array since we don't have database setup yet
    const providers: Provider[] = []

    return NextResponse.json({
      success: true,
      data: providers
    })
  } catch (error) {
    console.error('Failed to fetch providers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/providers - Create new provider connection
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, baseUrl, apiKey } = body

    // Validate input
    if (!name || !type || !baseUrl || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, baseUrl, apiKey' },
        { status: 400 }
      )
    }

    // Check if provider type is supported
    const supportedTypes = ProviderRegistry.getSupportedTypes()
    if (!supportedTypes.includes(type)) {
      return NextResponse.json(
        { error: `Unsupported provider type: ${type}. Supported types: ${supportedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Create provider object for testing
    const provider: Provider = {
      id: `temp_${Date.now()}`, // Temporary ID for testing
      name,
      type,
      baseUrl,
      apiKey,
      isConnected: false,
      lastChecked: new Date(),
      status: 'unknown',
      userId: user.id
    }

    // Test connection
    try {
      const adapter = ProviderRegistry.create(provider)
      const connectionTest = await adapter.testConnection()

      if (connectionTest.success) {
        provider.isConnected = true
        provider.status = connectionTest.data?.status || 'healthy'
        provider.version = connectionTest.data?.version
        provider.metadata = connectionTest.data?.metadata
      } else {
        provider.status = 'error'
        provider.metadata = { error: connectionTest.error }
      }
    } catch (error) {
      provider.status = 'error'
      provider.metadata = { error: String(error) }
    }

    // TODO: Save provider to database
    // For now, just return the provider with test results
    
    // Remove API key from response for security
    const responseProvider = { ...provider }
    delete responseProvider.apiKey

    return NextResponse.json({
      success: true,
      data: responseProvider
    })
  } catch (error) {
    console.error('Failed to create provider:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}