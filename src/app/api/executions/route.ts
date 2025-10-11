import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ProviderRegistry } from '@/lib/providers'
import { Provider, ExecutionFilters } from '@/types'

// GET /api/executions - List executions across all providers
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const filters: ExecutionFilters = {
      providerId: searchParams.get('providerId') || undefined,
      workflowId: searchParams.get('workflowId') || undefined,
      status: searchParams.get('status')?.split(',') as any || undefined,
      timeRange: searchParams.get('timeRange') as any || '24h',
      search: searchParams.get('search') || undefined
    }

    // Parse custom time range if provided
    const customStart = searchParams.get('customStart')
    const customEnd = searchParams.get('customEnd')
    if (customStart && customEnd) {
      filters.customTimeRange = {
        start: new Date(customStart),
        end: new Date(customEnd)
      }
      filters.timeRange = 'custom'
    }

    // TODO: Fetch user's providers from database
    // For now, return empty results since we don't have providers set up yet
    const providers: Provider[] = []

    const allExecutions = []
    let totalCount = 0

    // Fetch executions from each provider
    for (const provider of providers) {
      if (filters.providerId && provider.id !== filters.providerId) {
        continue // Skip this provider if filtering by specific provider
      }

      if (!provider.isConnected) {
        continue // Skip disconnected providers
      }

      try {
        const adapter = ProviderRegistry.create(provider)
        const result = await adapter.getExecutions(filters)

        if (result.success && result.data) {
          allExecutions.push(...result.data.items)
          totalCount += result.data.total
        }
      } catch (error) {
        console.error(`Failed to fetch executions from provider ${provider.name}:`, error)
        // Continue with other providers
      }
    }

    // Sort executions by startedAt (most recent first)
    allExecutions.sort((a, b) => {
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    })

    return NextResponse.json({
      success: true,
      data: {
        items: allExecutions,
        total: totalCount,
        page: 1,
        limit: allExecutions.length,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })
  } catch (error) {
    console.error('Failed to fetch executions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}