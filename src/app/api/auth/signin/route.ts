import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory user database for development
const USERS = [
  {
    id: 'admin-1',
    email: 'admin@test.com',
    password: '1234', // In production, this would be hashed
    name: 'Admin User',
    role: 'admin'
  },
  {
    id: 'demo-1',
    email: 'demo@test.com', 
    password: 'demo',
    name: 'Demo User',
    role: 'user'
  }
]

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

    // Find user by email
    const user = USERS.find(u => u.email === email)
    
    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user
    
    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      message: 'Signed in successfully'
    })

  } catch (error) {
    console.error('Signin API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}