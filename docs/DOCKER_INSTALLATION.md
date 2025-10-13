# Elova Docker Installation

**Elova** is a workflow observability platform designed to monitor and analyze n8n workflows. This guide shows you how to install and run Elova using Docker, following best practices inspired by n8n's deployment approach.

## Quick Start

For the impatient, here's how to get Elova running in under 5 minutes:

```bash
# Clone and navigate to the project
git clone https://github.com/philipphaunstetter/n8n-analytics.git
cd n8n-analytics

# Copy environment template
cp .env.example .env

# Start with SQLite (lightweight)
docker compose up -d

# Access Elova at http://localhost:3000
```

## Prerequisites

Before proceeding, make sure you have:

- **Docker** installed ([Get Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** v2.0+ (included with Docker Desktop)
- At least **512MB RAM** and **1GB disk space** available
- **Port 3000** available (or change `ELOVA_PORT` in `.env`)

## Installation Options

Elova offers flexible deployment options to match your infrastructure needs:

### Option 1: SQLite (Recommended for Testing)

Perfect for getting started quickly or small deployments:

```bash
# Use the default configuration
docker compose up -d
```

**Pros:** Simple setup, no external database required  
**Cons:** Limited scalability, single container only

### Option 2: PostgreSQL (Recommended for Production)

For production deployments with better performance and reliability:

```bash
# Configure PostgreSQL password
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)" >> .env

# Start with PostgreSQL
docker compose --profile with-postgres up -d
```

**Pros:** Better performance, supports clustering, full ACID compliance  
**Cons:** Requires additional container and configuration

### Option 3: Full Stack (PostgreSQL + Redis)

For high-performance deployments with caching:

```bash
# Configure passwords
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "REDIS_PASSWORD=$(openssl rand -base64 32)" >> .env

# Start full stack
docker compose --profile full-stack up -d
```

**Pros:** Maximum performance, session caching, scalable architecture  
**Cons:** More complex setup and resource usage

### Option 4: External Supabase

Use external Supabase for database and authentication:

```bash
# Configure Supabase in .env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Start with Supabase
docker compose up -d
```

## Environment Configuration

Elova uses environment variables for configuration. Copy the example and customize:

```bash
cp .env.example .env
```

### Essential Settings

```bash
# Application port
ELOVA_PORT=3000

# Timezone (important for accurate scheduling)
GENERIC_TIMEZONE=America/New_York
TZ=America/New_York

# Security (generate with: openssl rand -hex 32)
ELOVA_ENCRYPTION_KEY=your_32_character_encryption_key_here
```

### Database Settings

For PostgreSQL deployments:

```bash
# PostgreSQL configuration
DATABASE_TYPE=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=elova
POSTGRES_USER=elova
```

### Feature Flags

```bash
# Enable demo mode with sample data
ELOVA_DEMO_MODE=true

# Disable built-in analytics collection
ELOVA_DISABLE_ANALYTICS=false
```

### n8n Integration

To monitor your n8n instance:

```bash
# n8n connection settings
N8N_HOST=https://your-n8n-instance.com
N8N_API_KEY=your_n8n_api_key

# Sync intervals
SYNC_EXECUTIONS=15m
SYNC_WORKFLOWS=6h
SYNC_BACKUPS=24h
```

## Starting Elova

### Basic Start

```bash
docker compose up -d
```

### With Specific Profile

```bash
# PostgreSQL only
docker compose --profile with-postgres up -d

# PostgreSQL + Redis
docker compose --profile full-stack up -d
```

### With Custom Environment File

```bash
docker compose --env-file .env.production up -d
```

## Accessing Elova

Once started, Elova is available at:
- **Web Interface:** http://localhost:3000
- **Health Check:** http://localhost:3000/api/health
- **API Endpoints:** http://localhost:3000/api/*

Default credentials (if authentication is enabled):
- **Username:** admin
- **Password:** Check logs for generated password

## Monitoring and Logs

### View Service Status

```bash
docker compose ps
```

### View Application Logs

```bash
# All services
docker compose logs -f

# Elova application only
docker compose logs -f elova

# PostgreSQL only
docker compose logs -f postgres
```

### Health Checks

All services include health checks. View status:

```bash
docker compose ps --format \"table {{.Service}}\\t{{.Status}}\\t{{.Ports}}\"
```

## Data Persistence

Elova uses named Docker volumes for data persistence:

- `elova_data`: Application data, SQLite database, logs
- `postgres_data`: PostgreSQL database files (if using PostgreSQL)
- `redis_data`: Redis persistence files (if using Redis)

### View Volume Usage

```bash
docker volume ls | grep elova
docker system df -v
```

### Backup Data

```bash
# Backup application data
docker run --rm -v elova_data:/data -v $(pwd):/backup alpine tar czf /backup/elova-data-$(date +%Y%m%d).tar.gz /data

# Backup PostgreSQL (if using)
docker compose exec postgres pg_dump -U elova elova > backup-$(date +%Y%m%d).sql
```

## Updating Elova

### Pull Latest Version

```bash
# Pull latest image
docker compose pull

# Restart with new version
docker compose down
docker compose up -d
```

### Update Specific Version

```bash
# Edit docker-compose.yml to specify version
# image: ghcr.io/philipphaunstetter/n8n-analytics:v1.2.0

docker compose pull
docker compose down
docker compose up -d
```

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Check what's using port 3000
lsof -i :3000

# Change port in .env
ELOVA_PORT=3001
```

**Database Connection Issues**
```bash
# Check PostgreSQL health
docker compose exec postgres pg_isready -U elova

# View database logs
docker compose logs postgres
```

**Permission Issues**
```bash
# Fix volume permissions
docker compose down
docker volume rm elova_data
docker compose up -d
```

**Memory Issues**
```bash
# Check container memory usage
docker stats

# Increase Docker memory limit (Docker Desktop)
# Settings > Resources > Advanced > Memory
```

### Debug Mode

Enable detailed logging:

```bash
# Add to .env
NODE_ENV=development
ELOVA_DEBUG=true
ELOVA_LOG_LEVEL=debug

# Restart
docker compose down && docker compose up -d
```

### Reset Installation

Complete reset (⚠️ **This will delete all data**):

```bash
docker compose down -v
docker system prune -f
docker compose up -d
```

## Production Considerations

### Security Checklist

- [ ] Generate secure `ELOVA_ENCRYPTION_KEY`
- [ ] Use strong database passwords
- [ ] Enable HTTPS with reverse proxy
- [ ] Restrict network access
- [ ] Regular security updates

### Performance Optimization

- [ ] Use PostgreSQL for production
- [ ] Enable Redis for caching
- [ ] Configure proper resource limits
- [ ] Set up log rotation
- [ ] Monitor resource usage

### Backup Strategy

- [ ] Automated database backups
- [ ] Volume snapshots
- [ ] Configuration backup
- [ ] Test restore procedures

## Advanced Configuration

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name elova.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Custom Network

```yaml
# In docker-compose.yml
networks:
  elova_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Resource Limits

```yaml
# In docker-compose.yml
services:
  elova:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
```

## Next Steps

1. **Configure n8n Integration:** Add your n8n API credentials to start monitoring
2. **Set Up Monitoring:** Configure alerts and monitoring for your Elova instance  
3. **Customize Dashboards:** Explore the web interface and customize views
4. **Enable HTTPS:** Set up SSL certificates for production use
5. **Backup Setup:** Implement automated backup procedures

## Support

- **Documentation:** [Full documentation](./README.md)
- **Issues:** [GitHub Issues](https://github.com/philipphaunstetter/n8n-analytics/issues)
- **Discussions:** [GitHub Discussions](https://github.com/philipphaunstetter/n8n-analytics/discussions)

---

**Pro Tip:** Start with the SQLite option to test Elova, then migrate to PostgreSQL for production. The Docker setup makes this transition seamless!