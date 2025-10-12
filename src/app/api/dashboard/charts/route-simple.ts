import { NextRequest, NextResponse } from 'next/server'
import { Database } from 'sqlite3'
import { ConfigManager } from '@/lib/config/config-manager'

export interface ChartDataPoint {
  timestamp: number
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  successRate: number
  avgResponseTime: number
}

export async function GET(request: NextRequest) {
  try {
    console.log('📈 GET /api/dashboard/charts - Fetching chart data')
    
    const dbPath = ConfigManager.getDefaultDatabasePath()
    const db = new Database(dbPath)
    
    // Get execution data grouped by hour for the last 24 hours
    const chartData = await new Promise<any[]>((resolve, reject) => {
      db.all(`
        SELECT 
          DATE(started_at) as date,
          HOUR(started_at) as hour,
          COUNT(*) as total_executions,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_executions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
          AVG(response_time) as avg_response_time
        FROM executions
        WHERE started_at >= datetime('now', '-24 hours')
        GROUP BY DATE(started_at), HOUR(started_at)
        ORDER BY started_at
      `, (err, rows: any[]) => {
        if (err) {
          console.error('❌ Error fetching chart data:', err)
          // Fallback to simple aggregate data if time-based grouping fails
          db.all(`
            SELECT 
              COUNT(*) as total_executions,
              COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_executions,
              COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
              AVG(response_time) as avg_response_time,
              started_at
            FROM executions
            ORDER BY started_at DESC
            LIMIT 10
          `, (fallbackErr, fallbackRows: any[]) => {
            if (fallbackErr) {
              reject(fallbackErr)
            } else {
              console.log('📊 Using fallback chart data')
              resolve(fallbackRows || [])
            }
          })
        } else {
          console.log(`✅ Retrieved ${rows?.length || 0} chart data points`)
          resolve(rows || [])
        }
      })
    })
    
    // Convert to chart format
    const formattedData: ChartDataPoint[] = chartData.map((row, index) => {
      const totalExecs = row.total_executions || 0
      const successfulExecs = row.successful_executions || 0
      const successRate = totalExecs > 0 ? Math.round((successfulExecs / totalExecs) * 100) : 0
      
      // Use current time minus index for timestamp if no date info
      const timestamp = row.started_at ? 
        new Date(row.started_at).getTime() : 
        Date.now() - (index * 60 * 60 * 1000) // Spread over hours
      
      return {
        timestamp,
        totalExecutions: totalExecs,
        successfulExecutions: successfulExecs,
        failedExecutions: row.failed_executions || 0,
        successRate,
        avgResponseTime: Math.round(row.avg_response_time || 0)
      }
    })
    
    db.close()
    
    console.log('📈 Chart data response:', formattedData.length, 'data points')
    
    return NextResponse.json({
      success: true,
      data: formattedData,
      timeRange: '24h',
      count: formattedData.length
    })
  } catch (error) {
    console.error('❌ Failed to fetch chart data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}