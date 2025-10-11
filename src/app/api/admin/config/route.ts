import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'
import { headers } from 'next/headers'

export async function GET() {
  try {
    const configManager = getConfigManager()
    await configManager.initialize()
    
    const config = await configManager.getAllConfig()
    
    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to fetch configuration:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { changes, changeReason } = body
    
    if (!changes || typeof changes !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const configManager = getConfigManager()
    await configManager.initialize()
    
    // Get client info for audit
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || undefined
    const forwarded = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip')
    const ipAddress = forwarded?.split(',')[0] || realIp || undefined
    
    const updateOptions = {
      changedBy: 'admin-ui', // In a real app, this would be the authenticated user
      changeReason,
      ipAddress,
      userAgent
    }

    // Apply all changes
    const results = []
    for (const [key, value] of Object.entries(changes)) {
      try {
        await configManager.set(key, value, updateOptions)
        results.push({ key, status: 'success' })
      } catch (error) {
        console.error(`Failed to update config key ${key}:`, error)
        results.push({ 
          key, 
          status: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      message: 'Configuration update completed',
      results
    })
  } catch (error) {
    console.error('Failed to update configuration:', error)
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    )
  }
}