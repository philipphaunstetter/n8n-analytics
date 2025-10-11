import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'

export async function GET() {
  try {
    const configManager = getConfigManager()
    await configManager.initialize()

    // Check if essential onboarding steps are complete
    const n8nUrl = await configManager.get('integrations.n8n.url')
    const n8nApiKey = await configManager.get('integrations.n8n.api_key')
    const timezone = await configManager.get('app.timezone')
    const emailEnabled = await configManager.get('notifications.email.enabled')
    
    // Determine onboarding completion status
    const isN8NConfigured = !!(n8nUrl && n8nApiKey)
    const isTimezoneConfigured = !!timezone
    
    const isOnboardingComplete = isN8NConfigured && isTimezoneConfigured

    // Load existing configuration if any
    let existingConfig = null
    if (isN8NConfigured || isTimezoneConfigured || emailEnabled === 'true') {
      existingConfig = {
        n8nIntegration: isN8NConfigured ? {
          url: n8nUrl,
          apiKey: n8nApiKey
        } : undefined,
        regionalSettings: isTimezoneConfigured ? {
          timezone: timezone
        } : undefined,
        emailNotifications: emailEnabled === 'true' ? {
          enabled: true,
          resendApiKey: await configManager.get('notifications.email.resend_api_key'),
          fromEmail: await configManager.get('notifications.email.from_address'),
          fromName: await configManager.get('notifications.email.from_name')
        } : { enabled: false }
      }
    }

    return NextResponse.json({
      isOnboardingComplete,
      requiredSteps: {
        n8nIntegration: isN8NConfigured,
        regionalSettings: isTimezoneConfigured
      },
      existingConfig
    })

  } catch (error) {
    console.error('Failed to check onboarding status:', error)
    return NextResponse.json(
      { error: 'Failed to check onboarding status' },
      { status: 500 }
    )
  }
}