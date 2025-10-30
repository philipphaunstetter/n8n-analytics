#!/usr/bin/env tsx
/**
 * Backfill AI Metrics Script
 * 
 * This script fetches execution data for all executions that don't have AI metrics
 * and extracts token usage and costs.
 * 
 * Usage:
 *   npx tsx scripts/backfill-ai-metrics.ts
 */

import { getSQLiteClient } from '../src/lib/db/sqlite'
import { extractAIMetrics } from '../src/lib/services/ai-metrics-extractor'
import { getConfigManager } from '../src/lib/config/config-manager'

interface Execution {
  id: string
  provider_id: string
  provider_execution_id: string
  total_tokens: number
}

interface N8nExecution {
  id: string
  data?: {
    resultData?: {
      runData?: Record<string, any[]>
    }
  }
}

async function fetchExecutionData(host: string, apiKey: string, executionId: string): Promise<N8nExecution | null> {
  try {
    const response = await fetch(`${host}/api/v1/executions/${executionId}?includeData=true`, {
      headers: {
        'Accept': 'application/json',
        'X-N8N-API-KEY': apiKey
      }
    })
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch execution ${executionId}: ${response.status}`)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error(`❌ Error fetching execution ${executionId}:`, error)
    return null
  }
}

async function backfillAIMetrics() {
  console.log('🚀 Starting AI metrics backfill...\n')
  
  // Initialize config
  const configManager = getConfigManager()
  await configManager.initialize()
  
  const host = await configManager.get('integrations.n8n.url')
  const apiKey = await configManager.get('integrations.n8n.api_key')
  
  if (!host || !apiKey) {
    console.error('❌ n8n configuration not found. Please configure n8n integration first.')
    process.exit(1)
  }
  
  console.log(`📡 Connected to n8n at: ${host}\n`)
  
  const db = getSQLiteClient()
  
  // Get all executions without AI metrics
  const executions = await new Promise<Execution[]>((resolve, reject) => {
    db.all(`
      SELECT id, provider_id, provider_execution_id, total_tokens
      FROM executions
      WHERE total_tokens = 0 OR total_tokens IS NULL
      ORDER BY created_at DESC
    `, (err, rows: Execution[]) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
  
  console.log(`📊 Found ${executions.length} executions without AI metrics\n`)
  
  if (executions.length === 0) {
    console.log('✅ All executions already have AI metrics!')
    return
  }
  
  let processed = 0
  let updated = 0
  let skipped = 0
  
  for (const execution of executions) {
    processed++
    
    if (processed % 10 === 0) {
      console.log(`Progress: ${processed}/${executions.length}`)
    }
    
    // Fetch execution data from n8n
    const n8nExecution = await fetchExecutionData(host, apiKey, execution.provider_execution_id)
    
    if (!n8nExecution || !n8nExecution.data) {
      skipped++
      continue
    }
    
    // Extract AI metrics
    const aiMetrics = extractAIMetrics({ data: n8nExecution.data })
    
    if (!aiMetrics || aiMetrics.totalTokens === 0) {
      skipped++
      continue
    }
    
    // Update execution with AI metrics
    await new Promise<void>((resolve, reject) => {
      db.run(`
        UPDATE executions SET
          execution_data = ?,
          total_tokens = ?,
          input_tokens = ?,
          output_tokens = ?,
          ai_cost = ?,
          ai_provider = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        JSON.stringify(n8nExecution.data),
        aiMetrics.totalTokens,
        aiMetrics.inputTokens,
        aiMetrics.outputTokens,
        aiMetrics.aiCost,
        aiMetrics.aiProvider,
        execution.id
      ], (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    
    console.log(`✅ Updated execution ${execution.provider_execution_id}: ${aiMetrics.totalTokens} tokens, $${aiMetrics.aiCost.toFixed(4)}`)
    updated++
    
    // Rate limit: wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log(`\n📈 Backfill complete!`)
  console.log(`   Processed: ${processed}`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Skipped: ${skipped}`)
}

// Run the migration
backfillAIMetrics()
  .then(() => {
    console.log('\n✅ Migration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  })
