import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import { getConfigManager } from '@/lib/config/config-manager'
import crypto from 'crypto'

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
        const { currentPassword, newPassword } = body

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: 'Current and new password are required' },
                { status: 400 }
            )
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { error: 'New password must be at least 8 characters long' },
                { status: 400 }
            )
        }

        const config = getConfigManager()
        await config.initialize()

        // Verify current password
        const currentHash = await config.get('setup.admin_password_hash')
        const inputHash = crypto.createHash('sha256').update(currentPassword).digest('hex')

        if (inputHash !== currentHash) {
            return NextResponse.json(
                { error: 'Incorrect current password' },
                { status: 400 }
            )
        }

        // Update password
        const newHash = crypto.createHash('sha256').update(newPassword).digest('hex')
        await config.set('setup.admin_password_hash', newHash, { changedBy: authResult.user.email })

        return NextResponse.json({
            success: true,
            message: 'Password updated successfully'
        })
    } catch (error) {
        console.error('Password update error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
