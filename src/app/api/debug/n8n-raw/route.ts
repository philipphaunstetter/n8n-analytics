import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'

export async function GET() {
  try {
    const configManager = getConfigManager()
    await configManager.initialize()

    const host = await configManager.get('integrations.n8n.url') || 'http://localhost:5678'
    const apiKey = await configManager.get('integrations.n8n.api_key') || ''

    if (!host || !apiKey) {
      return NextResponse.json({ error: 'n8n not configured' }, { status: 400 })
    }

    // Test different n8n API endpoints to understand the response format
    const endpoints = ['/workflows', '/executions?limit=1']
    const results: any = {}

    for (const endpoint of endpoints) {
      try {
        const url = `${host}/api/v1${endpoint}`
        console.log(`Testing n8n API: ${url}`)
        
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': apiKey,
          },
        })

        console.log(`Response status: ${response.status} ${response.statusText}`)
        
        if (response.ok) {
          const data = await response.json()
          results[endpoint] = {
            status: response.status,
            success: true,
            data: data,
            dataType: Array.isArray(data) ? 'array' : typeof data,
            length: Array.isArray(data) ? data.length : (data?.data?.length || 'unknown')
          }
        } else {
          const errorText = await response.text()
          results[endpoint] = {
            status: response.status,
            success: false,
            error: `${response.status} ${response.statusText}`,
            body: errorText
          }
        }
      } catch (error) {
        results[endpoint] = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }

    return NextResponse.json({
      n8nConfig: {
        host,
        hasApiKey: !!apiKey
      },
      endpointTests: results
    })

  } catch (error) {
    console.error('Failed to test n8n API:', error)
    return NextResponse.json(
      { error: 'Failed to test n8n API', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}