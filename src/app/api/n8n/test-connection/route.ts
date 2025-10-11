import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'

export async function POST() {
  try {
    const configManager = getConfigManager()
    await configManager.initialize()

    // Get current n8n configuration
    const n8nUrl = await configManager.get('integrations.n8n.url')
    const n8nApiKey = await configManager.get('integrations.n8n.api_key')

    if (!n8nUrl || !n8nApiKey) {
      return NextResponse.json(
        { error: 'n8n URL or API key not configured' },
        { status: 400 }
      )
    }

    // Test the connection
    const cleanUrl = n8nUrl.replace(/\/$/, '')
    const testResponse = await fetch(`${cleanUrl}/api/v1/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': n8nApiKey,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(15000) // 15 second timeout for manual tests
    })

    if (!testResponse.ok) {
      let errorMessage = 'Connection failed'
      
      switch (testResponse.status) {
        case 401:
          errorMessage = 'Invalid API key - please check your n8n API key'
          break
        case 404:
          errorMessage = 'n8n API endpoint not found - please check your URL'
          break
        case 403:
          errorMessage = 'API access forbidden - check API key permissions'
          break
        case 500:
          errorMessage = 'n8n server error - please check your n8n instance'
          break
        default:
          errorMessage = `Connection failed with HTTP ${testResponse.status}`
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    const workflows = await testResponse.json()
    
    // Get additional instance info
    let instanceInfo = {
      version: 'Unknown',
      instanceId: 'Unknown'
    }
    
    try {
      const infoResponse = await fetch(`${cleanUrl}/api/v1/owner`, {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': n8nApiKey,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      })
      
      if (infoResponse.ok) {
        const info = await infoResponse.json()
        instanceInfo.version = info.version || 'Unknown'
        instanceInfo.instanceId = info.id || 'Unknown'
      }
    } catch (error) {
      // Info endpoint might not be available, that's okay
      console.warn('Could not fetch n8n instance info:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully connected to n8n instance',
      workflowCount: workflows.data?.length || workflows.length || 0,
      version: instanceInfo.version,
      instanceId: instanceInfo.instanceId,
      url: cleanUrl,
      testedAt: new Date().toISOString()
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