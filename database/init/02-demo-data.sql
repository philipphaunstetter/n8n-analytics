-- Elova Demo Data Initialization
-- This script adds sample data for demonstration purposes
-- Only runs if ELOVA_DEMO_MODE environment variable is set to 'true'

-- This will be executed after the main schema initialization
-- The application will check the ELOVA_DEMO_MODE environment variable
-- and only populate this data if demo mode is enabled

-- Demo workflows (simulating common n8n workflow patterns)
INSERT INTO elova_app.workflows (n8n_id, name, description, active, tags, version, settings, nodes) VALUES
('demo-workflow-1', 'Daily Data Sync', 'Syncs customer data from CRM to database every day', true, '["automation", "crm", "sync"]', 1, 
 '{"timezone": "UTC", "saveDataErrorExecution": "all", "saveDataSuccessExecution": "all"}',
 '[{"id": "webhook", "name": "Webhook", "type": "n8n-nodes-base.webhook"}, {"id": "http", "name": "HTTP Request", "type": "n8n-nodes-base.httpRequest"}]'),

('demo-workflow-2', 'Email Notification System', 'Sends email notifications based on form submissions', true, '["notification", "email", "forms"]', 1,
 '{"timezone": "UTC", "saveDataErrorExecution": "all", "saveDataSuccessExecution": "all"}',
 '[{"id": "trigger", "name": "Manual Trigger", "type": "n8n-nodes-base.manualTrigger"}, {"id": "email", "name": "Send Email", "type": "n8n-nodes-base.emailSend"}]'),

('demo-workflow-3', 'API Data Processing', 'Processes API data and stores results in database', false, '["api", "processing", "database"]', 2,
 '{"timezone": "UTC", "saveDataErrorExecution": "all", "saveDataSuccessExecution": "all"}',
 '[{"id": "schedule", "name": "Schedule Trigger", "type": "n8n-nodes-base.scheduleTrigger"}, {"id": "function", "name": "Function", "type": "n8n-nodes-base.function"}]'),

('demo-workflow-4', 'Slack Alert System', 'Monitors system health and sends Slack alerts', true, '["monitoring", "slack", "alerts"]', 1,
 '{"timezone": "UTC", "saveDataErrorExecution": "all", "saveDataSuccessExecution": "all"}',
 '[{"id": "cron", "name": "Cron", "type": "n8n-nodes-base.cron"}, {"id": "slack", "name": "Slack", "type": "n8n-nodes-base.slack"}]'),

('demo-workflow-5', 'File Processing Pipeline', 'Processes uploaded files and generates reports', true, '["files", "processing", "reports"]', 1,
 '{"timezone": "UTC", "saveDataErrorExecution": "all", "saveDataSuccessExecution": "all"}',
 '[{"id": "ftp", "name": "FTP", "type": "n8n-nodes-base.ftp"}, {"id": "spreadsheet", "name": "Spreadsheet File", "type": "n8n-nodes-base.spreadsheetFile"}]');

-- Demo executions (simulating various execution patterns and outcomes)
-- Successful executions
INSERT INTO elova_app.executions (n8n_id, workflow_id, workflow_n8n_id, mode, status, started_at, finished_at, execution_time, data) 
SELECT 
    'demo-exec-' || generate_random_uuid() as n8n_id,
    w.id,
    w.n8n_id,
    'workflow',
    'success',
    NOW() - INTERVAL '1 day' + (INTERVAL '1 hour' * s.hour_offset),
    NOW() - INTERVAL '1 day' + (INTERVAL '1 hour' * s.hour_offset) + (INTERVAL '1 second' * (random() * 300 + 10)::int),
    (random() * 300000 + 10000)::int,
    '{"resultData": {"runData": {}}}'::jsonb
FROM elova_app.workflows w
CROSS JOIN (SELECT generate_series(0, 23) as hour_offset) s
WHERE w.name IN ('Daily Data Sync', 'Email Notification System', 'Slack Alert System')
AND random() > 0.3; -- 70% success rate for these workflows

-- Failed executions
INSERT INTO elova_app.executions (n8n_id, workflow_id, workflow_n8n_id, mode, status, started_at, finished_at, execution_time, error) 
SELECT 
    'demo-exec-' || generate_random_uuid() as n8n_id,
    w.id,
    w.n8n_id,
    'workflow',
    'error',
    NOW() - INTERVAL '1 day' + (INTERVAL '2 hour' * s.hour_offset),
    NOW() - INTERVAL '1 day' + (INTERVAL '2 hour' * s.hour_offset) + (INTERVAL '1 second' * (random() * 60 + 5)::int),
    (random() * 60000 + 5000)::int,
    '{"message": "Connection timeout", "stack": "Error: Connection timeout\\n    at node.execute"}'::jsonb
FROM elova_app.workflows w
CROSS JOIN (SELECT generate_series(0, 11) as hour_offset) s
WHERE w.name IN ('API Data Processing', 'File Processing Pipeline')
AND random() > 0.7; -- 30% failure rate for these workflows

-- Running executions (simulate some currently running)
INSERT INTO elova_app.executions (n8n_id, workflow_id, workflow_n8n_id, mode, status, started_at, data) 
SELECT 
    'demo-exec-' || generate_random_uuid() as n8n_id,
    w.id,
    w.n8n_id,
    'workflow',
    'running',
    NOW() - (INTERVAL '1 minute' * (random() * 30 + 1)::int),
    '{}'::jsonb
FROM elova_app.workflows w
WHERE random() > 0.8 -- Only some workflows have running executions
LIMIT 3;

-- Generate analytics data based on executions
INSERT INTO elova_app.analytics (workflow_id, date, executions_count, success_count, error_count, avg_execution_time, total_execution_time)
SELECT 
    e.workflow_id,
    DATE(e.started_at) as date,
    COUNT(*) as executions_count,
    COUNT(*) FILTER (WHERE e.status = 'success') as success_count,
    COUNT(*) FILTER (WHERE e.status = 'error') as error_count,
    AVG(e.execution_time)::int as avg_execution_time,
    SUM(e.execution_time)::int as total_execution_time
FROM elova_app.executions e
WHERE e.started_at IS NOT NULL
GROUP BY e.workflow_id, DATE(e.started_at);

-- Add demo sync logs
INSERT INTO elova_app.sync_logs (type, status, message, details, started_at, finished_at, duration) VALUES
('workflows', 'completed', 'Successfully synced 5 workflows from n8n', '{"synced": 5, "created": 5, "updated": 0}', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '30 seconds', 30000),
('executions', 'completed', 'Synced execution data for the last 24 hours', '{"synced": 150, "created": 150, "skipped": 0}', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '45 seconds', 45000),
('workflows', 'completed', 'Regular workflow metadata sync', '{"synced": 5, "created": 0, "updated": 2}', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours' + INTERVAL '15 seconds', 15000),
('executions', 'failed', 'Failed to connect to n8n instance', '{"error": "Connection refused", "retry_count": 3}', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '5 seconds', 5000);

-- Update configuration to indicate demo data is loaded
INSERT INTO elova_config.settings (key, value, category, description) VALUES
('demo.data_loaded', 'true', 'system', 'Demo data has been loaded'),
('demo.loaded_at', to_jsonb(NOW()::text), 'system', 'When demo data was loaded'),
('demo.version', '"1.0.0"', 'system', 'Demo data version')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();

-- Helper function to generate random UUIDs for demo data
CREATE OR REPLACE FUNCTION generate_random_uuid() RETURNS TEXT AS $$
BEGIN
    RETURN SUBSTRING(MD5(random()::text), 1, 8) || '-' || 
           SUBSTRING(MD5(random()::text), 1, 4) || '-' || 
           '4' || SUBSTRING(MD5(random()::text), 1, 3) || '-' ||
           SUBSTRING(MD5(random()::text), 1, 4) || '-' ||
           SUBSTRING(MD5(random()::text), 1, 12);
END;
$$ LANGUAGE plpgsql;

-- Note: This demo data provides a realistic testing environment
-- with various workflow types, execution patterns, and analytics data
-- that mirrors what users would see in a real Elova deployment monitoring n8n instances