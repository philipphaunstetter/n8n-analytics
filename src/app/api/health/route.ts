import { NextResponse } from 'next/server'

/**
 * Health check endpoint for Docker container monitoring
 * Returns 200 OK if the application is running properly
 */
export async function GET() {
  try {
    // Basic health check - could be extended to check database connectivity, etc.
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || process.env.npm_package_version || '0.1.0',
      gitCommit: process.env.APP_GIT_COMMIT || 'unknown',
      buildDate: process.env.APP_BUILD_DATE || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    }

    return NextResponse.json(healthStatus, { status: 200 })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 503 }
    )
  }
}