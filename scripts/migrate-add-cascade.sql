-- Migration: Add CASCADE delete to foreign keys
-- SQLite doesn't support ALTER TABLE for foreign keys, so we need to recreate tables

-- Start transaction
BEGIN TRANSACTION;

-- 1. Backup existing data
CREATE TABLE workflows_backup AS SELECT * FROM workflows;
CREATE TABLE executions_backup AS SELECT * FROM executions;
CREATE TABLE sync_logs_backup AS SELECT * FROM sync_logs;

-- 2. Drop old tables
DROP TABLE IF EXISTS sync_logs;
DROP TABLE IF EXISTS executions;
DROP TABLE IF EXISTS workflows;

-- 3. Recreate tables with CASCADE
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  provider_id TEXT,
  provider_workflow_id TEXT,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  is_archived BOOLEAN DEFAULT 0,
  tags TEXT DEFAULT '[]',
  node_count INTEGER DEFAULT 0,
  workflow_data TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES providers (id) ON DELETE CASCADE
);

CREATE TABLE executions (
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
);

CREATE TABLE sync_logs (
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
);

-- 4. Restore data
INSERT INTO workflows SELECT * FROM workflows_backup;
INSERT INTO executions SELECT * FROM executions_backup;
INSERT INTO sync_logs SELECT * FROM sync_logs_backup;

-- 5. Drop backup tables
DROP TABLE workflows_backup;
DROP TABLE executions_backup;
DROP TABLE sync_logs_backup;

-- Commit transaction
COMMIT;

-- Verify
SELECT 'Migration completed successfully' as status;
