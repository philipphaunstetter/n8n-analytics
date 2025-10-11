# Docker Compose Files Explained

This repository contains several Docker Compose files for different use cases:

## 📁 Available Files

### 1. `docker-compose.simple.yml` ⭐ **Recommended for New Users**
- **Purpose**: Ultra-simple template for beginners
- **Usage**: Single service, SQLite database, easy port configuration
- **Features**: Basic Elova setup with clear examples
- **Best for**: First-time users, quick testing

```bash
# Quick start with this file:
cp docker-compose.simple.yml docker-compose.yml
docker compose up -d
# Complete setup at http://localhost:3000
```

### 2. `docker-compose.yml` 🔧 **Main Repository Version**
- **Purpose**: Main docker-compose.yml for the repository
- **Usage**: SQLite-based, no separate database services
- **Features**: Environment variables, clean configuration
- **Best for**: Most users, development, simple production

```bash
# Use as-is:
docker compose up -d
```

### 3. `docker-compose.advanced.yml` ⚡ **Advanced with PostgreSQL**
- **Purpose**: Full-featured setup with PostgreSQL and Redis
- **Usage**: For users who need external database and caching
- **Features**: PostgreSQL, Redis, networking, health checks
- **Best for**: High-performance production deployments

```bash
# Use with explicit file:
docker compose -f docker-compose.advanced.yml up -d
```

### 4. `docker-compose.prod.yml` 🚀 **Production Hardened**
- **Purpose**: Production optimized configuration
- **Usage**: Security hardening, resource limits, monitoring
- **Features**: Security settings, resource limits, monitoring
- **Best for**: Production environments with security requirements

## 🎯 Which File Should I Use?

| Use Case | File | Command |
|----------|------|---------|
| **First time / Just testing** | `docker-compose.simple.yml` | `cp docker-compose.simple.yml docker-compose.yml` |
| **Normal usage** | `docker-compose.yml` | `docker compose up -d` |
| **Need PostgreSQL/Redis** | `docker-compose.advanced.yml` | `docker compose -f docker-compose.advanced.yml up -d` |
| **Production deployment** | `docker-compose.prod.yml` | `docker compose -f docker-compose.prod.yml up -d` |

## 🔄 Migration Path

1. **Start Simple**: Use `docker-compose.simple.yml`
2. **Regular Usage**: Switch to `docker-compose.yml` (SQLite-based)
3. **Need Database**: Use `docker-compose.advanced.yml` (PostgreSQL + Redis)
4. **Production**: Use `docker-compose.prod.yml` (hardened)

## 💡 Pro Tips

- **New to Docker Compose?** Start with `docker-compose.simple.yml`
- **SQLite is perfect** for most users - no separate database needed!
- **Need PostgreSQL?** Use `docker-compose.advanced.yml`
- **Production deployment?** Use `docker-compose.prod.yml` with proper secrets

---

All files follow the same environment variable pattern - your `.env` file works with any of them!