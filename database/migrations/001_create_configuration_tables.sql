-- Configuration Management Tables for Elova
-- This migration creates a secure, flexible configuration system

-- Main configuration table for key-value storage
CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'encrypted')),
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    is_readonly BOOLEAN NOT NULL DEFAULT FALSE,
    validation_rules TEXT, -- JSON schema for validation
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT DEFAULT 'system'
);

-- Configuration categories for organization
CREATE TABLE IF NOT EXISTS config_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configuration change audit log
CREATE TABLE IF NOT EXISTS config_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT NOT NULL DEFAULT 'system',
    change_reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (config_key) REFERENCES app_config(key) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(key);
CREATE INDEX IF NOT EXISTS idx_app_config_category ON app_config(category);
CREATE INDEX IF NOT EXISTS idx_config_audit_log_key ON config_audit_log(config_key);
CREATE INDEX IF NOT EXISTS idx_config_audit_log_created_at ON config_audit_log(created_at);


-- Insert default configuration categories
INSERT OR IGNORE INTO config_categories (name, display_name, description, icon, sort_order, is_system) VALUES
    ('general', 'General', 'General application settings', 'settings', 0, FALSE),
    ('database', 'Database', 'Database connection and settings', 'database', 1, TRUE),
    ('authentication', 'Authentication', 'User authentication and security', 'shield', 2, TRUE),
    ('features', 'Features', 'Application feature toggles', 'toggle', 3, TRUE),
    ('notifications', 'Notifications', 'Email, webhook, and notification settings', 'bell', 4, FALSE),
    ('integration', 'Integrations', 'Third-party service integrations', 'plug', 5, FALSE),
    ('appearance', 'Appearance', 'UI theme and display preferences', 'palette', 6, FALSE),
    ('advanced', 'Advanced', 'Advanced system configuration', 'settings', 7, TRUE);

-- Insert default configuration values
INSERT OR IGNORE INTO app_config (key, value, value_type, category, description, is_sensitive, is_readonly, validation_rules) VALUES
    -- Database configuration
    ('database.type', 'sqlite', 'string', 'database', 'Database type (sqlite, supabase, postgresql)', FALSE, FALSE, '{"enum": ["sqlite", "supabase", "postgresql"]}'),
    ('database.path', '/app/data/elova.db', 'string', 'database', 'SQLite database file path', FALSE, TRUE, '{"type": "string", "minLength": 1}'),
    ('database.encryption_key', '', 'encrypted', 'database', 'Database encryption key for sensitive data', TRUE, FALSE, '{"type": "string", "minLength": 32}'),
    
    -- Authentication configuration
    ('auth.provider', 'dev', 'string', 'authentication', 'Authentication provider', FALSE, FALSE, '{"enum": ["dev", "supabase", "oauth"]}'),
    ('auth.development_mode', 'true', 'boolean', 'authentication', 'Enable development mode authentication', FALSE, FALSE, '{"type": "boolean"}'),
    ('auth.session_timeout', '86400', 'number', 'authentication', 'Session timeout in seconds', FALSE, FALSE, '{"type": "number", "minimum": 300, "maximum": 604800}'),
    ('auth.require_email_verification', 'false', 'boolean', 'authentication', 'Require email verification for new accounts', FALSE, FALSE, '{"type": "boolean"}'),
    
    -- Feature flags
    ('features.sync_enabled', 'true', 'boolean', 'features', 'Enable automatic data synchronization', FALSE, FALSE, '{"type": "boolean"}'),
    ('features.sync_interval_minutes', '5', 'number', 'features', 'Data sync interval in minutes', FALSE, FALSE, '{"type": "number", "minimum": 1, "maximum": 1440}'),
    ('features.demo_mode', 'false', 'boolean', 'features', 'Enable demo mode with sample data', FALSE, FALSE, '{"type": "boolean"}'),
    ('features.analytics_enabled', 'true', 'boolean', 'features', 'Enable usage analytics collection', FALSE, FALSE, '{"type": "boolean"}'),
    ('features.export_enabled', 'true', 'boolean', 'features', 'Enable data export functionality', FALSE, FALSE, '{"type": "boolean"}'),
    
    -- Application settings
    ('app.name', 'Elova', 'string', 'general', 'Application display name', FALSE, FALSE, '{"type": "string", "minLength": 1, "maxLength": 50}'),
    ('app.version', '1.0.0', 'string', 'general', 'Application version', FALSE, TRUE, '{"type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+"}'),
    ('app.timezone', 'UTC', 'string', 'general', 'Default application timezone', FALSE, FALSE, '{"type": "string", "minLength": 1}'),
    ('app.log_level', 'info', 'string', 'advanced', 'Application log level', FALSE, FALSE, '{"enum": ["debug", "info", "warn", "error"]}'),
    ('app.max_file_upload_mb', '10', 'number', 'advanced', 'Maximum file upload size in MB', FALSE, FALSE, '{"type": "number", "minimum": 1, "maximum": 100}'),
    
    -- Security settings
    ('security.cors_origins', '["http://localhost:3000"]', 'json', 'advanced', 'Allowed CORS origins', FALSE, FALSE, '{"type": "array", "items": {"type": "string"}}'),
    ('security.rate_limit_requests_per_minute', '100', 'number', 'advanced', 'API rate limit requests per minute', FALSE, FALSE, '{"type": "number", "minimum": 10, "maximum": 1000}'),
    ('security.password_min_length', '8', 'number', 'authentication', 'Minimum password length', FALSE, FALSE, '{"type": "number", "minimum": 6, "maximum": 128}'),
    
    -- Integration settings
    ('integrations.n8n.url', '', 'string', 'integration', 'n8n instance URL for workflow integration', FALSE, FALSE, '{"type": "string", "format": "url"}'),
    ('integrations.n8n.api_key', '', 'encrypted', 'integration', 'n8n API key for workflow integration', TRUE, FALSE, '{"type": "string", "minLength": 1}'),
    ('integrations.webhook.secret', '', 'encrypted', 'integration', 'Webhook signature secret', TRUE, FALSE, '{"type": "string", "minLength": 16}'),
    
    -- Notification settings
    ('notifications.email.enabled', 'false', 'boolean', 'notifications', 'Enable email notifications', FALSE, FALSE, '{"type": "boolean"}'),
    ('notifications.email.provider', 'smtp', 'string', 'notifications', 'Email provider (smtp, resend)', FALSE, FALSE, '{"enum": ["smtp", "resend"]}'),
    ('notifications.email.resend_api_key', '', 'encrypted', 'notifications', 'Resend API key for email delivery', TRUE, FALSE, '{"type": "string"}'),
    ('notifications.email.from_name', '', 'string', 'notifications', 'Email sender display name', FALSE, FALSE, '{"type": "string"}'),
    ('notifications.email.smtp_host', '', 'string', 'notifications', 'SMTP server hostname', FALSE, FALSE, '{"type": "string"}'),
    ('notifications.email.smtp_port', '587', 'number', 'notifications', 'SMTP server port', FALSE, FALSE, '{"type": "number", "minimum": 1, "maximum": 65535}'),
    ('notifications.email.smtp_user', '', 'string', 'notifications', 'SMTP username', FALSE, FALSE, '{"type": "string"}'),
    ('notifications.email.smtp_password', '', 'encrypted', 'notifications', 'SMTP password', TRUE, FALSE, '{"type": "string"}'),
    ('notifications.email.from_address', '', 'string', 'notifications', 'Email sender address', FALSE, FALSE, '{"type": "string", "format": "email"}'),
    
    -- UI/Appearance settings
    ('ui.theme', 'light', 'string', 'appearance', 'Default UI theme', FALSE, FALSE, '{"enum": ["light", "dark", "auto"]}'),
    ('ui.default_page_size', '25', 'number', 'appearance', 'Default number of items per page', FALSE, FALSE, '{"type": "number", "minimum": 5, "maximum": 100}'),
    ('ui.show_advanced_options', 'false', 'boolean', 'appearance', 'Show advanced options by default', FALSE, FALSE, '{"type": "boolean"}');

-- Create a view for easier configuration queries
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