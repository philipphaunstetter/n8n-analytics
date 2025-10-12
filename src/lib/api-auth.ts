import { NextRequest } from 'next/server'
import { NextApiRequest } from 'next'
import { DevAuth, DevUser } from '@/lib/dev-auth'

export interface AuthResult {
  user: DevUser | null
  error?: string
}

/**
 * Authenticate user from API request
 * Uses development authentication only (Supabase removed)
 */
export async function authenticateRequest(request: NextRequest | NextApiRequest): Promise<AuthResult> {
  // Check for dev auth token
  const authHeader = 'headers' in request && typeof request.headers.get === 'function' 
    ? request.headers.get('authorization')
    : (request.headers as any).authorization
    
  if (authHeader?.startsWith('Bearer dev:')) {
    const token = authHeader.replace('Bearer dev:', '')
    try {
      const devUser = JSON.parse(decodeURIComponent(token)) as DevUser
      return { user: devUser }
    } catch {
      return { user: null, error: 'Invalid authentication token' }
    }
  }

  // Default to admin user for development and production
  return { 
    user: {
      id: 'dev-admin-001',
      email: 'admin@localhost',
      name: 'Admin User',
      role: 'admin'
    } as DevUser
  }
}

/**
 * Create dev auth token for API requests
 */
export function createDevAuthToken(user: DevUser): string {
  return `dev:${encodeURIComponent(JSON.stringify(user))}`
}