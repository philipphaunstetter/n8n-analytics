-- Execution Storage Schema
-- This migration creates tables to store n8n execution data for long-term analytics

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Providers table - stores n8n instance configurations
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- references auth.users(id)
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'n8n',
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL, -- encrypted API key
  is_connected BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'unknown', -- 'healthy', 'error', 'warning', 'unknown'
  version TEXT,
  last_checked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_provider_per_user UNIQUE (user_id, base_url)
);

-- Workflows table - stores workflow metadata
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  provider_workflow_id TEXT NOT NULL, -- n8n workflow ID
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  node_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_executed_at TIMESTAMPTZ,
  
  -- Statistics (calculated from executions)
  total_executions INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2) DEFAULT 0,
  avg_duration INTEGER DEFAULT 0, -- in milliseconds
  
  -- n8n specific data
  workflow_data JSONB DEFAULT '{}', -- stores nodes, connections, etc.
  
  CONSTRAINT unique_workflow_per_provider UNIQUE (provider_id, provider_workflow_id)
);

-- Executions table - stores execution data
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  provider_execution_id TEXT NOT NULL, -- n8n execution ID
  provider_workflow_id TEXT NOT NULL, -- n8n workflow ID (for faster queries)
  
  -- Execution details
  status TEXT NOT NULL, -- 'success', 'error', 'running', 'waiting', 'canceled'
  mode TEXT NOT NULL, -- 'manual', 'trigger', 'webhook', 'cron'
  started_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,
  duration INTEGER, -- in milliseconds
  
  -- Error information
  error_message TEXT,
  error_stack TEXT,
  error_node_id TEXT,
  error_timestamp TIMESTAMPTZ,
  
  -- Execution data (limited for privacy)
  input_data JSONB,
  output_data JSONB,
  
  -- Metadata
  retry_of TEXT, -- reference to parent execution if this is a retry
  retry_success_id TEXT,
  finished BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_execution_per_provider UNIQUE (provider_id, provider_execution_id)
);

-- Sync logs table - tracks sync operations
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'executions', 'workflows', 'full'
  status TEXT NOT NULL, -- 'running', 'success', 'error'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  last_cursor TEXT, -- for pagination
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX idx_executions_provider_id ON executions(provider_id);
CREATE INDEX idx_executions_workflow_id ON executions(workflow_id);
CREATE INDEX idx_executions_started_at ON executions(started_at DESC);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_provider_workflow_id ON executions(provider_workflow_id);

CREATE INDEX idx_workflows_provider_id ON workflows(provider_id);
CREATE INDEX idx_workflows_is_active ON workflows(is_active);
CREATE INDEX idx_workflows_last_executed_at ON workflows(last_executed_at DESC);

CREATE INDEX idx_providers_user_id ON providers(user_id);
CREATE INDEX idx_providers_status ON providers(status);

CREATE INDEX idx_sync_logs_provider_id ON sync_logs(provider_id);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at DESC);

-- Row Level Security (RLS)
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see their own providers" ON providers
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see workflows from their providers" ON workflows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM providers 
      WHERE providers.id = workflows.provider_id 
      AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can only see executions from their providers" ON executions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM providers 
      WHERE providers.id = executions.provider_id 
      AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can only see sync logs from their providers" ON sync_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM providers 
      WHERE providers.id = sync_logs.provider_id 
      AND providers.user_id = auth.uid()
    )
  );

-- Functions to update workflow statistics
CREATE OR REPLACE FUNCTION update_workflow_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update workflow statistics when executions are inserted/updated
  UPDATE workflows SET
    total_executions = (
      SELECT COUNT(*) FROM executions 
      WHERE workflow_id = COALESCE(NEW.workflow_id, OLD.workflow_id)
    ),
    success_count = (
      SELECT COUNT(*) FROM executions 
      WHERE workflow_id = COALESCE(NEW.workflow_id, OLD.workflow_id) 
      AND status = 'success'
    ),
    failure_count = (
      SELECT COUNT(*) FROM executions 
      WHERE workflow_id = COALESCE(NEW.workflow_id, OLD.workflow_id) 
      AND status IN ('error', 'failed', 'crashed')
    ),
    last_executed_at = (
      SELECT MAX(started_at) FROM executions 
      WHERE workflow_id = COALESCE(NEW.workflow_id, OLD.workflow_id)
    ),
    avg_duration = (
      SELECT AVG(duration) FROM executions 
      WHERE workflow_id = COALESCE(NEW.workflow_id, OLD.workflow_id) 
      AND duration IS NOT NULL
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.workflow_id, OLD.workflow_id);
  
  -- Update success rate
  UPDATE workflows SET
    success_rate = CASE 
      WHEN total_executions > 0 
      THEN ROUND((success_count::NUMERIC / total_executions::NUMERIC) * 100, 2)
      ELSE 0 
    END
  WHERE id = COALESCE(NEW.workflow_id, OLD.workflow_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update workflow stats
CREATE TRIGGER trigger_update_workflow_stats_insert
  AFTER INSERT ON executions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_stats();

CREATE TRIGGER trigger_update_workflow_stats_update
  AFTER UPDATE ON executions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_stats();

CREATE TRIGGER trigger_update_workflow_stats_delete
  AFTER DELETE ON executions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_stats();