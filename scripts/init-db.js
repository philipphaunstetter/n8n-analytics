#!/usr/bin/env node

const { ConfigManager } = require('../src/lib/config/config-manager');
const path = require('path');

async function initializeDatabase() {
  const dbPath = path.join(process.cwd(), 'data', 'elova.db');
  console.log(`Initializing database at: ${dbPath}`);
  
  try {
    const configManager = new ConfigManager(dbPath);
    await configManager.initialize();
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

initializeDatabase();