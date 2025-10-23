import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface CronJob {
  id: string
  workflowId: string
  workflowName: string
  providerId: string
  providerName: string
  isActive: boolean
  isArchived: boolean
  cronSchedules: Array<{
    nodeName: string
    nodeType: string
    cronExpression: string
  }>
  updatedAt: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId')
    const statusFilter = searchParams.get('status') // 'all', 'active', 'inactive', 'archived'

    const db = getDb()

    // Build query with filters
    let query = `
      SELECT 
        w.id,
        w.name as workflowName,
        w.provider_id as providerId,
        w.is_active as isActive,
        w.is_archived as isArchived,
        w.cron_schedules as cronSchedules,
        w.updated_at as updatedAt,
        p.name as providerName
      FROM workflows w
      LEFT JOIN providers p ON w.provider_id = p.id
      WHERE w.cron_schedules != '[]' AND w.cron_schedules IS NOT NULL
    `

    const params: any[] = []

    // Add status filter
    if (statusFilter === 'active') {
      query += ` AND w.is_active = 1 AND (w.is_archived = 0 OR w.is_archived IS NULL)`
    } else if (statusFilter === 'inactive') {
      query += ` AND w.is_active = 0 AND (w.is_archived = 0 OR w.is_archived IS NULL)`
    } else if (statusFilter === 'archived') {
      query += ` AND w.is_archived = 1`
    }

    // Add provider filter
    if (providerId && providerId !== 'all') {
      query += ` AND w.provider_id = ?`
      params.push(providerId)
    }

    query += ` ORDER BY w.name ASC`

    const workflows = await new Promise<any[]>((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows || [])
        }
      })
    })

    // Transform the results
    const cronJobs: CronJob[] = workflows.map((workflow) => ({
      id: workflow.id,
      workflowId: workflow.id,
      workflowName: workflow.workflowName,
      providerId: workflow.providerId,
      providerName: workflow.providerName || 'Unknown',
      isActive: workflow.isActive === 1,
      isArchived: workflow.isArchived === 1,
      cronSchedules: JSON.parse(workflow.cronSchedules || '[]'),
      updatedAt: workflow.updatedAt
    }))

    return NextResponse.json({
      success: true,
      data: cronJobs,
      count: cronJobs.length
    })
  } catch (error) {
    console.error('Failed to fetch cron jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cron jobs' },
      { status: 500 }
    )
  }
}
