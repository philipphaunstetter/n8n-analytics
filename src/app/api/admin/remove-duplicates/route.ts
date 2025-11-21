import { NextResponse } from 'next/server'
import { removeDuplicateWorkflows } from '@/lib/migrations/remove-duplicate-workflows'

export async function POST() {
    try {
        console.log('🔧 Starting duplicate workflow removal...')

        const result = await removeDuplicateWorkflows()

        return NextResponse.json({
            success: true,
            message: `Removed ${result.duplicatesRemoved} duplicate workflows`,
            duplicatesFound: result.duplicatesFound,
            duplicatesRemoved: result.duplicatesRemoved
        })
    } catch (error) {
        console.error('Failed to remove duplicate workflows:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
