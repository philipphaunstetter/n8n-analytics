import { NextRequest, NextResponse } from 'next/server'
import { executionSync } from '@/lib/sync/execution-sync'
import { authenticateRequest } from '@/lib/api-auth'
import { Database } from 'sqlite3'
import { ConfigManager } from '@/lib/config/config-manager'

// POST /api/sync/executions - Trigger execution sync specifically
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { user } = await authenticateRequest(request)
    
    // Temporary bypass for testing - create fallback user
    const _actualUser = user || {
      id: 'admin-001',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin' as const
    }

    console.log('🚀 Triggering executions sync via API...')
    
    const body = await request.json().catch(() => ({}))
    const { 
      providerId,
      batchSize = 100
    } = body

    const options = {
      syncType: 'executions' as const,
      batchSize
    }

    let result
    if (providerId) {
      // Get the actual provider from database
      const dbPath = ConfigManager.getDefaultDatabasePath()
      const db = new Database(dbPath)
      
      const provider = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM providers WHERE id = ?', [providerId], (err, row) => {
          if (err) reject(err)
          else resolve(row)
        })
      })
      
      db.close()
      
      if (!provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
      }
      
      result = await executionSync.syncProvider(provider, options)
    } else {
      // Sync all providers
      result = await executionSync.syncAllProviders(options)
    }

    return NextResponse.json({
      success: true,
      message: 'Executions sync completed successfully',
      data: result
    })

  } catch (error) {
    console.error('❌ Execution sync API failed:', error)
    return NextResponse.json({
      error: 'Execution sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}