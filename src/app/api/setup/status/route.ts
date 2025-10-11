import { NextResponse } from 'next/server'
import { setupChecker } from '@/lib/setup/setup-checker'

export async function GET() {
  try {
    const status = await setupChecker.checkSetupStatus()
    
    return NextResponse.json(status)
  } catch (error) {
    console.error('Failed to check setup status:', error)
    
    // On error, assume setup is required
    return NextResponse.json({
      isComplete: false,
      completedSteps: {
        database: false,
        adminAccount: false,
        basicConfiguration: false,
        integrations: false
      },
      nextStep: 'welcome',
      requiresSetup: true
    })
  }
}