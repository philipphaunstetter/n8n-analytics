import { createHash, randomBytes, createCipherGCM, createDecipherGCM } from 'crypto';
import { z } from 'zod';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';

export interface ConfigItem {
  key: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'json' | 'encrypted';
  category: string;
  description?: string;
  isSensitive: boolean;
  isReadonly: boolean;
  validationRules?: string;
  updatedAt: string;
  categoryDisplayName?: string;
  categoryIcon?: string;
}

export interface ConfigCategory {
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isSystem: boolean;
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
  private db: Database;
  private encryptionKey: string;
  private isInitialized = false;

  /**
   * Get the default database path based on environment
   */
  static getDefaultDatabasePath(): string {
    if (process.env.NODE_ENV === 'development') {
      return path.join(process.cwd(), 'data', 'elova.db');
    }
    return '/app/data/elova.db';
  }

  constructor(private databasePath: string = ConfigManager.getDefaultDatabasePath()) {
    // Ensure the database directory exists
    const dbDir = path.dirname(databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(databasePath);
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  /**
   * Initialize the configuration system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Run the configuration migration
      const migrationSql = await this.loadMigrationFile();
      await this.executeSql(migrationSql);
      
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
    return new Promise((resolve, reject) => {
      this.db.get(
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
            const value = this.deserializeValue(row.value, row.valueType);
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
    return new Promise((resolve, reject) => {
      const placeholders = keys.map(() => '?').join(',');
      this.db.all(
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
              result[row.key] = this.deserializeValue(row.value, row.valueType);
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
    return new Promise((resolve, reject) => {
      this.db.all(
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
              result[row.key] = this.deserializeValue(row.value, row.valueType);
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
    
    if (current?.isReadonly) {
      throw new Error(`Configuration key "${key}" is readonly and cannot be modified`);
    }

    // Validate the new value
    if (current?.validationRules) {
      await this.validateValue(value, current.validationRules);
    }

    // Serialize and potentially encrypt the value
    const serializedValue = this.serializeValue(value, current?.valueType || 'string');

    return new Promise((resolve, reject) => {
      const updateSql = `
        UPDATE app_config 
        SET value = ?, updated_by = ?
        WHERE key = ?
      `;

      this.db.run(
        updateSql,
        [serializedValue, options.changedBy || 'system', key],
        (err: Error | null, result: any) => {
          if (err) {
            reject(err);
            return;
          }

          if ((result as any).changes === 0) {
            reject(new Error(`Configuration key "${key}" not found`));
            return;
          }

          // Log the change for audit
          const auditData = {
            configKey: key,
            oldValue: current?.value,
            newValue: serializedValue,
            changedBy: options.changedBy || 'system',
            changeReason: options.changeReason,
            ipAddress: options.ipAddress,
            userAgent: options.userAgent
          };

          this.logConfigChange(auditData).catch(console.error);
          resolve();
        }
      );
    });
  }

  /**
   * Get all configuration categories
   */
  async getCategories(): Promise<ConfigCategory[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
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
    return new Promise((resolve, reject) => {
      this.db.all(
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
            value: row.isSensitive ? '***HIDDEN***' : row.value
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
    return new Promise((resolve, reject) => {
      this.db.all(
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
    valueType: ConfigItem['valueType'] = 'string',
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

      this.db.run(
        sql,
        [key, serializedValue, valueType, category, description, isSensitive, isReadonly, validationRules, options.changedBy || 'system'],
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
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    const migrationSql = await this.loadMigrationFile();
    
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('DELETE FROM app_config');
        this.db.run('DELETE FROM config_categories');
        this.db.exec(migrationSql, (err) => {
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
    return new Promise((resolve) => {
      this.db.close(() => {
        resolve();
      });
    });
  }

  // Private helper methods

  private async getConfigItem(key: string): Promise<ConfigItem | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
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

  private serializeValue(value: any, valueType: ConfigItem['valueType']): string {
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

  private deserializeValue(value: string, valueType: ConfigItem['valueType']): any {
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
    if (!text) return text;
    
    // Generate a random IV for each encryption
    const iv = randomBytes(16);
    const cipher = createCipherGCM('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'), iv);
    cipher.setAAD(Buffer.from('elova-config', 'utf8'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + auth tag + encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;
    
    try {
      // Split the combined string: IV:authTag:encryptedData
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = createDecipherGCM('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'), iv);
      decipher.setAAD(Buffer.from('elova-config', 'utf8'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
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
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
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