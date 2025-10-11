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

# Function to set runtime configuration hints
set_runtime_config() {
    local db_type="$1"
    
    # Create a runtime configuration file that the Node.js app can read
    # This provides hints for initial configuration setup
    cat > "$DATA_DIR/runtime-config.json" << EOF
{
  "firstRun": true,
  "detectedDatabaseType": "$db_type",
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
    
    echo "Runtime configuration hints written to $DATA_DIR/runtime-config.json"
}

# Initialize configuration on first run
if [ ! -f "$FIRST_RUN_MARKER" ]; then
    echo "First run detected - initializing configuration..."
    
    # Set up database and configuration system
    setup_database_config
    
    # Detect database type from environment
    DB_TYPE=$(detect_database_config)
    
    # Create runtime configuration hints
    set_runtime_config "$DB_TYPE"
    
    # Create marker file
    touch "$FIRST_RUN_MARKER"
    
    echo "Database configuration system initialized successfully"
    echo "Database type: $DB_TYPE"
    echo "Configuration will be managed through the database"
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
