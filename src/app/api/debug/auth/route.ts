import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'

// GET /api/debug/auth - Test authentication
export async function GET(request: NextRequest) {
  try {
    // Extract all possible auth headers and cookies
    const authHeader = request.headers.get('authorization')
    const cookieHeader = request.headers.get('cookie')
    const sessionToken = request.cookies.get('session-token')
    
    console.log('Debug Auth - Headers:')
    console.log('- Authorization:', authHeader)
    console.log('- Cookie:', cookieHeader)
    console.log('- session-token cookie:', sessionToken?.value)
    
    // Try to authenticate
    const { user, error: authError } = await authenticateRequest(request)
    
    return NextResponse.json({
      success: true,
      debug: {
        authHeader,
        cookieHeader,
        sessionTokenCookie: sessionToken?.value,
        user,
        authError
      }
    })
  } catch (error) {
    console.error('Debug auth error:', error)
    return NextResponse.json({
      error: 'Debug error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}