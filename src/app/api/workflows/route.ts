import { NextRequest, NextResponse } from 'next/server'
import { Database } from 'sqlite3'
import { ConfigManager } from '@/lib/config/config-manager'

// GET /api/workflows - List workflows from SQLite database
export async function GET(request: NextRequest) {
  try {
    console.log('📋 GET /api/workflows - Fetching workflows from database')
    
    const dbPath = ConfigManager.getDefaultDatabasePath()
    const db = new Database(dbPath)
    
    // Get workflows from database with execution counts
    const workflows = await new Promise<any[]>((resolve, reject) => {
      db.all(`
        SELECT 
          w.*,
          COUNT(e.id) as execution_count,
          MAX(e.started_at) as last_execution_at
        FROM workflows w
        LEFT JOIN executions e ON e.workflow_id = w.id
        GROUP BY w.id
        ORDER BY w.name
      `, (err, rows: any[]) => {
        if (err) {
          console.error('❌ Error fetching workflows:', err)
          reject(err)
        } else {
          console.log(`✅ Found ${rows?.length || 0} workflows in database`)
          resolve(rows || [])
        }
      })
    })
    
    // Convert to API format
    const apiWorkflows = workflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      active: Boolean(workflow.is_active),
      tags: workflow.tags ? JSON.parse(workflow.tags) : [],
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at,
      executionCount: parseInt(workflow.execution_count || '0'),
      nodeCount: workflow.node_count || 0,
      lifecycleStatus: workflow.lifecycle_status || 'active',
      version: workflow.version || 1
    }))
    
    db.close()
    
    return NextResponse.json({
      success: true,
      data: {
        items: apiWorkflows,
        total: apiWorkflows.length,
        page: 1,
        limit: apiWorkflows.length,
        hasNextPage: false,
        hasPreviousPage: false
      }
    })
  } catch (error) {
    console.error('❌ Failed to fetch workflows:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}