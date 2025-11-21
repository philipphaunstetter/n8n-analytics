import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const config = getConfigManager()
        await config.initialize()

        const syncStatus = await config.get<string>('sync.initial.status')
        const syncStartedAt = await config.get<string>('sync.initial.started_at')
        const syncCompletedAt = await config.get<string>('sync.initial.completed_at')
        const syncError = await config.get<string>('sync.initial.error')

        return NextResponse.json({
            status: syncStatus || 'not_started', // 'not_started' | 'in_progress' | 'completed' | 'failed'
            startedAt: syncStartedAt,
            completedAt: syncCompletedAt,
            error: syncError,
            isComplete: syncStatus === 'completed',
            inProgress: syncStatus === 'in_progress'
        })
    } catch (error) {
        console.error('Failed to get sync status:', error)
        return NextResponse.json(
            { error: 'Failed to get sync status' },
            { status: 500 }
        )
    }
}
