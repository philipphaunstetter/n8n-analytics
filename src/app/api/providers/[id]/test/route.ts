import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getProviderService } from '@/lib/services/provider-service'

// POST /api/providers/[id]/test - Test connection to a provider
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const providerService = getProviderService()
    
    // Get provider with API key
    const provider = await providerService.getProviderWithApiKey(id, user.id)
    
    if (!provider) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Provider not found' 
        },
        { status: 404 }
      )
    }

    // Test connection
    const result = await providerService.testConnection(provider.baseUrl, provider.apiKey)

    // Update provider status
    await providerService.updateConnectionStatus(
      id,
      user.id,
      result.success,
      result.success ? 'healthy' : 'error',
      result.version
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        data: {
          version: result.version,
          status: 'healthy'
        }
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Connection test failed'
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Failed to test provider connection:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to test connection' 
      },
      { status: 500 }
    )
  }
}
