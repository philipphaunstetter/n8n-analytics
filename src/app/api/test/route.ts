import { NextRequest, NextResponse } from 'next/server'

// GET /api/test - Simple test endpoint
export async function GET(request: NextRequest) {
  console.log('Test endpoint hit!')
  
  return NextResponse.json({
    success: true,
    message: 'Test endpoint working!',
    timestamp: new Date().toISOString()
  })
}