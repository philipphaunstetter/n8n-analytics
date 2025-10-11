-- Elova Database Initialization Script
-- This script is automatically executed when the PostgreSQL container starts for the first time
-- Similar to n8n's database initialization approach

-- Create the Elova database if it doesn't exist
-- (The database is usually created by POSTGRES_DB environment variable)

-- Set proper encoding and collation
ALTER DATABASE elova SET timezone TO 'UTC';

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create configuration schema for system settings
CREATE SCHEMA IF NOT EXISTS elova_config;

-- Create configuration tables (similar to ConfigManager approach)
CREATE TABLE IF NOT EXISTS elova_config.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB,
    encrypted BOOLEAN DEFAULT false,
    category VARCHAR(100) DEFAULT 'general',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON elova_config.settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON elova_config.settings(category);

-- Insert default configuration values
INSERT INTO elova_config.settings (key, value, category, description) VALUES
('app.version', '"0.1.0"', 'system', 'Application version'),
('app.initialized', 'true', 'system', 'Database initialization marker'),
('app.timezone', '"UTC"', 'system', 'Application timezone'),
('database.type', '"postgres"', 'database', 'Database type'),
('database.initialized_at', to_jsonb(NOW()::text), 'system', 'Database initialization timestamp'),
('features.demo_mode', 'false', 'features', 'Enable demo mode with sample data'),
('features.analytics_enabled', 'true', 'features', 'Enable built-in analytics collection'),
('sync.executions_interval', '"15m"', 'sync', 'Execution sync interval'),
('sync.workflows_interval', '"6h"', 'sync', 'Workflow sync interval'),
('sync.backups_interval', '"24h"', 'sync', 'Backup sync interval')
ON CONFLICT (key) DO NOTHING;

-- Create main application tables
CREATE SCHEMA IF NOT EXISTS elova_app;

-- Workflows table (stores n8n workflow metadata)
CREATE TABLE IF NOT EXISTS elova_app.workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    n8n_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    tags JSONB DEFAULT '[]',
    version INTEGER DEFAULT 1,
    settings JSONB DEFAULT '{}',
    connections JSONB DEFAULT '{}',
    nodes JSONB DEFAULT '[]',
    static_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Executions table (stores workflow execution data)
CREATE TABLE IF NOT EXISTS elova_app.executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    n8n_id VARCHAR(255) UNIQUE,
    workflow_id UUID REFERENCES elova_app.workflows(id) ON DELETE CASCADE,
    workflow_n8n_id VARCHAR(255),
    mode VARCHAR(50) DEFAULT 'workflow',
    status VARCHAR(50) DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    execution_time INTEGER, -- in milliseconds
    data JSONB DEFAULT '{}',
    error JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics table (stores aggregated metrics)
CREATE TABLE IF NOT EXISTS elova_app.analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES elova_app.workflows(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    executions_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_execution_time INTEGER DEFAULT 0,
    total_execution_time INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync logs table (tracks synchronization status)
CREATE TABLE IF NOT EXISTS elova_app.sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL, -- 'workflows', 'executions', 'cleanup'
    status VARCHAR(50) NOT NULL, -- 'started', 'completed', 'failed'
    message TEXT,
    details JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER -- in milliseconds
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflows_n8n_id ON elova_app.workflows(n8n_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON elova_app.workflows(active);
CREATE INDEX IF NOT EXISTS idx_workflows_updated ON elova_app.workflows(updated_at);

CREATE INDEX IF NOT EXISTS idx_executions_n8n_id ON elova_app.executions(n8n_id);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON elova_app.executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON elova_app.executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_started ON elova_app.executions(started_at);
CREATE INDEX IF NOT EXISTS idx_executions_workflow_n8n ON elova_app.executions(workflow_n8n_id);

CREATE INDEX IF NOT EXISTS idx_analytics_workflow ON elova_app.analytics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON elova_app.analytics(date);
CREATE INDEX IF NOT EXISTS idx_analytics_workflow_date ON elova_app.analytics(workflow_id, date);

CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON elova_app.sync_logs(type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON elova_app.sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON elova_app.sync_logs(started_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION elova_app.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON elova_app.workflows
    FOR EACH ROW EXECUTE FUNCTION elova_app.update_updated_at_column();

CREATE TRIGGER update_executions_updated_at BEFORE UPDATE ON elova_app.executions
    FOR EACH ROW EXECUTE FUNCTION elova_app.update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at BEFORE UPDATE ON elova_app.analytics
    FOR EACH ROW EXECUTE FUNCTION elova_app.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON elova_config.settings
    FOR EACH ROW EXECUTE FUNCTION elova_app.update_updated_at_column();

-- Grant permissions to the elova user
GRANT USAGE ON SCHEMA elova_config TO elova;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA elova_config TO elova;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA elova_config TO elova;

GRANT USAGE ON SCHEMA elova_app TO elova;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA elova_app TO elova;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA elova_app TO elova;

-- Log successful initialization
INSERT INTO elova_config.settings (key, value, category, description) VALUES
('database.schema_version', '"1.0.0"', 'system', 'Database schema version'),
('database.postgres_version', to_jsonb(version()::text), 'system', 'PostgreSQL version info')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();

-- Add initial demo data if demo mode is enabled
-- This will be controlled by the application based on ELOVA_DEMO_MODE
-- The initialization script just sets up the schema