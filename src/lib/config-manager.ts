/**
 * ConfigManager - Database-based configuration management
 * 
 * Stores all application configuration in SQLite database instead of .env files
 * Provides a clean interface for reading/writing configuration values
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

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
  private initPromise: Promise<void>;

  constructor(dbPath?: string) {
    // Default to the same database file used by the Docker init script
    this.dbPath = dbPath || process.env.DB_PATH || '/app/data/elova.db';
    
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(this.dbPath);
    this.initPromise = this.initializeDatabase();
  }

  private async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create config table if it doesn't exist
      this.db.run(`
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
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create trigger for updated_at
        this.db.run(`
          CREATE TRIGGER IF NOT EXISTS update_config_timestamp 
            AFTER UPDATE ON config
            BEGIN
              UPDATE config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Insert default configuration values
          this.insertDefaultConfig().then(() => {
            resolve();
          }).catch((err) => {
            reject(err);
          });
        });
      });
    });
  }

  private async insertDefaultConfig(): Promise<void> {
    const defaultConfigs = [
      { key: 'app.version', value: '0.1.0', category: 'system', description: 'Application version' },
      { key: 'app.initialized', value: 'true', category: 'system', description: 'Application initialized marker' },
      { key: 'app.first_run', value: 'true', category: 'system', description: 'First run flag - triggers setup wizard' },
      { key: 'app.timezone', value: process.env.GENERIC_TIMEZONE || 'UTC', category: 'system', description: 'Application timezone' },
      { key: 'database.type', value: 'sqlite', category: 'database', description: 'Database type' },
      { key: 'database.file', value: this.dbPath, category: 'database', description: 'SQLite database file path' },
      { key: 'features.demo_mode', value: process.env.ELOVA_DEMO_MODE === 'true' ? 'true' : 'false', category: 'features', description: 'Enable demo mode with sample data' },
      { key: 'features.analytics_enabled', value: 'true', category: 'features', description: 'Enable built-in analytics' },
      { key: 'n8n.host', value: process.env.N8N_HOST || '', category: 'n8n', description: 'n8n instance URL' },
      { key: 'n8n.api_key', value: process.env.N8N_API_KEY || '', category: 'n8n', description: 'n8n API key' },
      { key: 'sync.executions_interval', value: '15m', category: 'sync', description: 'Execution sync interval' },
      { key: 'sync.workflows_interval', value: '6h', category: 'sync', description: 'Workflow sync interval' },
      { key: 'app.initDone', value: 'false', category: 'app', description: 'Setup wizard completion status' },
    ];

    return new Promise((resolve, reject) => {
      let completed = 0;
      let hasError = false;

      if (defaultConfigs.length === 0) {
        resolve();
        return;
      }

      for (const config of defaultConfigs) {
        this.db.run(
          'INSERT OR IGNORE INTO config (key, value, category, description) VALUES (?, ?, ?, ?)',
          [config.key, config.value, config.category, config.description],
          (err) => {
            if (err && !hasError) {
              hasError = true;
              reject(err);
              return;
            }
            
            completed++;
            if (completed === defaultConfigs.length && !hasError) {
              console.log('Default configuration values inserted successfully');
              resolve();
            }
          }
        );
      }
    });
  }

  /**
   * Get a configuration value by key
   */
  async get(key: string): Promise<string | null> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      this.db.get('SELECT value FROM config WHERE key = ?', [key], (err, row: ConfigValue) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row?.value || null);
      });
    });
  }

  /**
   * Set a configuration value
   */
  async set(key: string, value: string, category: string = 'general', description?: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO config (key, value, category, description) 
         VALUES (?, ?, ?, ?)`,
        [key, value, category, description],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  /**
   * Get all configuration values for a category
   */
  async getCategory(category: string): Promise<Record<string, string | null>> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      this.db.all('SELECT key, value FROM config WHERE category = ?', [category], (err, rows: ConfigValue[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const config: Record<string, string | null> = {};
        for (const row of rows) {
          config[row.key] = row.value;
        }
        resolve(config);
      });
    });
  }

  /**
   * Get all configuration values
   */
  async getAll(): Promise<Record<string, string | null>> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      this.db.all('SELECT key, value FROM config', [], (err, rows: ConfigValue[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const config: Record<string, string | null> = {};
        for (const row of rows) {
          config[row.key] = row.value;
        }
        resolve(config);
      });
    });
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