import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'

export async function GET() {
  try {
    const configManager = getConfigManager()
    await configManager.initialize()
    
    const n8nUrl = await configManager.get('integrations.n8n.url') || 'http://localhost:5678'
    
    return NextResponse.json({ n8nUrl })
  } catch (error) {
    console.error('Failed to get n8n URL:', error)
    return NextResponse.json({ n8nUrl: 'http://localhost:5678' })
  }
}