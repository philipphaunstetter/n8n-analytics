import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ProviderRegistry } from '@/lib/providers'
import { Provider, WorkflowFilters } from '@/types'

// GET /api/workflows - List workflows across all providers
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
    const filters: WorkflowFilters = {
      providerId: searchParams.get('providerId') || undefined,
      isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      search: searchParams.get('search') || undefined
    }

    // TODO: Fetch user's providers from database
    // For now, return empty results since we don't have providers set up yet
    const providers: Provider[] = []

    const allWorkflows = []
    let totalCount = 0

    // Fetch workflows from each provider
    for (const provider of providers) {
      if (filters.providerId && provider.id !== filters.providerId) {
        continue // Skip this provider if filtering by specific provider
      }

      if (!provider.isConnected) {
        continue // Skip disconnected providers
      }

      try {
        const adapter = ProviderRegistry.create(provider)
        const result = await adapter.getWorkflows(filters)

        if (result.success && result.data) {
          allWorkflows.push(...result.data.items)
          totalCount += result.data.total
        }
      } catch (error) {
        console.error(`Failed to fetch workflows from provider ${provider.name}:`, error)
        // Continue with other providers
      }
    }

    // Sort workflows by lastExecutedAt (most recent first), then by name
    allWorkflows.sort((a, b) => {
      if (a.lastExecutedAt && b.lastExecutedAt) {
        return new Date(b.lastExecutedAt).getTime() - new Date(a.lastExecutedAt).getTime()
      }
      if (a.lastExecutedAt && !b.lastExecutedAt) return -1
      if (!a.lastExecutedAt && b.lastExecutedAt) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      success: true,
      data: {
        items: allWorkflows,
        total: totalCount,
        page: 1,
        limit: allWorkflows.length,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })
  } catch (error) {
    console.error('Failed to fetch workflows:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}