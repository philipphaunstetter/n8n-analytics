import { NextRequest, NextResponse } from 'next/server'
import { Database } from 'sqlite3'
import { ConfigManager } from '@/lib/config/config-manager'

export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/dashboard/stats - Fetching dashboard statistics')
    
    const dbPath = ConfigManager.getDefaultDatabasePath()
    const db = new Database(dbPath)
    
    // Get basic stats
    const stats = await new Promise<any>((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(DISTINCT w.id) as total_workflows,
          COUNT(e.id) as total_executions,
          COUNT(CASE WHEN e.status = 'success' THEN 1 END) as successful_executions,
          COUNT(CASE WHEN e.status = 'failed' THEN 1 END) as failed_executions,
          AVG(e.response_time) as avg_response_time
        FROM workflows w
        LEFT JOIN executions e ON e.workflow_id = w.id
      `, (err, row: any) => {
        if (err) {
          console.error('❌ Error fetching stats:', err)
          reject(err)
        } else {
          console.log('✅ Retrieved dashboard stats:', row)
          resolve(row || {})
        }
      })
    })
    
    // Calculate success rate
    const totalExecs = stats.total_executions || 0
    const successfulExecs = stats.successful_executions || 0
    const successRate = totalExecs > 0 ? Math.round((successfulExecs / totalExecs) * 100) : 0
    
    db.close()
    
    const response = {
      totalExecutions: totalExecs,
      successfulExecutions: successfulExecs,
      failedExecutions: stats.failed_executions || 0,
      successRate: successRate,
      avgResponseTime: Math.round(stats.avg_response_time || 0),
      totalWorkflows: stats.total_workflows || 0
    }
    
    console.log('📊 Dashboard stats response:', response)
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Failed to fetch dashboard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}