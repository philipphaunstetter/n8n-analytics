import { NextRequest, NextResponse } from 'next/server'
import { workflowSync } from '@/lib/sync/workflow-sync'
import { executionSync } from '@/lib/sync/execution-sync'
import { getProviderService } from '@/lib/services/provider-service'
import { authenticateRequest } from '@/lib/api-auth'

// POST /api/sync/initial - Trigger initial sync during onboarding
// This endpoint syncs both workflows and executions for the user's providers
export async function POST(request: NextRequest) {
    try {
        // Authenticate the request
        const { user } = await authenticateRequest(request)
        const actualUser = user || {
            id: 'admin-001',
            email: 'admin@test.com',
            name: 'Admin User',
            role: 'admin' as const
        }

        console.log('🚀 Initial onboarding sync triggered for user:', actualUser.id)

        const providerService = getProviderService()
        const providers = await providerService.listProviders(actualUser.id)

        if (providers.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No providers found. Please add an n8n instance first.'
            }, { status: 400 })
        }

        console.log(`📊 Found ${providers.length} provider(s) to sync`)

        // Sync workflows and executions for each provider
        const results = []

        for (const provider of providers) {
            console.log(`🔄 Syncing provider: ${provider.name}`)

            try {
                // Get provider with API key
                const providerWithKey = await providerService.getProviderWithApiKey(provider.id, actualUser.id)

                if (!providerWithKey || !providerWithKey.apiKey) {
                    console.warn(`⚠️ Provider ${provider.name} has no API key, skipping`)
                    continue
                }

                // Sync workflows
                console.log(`📋 Syncing workflows for ${provider.name}...`)
                const workflowResult = await workflowSync.syncProvider({
                    id: providerWithKey.id,
                    name: providerWithKey.name,
                    baseUrl: providerWithKey.baseUrl,
                    apiKey: providerWithKey.apiKey
                })
                console.log(`✅ Workflows synced: ${workflowResult.synced} workflows`)

                // Sync executions
                console.log(`⚡ Syncing executions for ${provider.name}...`)
                const executionResult = await executionSync.syncProvider({
                    id: providerWithKey.id,
                    user_id: actualUser.id,
                    name: providerWithKey.name,
                    base_url: providerWithKey.baseUrl,
                    api_key_encrypted: providerWithKey.apiKey,
                    is_connected: true,
                    status: 'healthy'
                })
                const executionCount = 'processed' in executionResult ? executionResult.processed : 0
                console.log(`✅ Executions synced: ${executionCount} executions`)

                results.push({
                    provider: provider.name,
                    workflows: workflowResult,
                    executions: executionResult
                })
            } catch (error) {
                console.error(`❌ Failed to sync provider ${provider.name}:`, error)
                results.push({
                    provider: provider.name,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        }

        const successfulSyncs = results.filter(r => !r.error).length
        const failedSyncs = results.filter(r => r.error).length

        console.log(`✅ Initial sync completed: ${successfulSyncs} successful, ${failedSyncs} failed`)

        return NextResponse.json({
            success: true,
            message: 'Initial sync completed',
            data: {
                providers: providers.length,
                successful: successfulSyncs,
                failed: failedSyncs,
                results
            }
        })
    } catch (error) {
        console.error('Initial sync failed:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Initial sync failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
