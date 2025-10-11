import type { NextApiRequest, NextApiResponse } from 'next'
import { authenticateRequest } from '@/lib/api-auth'
import { executionSync } from '@/lib/sync/execution-sync'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req)
    if (authResult.error || !authResult.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    console.log('🔄 Manual executions sync requested by user:', (authResult.user as any).id || 'dev-user')

    // Trigger execution sync for all providers
    const result = await executionSync.syncAllProviders({ 
      syncType: 'executions',
      batchSize: 200 // Larger batch for manual sync
    })

    console.log('✅ Manual executions sync completed:', result)

    return res.status(200).json({
      success: true,
      message: 'Executions sync completed successfully',
      result
    })

  } catch (error) {
    console.error('❌ Manual executions sync failed:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Executions sync failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}