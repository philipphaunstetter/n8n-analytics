#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// Get n8n config from the database
function getN8nConfig() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('./data/elova.db');
    
    db.all("SELECT key, value, is_encrypted FROM app_config WHERE key LIKE '%n8n%'", (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      const config = {};
      rows.forEach(row => {
        if (row.is_encrypted) {
          // For demo purposes, we'll just note it's encrypted
          config[row.key] = '[ENCRYPTED]';
        } else {
          config[row.key] = row.value;
        }
      });
      
      db.close();
      resolve(config);
    });
  });
}

async function testN8nEndpoints() {
  try {
    const config = await getN8nConfig();
    console.log('n8n Configuration:', config);
    
    const host = config['integrations.n8n.url'];
    console.log('\nTesting n8n endpoints on:', host);
    
    // Note: We can't decrypt the API key from Node.js easily, 
    // so this is just to show the concept
    console.log('\n⚠️  API Key is encrypted in database - cannot test endpoints directly from this script');
    console.log('   You would need to make requests through the Elova app which has decryption capability');
    
    // Common n8n API endpoints to try:
    const endpointsToTest = [
      '/api/v1/workflows',
      '/api/v1/executions', 
      '/api/v1/executions/current',
      '/api/v1/workflow-executions',
      '/rest/workflows',
      '/rest/executions',
      '/webhook-test/workflow-executions'
    ];
    
    console.log('\nEndpoints that should be tested (through Elova app):');
    endpointsToTest.forEach(endpoint => {
      console.log(`  ${host}${endpoint}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testN8nEndpoints();