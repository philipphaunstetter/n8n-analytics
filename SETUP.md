# Elova Setup Guide

This guide will help you set up Elova from scratch, whether you're using Docker or installing manually.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Docker Setup (Recommended)](#docker-setup-recommended)
- [Manual Setup](#manual-setup)
- [First-Time Configuration](#first-time-configuration)
- [Database Configuration](#database-configuration)
- [Authentication Setup](#authentication-setup)
- [n8n Integration](#n8n-integration)
- [Advanced Configuration](#advanced-configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### For Docker Setup
- Docker 20.10+ and Docker Compose 2.0+
- At least 512MB RAM and 1GB storage
- Access to an n8n instance with API enabled

### For Manual Setup
- Node.js 18+ and npm
- Database (SQLite, PostgreSQL, or MySQL)
- At least 512MB RAM and 1GB storage

### n8n Requirements
- n8n Community or Pro edition
- API access enabled in n8n settings
- API key generated in n8n

## Docker Setup (Recommended)

### Simple Docker Run

```bash
# Create data volume
docker volume create elova-data

# Run the container
docker run -d \
  --name elova \
  -p 3000:3000 \
  -v elova-data:/app/data \
  -e NODE_ENV=production \
  elova:latest
```

### Docker Compose (Production)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  elova:
    image: elova:latest
    container_name: elova
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./config:/app/config
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: PostgreSQL database
  postgres:
    image: postgres:15
    container_name: elova-db
    environment:
      - POSTGRES_DB=elova
      - POSTGRES_USER=elova
      - POSTGRES_PASSWORD=your_secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

Start the services:

```bash
docker-compose up -d
```

## Manual Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/elova.git
cd elova

# Install dependencies
npm install

# Build the application
npm run build
```

### 2. Environment Configuration

Create a `.env.local` file:

```env
# Application
NODE_ENV=production
PORT=3000

# Database (choose one)
DATABASE_TYPE=sqlite
DATABASE_URL=file:./data/database.sqlite

# Authentication
AUTH_TYPE=simple
AUTH_SECRET=your-super-secure-secret-key

# n8n Connection
N8N_HOST=https://your-n8n-instance.com
N8N_API_KEY=your-n8n-api-key

# Optional: Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### 3. Start the Application

```bash
# Production start
npm start

# Or with PM2 for process management
npm install -g pm2
pm2 start ecosystem.config.js
```

## First-Time Configuration

After starting the application, navigate to `http://localhost:3000`. You'll be greeted with the setup wizard.

### Setup Wizard Steps

1. **Welcome Screen**
   - Overview of the setup process
   - System requirements check

2. **Database Configuration**
   - Choose your database type
   - Configure connection settings
   - Test database connection

3. **Authentication Setup**
   - Choose authentication method
   - Configure auth settings
   - Create admin user

4. **n8n Integration**
   - Enter n8n instance URL
   - Provide API key
   - Test connection and permissions

5. **Sync Configuration**
   - Set sync frequencies
   - Configure data retention
   - Choose initial sync options

6. **Review & Launch**
   - Review all settings
   - Complete setup
   - Initial data sync

## Database Configuration

### SQLite (Default - Recommended for Small Deployments)

```env
DATABASE_TYPE=sqlite
DATABASE_URL=file:./data/database.sqlite
```

**Pros:**
- No additional setup required
- Perfect for single-user deployments
- Automatic backups with volume mounts

**Cons:**
- Not suitable for high-concurrent usage
- Limited scalability

### PostgreSQL (Recommended for Production)

```env
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://username:password@host:5432/database
```

**Setup Steps:**

1. **Install PostgreSQL** (or use managed service)
2. **Create Database:**
```sql
   CREATE DATABASE elova;
   CREATE USER elova WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE elova TO elova;
   ```
3. **Configure Connection String**
4. **Run Migrations** (automatic on first start)

### MySQL (Alternative Production Option)

```env
DATABASE_TYPE=mysql
DATABASE_URL=mysql://username:password@host:3306/elova
```

## Authentication Setup

### Simple Authentication (Built-in)

```env
AUTH_TYPE=simple
AUTH_SECRET=your-super-secure-secret-minimum-32-characters
```

Features:
- Username/password authentication
- Local user management
- Session-based login
- Password reset functionality

### Supabase Integration

```env
AUTH_TYPE=supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
```

### OIDC/SSO (Enterprise)

```env
AUTH_TYPE=oidc
OIDC_ISSUER=https://your-provider.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=https://your-domain.com/api/auth/callback
```

## n8n Integration

### 1. Enable n8n API

In your n8n instance:
1. Go to **Settings → API**
2. Enable **API** if not already enabled
3. Create a new **API Key**
4. Copy the API key for configuration

### 2. Configure Connection

```env
N8N_HOST=https://your-n8n-instance.com
N8N_API_KEY=your-api-key-here
```

### 3. Test Connection

The setup wizard will test:
- API connectivity
- Authentication
- Required permissions
- Available workflows and executions

### 4. Configure Sync Settings

```env
# Sync frequencies (using duration strings)
SYNC_FREQUENCY_EXECUTIONS=15m    # Every 15 minutes
SYNC_FREQUENCY_WORKFLOWS=6h      # Every 6 hours  
SYNC_FREQUENCY_BACKUPS=24h       # Daily backups

# Data retention
DATA_RETENTION_DAYS=90           # Keep data for 90 days
MAX_EXECUTIONS_PER_SYNC=500      # Limit per sync operation
```

## Advanced Configuration

### Environment Variables Reference

```env
# Application Settings
NODE_ENV=production|development
PORT=3000
LOG_LEVEL=error|warn|info|debug

# Database Configuration
DATABASE_TYPE=sqlite|postgresql|mysql
DATABASE_URL=connection-string
DATABASE_POOL_SIZE=10
DATABASE_CONNECTION_TIMEOUT=30000

# Authentication
AUTH_TYPE=simple|supabase|oidc
AUTH_SECRET=minimum-32-character-secret
SESSION_TIMEOUT=24h

# n8n Integration
N8N_HOST=https://your-n8n-instance.com
N8N_API_KEY=your-api-key
N8N_REQUEST_TIMEOUT=30000
N8N_RETRY_ATTEMPTS=3

# Sync Configuration
SYNC_FREQUENCY_EXECUTIONS=15m
SYNC_FREQUENCY_WORKFLOWS=6h
SYNC_FREQUENCY_BACKUPS=24h
DATA_RETENTION_DAYS=90
MAX_EXECUTIONS_PER_SYNC=500

# Performance Tuning
WORKER_THREADS=2
CACHE_TTL=300
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=15m

# Monitoring
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
PROMETHEUS_PORT=9090

# Security
CORS_ORIGIN=https://your-domain.com
CSRF_PROTECTION=true
HTTPS_REDIRECT=true
```

### Docker Environment File

Create `.env` for Docker Compose:

```env
# Copy your configuration here
DATABASE_URL=postgresql://user:pass@localhost:5432/elova
N8N_HOST=https://your-n8n-instance.com
N8N_API_KEY=your-api-key
AUTH_SECRET=your-super-secure-secret-key
```

### Reverse Proxy Configuration

#### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Traefik (Docker)

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.elova.rule=Host(`analytics.yourdomain.com`)"
  - "traefik.http.routers.elova.entrypoints=websecure"
  - "traefik.http.routers.elova.tls.certresolver=letsencrypt"
```

### Backup Configuration

```bash
# Database backups (SQLite)
docker exec elova cp /app/data/database.sqlite /app/backups/

# Full data backup
docker run --rm -v elova-data:/source -v $(pwd)/backup:/backup \
  alpine tar czf /backup/elova-backup-$(date +%Y%m%d).tar.gz -C /source .
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check logs
docker logs elova

# Common causes:
# - Port already in use
# - Invalid environment variables
# - Insufficient permissions
# - Missing volumes
```

#### 2. Database Connection Failed

```bash
# Test database connectivity
docker exec elova npm run db:test

# For PostgreSQL:
docker exec postgres psql -U elova -d elova -c "SELECT 1;"
```

#### 3. n8n API Connection Issues

```bash
# Test n8n API manually
curl -H "X-N8N-API-KEY: your-key" https://your-n8n-instance.com/api/v1/workflows

# Common causes:
# - Invalid API key
# - n8n instance not accessible
# - Firewall blocking requests
# - SSL certificate issues
```

#### 4. Sync Issues

```bash
# Check sync logs
docker logs elova | grep -i sync

# Manual sync trigger
curl -X POST http://localhost:3000/api/sync/executions \
  -H "Authorization: Bearer your-auth-token"
```

### Performance Optimization

#### 1. Database Optimization

```env
# PostgreSQL specific
DATABASE_POOL_SIZE=20
DATABASE_CONNECTION_TIMEOUT=5000

# Add database indexes (automatic migration)
```

#### 2. Memory Management

```bash
# Docker memory limit
docker run --memory=1g --memory-swap=2g elova:latest

# Node.js memory settings
NODE_OPTIONS="--max-old-space-size=1024"
```

#### 3. Sync Optimization

```env
# Reduce sync frequency for large instances
SYNC_FREQUENCY_EXECUTIONS=30m
MAX_EXECUTIONS_PER_SYNC=200

# Enable data compression
ENABLE_COMPRESSION=true
```

### Health Checks

```bash
# Application health
curl http://localhost:3000/api/health

# Database health  
curl http://localhost:3000/api/health/database

# n8n connectivity
curl http://localhost:3000/api/health/n8n
```

## Next Steps

After completing the setup:

1. **Review the Dashboard** - Explore the analytics interface
2. **Configure Alerts** - Set up monitoring and notifications
3. **Customize Settings** - Adjust sync frequencies and retention
4. **User Management** - Add additional users if using multi-user auth
5. **Backup Strategy** - Implement regular backups
6. **Monitoring** - Set up external monitoring and alerting

For more advanced configuration and deployment options, see the [Deployment Guide](./DEPLOYMENT.md).