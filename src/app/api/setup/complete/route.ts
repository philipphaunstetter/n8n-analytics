import { NextRequest, NextResponse } from 'next/server'
import { setupChecker, markSetupComplete } from '@/lib/setup/setup-checker'
import { configProvider } from '@/lib/config/config-provider'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminData, skipIntegrations } = body

    // Validate that all required steps are completed
    const status = await setupChecker.checkSetupStatus()
    
    if (!status.completedSteps.database) {
      return NextResponse.json(
        { error: 'Database setup not completed' },
        { status: 400 }
      )
    }

    // Create admin account (in a real app, this would create a user in the database)
    if (adminData) {
      await configProvider.set(
        'setup.admin_account_created',
        true,
        'Admin account created during setup'
      )
      
      await configProvider.set(
        'setup.admin_email',
        adminData.email,
        'Admin email from setup'
      )
      
      await configProvider.set(
        'setup.admin_name',
        adminData.name || 'Admin',
        'Admin name from setup'
      )
    }

    // Mark integrations as skipped if requested
    if (skipIntegrations) {
      await configProvider.set(
        'setup.integrations_skipped',
        true,
        'User chose to skip integrations during setup'
      )
    }

    // Mark setup as complete
    await markSetupComplete()

    return NextResponse.json({
      message: 'Setup completed successfully',
      redirectTo: '/dashboard'
    })
  } catch (error) {
    console.error('Failed to complete setup:', error)
    return NextResponse.json(
      { error: 'Failed to complete setup' },
      { status: 500 }
    )
  }
}