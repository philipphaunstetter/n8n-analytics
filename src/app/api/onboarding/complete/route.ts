import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'

export async function POST() {
  try {
    const configManager = getConfigManager()
    await configManager.initialize()

    // Mark onboarding as complete
    await configManager.set('app.onboarding_completed', 'true', {
      changedBy: 'onboarding-wizard',
      changeReason: 'Onboarding completed successfully'
    })

    // Set the completion timestamp
    await configManager.set('app.onboarding_completed_at', new Date().toISOString(), {
      changedBy: 'onboarding-wizard',
      changeReason: 'Onboarding completion timestamp'
    })

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      redirectTo: '/dashboard'
    })

  } catch (error) {
    console.error('Failed to complete onboarding:', error)
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }
}