import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'

export async function GET() {
  try {
    const configManager = getConfigManager()
    await configManager.initialize()

    // Get all admin-related configuration
    const adminData = {
      // Main completion flags
      initDone: await configManager.get('app.initDone'),
      setupCompleted: await configManager.get('app.setup_completed'),
      onboardingCompleted: await configManager.get('app.onboarding_completed'),
      
      // Admin account flags
      adminAccountCreated: await configManager.get('setup.admin_account_created'),
      
      // Actual admin user data
      adminEmail: await configManager.get('setup.admin_email'),
      adminName: await configManager.get('setup.admin_name'),
      adminPasswordHash: await configManager.get('setup.admin_password_hash'),
      adminUserId: await configManager.get('setup.admin_user_id'),
      
      // Timestamps
      setupCompletedAt: await configManager.get('setup.completed_at'),
      onboardingCompletedAt: await configManager.get('app.onboarding_completed_at'),
    }

    // Determine what's actually set up
    const analysis = {
      hasFlagsSet: Boolean(adminData.initDone === 'true' || adminData.setupCompleted === 'true'),
      hasAdminAccountFlag: adminData.adminAccountCreated === 'true',
      hasActualAdminData: Boolean(adminData.adminEmail && adminData.adminPasswordHash && adminData.adminUserId),
      shouldShowSetup: !Boolean(adminData.adminEmail && adminData.adminPasswordHash && adminData.adminUserId)
    }

    return NextResponse.json({
      adminData,
      analysis,
      message: analysis.hasActualAdminData 
        ? `Admin account exists: ${adminData.adminEmail}`
        : 'No admin account data found - setup required'
    })

  } catch (error) {
    console.error('Failed to check admin status:', error)
    return NextResponse.json(
      { error: 'Failed to check admin status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}