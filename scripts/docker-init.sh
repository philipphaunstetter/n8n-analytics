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
    echo "Configuration database will be initialized by Node.js ConfigManager"
    echo "Database file prepared at: $DB_FILE"
    
    # The Node.js ConfigManager will handle database initialization
    # when the application starts. We just ensure the file exists and is writable.
    touch "$DB_FILE"
    chmod 644 "$DB_FILE"
    
    # Set environment variables for configuration defaults
    export DB_PATH="$DB_FILE"
    # Note: ELOVA_FIRST_RUN is determined by marker file existence, not hardcoded
    
    echo "Database initialization will be handled by the application"
}

# Function to set runtime configuration hints
set_runtime_config() {
    local db_type="$1"
    local is_first_run="$2"
    
    # Create a runtime configuration file that the Node.js app can read
    # This provides hints for initial configuration setup
    cat > "$DATA_DIR/runtime-config.json" << EOF
{
  "firstRun": $is_first_run,
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
# Check both marker file AND database state to prevent reset after setup completion
if [ ! -f "$FIRST_RUN_MARKER" ]; then
    echo "Marker file not found - checking if database has existing configuration..."
    
    # Check if database exists and has configuration data
    if [ -f "$DB_FILE" ]; then
        CONFIG_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM config WHERE key = 'app.initDone'" 2>/dev/null || echo "0")
        if [ "$CONFIG_COUNT" -gt 0 ]; then
            INIT_DONE=$(sqlite3 "$DB_FILE" "SELECT value FROM config WHERE key = 'app.initDone'" 2>/dev/null || echo "false")
            if [ "$INIT_DONE" = "true" ]; then
                echo "Database indicates setup is already complete - creating marker file"
                touch "$FIRST_RUN_MARKER"
                DB_TYPE=$(detect_database_config)
                set_runtime_config "$DB_TYPE" "false"
                echo "Skipping initialization - setup already completed"
                # Skip to the end of initialization
                skip_init=true
            fi
        fi
    fi
    
    echo "First run detected - initializing configuration..."
    skip_init=false
fi

# Only run initialization if not skipped
if [ "$skip_init" != "true" ]; then
    # Set up database and configuration system
    setup_database_config
    
    # Initialize configuration database with default values
    init_config_database
    
    # Detect database type from environment
    DB_TYPE=$(detect_database_config)
    
    # Set environment variables for the Node.js app to read
    if [ -n "$N8N_HOST" ]; then
        export N8N_HOST="$N8N_HOST"
        echo "N8N_HOST environment variable set for application"
    fi
    
    if [ -n "$N8N_API_KEY" ]; then
        export N8N_API_KEY="$N8N_API_KEY"
        echo "N8N_API_KEY environment variable set for application"
    fi
    
    if [ -n "$GENERIC_TIMEZONE" ]; then
        export GENERIC_TIMEZONE="$GENERIC_TIMEZONE"
        echo "GENERIC_TIMEZONE environment variable set for application"
    fi
    
    if [ "$ELOVA_DEMO_MODE" = "true" ]; then
        export ELOVA_DEMO_MODE="true"
        echo "ELOVA_DEMO_MODE environment variable set for application"
    fi
    
    # Create runtime configuration hints
    set_runtime_config "$DB_TYPE" "true"
    
    # Create marker file
    touch "$FIRST_RUN_MARKER"
    
    echo "Database configuration system initialized successfully"
    echo "Database type: $DB_TYPE"
    echo "Configuration stored in SQLite database"
    echo "Runtime hints available at: $DATA_DIR/runtime-config.json"
fi

# Handle existing installations (non-first-run)
if [ -f "$FIRST_RUN_MARKER" ] && [ "$skip_init" = "true" ]; then
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

# Ensure DB_TYPE is set for summary display
if [ -z "$DB_TYPE" ]; then
    DB_TYPE=$(detect_database_config)
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
