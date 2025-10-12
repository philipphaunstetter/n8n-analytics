import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'
import { createSessionToken } from '@/lib/api-auth'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const config = getConfigManager()
    await config.initialize()
    
    // Authenticate against database admin user
    const adminEmail = await config.get('setup.admin_email')
    const adminName = await config.get('setup.admin_name')
    const adminPasswordHash = await config.get('setup.admin_password_hash')
    
    if (!adminEmail || !adminPasswordHash) {
      return NextResponse.json(
        { error: 'No admin account configured. Please complete setup first.' },
        { status: 401 }
      )
    }
    
    if (email.toLowerCase() === adminEmail.toLowerCase()) {
      // Check password hash
      const inputHash = crypto.createHash('sha256').update(password).digest('hex')
      
      if (inputHash === adminPasswordHash) {
        const user = {
          id: 'admin-001',
          email: adminEmail,
          name: adminName || 'Admin User',
          role: 'admin' as const
        }
        
        // Create session token
        const sessionToken = createSessionToken(user)
        
        const response = NextResponse.json({
          success: true,
          user,
          sessionToken
        })
        
        // Set session cookie
        response.cookies.set('sessionToken', sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 // 7 days
        })
        
        return response
      }
    }

    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )

  } catch (error) {
    console.error('Authentication error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
