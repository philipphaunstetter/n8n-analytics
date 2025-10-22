import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getProviderService } from '@/lib/services/provider-service'

// GET /api/providers/[id] - Get a specific provider
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const providerService = getProviderService()
    const provider = await providerService.getProvider(params.id, user.id)

    if (!provider) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Provider not found' 
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: provider
    })
  } catch (error) {
    console.error('Failed to get provider:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get provider' 
      },
      { status: 500 }
    )
  }
}

// PUT /api/providers/[id] - Update a provider
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, baseUrl, apiKey, metadata } = body

    const updateData: any = {}
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Provider name cannot be empty' 
          },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }

    if (baseUrl !== undefined) {
      if (typeof baseUrl !== 'string' || !baseUrl.startsWith('http')) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Valid base URL is required (must start with http:// or https://)' 
          },
          { status: 400 }
        )
      }
      updateData.baseUrl = baseUrl.trim()
    }

    if (apiKey !== undefined) {
      if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return NextResponse.json(
          { 
            success: false,
            error: 'API key cannot be empty' 
          },
          { status: 400 }
        )
      }
      updateData.apiKey = apiKey.trim()
    }

    if (metadata !== undefined) {
      updateData.metadata = metadata
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No fields to update' 
        },
        { status: 400 }
      )
    }

    const providerService = getProviderService()
    
    // If credentials changed, test connection
    if (updateData.baseUrl || updateData.apiKey) {
      const provider = await providerService.getProviderWithApiKey(params.id, user.id)
      if (!provider) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Provider not found' 
          },
          { status: 404 }
        )
      }

      const testBaseUrl = updateData.baseUrl || provider.baseUrl
      const testApiKey = updateData.apiKey || provider.apiKey

      const connectionTest = await providerService.testConnection(testBaseUrl, testApiKey)
      if (!connectionTest.success) {
        return NextResponse.json(
          { 
            success: false,
            error: `Connection test failed: ${connectionTest.error}` 
          },
          { status: 400 }
        )
      }

      // Update connection status
      await providerService.updateConnectionStatus(
        params.id,
        user.id,
        true,
        'healthy',
        connectionTest.version
      )
    }

    const updatedProvider = await providerService.updateProvider(
      params.id,
      user.id,
      updateData
    )

    return NextResponse.json({
      success: true,
      data: updatedProvider,
      message: 'Provider updated successfully'
    })
  } catch (error) {
    console.error('Failed to update provider:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update provider' 
      },
      { status: 500 }
    )
  }
}

// DELETE /api/providers/[id] - Delete a provider
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const providerService = getProviderService()
    
    // Check if provider exists
    const provider = await providerService.getProvider(params.id, user.id)
    if (!provider) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Provider not found' 
        },
        { status: 404 }
      )
    }

    await providerService.deleteProvider(params.id, user.id)

    return NextResponse.json({
      success: true,
      message: 'Provider deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete provider:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete provider' 
      },
      { status: 500 }
    )
  }
}
