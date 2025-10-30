const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Configuration - UPDATE THESE
const N8N_HOST = process.env.N8N_HOST || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const DB_PATH = process.env.DATABASE_PATH || '/tmp/elova-backup.db';

console.log('🚀 Starting AI metrics backfill...\n');
console.log(`📡 n8n Host: ${N8N_HOST}`);
console.log(`💾 Database: ${DB_PATH}\n`);

const db = new sqlite3.Database(DB_PATH);

// Get executions without AI metrics
db.all(`
  SELECT id, provider_execution_id, total_tokens 
  FROM executions 
  WHERE total_tokens = 0 OR total_tokens IS NULL 
  LIMIT 50
`, async (err, rows) => {
  if (err) {
    console.error('❌ Database error:', err);
    process.exit(1);
  }
  
  console.log(`📊 Found ${rows.length} executions to process\n`);
  
  let processed = 0;
  let updated = 0;
  
  for (const row of rows) {
    try {
      const response = await fetch(`${N8N_HOST}/api/v1/executions/${row.provider_execution_id}?includeData=true`, {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log(`⚠️  Skip ${row.provider_execution_id}: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      // Check for AI metrics in execution data
      if (data.data?.resultData?.runData) {
        let totalTokens = 0;
        
        // Simple token extraction from runData
        for (const [nodeName, nodeRuns] of Object.entries(data.data.resultData.runData)) {
          for (const run of nodeRuns) {
            if (run.data?.main?.[0]) {
              for (const output of run.data.main[0]) {
                if (output.json?.usage?.total_tokens) {
                  totalTokens += output.json.usage.total_tokens;
                }
              }
            }
          }
        }
        
        if (totalTokens > 0) {
          console.log(`✅ ${row.provider_execution_id}: ${totalTokens} tokens`);
          updated++;
        }
      }
      
      processed++;
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error processing ${row.provider_execution_id}:`, error.message);
    }
  }
  
  console.log(`\n📈 Complete: ${processed} processed, ${updated} with AI metrics`);
  db.close();
});
