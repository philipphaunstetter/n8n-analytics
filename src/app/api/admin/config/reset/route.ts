import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'

export async function POST() {
  try {
    const configManager = getConfigManager()
    await configManager.initialize()
    
    await configManager.resetToDefaults()
    
    return NextResponse.json({
      message: 'Configuration reset to defaults successfully'
    })
  } catch (error) {
    console.error('Failed to reset configuration:', error)
    return NextResponse.json(
      { error: 'Failed to reset configuration to defaults' },
      { status: 500 }
    )
  }
}