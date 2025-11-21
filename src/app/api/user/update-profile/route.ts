import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getConfigManager } from '@/lib/config/config-manager'

export async function POST(request: NextRequest) {
    try {
        const authResult = await authenticateRequest(request)

        if (!authResult.user) {
            return NextResponse.json(
                { error: authResult.error || 'Unauthorized' },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { name, email } = body

        if (!name || !email) {
            return NextResponse.json(
                { error: 'Name and email are required' },
                { status: 400 }
            )
        }

        const config = getConfigManager()
        await config.initialize()

        // Update config
        await config.set('setup.admin_name', name, { changedBy: authResult.user.email })
        await config.set('setup.admin_email', email, { changedBy: authResult.user.email })

        return NextResponse.json({
            success: true,
            user: {
                ...authResult.user,
                name,
                email
            }
        })
    } catch (error) {
        console.error('Profile update error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
