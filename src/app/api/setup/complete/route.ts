import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config-manager'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminData, config: configData, skipIntegrations } = body
    
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

    // Save configuration data
    if (configData) {
      if (configData.timezone) {
        await config.set('app.timezone', configData.timezone)
      }
      if (typeof configData.demoMode === 'boolean') {
        await config.set('app.demoMode', configData.demoMode ? 'true' : 'false')
      }
      if (configData.n8nUrl) {
        await config.set('n8n.url', configData.n8nUrl)
      }
      if (configData.n8nApiKey) {
        await config.set('n8n.apiKey', configData.n8nApiKey)
      }
    }

    // Mark integrations as skipped if requested
    if (skipIntegrations) {
      await config.set('setup.integrations_skipped', 'true')
    }

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
