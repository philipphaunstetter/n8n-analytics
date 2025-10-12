import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager } from '../../../../lib/config-manager'
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
    
    // First, try to authenticate against database admin user
    const adminEmail = await config.get('setup.admin_email')
    const adminName = await config.get('setup.admin_name')
    const adminPasswordHash = await config.get('setup.admin_password_hash')
    
    if (adminEmail && adminPasswordHash && email.toLowerCase() === adminEmail.toLowerCase()) {
      // Check password hash
      const inputHash = crypto.createHash('sha256').update(password).digest('hex')
      
      if (inputHash === adminPasswordHash) {
        return NextResponse.json({
          success: true,
          user: {
            id: 'admin-001',
            email: adminEmail,
            name: adminName || 'Admin User',
            role: 'admin'
          }
        })
      }
    }

    // Fallback to hardcoded dev users for development/testing
    if (process.env.NODE_ENV === 'development') {
      const DEV_USERS: Record<string, { password: string; user: any }> = {
        'dev@example.com': {
          password: 'dev123',
          user: {
            id: 'dev-001',
            email: 'dev@example.com',
            name: 'Dev User',
            role: 'developer'
          }
        },
        'admin@example.com': {
          password: 'admin123',
          user: {
            id: 'admin-002',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin'
          }
        }
      }

      const userEntry = DEV_USERS[email.toLowerCase()]
      if (userEntry && userEntry.password === password) {
        return NextResponse.json({
          success: true,
          user: userEntry.user
        })
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
