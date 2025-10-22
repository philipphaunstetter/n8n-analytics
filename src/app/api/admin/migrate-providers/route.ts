import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { migrateToProviders, checkMigrationNeeded } from '@/lib/migrations/migrate-to-providers'

// POST /api/admin/migrate-providers - Manually trigger migration
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await migrateToProviders(user.id)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        providerId: result.providerId
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.message
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Migration endpoint error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed'
      },
      { status: 500 }
    )
  }
}

// GET /api/admin/migrate-providers - Check if migration is needed
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const migrationNeeded = await checkMigrationNeeded(user.id)

    return NextResponse.json({
      success: true,
      migrationNeeded
    })
  } catch (error) {
    console.error('Migration check error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check migration status'
      },
      { status: 500 }
    )
  }
}
