import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config-manager'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminData, n8nConfig, configuration, emailConfig } = body

    const config = getConfigManager()
    console.log('Setup Complete API called with body:', JSON.stringify(body, null, 2))


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

    // Configure n8n integration
    if (n8nConfig) {
      await config.set('integrations.n8n.url', n8nConfig.url || '', 'integration', 'n8n instance URL')
      await config.set('integrations.n8n.api_key', n8nConfig.apiKey || '', 'integration', 'n8n API key')
    }

    // Set configuration values
    if (configuration) {
      await config.set('features.sync_interval_minutes', configuration.syncInterval || '15', 'features', 'Data sync interval')
      await config.set('features.analytics_enabled', configuration.analyticsEnabled ? 'true' : 'false', 'features', 'Enable analytics')
    }

    // Set email configuration (placeholder for future functionality)
    if (emailConfig) {
      await config.set('notifications.email.enabled', emailConfig.enabled ? 'true' : 'false', 'notifications', 'Email notifications enabled')
      await config.set('notifications.email.smtp_host', emailConfig.smtpHost || '', 'notifications', 'SMTP host')
      await config.set('notifications.email.smtp_port', emailConfig.smtpPort || '587', 'notifications', 'SMTP port')
      await config.set('notifications.email.smtp_user', emailConfig.smtpUser || '', 'notifications', 'SMTP username')
      await config.set('notifications.email.smtp_password', emailConfig.smtpPassword || '', 'notifications', 'SMTP password')
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
