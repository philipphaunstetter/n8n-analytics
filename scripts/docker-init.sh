#!/bin/bash

# Docker initialization script for Elova
# This script runs on container startup to handle first-time configuration

set -e

echo "Starting Elova initialization..."

# Check if this is the first run
FIRST_RUN_MARKER="/app/data/.initialized"
DATA_DIR="/app/data"
CONFIG_FILE="/app/data/config.json"

# Ensure data directory exists
mkdir -p "$DATA_DIR"

# Default configuration
DEFAULT_CONFIG='{
  "database": {
    "type": "sqlite",
    "path": "/app/data/elova.db"
  },
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "features": {
    "auth": {
      "provider": "dev",
      "development": true
    },
    "sync": {
      "enabled": true,
      "intervalMinutes": 5
    }
  },
  "security": {
    "allowDevMode": true,
    "corsOrigins": ["http://localhost:3000"]
  }
}'

# Function to detect available database options
detect_database_config() {
    if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
        echo "Supabase configuration detected"
        return 0
    else
        echo "No external database configured, using SQLite"
        return 1
    fi
}

# Initialize configuration on first run
if [ ! -f "$FIRST_RUN_MARKER" ]; then
    echo "First run detected - initializing configuration..."
    
    # Create default config
    echo "$DEFAULT_CONFIG" > "$CONFIG_FILE"
    
    # Check database configuration
    if detect_database_config; then
        echo "Configuring for Supabase database..."
        # Update config to use Supabase
        jq '.database.type = "supabase"' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
        jq '.features.auth.provider = "supabase"' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
        jq '.features.auth.development = false' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
    else
        echo "Configuring for SQLite database..."
        # Initialize SQLite database if needed
        touch "/app/data/elova.db"
        chmod 644 "/app/data/elova.db"
    fi
    
    # Create marker file
    touch "$FIRST_RUN_MARKER"
    
    echo "Configuration initialized successfully"
    echo "Config file: $CONFIG_FILE"
    cat "$CONFIG_FILE"
else
    echo "Configuration already exists, skipping initialization"
fi

# Health check for dependencies
echo "Checking system health..."

# Check if Node.js server file exists
if [ ! -f "/app/server.js" ]; then
    echo "ERROR: Server file not found at /app/server.js"
    exit 1
fi

# Display configuration summary
echo ""
echo "=== Elova Configuration Summary ==="
if [ -f "$CONFIG_FILE" ]; then
    echo "Database type: $(jq -r '.database.type' "$CONFIG_FILE")"
    echo "Auth provider: $(jq -r '.features.auth.provider' "$CONFIG_FILE")"
    echo "Development mode: $(jq -r '.features.auth.development' "$CONFIG_FILE")"
    echo "Data directory: $DATA_DIR"
else
    echo "No configuration file found"
fi

echo ""
echo "Environment variables:"
echo "PORT: ${PORT:-3000}"
echo "NODE_ENV: ${NODE_ENV:-production}"
echo "HOSTNAME: ${HOSTNAME:-0.0.0.0}"

if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "NEXT_PUBLIC_SUPABASE_URL: configured"
else
    echo "NEXT_PUBLIC_SUPABASE_URL: not set (using SQLite)"
fi

echo ""
echo "Initialization complete. Starting application..."