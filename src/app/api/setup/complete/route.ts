import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'
import { getProviderService } from '@/lib/services/provider-service'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminData, n8nConfig, configuration, emailConfig } = body

    const config = getConfigManager()
    console.log('Setup Complete API called with body:', JSON.stringify(body, null, 2))


    // Create admin account
    if (adminData) {
      await config.upsert('setup.admin_account_created', 'true', 'boolean', 'setup', 'Admin account created flag')
      await config.upsert('setup.admin_email', adminData.email || '', 'string', 'setup', 'Admin email address')
      await config.upsert('setup.admin_name', adminData.name || 'Admin', 'string', 'setup', 'Admin name')

      // Store admin password securely (hashed)
      if (adminData.password) {
        // For simplicity, we'll store a simple hash. In production, use proper password hashing
        const passwordHash = crypto.createHash('sha256').update(adminData.password).digest('hex')
        await config.upsert('setup.admin_password_hash', passwordHash, 'encrypted', 'auth', 'Admin password hash', true)
        await config.upsert('setup.admin_user_id', 'admin-001', 'string', 'auth', 'Admin user ID')
      }
    }





    // Configure n8n integration
    if (n8nConfig) {
      await config.upsert('integrations.n8n.url', n8nConfig.url || '', 'string', 'integration', 'n8n instance URL')
      await config.upsert('integrations.n8n.api_key', n8nConfig.apiKey || '', 'encrypted', 'integration', 'n8n API key', true)

      // Create provider entry for the new multi-provider system
      try {
        const providerService = getProviderService()
        // Use the same admin ID as stored in config
        const userId = 'admin-001'

        await providerService.createProvider(userId, {
          name: 'Primary n8n',
          baseUrl: n8nConfig.url,
          apiKey: n8nConfig.apiKey,
          metadata: {
            createdVia: 'setup-wizard'
          }
        })
        console.log('Created default provider from setup wizard')
      } catch (error) {
        console.error('Failed to create default provider:', error)
        // Don't fail setup if provider creation fails, but log it
      }
    }

    // Set configuration values
    if (configuration) {
      await config.upsert('features.sync_interval_minutes', configuration.syncInterval || '15', 'number', 'features', 'Data sync interval')
      await config.upsert('features.analytics_enabled', configuration.analyticsEnabled ? 'true' : 'false', 'boolean', 'features', 'Enable analytics')
    }

    // Set email configuration (placeholder for future functionality)
    if (emailConfig) {
      await config.upsert('notifications.email.enabled', emailConfig.enabled ? 'true' : 'false', 'boolean', 'notifications', 'Email notifications enabled')
      await config.upsert('notifications.email.smtp_host', emailConfig.smtpHost || '', 'string', 'notifications', 'SMTP host')
      await config.upsert('notifications.email.smtp_port', emailConfig.smtpPort || '587', 'number', 'notifications', 'SMTP port')
      await config.upsert('notifications.email.smtp_user', emailConfig.smtpUser || '', 'string', 'notifications', 'SMTP username')
      await config.upsert('notifications.email.smtp_password', emailConfig.smtpPassword || '', 'encrypted', 'notifications', 'SMTP password', true)
    }

    // Set default configuration values
    await config.upsert('app.timezone', 'UTC', 'string', 'system', 'Application timezone')
    await config.upsert('app.demoMode', 'false', 'boolean', 'system', 'Demo mode flag')

    // Mark setup as complete by setting the initDone flag
    await config.upsert('app.initDone', 'true', 'boolean', 'system', 'Initialization complete flag')
    await config.upsert('setup.completed_at', new Date().toISOString(), 'string', 'setup', 'Setup completion timestamp')

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
