import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config-manager'

export async function GET() {
  try {
    const config = getConfigManager()
    await config.initialize()
    
    // Check if admin account actually exists (not just flags)
    const adminEmail = await config.get('setup.admin_email')
    const adminPasswordHash = await config.get('setup.admin_password_hash')
    const adminUserId = await config.get('setup.admin_user_id')
    
    const hasAdminData = Boolean(adminEmail && adminPasswordHash && adminUserId)
    
    if (hasAdminData) {
      console.log(`Setup status: Admin account found (${adminEmail})`)
      // Setup is complete - redirect to sign in
      return NextResponse.json({
        initDone: true,
        requiresSetup: false,
        nextStep: 'signin',
        message: `Setup completed - admin account: ${adminEmail}`
      })
    } else {
      console.log('Setup status: No admin account found - setup required')
      // Setup is required - redirect to setup wizard
      return NextResponse.json({
        initDone: false,
        requiresSetup: true,
        nextStep: 'setup',
        message: 'Initial setup required - no admin account found'
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
