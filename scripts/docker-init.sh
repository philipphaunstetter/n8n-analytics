#!/bin/bash

# Docker initialization script for Elova
# This script runs on container startup to initialize database configuration

set -e

echo "Starting Elova initialization..."

# Check if this is the first run
FIRST_RUN_MARKER="/app/data/.initialized"
DATA_DIR="/app/data"
DB_FILE="/app/data/elova.db"

# Ensure data directory exists
mkdir -p "$DATA_DIR"

# Function to run database configuration setup
setup_database_config() {
    echo "Setting up database configuration..."
    
    # Create the database and configuration tables if they don't exist
    # This will be handled by the Node.js configuration manager on first app start
    # We just need to ensure the database file exists and is writable
    touch "$DB_FILE"
    chmod 644 "$DB_FILE"
    
    echo "Database file ready at: $DB_FILE"
}

# Function to detect database configuration from environment
detect_database_config() {
    if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
        echo "Supabase configuration detected in environment"
        echo "supabase"
    else
        echo "No external database configured, will use SQLite"
        echo "sqlite"
    fi
}

# Function to initialize SQLite configuration database
init_config_database() {
    echo "Initializing configuration database..."
    
    # Create SQLite database with configuration table if it doesn't exist
    sqlite3 "$DB_FILE" << 'EOF'
CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    encrypted BOOLEAN DEFAULT 0,
    category TEXT DEFAULT 'general',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_config_timestamp 
    AFTER UPDATE ON config
    BEGIN
        UPDATE config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Insert default configuration values
INSERT OR IGNORE INTO config (key, value, category, description) VALUES
    ('app.version', '0.1.0', 'system', 'Application version'),
    ('app.initialized', 'true', 'system', 'Application initialized marker'),
    ('app.first_run', 'true', 'system', 'First run flag - triggers setup wizard'),
    ('app.timezone', 'UTC', 'system', 'Application timezone'),
    ('database.type', 'sqlite', 'database', 'Database type'),
    ('database.file', '/app/data/elova.db', 'database', 'SQLite database file path'),
    ('features.demo_mode', 'false', 'features', 'Enable demo mode with sample data'),
    ('features.analytics_enabled', 'true', 'features', 'Enable built-in analytics'),
    ('n8n.host', '', 'n8n', 'n8n instance URL'),
    ('n8n.api_key', '', 'n8n', 'n8n API key (encrypted)'),
    ('sync.executions_interval', '15m', 'sync', 'Execution sync interval'),
    ('sync.workflows_interval', '6h', 'sync', 'Workflow sync interval'),
    ('app.initDone', 'false', 'app', 'Setup wizard completion status');
EOF

    echo "Configuration database initialized at: $DB_FILE"
}

# Function to set runtime configuration hints
set_runtime_config() {
    local db_type="$1"
    
    # Create a runtime configuration file that the Node.js app can read
    # This provides hints for initial configuration setup
    cat > "$DATA_DIR/runtime-config.json" << EOF
{
  "firstRun": $([ "$ELOVA_FIRST_RUN" = "true" ] && echo "true" || echo "false"),
  "detectedDatabaseType": "$db_type",
  "hasSupabaseEnv": $([ -n "$NEXT_PUBLIC_SUPABASE_URL" ] && echo "true" || echo "false"),
  "hasN8nConfig": $([ -n "$N8N_HOST" ] && [ -n "$N8N_API_KEY" ] && echo "true" || echo "false"),
  "containerStartTime": "$(date -Iseconds)",
  "dataDirectory": "$DATA_DIR",
  "environment": {
    "nodeEnv": "${NODE_ENV:-production}",
    "port": "${PORT:-3000}",
    "hostname": "${HOSTNAME:-0.0.0.0}",
    "demoMode": "${ELOVA_DEMO_MODE:-false}"
  }
}
EOF
    
    echo "Runtime configuration hints written to $DATA_DIR/runtime-config.json"
}

# Initialize configuration on first run
if [ ! -f "$FIRST_RUN_MARKER" ]; then
    echo "First run detected - initializing configuration..."
    
    # Set up database and configuration system
    setup_database_config
    
    # Initialize configuration database with default values
    init_config_database
    
    # Detect database type from environment
    DB_TYPE=$(detect_database_config)
    
    # Update any environment-provided configuration
    if [ -n "$N8N_HOST" ]; then
        sqlite3 "$DB_FILE" "UPDATE config SET value = '$N8N_HOST' WHERE key = 'n8n.host';"
        echo "Updated n8n.host from environment"
    fi
    
    if [ -n "$N8N_API_KEY" ]; then
        sqlite3 "$DB_FILE" "UPDATE config SET value = '$N8N_API_KEY' WHERE key = 'n8n.api_key';"
        echo "Updated n8n.api_key from environment"
    fi
    
    if [ -n "$GENERIC_TIMEZONE" ]; then
        sqlite3 "$DB_FILE" "UPDATE config SET value = '$GENERIC_TIMEZONE' WHERE key = 'app.timezone';"
        echo "Updated timezone from environment"
    fi
    
    if [ "$ELOVA_DEMO_MODE" = "true" ]; then
        sqlite3 "$DB_FILE" "UPDATE config SET value = 'true' WHERE key = 'features.demo_mode';"
        echo "Enabled demo mode from environment"
    fi
    
    # Create runtime configuration hints
    set_runtime_config "$DB_TYPE"
    
    # Create marker file
    touch "$FIRST_RUN_MARKER"
    
    echo "Database configuration system initialized successfully"
    echo "Database type: $DB_TYPE"
    echo "Configuration stored in SQLite database"
    echo "Runtime hints available at: $DATA_DIR/runtime-config.json"
else
    echo "Configuration already exists, skipping initialization"
    
    # Still update runtime config for current environment
    DB_TYPE=$(detect_database_config)
    
    # Update runtime configuration for existing installations
    cat > "$DATA_DIR/runtime-config.json" << EOF
{
  "firstRun": false,
  "detectedDatabaseType": "$DB_TYPE",
  "hasSupabaseEnv": $([ -n "$NEXT_PUBLIC_SUPABASE_URL" ] && echo "true" || echo "false"),
  "containerStartTime": "$(date -Iseconds)",
  "dataDirectory": "$DATA_DIR",
  "environment": {
    "nodeEnv": "${NODE_ENV:-production}",
    "port": "${PORT:-3000}",
    "hostname": "${HOSTNAME:-0.0.0.0}",
    "demoMode": "${NEXT_PUBLIC_ENABLE_DEMO_MODE:-false}"
  }
}
EOF
fi

# Health check for dependencies
echo "Checking system health..."

# Check if Node.js server file exists
if [ ! -f "/app/server.js" ]; then
    echo "ERROR: Server file not found at /app/server.js"
    exit 1
fi

# Check if database migration files exist
if [ ! -f "/app/database/migrations/001_create_configuration_tables.sql" ]; then
    echo "WARNING: Database migration files not found"
    echo "Configuration system may not work properly"
fi

# Display configuration summary
echo ""
echo "=== Elova Configuration Summary ==="
echo "Configuration system: Database-based"
echo "Database type: $DB_TYPE"
echo "Data directory: $DATA_DIR"
echo "Database file: $DB_FILE"

if [ -f "$DATA_DIR/runtime-config.json" ]; then
    echo "Runtime config: Available"
else
    echo "Runtime config: Not found"
fi

echo ""
echo "Environment variables:"
echo "PORT: ${PORT:-3000}"
echo "NODE_ENV: ${NODE_ENV:-production}"
echo "HOSTNAME: ${HOSTNAME:-0.0.0.0}"
echo "DEMO_MODE: ${NEXT_PUBLIC_ENABLE_DEMO_MODE:-false}"

if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "NEXT_PUBLIC_SUPABASE_URL: configured"
else
    echo "NEXT_PUBLIC_SUPABASE_URL: not set (using SQLite)"
fi

echo ""
echo "Initialization complete. Configuration will be managed in the database."
echo "Starting application..."
