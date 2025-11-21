import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { z } from 'zod';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

// ... (skipping interfaces)

// ... inside ConfigManager class


export interface ConfigItem {
  key: string;
  value: string;
  value_type: 'string' | 'number' | 'boolean' | 'json' | 'encrypted';
  category: string;
  description?: string;
  is_sensitive: boolean;
  is_readonly: boolean;
  validation_rules?: string;
  updated_at: string;
  category_display_name?: string;
  category_icon?: string;
}

export interface ConfigCategory {
  name: string;
  display_name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_system: boolean;
}

export interface ConfigAuditEntry {
  configKey: string;
  oldValue?: string;
  newValue: string;
  changedBy: string;
  changeReason?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ConfigUpdateOptions {
  changedBy?: string;
  changeReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Secure configuration management system for Elova
 * Handles reading, writing, validation, and encryption of configuration values
 */
export class ConfigManager {
  private db: Database | null = null;
  private encryptionKey: string | null = null;
  private isInitialized = false;

  /**
   * Get the default database path based on environment
   */
  static getDefaultDatabasePath(): string {
    if (process.env.NODE_ENV === 'development') {
      return path.join(process.cwd(), 'data', 'elova.db');
    }
    // For build time, use a temp path that won't cause issues
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
      return path.join(process.cwd(), 'data', 'elova.db');
    }
    return '/app/data/elova.db';
  }

  constructor(private databasePath: string = ConfigManager.getDefaultDatabasePath()) {
    // Skip initialization during build phase
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return;
    }

    // Ensure the database directory exists
    const dbDir = path.dirname(databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (this.db === null) {
      this.db = new Database(databasePath);
      // Try to reduce lock contention
      try {
        const anyDb = this.db as any;
        if (typeof anyDb.configure === 'function') {
          anyDb.configure('busyTimeout', 5000);
        }
      } catch { }
      this.encryptionKey = this.getOrCreateEncryptionKey();
    }
  }

  /**
   * Initialize the configuration system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      // Apply pragmas to improve concurrency and stability
      await this.executeSql(`
        PRAGMA journal_mode=WAL;
        PRAGMA busy_timeout=5000;
        PRAGMA synchronous=NORMAL;
        PRAGMA foreign_keys=ON;
      `);

      // Always ensure complete schema exists
      const hasCompleteSchema = await this.hasSchema();
      if (!hasCompleteSchema) {
        console.log('ConfigManager: schema incomplete – running migration');
        const migrationSql = await this.loadMigrationFile();
        await this.executeSql(migrationSql);
        console.log('ConfigManager: migration completed');
      }

      // Always ensure the config_view exists (critical for operation)
      await this.ensureConfigView();

      // Drop legacy timestamp trigger if present (we set updated_at explicitly)
      await this.executeSql('DROP TRIGGER IF EXISTS tr_app_config_updated_at;');

      // Ensure encryption key is set
      await this.ensureEncryptionKey();

      this.isInitialized = true;
      console.log('Configuration system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize configuration system:', error);
      throw error;
    }
  }

  /**
   * Get a configuration value by key
   */
  async get<T = string>(key: string): Promise<T | null> {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return null as T;
    }

    if (!this.db) {
      return Promise.resolve(null as T);
    }

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM config_view WHERE key = ?',
        [key],
        (err, row: ConfigItem) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          try {
            const value = this.deserializeValue(row.value, row.value_type);
            resolve(value as T);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Get multiple configuration values by keys
   */
  async getMany(keys: string[]): Promise<Record<string, any>> {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return Promise.resolve({});
    }

    if (!this.db) {
      return Promise.resolve({});
    }

    return new Promise((resolve, reject) => {
      const placeholders = keys.map(() => '?').join(',');
      this.db!.all(
        `SELECT * FROM config_view WHERE key IN (${placeholders})`,
        keys,
        (err, rows: ConfigItem[]) => {
          if (err) {
            reject(err);
            return;
          }

          const result: Record<string, any> = {};
          for (const row of rows) {
            try {
              result[row.key] = this.deserializeValue(row.value, row.value_type);
            } catch (error) {
              console.error(`Error deserializing config key ${row.key}:`, error);
              result[row.key] = null;
            }
          }

          resolve(result);
        }
      );
    });
  }

  /**
   * Get all configuration values in a category
   */
  async getByCategory(category: string): Promise<Record<string, any>> {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return Promise.resolve({});
    }

    if (!this.db) {
      return Promise.resolve({});
    }

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM config_view WHERE category = ? ORDER BY key',
        [category],
        (err, rows: ConfigItem[]) => {
          if (err) {
            reject(err);
            return;
          }

          const result: Record<string, any> = {};
          for (const row of rows) {
            try {
              result[row.key] = this.deserializeValue(row.value, row.value_type);
            } catch (error) {
              console.error(`Error deserializing config key ${row.key}:`, error);
              result[row.key] = null;
            }
          }

          resolve(result);
        }
      );
    });
  }

  /**
   * Set a configuration value
   */
  async set(
    key: string,
    value: any,
    options: ConfigUpdateOptions = {}
  ): Promise<void> {
    // First, get the current configuration to check if it's readonly and for audit
    const current = await this.getConfigItem(key);

    if (current?.is_readonly) {
      throw new Error(`Configuration key "${key}" is readonly and cannot be modified`);
    }

    // Validate the new value
    if (current?.validation_rules) {
      await this.validateValue(value, current.validation_rules);
    }

    // Serialize and potentially encrypt the value
    const serializedValue = this.serializeValue(value, current?.value_type || 'string');

    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return Promise.resolve();
    }

    if (!this.db) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const updateSql = `
        UPDATE app_config 
        SET value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE key = ?
      `;

      this.db!.run(
        updateSql,
        [serializedValue, options.changedBy || 'system', key],
        // Using regular function to access SQLite RunResult properties
        function (this: any, err: Error | null) {
          if (err) {
            reject(err);
            return;
          }

          if (this.changes === 0) {
            reject(new Error(`Configuration key "${key}" not found`));
            return;
          }

          resolve();
        }
      );
    });
  }

  /**
   * Get all configuration categories
   */
  async getCategories(): Promise<ConfigCategory[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return Promise.resolve([]);
    }

    if (!this.db) {
      return Promise.resolve([]);
    }

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM config_categories ORDER BY sort_order, name',
        [],
        (err, rows: ConfigCategory[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });
  }

  /**
   * Get all configuration items for admin interface
   */
  async getAllConfig(): Promise<ConfigItem[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return Promise.resolve([]);
    }

    if (!this.db) {
      return Promise.resolve([]);
    }

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM config_view ORDER BY category_icon, key',
        [],
        (err, rows: ConfigItem[]) => {
          if (err) {
            reject(err);
            return;
          }

          // Don't expose sensitive values in admin interface
          const sanitized = rows.map(row => ({
            ...row,
            value: row.is_sensitive ? '***HIDDEN***' : row.value
          }));

          resolve(sanitized);
        }
      );
    });
  }

  /**
   * Get configuration audit log
   */
  async getAuditLog(limit = 100): Promise<ConfigAuditEntry[]> {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return Promise.resolve([]);
    }

    if (!this.db) {
      return Promise.resolve([]);
    }

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM config_audit_log ORDER BY created_at DESC LIMIT ?',
        [limit],
        (err, rows: ConfigAuditEntry[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });
  }

  /**
   * Create or update a configuration key
   */
  async upsert(
    key: string,
    value: any,
    valueType: ConfigItem['value_type'] = 'string',
    category = 'general',
    description?: string,
    isSensitive = false,
    isReadonly = false,
    validationRules?: string,
    options: ConfigUpdateOptions = {}
  ): Promise<void> {
    const serializedValue = this.serializeValue(value, valueType);

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO app_config 
        (key, value, value_type, category, description, is_sensitive, is_readonly, validation_rules, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(
        sql,
        [key, serializedValue, valueType, category, description, isSensitive, isReadonly, validationRules, options.changedBy || 'system'],
        function (err) {
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
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    const migrationSql = await this.loadMigrationFile();

    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return Promise.resolve();
    }

    if (!this.db) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run('DELETE FROM app_config');
        this.db!.run('DELETE FROM config_categories');
        this.db!.exec(migrationSql, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (!this.db) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.db!.close(() => {
        resolve();
      });
    });
  }

  // Private helper methods

  private async getConfigItem(key: string): Promise<ConfigItem | null> {
    if (!this.db) {
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT * FROM config_view WHERE key = ?',
        [key],
        (err, row: ConfigItem) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || null);
          }
        }
      );
    });
  }

  private serializeValue(value: any, valueType: ConfigItem['value_type']): string {
    switch (valueType) {
      case 'string':
        return String(value);
      case 'number':
        return String(Number(value));
      case 'boolean':
        return String(Boolean(value));
      case 'json':
        return JSON.stringify(value);
      case 'encrypted':
        return this.encrypt(String(value));
      default:
        return String(value);
    }
  }

  private deserializeValue(value: string, valueType: ConfigItem['value_type']): any {
    switch (valueType) {
      case 'string':
        return value;
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true' || value === '1';
      case 'json':
        return JSON.parse(value);
      case 'encrypted':
        return this.decrypt(value);
      default:
        return value;
    }
  }

  private encrypt(text: string): string {
    if (!text || !this.encryptionKey) return text;

    // Use a fixed IV for compatibility with the simple string key we have
    // In a real app, we should store the IV with the data
    const iv = Buffer.alloc(16, 0);
    const key = createHash('sha256').update(this.encryptionKey).digest(); // Ensure 32 bytes

    const cipher = createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return encrypted;
  }

  private decrypt(encryptedText: string): string {
    if (!encryptedText || !this.encryptionKey) return encryptedText;

    try {
      const iv = Buffer.alloc(16, 0);
      const key = createHash('sha256').update(this.encryptionKey).digest();

      const decipher = createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt value:', error);
      return encryptedText;
    }
  }

  private getOrCreateEncryptionKey(): string {
    // In production, this should come from a secure source
    const keyFile = path.join(path.dirname(this.databasePath), '.encryption-key');

    try {
      if (fs.existsSync(keyFile)) {
        return fs.readFileSync(keyFile, 'utf8').trim();
      } else {
        const key = randomBytes(32).toString('hex');
        fs.writeFileSync(keyFile, key, { mode: 0o600 });
        return key;
      }
    } catch (error) {
      // Fallback to environment-based key
      return process.env.ELOVA_ENCRYPTION_KEY || createHash('sha256')
        .update(process.env.HOSTNAME || 'elova-default-key')
        .digest('hex');
    }
  }

  private async ensureEncryptionKey(): Promise<void> {
    const existingKey = await this.get('database.encryption_key');
    if (!existingKey) {
      await this.upsert('database.encryption_key', this.encryptionKey, 'encrypted', 'database',
        'Database encryption key for sensitive data', true, true);
    }
  }

  private async validateValue(value: any, validationRules: string): Promise<void> {
    try {
      const rules = JSON.parse(validationRules);

      // Basic validation using Zod-like logic
      if (rules.type === 'string') {
        if (typeof value !== 'string') throw new Error('Value must be a string');
        if (rules.minLength && value.length < rules.minLength) {
          throw new Error(`Value must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          throw new Error(`Value must be at most ${rules.maxLength} characters`);
        }
        if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
          throw new Error('Value does not match required pattern');
        }
        if (rules.format === 'email' && !value.includes('@')) {
          throw new Error('Value must be a valid email address');
        }
      } else if (rules.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) throw new Error('Value must be a number');
        if (rules.minimum !== undefined && num < rules.minimum) {
          throw new Error(`Value must be at least ${rules.minimum}`);
        }
        if (rules.maximum !== undefined && num > rules.maximum) {
          throw new Error(`Value must be at most ${rules.maximum}`);
        }
      } else if (rules.enum && !rules.enum.includes(value)) {
        throw new Error(`Value must be one of: ${rules.enum.join(', ')}`);
      }
    } catch (error) {
      throw new Error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async logConfigChange(auditData: Partial<ConfigAuditEntry>): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO config_audit_log 
        (config_key, old_value, new_value, changed_by, change_reason, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      if (!this.db) {
        resolve();
        return;
      }

      this.db.run(
        sql,
        [
          auditData.configKey,
          auditData.oldValue,
          auditData.newValue,
          auditData.changedBy || 'system',
          auditData.changeReason,
          auditData.ipAddress,
          auditData.userAgent
        ],
        (err) => {
          if (err) {
            console.error('Failed to log config change:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  private async loadMigrationFile(): Promise<string> {
    const migrationPath = path.join(process.cwd(), 'database/migrations/001_create_configuration_tables.sql');
    return fs.readFileSync(migrationPath, 'utf8');
  }

  private async executeSql(sql: string): Promise<void> {
    if (!this.db) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.db!.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async hasSchema(): Promise<boolean> {
    if (!this.db) return false;
    return new Promise((resolve) => {
      // Check for both required table and view
      this.db!.get(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE (type='table' AND name='app_config') OR (type='view' AND name='config_view')",
        [],
        (err, row: any) => {
          if (err) {
            resolve(false);
            return;
          }
          // Both table and view should exist (count = 2)
          resolve(row && row.count >= 2);
        }
      );
    });
  }

  /**
   * Ensure the config_view exists - critical for all config operations
   */
  private async ensureConfigView(): Promise<void> {
    const viewSql = `
      CREATE VIEW IF NOT EXISTS config_view AS
      SELECT 
        c.key,
        c.value,
        c.value_type,
        c.category,
        c.description,
        c.is_sensitive,
        c.is_readonly,
        c.validation_rules,
        c.updated_at,
        cat.display_name as category_display_name,
        cat.icon as category_icon
      FROM app_config c
      LEFT JOIN config_categories cat ON c.category = cat.name
      ORDER BY cat.sort_order, c.key;
    `;

    await this.executeSql(viewSql);
    console.log('ConfigManager: config_view ensured');
  }
}

// Singleton instance for application use
let configManager: ConfigManager | null = null;

export function getConfigManager(databasePath?: string): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager(databasePath);
  }
  return configManager;
}

// Helper functions for common config operations
export async function getConfig<T = string>(key: string): Promise<T | null> {
  const manager = getConfigManager();
  await manager.initialize();
  return manager.get<T>(key);
}

export async function setConfig(
  key: string,
  value: any,
  options?: ConfigUpdateOptions
): Promise<void> {
  const manager = getConfigManager();
  await manager.initialize();
  return manager.set(key, value, options);
}

export async function getConfigByCategory(category: string): Promise<Record<string, any>> {
  const manager = getConfigManager();
  await manager.initialize();
  return manager.getByCategory(category);
}