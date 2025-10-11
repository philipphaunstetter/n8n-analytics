# Elova Docker Guide

This guide covers Docker deployment options for Elova, from development to production environments.

## Quick Start

### Option 1: Pre-built Images (Recommended)

```bash
# Pull the latest image from GitHub Container Registry
docker pull ghcr.io/your-username/elova:latest

# Run with minimal configuration
docker run -d \
  --name elova \
  -p 3000:3000 \
  -e AUTH_SECRET=your-secure-secret-minimum-32-chars \
  ghcr.io/your-username/elova:latest
```

### Option 2: Docker Compose (Full Stack)

```bash
# Clone the repository
git clone https://github.com/your-username/elova.git
cd elova

# Copy and edit environment configuration
cp .env.production.template .env.production
# Edit .env.production with your settings

# Deploy with Docker Compose
docker-compose -f docker-compose.production.yml up -d
```

## Development vs Production

### Development Mode

For development with your real n8n instance data:

```bash
# Using the deployment script (recommended)
./scripts/deploy.sh dev

# Manual approach
cp .env.development .env.local
npm run dev
```

**Development Features:**
- Uses your real n8n instance configuration
- SQLite database for simplicity
- Hot reloading and debug features
- Development authentication enabled

### Production Mode

For production deployment:

```bash
# Using the deployment script (recommended)
./scripts/deploy.sh prod

# With Docker Compose
docker-compose -f docker-compose.production.yml up -d
```

**Production Features:**
- PostgreSQL database
- Security headers and optimizations
- Health checks and logging
- Setup wizard for initial configuration

## Environment Configuration

### Development Environment (`.env.development`)

```bash
NODE_ENV=development
NEXT_PUBLIC_ENABLE_DEV_AUTH=true
N8N_HOST=https://your-n8n-instance.com
N8N_API_KEY=your-api-key
DATABASE_TYPE=sqlite
```

### Production Environment (`.env.production`)

```bash
NODE_ENV=production
AUTH_SECRET=secure-random-secret-32-chars-minimum
POSTGRES_PASSWORD=secure-database-password
N8N_HOST=https://your-n8n-instance.com
N8N_API_KEY=your-api-key
```

See `.env.production.template` for complete configuration options.

## Docker Images

### Available Tags

- `latest` - Latest stable release
- `v1.0.0` - Specific version releases
- `main` - Latest development build
- `develop` - Development branch builds

### Registry Locations

- **GitHub Container Registry**: `ghcr.io/your-username/elova`
- **Docker Hub** (optional): `elova/elova`

### Multi-Architecture Support

Images are built for:
- `linux/amd64` (x86_64)
- `linux/arm64` (Apple Silicon, ARM servers)

## Build Your Own Image

### Local Build

```bash
# Using the build script (recommended)
./scripts/build-docker.sh

# Manual build
docker build -t elova:local .
```

### Build Arguments

```bash
docker build \
  --build-arg VERSION=1.0.0 \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  -t elova:custom .
```

## Docker Compose Configurations

### Production Stack

```yaml
# docker-compose.production.yml
version: '3.8'
services:
  elova:
    image: elova:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://elova:${POSTGRES_PASSWORD}@postgres:5432/elova
    depends_on:
      - postgres
  
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=elova
      - POSTGRES_USER=elova
```

### With Redis Cache

```bash
# Enable Redis profile
docker-compose -f docker-compose.production.yml --profile with-redis up -d
```

### With Nginx Reverse Proxy

```bash
# Enable proxy profile  
docker-compose -f docker-compose.production.yml --profile with-proxy up -d
```

## Persistent Data

### Volume Mounts

- `/app/data` - Application data (SQLite database, files)
- `/app/logs` - Application logs
- `/app/config` - Runtime configuration

### Backup Strategy

```bash
# Backup application data
docker run --rm -v elova_data:/source -v $(pwd)/backup:/backup alpine \
  tar czf /backup/elova-data-$(date +%Y%m%d).tar.gz -C /source .

# Backup PostgreSQL database
docker exec elova-db pg_dump -U elova elova > backup/elova-db-$(date +%Y%m%d).sql
```

## Health Checks

### Container Health

Docker includes built-in health checks:

```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# View health check logs
docker inspect elova --format='{{range .State.Health.Log}}{{.Output}}{{end}}'
```

### Application Health

The application provides a health endpoint:

```bash
# Basic health check
curl http://localhost:3000/api/health

# Expected response
{
  "status": "healthy",
  "version": "1.0.0",
  "gitCommit": "abc123",
  "environment": "production",
  "uptime": 3600
}
```

## Performance Tuning

### Resource Limits

```yaml
services:
  elova:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
```

### Environment Variables

```bash
# Node.js memory optimization
NODE_OPTIONS=--max-old-space-size=1024

# Database connection pooling
DATABASE_POOL_SIZE=20
DATABASE_CONNECTION_TIMEOUT=30000
```

## Security Best Practices

### Production Checklist

- [ ] Use strong, randomly generated secrets
- [ ] Enable HTTPS redirect if behind proxy
- [ ] Set appropriate CORS origins
- [ ] Use non-root user (automatically configured)
- [ ] Keep images updated
- [ ] Monitor for vulnerabilities

### Security Scanning

```bash
# Scan image for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image elova:latest
```

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check container logs
docker logs elova

# Check container status
docker ps -a

# Inspect container configuration
docker inspect elova
```

#### Database Connection Issues

```bash
# Test database connectivity
docker exec elova-db psql -U elova -d elova -c "SELECT 1;"

# Check database logs
docker logs elova-db
```

#### n8n API Connection Issues

```bash
# Test from container
docker exec elova curl -H "X-N8N-API-KEY: your-key" $N8N_HOST/api/v1/workflows

# Check environment variables
docker exec elova env | grep N8N
```

### Debug Mode

```bash
# Run with debug logging
docker run -d \
  --name elova-debug \
  -p 3000:3000 \
  -e LOG_LEVEL=debug \
  -e NODE_ENV=development \
  elova:latest

# Follow debug logs
docker logs -f elova-debug
```

## Monitoring and Logging

### Centralized Logging

```yaml
# docker-compose.yml
services:
  elova:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Metrics Collection

```bash
# Enable Prometheus metrics
docker run -d \
  -e METRICS_ENABLED=true \
  -e PROMETHEUS_PORT=9090 \
  elova:latest
```

## Upgrades and Maintenance

### Upgrading

```bash
# Pull latest image
docker pull ghcr.io/your-username/elova:latest

# Restart with new image
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d
```

### Maintenance Mode

```bash
# Stop application containers
docker-compose -f docker-compose.production.yml stop elova

# Perform maintenance
# ...

# Restart application
docker-compose -f docker-compose.production.yml start elova
```

## CI/CD Integration

### GitHub Actions

The repository includes automated Docker builds:

- **Pull Requests**: Build and test images
- **Pushes to main**: Build and publish to registry
- **Tagged releases**: Build versioned releases
- **Security scanning**: Vulnerability scanning with Trivy

### Custom Registry

```bash
# Set custom registry
export DOCKER_REGISTRY=your-registry.com
./scripts/build-docker.sh

# Push to custom registry
docker push your-registry.com/elova:latest
```

## Support

### Getting Help

1. Check the [troubleshooting section](#troubleshooting)
2. Review container logs: `docker logs elova`
3. Check health endpoint: `curl http://localhost:3000/api/health`
4. Open an issue on [GitHub](https://github.com/your-username/elova/issues)

### Contributing

See the main [README.md](../README.md) for contribution guidelines.

---

## Quick Reference

### Essential Commands

```bash
# Development
./scripts/deploy.sh dev

# Production deployment
./scripts/deploy.sh prod --build

# View logs
./scripts/deploy.sh logs --follow

# Stop containers
./scripts/deploy.sh stop

# Clean up
./scripts/deploy.sh clean
```

### Environment Files

- `.env.development` - Development configuration (committed)
- `.env.production` - Production configuration (not committed)
- `.env.example` - Example configuration
- `.env.production.template` - Production template

For detailed deployment guides, see [DEPLOYMENT.md](./DEPLOYMENT.md).