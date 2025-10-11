import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config-manager'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminData } = body
    
    const config = getConfigManager()

    // Create admin account
    if (adminData) {
      await config.set('setup.admin_account_created', 'true')
      await config.set('setup.admin_email', adminData.email || '')
      await config.set('setup.admin_name', adminData.name || 'Admin')
      
      // Store admin password securely (hashed)
      if (adminData.password) {
        // For simplicity, we'll store a simple hash. In production, use proper password hashing
        const passwordHash = crypto.createHash('sha256').update(adminData.password).digest('hex')
        await config.set('setup.admin_password_hash', passwordHash, 'auth', 'Admin password hash')
        await config.set('setup.admin_user_id', 'admin-001', 'auth', 'Admin user ID')
      }
    }

    // Set default configuration values
    await config.set('app.timezone', 'UTC')
    await config.set('app.demoMode', 'false')

    // Mark setup as complete by setting the initDone flag
    await config.set('app.initDone', 'true')
    await config.set('setup.completed_at', new Date().toISOString())

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
