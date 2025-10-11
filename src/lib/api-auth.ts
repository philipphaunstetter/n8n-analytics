import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { DevAuth, DevUser } from '@/lib/dev-auth'
import { User } from '@supabase/supabase-js'

export interface AuthResult {
  user: User | DevUser | null
  error?: string
}

/**
 * Authenticate user from API request
 * Supports both Supabase and development authentication
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  // Check for dev auth first
  if (DevAuth.isDevelopment()) {
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer dev:')) {
      const token = authHeader.replace('Bearer dev:', '')
      try {
        const devUser = JSON.parse(decodeURIComponent(token)) as DevUser
        return { user: devUser }
      } catch {
        // Fall through to Supabase auth
      }
    }
  }

  // Standard Supabase authentication
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
    
    if (authError) {
      return { user: null, error: authError.message }
    }

    return { user }
  } catch (error) {
    return { user: null, error: 'Authentication failed' }
  }
}

/**
 * Create dev auth token for API requests
 */
export function createDevAuthToken(user: DevUser): string {
  return `dev:${encodeURIComponent(JSON.stringify(user))}`
}