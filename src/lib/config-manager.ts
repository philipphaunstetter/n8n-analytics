/**
 * ConfigManager - Database-based configuration management
 * 
 * Stores all application configuration in SQLite database instead of .env files
 * Provides a clean interface for reading/writing configuration values
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

interface ConfigValue {
  key: string;
  value: string | null;
  encrypted: boolean;
  category: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export class ConfigManager {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Default to the same database file used by the Docker init script
    this.dbPath = dbPath || process.env.DB_PATH || '/app/data/elova.db';
    
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(this.dbPath);
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));
    
    // Create config table if it doesn't exist (same as docker-init.sh)
    await run(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        encrypted BOOLEAN DEFAULT 0,
        category TEXT DEFAULT 'general',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create trigger for updated_at
    await run(`
      CREATE TRIGGER IF NOT EXISTS update_config_timestamp 
        AFTER UPDATE ON config
        BEGIN
          UPDATE config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
    `);
  }

  /**
   * Get a configuration value by key
   */
  async get(key: string): Promise<string | null> {
    const query = promisify(this.db.get.bind(this.db));
    const result = await query('SELECT value FROM config WHERE key = ?', [key]) as ConfigValue | undefined;
    return result?.value || null;
  }

  /**
   * Set a configuration value
   */
  async set(key: string, value: string, category: string = 'general', description?: string): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));
    await run(
      `INSERT OR REPLACE INTO config (key, value, category, description) 
       VALUES (?, ?, ?, ?)`,
      [key, value, category, description]
    );
  }

  /**
   * Get all configuration values for a category
   */
  async getCategory(category: string): Promise<Record<string, string | null>> {
    const query = promisify(this.db.all.bind(this.db));
    const results = await query('SELECT key, value FROM config WHERE category = ?', [category]) as ConfigValue[];
    
    const config: Record<string, string | null> = {};
    for (const result of results) {
      config[result.key] = result.value;
    }
    return config;
  }

  /**
   * Get all configuration values
   */
  async getAll(): Promise<Record<string, string | null>> {
    const query = promisify(this.db.all.bind(this.db));
    const results = await query('SELECT key, value FROM config') as ConfigValue[];
    
    const config: Record<string, string | null> = {};
    for (const result of results) {
      config[result.key] = result.value;
    }
    return config;
  }

  /**
   * Check if this is the first run (setup needed)
   */
  async isFirstRun(): Promise<boolean> {
    const setupCompleted = await this.get('setup.completed');
    const firstRun = await this.get('app.first_run');
    return setupCompleted !== 'true' || firstRun === 'true';
  }

  /**
   * Mark setup as completed
   */
  async markSetupCompleted(): Promise<void> {
    await this.set('setup.completed', 'true', 'setup');
    await this.set('app.first_run', 'false', 'system');
  }

  /**
   * Get n8n configuration
   */
  async getN8nConfig(): Promise<{ host: string | null; apiKey: string | null }> {
    const host = await this.get('n8n.host');
    const apiKey = await this.get('n8n.api_key');
    return { host, apiKey };
  }

  /**
   * Set n8n configuration
   */
  async setN8nConfig(host: string, apiKey: string): Promise<void> {
    await this.set('n8n.host', host, 'n8n', 'n8n instance URL');
    await this.set('n8n.api_key', apiKey, 'n8n', 'n8n API key');
  }

  /**
   * Check if n8n is configured
   */
  async isN8nConfigured(): Promise<boolean> {
    const config = await this.getN8nConfig();
    return !!(config.host && config.apiKey);
  }

  /**
   * Get application features
   */
  async getFeatures(): Promise<{ demoMode: boolean; analyticsEnabled: boolean }> {
    const demoMode = (await this.get('features.demo_mode')) === 'true';
    const analyticsEnabled = (await this.get('features.analytics_enabled')) === 'true';
    return { demoMode, analyticsEnabled };
  }

  /**
   * Set demo mode
   */
  async setDemoMode(enabled: boolean): Promise<void> {
    await this.set('features.demo_mode', enabled.toString(), 'features');
  }

  /**
   * Get application timezone
   */
  async getTimezone(): Promise<string> {
    return (await this.get('app.timezone')) || 'UTC';
  }

  /**
   * Set application timezone
   */
  async setTimezone(timezone: string): Promise<void> {
    await this.set('app.timezone', timezone, 'system', 'Application timezone');
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export singleton instance
let configManager: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager();
  }
  return configManager;
}