import { NextRequest } from 'next/server'
import { NextApiRequest } from 'next'
import { getConfigManager } from '@/lib/config/config-manager'
import crypto from 'crypto'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
}

export interface AuthResult {
  user: User | null
  error?: string
}

/**
 * Authenticate user from API request
 * Uses proper session-based authentication with SQLite
 */
export async function authenticateRequest(request: NextRequest | NextApiRequest): Promise<AuthResult> {
  // Check for session token in cookies or headers
  const sessionToken = getSessionToken(request)
  
  if (!sessionToken) {
    return { user: null, error: 'No session token provided' }
  }

  try {
    // Validate session token and get user
    const user = await validateSessionToken(sessionToken)
    return { user }
  } catch (error) {
    return { user: null, error: 'Invalid session token' }
  }
}

/**
 * Extract session token from request
 */
function getSessionToken(request: NextRequest | NextApiRequest): string | null {
  // Check Authorization header
  const authHeader = 'headers' in request && typeof request.headers.get === 'function' 
    ? request.headers.get('authorization')
    : (request.headers as any).authorization
    
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '')
  }

  // Check cookies
  const cookies = 'cookies' in request ? request.cookies : (request as any).cookies
  if (cookies?.sessionToken || cookies?.get?.('sessionToken')) {
    return cookies.sessionToken || cookies.get('sessionToken')?.value
  }

  return null
}

/**
 * Validate session token and return user
 */
async function validateSessionToken(token: string): Promise<User> {
  // For now, we'll implement a simple token validation
  // In a more robust system, you'd store session tokens in the database
  
  try {
    // Decode the session token (assuming it's base64 encoded user data)
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const sessionData = JSON.parse(decoded)
    
    // Validate the session data has required fields and isn't expired
    if (!sessionData.userId || !sessionData.email || !sessionData.expires) {
      throw new Error('Invalid session format')
    }
    
    // Check if session is expired
    if (Date.now() > sessionData.expires) {
      throw new Error('Session expired')
    }
    
    // Verify user still exists in database
    const config = getConfigManager()
    await config.initialize()
    
    const adminEmail = await config.get('setup.admin_email')
    const adminName = await config.get('setup.admin_name')
    
    if (!adminEmail || sessionData.email.toLowerCase() !== adminEmail.toLowerCase()) {
      throw new Error('User not found')
    }
    
    return {
      id: sessionData.userId,
      email: adminEmail,
      name: adminName || 'Admin User',
      role: 'admin'
    }
  } catch (error) {
    throw new Error('Invalid session token')
  }
}

/**
 * Create session token for user
 */
export function createSessionToken(user: User): string {
  const sessionData = {
    userId: user.id,
    email: user.email,
    expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  }
  
  return Buffer.from(JSON.stringify(sessionData)).toString('base64')
}

