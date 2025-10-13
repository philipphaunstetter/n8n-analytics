#!/usr/bin/env node

const { Database } = require('sqlite3').verbose();
const fetch = require('node-fetch'); // May need to install: npm install node-fetch

async function testSync() {
  try {
    // Test current executions API (should show empty results from SQLite)
    console.log('🔍 Testing current executions API...');
    const execResponse = await fetch('http://localhost:3000/api/executions?timeRange=24h');
    const execData = await execResponse.text();
    console.log('Current executions response:', execData.substring(0, 200) + '...');
    
    // Get n8n configuration from database
    console.log('\n📋 Checking n8n configuration...');
    const db = new Database('/Users/philipp/development/n8n-analytics/data/elova.db');
    
    const config = await new Promise((resolve, reject) => {
      db.all("SELECT key, value FROM app_config WHERE key LIKE '%n8n%'", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('n8n config:', config.map(r => ({ key: r.key, hasValue: !!r.value })));
    
    // Test direct n8n API call
    const host = config.find(c => c.key === 'integrations.n8n.url')?.value;
    const apiKey = config.find(c => c.key === 'integrations.n8n.api_key')?.value;
    
    if (host && apiKey) {
      console.log('\n🧪 Testing direct n8n API call...');
      const n8nResponse = await fetch(`${host}/api/v1/executions?limit=5`, {
        headers: {
          'X-N8N-API-KEY': apiKey,
          'Accept': 'application/json'
        }
      });
      
      if (n8nResponse.ok) {
        const n8nData = await n8nResponse.json();
        console.log(`✅ n8n API working - found ${n8nData.data?.length || 0} executions`);
        
        // If we got executions, let's manually insert one for testing
        if (n8nData.data && n8nData.data.length > 0) {
          const sampleExecution = n8nData.data[0];
          console.log('\n💾 Inserting sample execution into SQLite...');
          
          // First, ensure provider and workflow exist
          await new Promise((resolve, reject) => {
            db.run(`
              INSERT OR IGNORE INTO providers (id, user_id, name, base_url, api_key_encrypted, is_connected, status)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, ['provider_1760336304263', 'admin', 'n8n Instance', host, apiKey, 1, 'healthy'], 
            (err) => err ? reject(err) : resolve());
          });
          
          await new Promise((resolve, reject) => {
            db.run(`
              INSERT OR IGNORE INTO workflows (id, provider_id, provider_workflow_id, name, is_active)
              VALUES (?, ?, ?, ?, ?)
            `, [`wf_${Date.now()}`, 'provider_1760336304263', sampleExecution.workflowId, 'Test Workflow', 1],
            (err) => err ? reject(err) : resolve());
          });
          
          // Insert execution
          await new Promise((resolve, reject) => {
            const execId = `exec_${Date.now()}`;
            db.run(`
              INSERT OR REPLACE INTO executions (
                id, provider_id, workflow_id, provider_execution_id, provider_workflow_id,
                status, mode, started_at, stopped_at, duration, finished, metadata
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              execId,
              'provider_1760336304263', 
              `wf_${Date.now()}`,
              sampleExecution.id,
              sampleExecution.workflowId,
              sampleExecution.status === 'success' ? 'success' : 'error',
              sampleExecution.mode || 'trigger',
              sampleExecution.startedAt,
              sampleExecution.stoppedAt,
              sampleExecution.stoppedAt ? 
                new Date(sampleExecution.stoppedAt).getTime() - new Date(sampleExecution.startedAt).getTime() : null,
              sampleExecution.finished ? 1 : 0,
              JSON.stringify({ originalData: sampleExecution })
            ], (err) => err ? reject(err) : resolve());
          });
          
          console.log('✅ Sample execution inserted');
          
          // Test executions API again
          console.log('\n🔍 Testing executions API after insert...');
          const newExecResponse = await fetch('http://localhost:3000/api/executions?timeRange=24h');
          const newExecData = await newExecResponse.text();
          console.log('New executions response:', newExecData.substring(0, 500) + '...');
        }
      } else {
        console.log(`❌ n8n API failed: ${n8nResponse.status} ${n8nResponse.statusText}`);
      }
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSync();