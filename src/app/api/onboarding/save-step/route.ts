import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'
import { getProviderService } from '@/lib/services/provider-service'
import { authenticateRequest } from '@/lib/api-auth'
import { headers } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    console.log('[onboarding/save-step] request received')
    const body = await request.json()
    const { step, data } = body
    console.log('[onboarding/save-step] parsed body:', { step, hasData: !!data })

    if (!step || !data) {
      return NextResponse.json(
        { error: 'Step and data are required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const { user } = await authenticateRequest(request)
    const actualUser = user || { id: 'admin-001', email: 'admin@test.com' } // Fallback for testing

    const configManager = getConfigManager()
    console.log('[onboarding/save-step] initializing config manager...')
    await configManager.initialize()
    console.log('[onboarding/save-step] config manager initialized')

    // Get client info for audit
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || undefined
    const forwarded = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip')
    const ipAddress = forwarded?.split(',')[0] || realIp || undefined

    const updateOptions = {
      changedBy: 'onboarding-wizard',
      changeReason: `Onboarding step: ${step}`,
      ipAddress,
      userAgent
    }

    // Save configuration based on step
    switch (step) {
      case 'n8n-integration':
        console.log('[onboarding/save-step] saving n8n integration config...')

        // Save to config system (for backward compatibility)
        await configManager.set('integrations.n8n.url', data.url, updateOptions)
        await configManager.set('integrations.n8n.api_key', data.apiKey, updateOptions)
        console.log('[onboarding/save-step] n8n integration config saved')

        // Create provider record in database
        console.log('[onboarding/save-step] creating provider record...')
        const providerService = getProviderService()

        // Check if a provider already exists for this user
        const existingProviders = await providerService.listProviders(actualUser.id)

        if (existingProviders.length === 0) {
          // Create new provider
          const provider = await providerService.createProvider(actualUser.id, {
            name: 'My n8n Instance',
            baseUrl: data.url,
            apiKey: data.apiKey,
            metadata: { createdVia: 'onboarding' }
          })
          console.log('[onboarding/save-step] provider created:', provider.id)

          // Test and update connection status
          const connectionTest = await providerService.testConnection(data.url, data.apiKey)
          if (connectionTest.success) {
            await providerService.updateConnectionStatus(
              provider.id,
              actualUser.id,
              true,
              'healthy',
              connectionTest.version
            )
            console.log('[onboarding/save-step] provider connection status updated')
          }
        } else {
          console.log('[onboarding/save-step] provider already exists, skipping creation')
        }

        break

      case 'regional-settings':
        await configManager.set('app.timezone', data.timezone, updateOptions)
        break

      case 'email-notifications':
        await configManager.set('notifications.email.enabled', data.enabled.toString(), updateOptions)
        if (data.enabled && data.resendApiKey) {
          await configManager.set('notifications.email.provider', 'resend', updateOptions)
          await configManager.set('notifications.email.resend_api_key', data.resendApiKey, updateOptions)
        }
        if (data.enabled && data.fromEmail) {
          await configManager.set('notifications.email.from_address', data.fromEmail, updateOptions)
        }
        if (data.enabled && data.fromName) {
          await configManager.set('notifications.email.from_name', data.fromName, updateOptions)
        }
        break

      default:
        return NextResponse.json(
          { error: `Unknown onboarding step: ${step}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${step} configuration`
    })

  } catch (error) {
    console.error('Failed to save onboarding step:', error)
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}
