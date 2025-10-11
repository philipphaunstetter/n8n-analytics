import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require setup completion
const PUBLIC_ROUTES = [
  '/',
  '/api/health',
  '/api/setup',
  '/setup',
  '/_next',
  '/favicon.ico',
  '/robots.txt'
]

// Setup wizard routes
const SETUP_ROUTES = [
  '/setup/welcome',
  '/setup/admin',
  '/setup/database', 
  '/setup/integrations',
  '/setup/complete'
]

// Admin routes that require setup completion
const ADMIN_ROUTES = [
  '/admin',
  '/dashboard',
  '/workflows',
  '/analytics'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files and API routes (except setup)
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') && !pathname.startsWith('/api/setup') ||
    pathname.includes('.') ||
    PUBLIC_ROUTES.includes(pathname)
  ) {
    return NextResponse.next()
  }

  try {
    // Check setup status by calling our setup API
    const setupResponse = await fetch(new URL('/api/setup/status', request.url), {
      headers: {
        'x-forwarded-host': request.headers.get('host') || '',
      }
    })

    if (!setupResponse.ok) {
      console.error('Failed to check setup status:', setupResponse.statusText)
      // On error, redirect to setup to be safe
      return NextResponse.redirect(new URL('/setup/welcome', request.url))
    }

    const setupStatus = await setupResponse.json()

    // If setup is required and user is not on a setup page
    if (!setupStatus.initDone && !SETUP_ROUTES.some(route => pathname.startsWith(route))) {
      // Redirect to setup wizard
      return NextResponse.redirect(new URL('/setup/welcome', request.url))
    }

    // If setup is complete and user is on setup pages
    if (setupStatus.initDone && SETUP_ROUTES.some(route => pathname.startsWith(route))) {
      // Redirect to dashboard or main app
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // If user tries to access admin routes without setup completion
    if (!setupStatus.initDone && ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/setup/welcome', request.url))
    }

  } catch (error) {
    console.error('Setup middleware error:', error)
    // On error, redirect to setup welcome page to be safe
    if (!SETUP_ROUTES.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL('/setup/welcome', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}