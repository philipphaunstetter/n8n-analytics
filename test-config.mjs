import { getConfigManager } from './src/lib/config-manager.js';

async function testConfig() {
  console.log('Starting config test...');
  try {
    const config = getConfigManager();
    console.log('Got config manager instance');
    
    console.log('Testing set operation...');
    await config.set('test.key', 'test-value', 'test');
    console.log('Set operation successful');
    
    console.log('Testing get operation...');
    const value = await config.get('test.key');
    console.log('Get operation result:', value);
    
    console.log('Testing n8n config...');
    await config.setN8nConfig('http://localhost:5678', 'test-api-key');
    console.log('N8n config set successfully');
    
    const n8nConfig = await config.getN8nConfig();
    console.log('N8n config retrieved:', n8nConfig);
    
    config.close();
    console.log('Config test completed successfully');
  } catch (error) {
    console.error('Config test failed:', error);
    process.exit(1);
  }
}

testConfig();
