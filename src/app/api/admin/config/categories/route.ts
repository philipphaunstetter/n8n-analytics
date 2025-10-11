import { NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/config/config-manager'

export async function GET() {
  try {
    const configManager = getConfigManager()
    await configManager.initialize()
    
    const categories = await configManager.getCategories()
    
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Failed to fetch configuration categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch configuration categories' },
      { status: 500 }
    )
  }
}