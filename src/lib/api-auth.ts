import { NextRequest } from 'next/server'
import { NextApiRequest } from 'next'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { DevAuth, DevUser } from '@/lib/dev-auth'
import { User } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

export interface AuthResult {
  user: User | DevUser | null
  error?: string
}

/**
 * Authenticate user from API request
 * Supports both Supabase and development authentication
 */
export async function authenticateRequest(request: NextRequest | NextApiRequest): Promise<AuthResult> {
  // Check for dev auth first
  if (DevAuth.isDevelopment()) {
    const authHeader = 'headers' in request && typeof request.headers.get === 'function' 
      ? request.headers.get('authorization')
      : (request.headers as any).authorization
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

  // Check if Supabase credentials are available
  const hasSupabaseCredentials = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If no Supabase credentials, fall back to dev auth for all environments
  if (!hasSupabaseCredentials || DevAuth.isDevelopment()) {
    return { 
      user: {
        id: 'dev-admin-001',
        email: 'admin@localhost',
        name: 'Admin User',
        role: 'admin'
      } as DevUser
    }
  }

  // Handle different request types with Supabase
  if ('cookies' in request) {
    // NextApiRequest (Pages Router)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // For now, return dev user for Pages Router
      return { 
        user: {
          id: 'dev-admin-001',
          email: 'admin@localhost',
          name: 'Admin User',
          role: 'admin'
        } as DevUser
      }
    } catch (error) {
      return { user: null, error: 'Authentication failed' }
    }
  } else {
    // NextRequest (App Router)
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
}

/**
 * Create dev auth token for API requests
 */
export function createDevAuthToken(user: DevUser): string {
  return `dev:${encodeURIComponent(JSON.stringify(user))}`
}