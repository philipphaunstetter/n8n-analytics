# Docker Compose Setup Guide

This guide shows you how to run Elova using Docker Compose with the published container image.

## 🚀 Quick Start

### 1. **Simple Setup (SQLite Database)**
```bash
# Use the production compose file directly
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Access the application
open http://localhost:3000
```

### 2. **Custom Configuration Setup**
```bash
# Copy environment template
cp .env.compose .env

# Edit the .env file with your preferences
nano .env

# Start with your configuration
docker compose -f docker-compose.prod.yml up -d
```

## 📋 **Available Configurations**

### **SQLite (Default)**
- No additional setup required
- Data stored in Docker volume `elova_data`
- Perfect for testing and small deployments

### **With Supabase**
```bash
# Edit .env file and uncomment Supabase variables:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### **With PostgreSQL**
```bash
# Start with PostgreSQL
docker compose -f docker-compose.prod.yml --profile with-postgres up -d
```

### **With Redis Cache**
```bash
# Start with Redis
docker compose -f docker-compose.prod.yml --profile with-redis up -d
```

### **Full Stack**
```bash
# Start with PostgreSQL and Redis
docker compose -f docker-compose.prod.yml --profile with-postgres --profile with-redis up -d
```

## 🛠️ **Management Commands**

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Stop services
docker compose -f docker-compose.prod.yml down

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Update to latest image
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Clean up (removes containers and networks, keeps volumes)
docker compose -f docker-compose.prod.yml down

# Clean up everything (including data volumes) - BE CAREFUL!
docker compose -f docker-compose.prod.yml down -v
```

## 🔍 **Default Credentials**

When `DEMO_MODE=true` (default), you can use these test credentials:

- **Email:** `admin@test.com` **Password:** `1234`
- **Email:** `demo@test.com` **Password:** `demo`

## 📁 **Data Persistence**

- **Application data:** `/app/data` → `elova_data` volume
- **Application logs:** `/app/logs` → `elova_logs` volume
- **PostgreSQL data:** `/var/lib/postgresql/data` → `postgres_data` volume
- **Redis data:** `/data` → `redis_data` volume

## 🌐 **Access Points**

- **Application:** http://localhost:3000
- **PostgreSQL:** localhost:5432 (if enabled)
- **Redis:** localhost:6379 (if enabled)

## 🔧 **Troubleshooting**

### Check container status:
```bash
docker compose -f docker-compose.prod.yml ps
```

### View initialization logs:
```bash
docker compose -f docker-compose.prod.yml logs elova
```

### Access container shell:
```bash
docker compose -f docker-compose.prod.yml exec elova /bin/bash
```

### Check data directory:
```bash
docker compose -f docker-compose.prod.yml exec elova ls -la /app/data
```