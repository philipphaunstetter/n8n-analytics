import { Database } from 'sqlite3'
import { ConfigManager } from '@/lib/config/config-manager'

let db: Database | null = null

// Migration to add AI metrics columns to executions table
function migrateAIMetrics(database: Database) {
  database.serialize(() => {
    // Check if columns already exist by attempting to add them
    // SQLite will ignore if columns already exist with IF NOT EXISTS equivalent
    const migrations = [
      'ALTER TABLE executions ADD COLUMN execution_data TEXT DEFAULT NULL',
      'ALTER TABLE executions ADD COLUMN total_tokens INTEGER DEFAULT 0',
      'ALTER TABLE executions ADD COLUMN input_tokens INTEGER DEFAULT 0',
      'ALTER TABLE executions ADD COLUMN output_tokens INTEGER DEFAULT 0',
      'ALTER TABLE executions ADD COLUMN ai_cost REAL DEFAULT 0.0',
      'ALTER TABLE executions ADD COLUMN ai_provider TEXT DEFAULT NULL'
    ]

    migrations.forEach(sql => {
      database.run(sql, (err) => {
        // Ignore "duplicate column" errors - means migration already ran
        if (err && !err.message.includes('duplicate column')) {
          console.error('Migration error:', err.message)
        }
      })
    })
  })
}

// Ensure core analytics tables exist (idempotent)
function ensureSchema(database: Database) {
  database.serialize(() => {
    database.run(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        is_connected BOOLEAN DEFAULT 1,
        status TEXT DEFAULT 'healthy',
        last_checked_at TEXT,
        metadata TEXT DEFAULT '{}'
      )
    `)

    database.run(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        provider_id TEXT,
        provider_workflow_id TEXT,
        name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        is_archived BOOLEAN DEFAULT 0,
        tags TEXT DEFAULT '[]',
        node_count INTEGER DEFAULT 0,
        workflow_data TEXT,
        cron_schedules TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES providers (id) ON DELETE CASCADE
      )
    `)

    database.run(`
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        provider_id TEXT,
        workflow_id TEXT,
        provider_execution_id TEXT UNIQUE,
        provider_workflow_id TEXT,
        status TEXT,
        mode TEXT,
        started_at TEXT,
        stopped_at TEXT,
        duration INTEGER,
        finished BOOLEAN,
        retry_of TEXT,
        retry_success_id TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES providers (id) ON DELETE CASCADE,
        FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
      )
    `)

    database.run(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id TEXT PRIMARY KEY,
        provider_id TEXT,
        sync_type TEXT,
        status TEXT,
        completed_at TEXT,
        records_processed INTEGER DEFAULT 0,
        records_inserted INTEGER DEFAULT 0,
        records_updated INTEGER DEFAULT 0,
        error_message TEXT,
        metadata TEXT DEFAULT '{}',
        last_cursor TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES providers (id) ON DELETE CASCADE
      )
    `)
  })
}

// Apply pragmas and timeouts for better stability
function configureDatabase(database: Database) {
  try {
    const anyDb = database as any
    if (typeof anyDb.configure === 'function') {
      anyDb.configure('busyTimeout', 5000)
    }
  } catch {}

  database.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
    PRAGMA foreign_keys=ON;
  `)
}

export function getDb(): Database {
  if (!db) {
    const dbPath = ConfigManager.getDefaultDatabasePath()
    db = new Database(dbPath)
    configureDatabase(db)
    ensureSchema(db)
    migrateAIMetrics(db)
  }
  return db
}

export function isMissingTableError(err: unknown): boolean {
  return !!(err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string' && /no such table/i.test((err as any).message))
}
