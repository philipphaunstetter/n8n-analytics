import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'

export async function GET() {
  try {
    const configManager = getConfigManager()
    await configManager.initialize()

    // Check if n8n is configured
    const n8nUrl = await configManager.get('integrations.n8n.url')
    const n8nApiKey = await configManager.get('integrations.n8n.api_key')

    if (!n8nUrl || !n8nApiKey) {
      return NextResponse.json({
        isConfigured: false,
        isConnected: false,
        error: 'n8n URL or API key not configured'
      })
    }

    // Test the connection
    try {
      const cleanUrl = n8nUrl.replace(/\/$/, '')
      const testResponse = await fetch(`${cleanUrl}/api/v1/workflows`, {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': n8nApiKey,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (!testResponse.ok) {
        let errorMessage = 'Connection failed'
        
        switch (testResponse.status) {
          case 401:
            errorMessage = 'Invalid API key'
            break
          case 404:
            errorMessage = 'n8n API endpoint not found - check URL'
            break
          case 403:
            errorMessage = 'API access forbidden'
            break
          case 500:
            errorMessage = 'n8n server error'
            break
          default:
            errorMessage = `HTTP ${testResponse.status} error`
        }

        return NextResponse.json({
          isConfigured: true,
          isConnected: false,
          error: errorMessage,
          lastChecked: new Date().toISOString()
        })
      }

      const workflows = await testResponse.json()
      
      // Try to get additional info
      let n8nVersion = 'Unknown'
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
          n8nVersion = info.version || 'Unknown'
        }
      } catch (error) {
        // Info endpoint might not be available, that's okay
      }

      return NextResponse.json({
        isConfigured: true,
        isConnected: true,
        workflowCount: workflows.data?.length || workflows.length || 0,
        n8nVersion,
        lastChecked: new Date().toISOString()
      })

    } catch (error) {
      let errorMessage = 'Network error'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Connection timeout'
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Cannot reach n8n instance'
        } else {
          errorMessage = error.message
        }
      }

      return NextResponse.json({
        isConfigured: true,
        isConnected: false,
        error: errorMessage,
        lastChecked: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('Connection status check failed:', error)
    return NextResponse.json(
      { 
        isConfigured: false,
        isConnected: false,
        error: 'Failed to check connection status' 
      },
      { status: 500 }
    )
  }
}