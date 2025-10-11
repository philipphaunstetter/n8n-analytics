import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config-manager'

export async function GET() {
  try {
    const config = getConfigManager()
    
    // Check the simple initDone flag
    const initDone = await config.get('app.initDone')
    const setupCompleted = initDone === 'true'
    
    if (setupCompleted) {
      // Setup is complete - redirect to sign in
      return NextResponse.json({
        initDone: true,
        requiresSetup: false,
        nextStep: 'signin',
        message: 'Setup completed - ready for sign in'
      })
    } else {
      // Setup is required - redirect to setup wizard
      return NextResponse.json({
        initDone: false,
        requiresSetup: true,
        nextStep: 'setup',
        message: 'Initial setup required'
      })
    }
  } catch (error) {
    console.error('Failed to check setup status:', error)
    
    // On error, assume setup is required
    return NextResponse.json({
      initDone: false,
      requiresSetup: true,
      nextStep: 'setup',
      error: 'Failed to check setup status - assuming setup required'
    })
  }
}
