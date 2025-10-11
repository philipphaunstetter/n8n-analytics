import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, apiKey } = body

    if (!url || !apiKey) {
      return NextResponse.json(
        { error: 'URL and API key are required' },
        { status: 400 }
      )
    }

    // Clean up URL (remove trailing slash)
    const cleanUrl = url.replace(/\/$/, '')

    // Test connection to n8n instance
    const testResponse = await fetch(`${cleanUrl}/api/v1/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      // Add timeout
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!testResponse.ok) {
      let errorMessage = 'Failed to connect to n8n instance'
      
      switch (testResponse.status) {
        case 401:
          errorMessage = 'Invalid API key - please check your n8n API key'
          break
        case 404:
          errorMessage = 'n8n API endpoint not found - please check your URL'
          break
        case 403:
          errorMessage = 'API access forbidden - please check your API key permissions'
          break
        case 500:
          errorMessage = 'n8n server error - please check your n8n instance'
          break
        default:
          errorMessage = `Connection failed with status ${testResponse.status}`
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    const workflows = await testResponse.json()
    
    // Also try to get instance info
    let instanceInfo = {}
    try {
      const infoResponse = await fetch(`${cleanUrl}/api/v1/owner`, {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': apiKey,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      })
      
      if (infoResponse.ok) {
        instanceInfo = await infoResponse.json()
      }
    } catch (error) {
      // Info endpoint might not be available, that's okay
      console.warn('Could not fetch n8n instance info:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to n8n instance',
      workflowCount: workflows.data?.length || workflows.length || 0,
      version: instanceInfo.version || 'Unknown',
      instanceId: instanceInfo.id || 'Unknown',
      url: cleanUrl
    })

  } catch (error) {
    console.error('n8n connection test failed:', error)
    
    let errorMessage = 'Network error: Unable to connect to n8n instance'
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Connection timeout - please check your n8n URL and network'
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Cannot reach n8n instance - please check your URL'
      } else {
        errorMessage = `Connection error: ${error.message}`
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}