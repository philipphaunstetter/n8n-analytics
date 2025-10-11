# Elova Deployment Guide

This guide covers production deployment of Elova across different platforms and configurations.

## Table of Contents

- [Docker Deployment](#docker-deployment)
- [Kubernetes](#kubernetes)
- [Cloud Platforms](#cloud-platforms)
- [Manual Deployment](#manual-deployment)
- [Reverse Proxy](#reverse-proxy)
- [SSL/TLS Configuration](#ssl-tls-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Performance Tuning](#performance-tuning)

## Docker Deployment

### Single Container (Development/Small Scale)

```bash
# Pull the latest image
docker pull elova:latest

# Run with basic configuration
docker run -d \
  --name elova \
  --restart unless-stopped \
  -p 3000:3000 \
  -v elova-data:/app/data \
  -e DATABASE_TYPE=sqlite \
  -e N8N_HOST=https://your-n8n-instance.com \
  -e N8N_API_KEY=your-api-key \
  -e AUTH_SECRET=your-super-secure-secret \
  elova:latest
```

### Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  elova:
    image: elova:latest
    container_name: elova
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - analytics_data:/app/data
      - analytics_config:/app/config
      - analytics_logs:/app/logs
    environment:
      - NODE_ENV=production
      - DATABASE_TYPE=${DATABASE_TYPE:-postgresql}
      - DATABASE_URL=postgresql://elova:${DB_PASSWORD}@postgres:5432/elova
      - AUTH_TYPE=${AUTH_TYPE:-simple}
      - AUTH_SECRET=${AUTH_SECRET}
      - N8N_HOST=${N8N_HOST}
      - N8N_API_KEY=${N8N_API_KEY}
      - SYNC_FREQUENCY_EXECUTIONS=${SYNC_EXECUTIONS:-15m}
      - SYNC_FREQUENCY_WORKFLOWS=${SYNC_WORKFLOWS:-6h}
      - SYNC_FREQUENCY_BACKUPS=${SYNC_BACKUPS:-24h}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  postgres:
    image: postgres:15-alpine
    container_name: elova-db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=elova
      - POSTGRES_USER=elova
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS="--encoding=UTF8 --locale=C"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups/postgres:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U elova -d elova"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Optional: Redis for caching and session storage
  redis:
    image: redis:7-alpine
    container_name: elova-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Optional: Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: elova-proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - elova

volumes:
  analytics_data:
  analytics_config:
  analytics_logs:
  postgres_data:
  redis_data:
  nginx_logs:

networks:
  default:
    name: elova
```

Create `.env` file:

```env
# Application Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DATABASE_TYPE=postgresql
DB_PASSWORD=your_secure_db_password

# Authentication
AUTH_TYPE=simple
AUTH_SECRET=your-super-secure-secret-minimum-32-characters

# n8n Integration
N8N_HOST=https://your-n8n-instance.com
N8N_API_KEY=your-n8n-api-key

# Sync Configuration
SYNC_EXECUTIONS=15m
SYNC_WORKFLOWS=6h
SYNC_BACKUPS=24h

# Optional: Redis
REDIS_PASSWORD=your_redis_password

# Security
CORS_ORIGIN=https://your-domain.com
```

Deploy:

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f elova

# Update to latest version
docker-compose pull && docker-compose up -d
```

### Docker with Traefik

For automatic SSL and routing:

```yaml
version: '3.8'

services:
  elova:
    image: elova:latest
    restart: unless-stopped
    volumes:
      - analytics_data:/app/data
    environment:
      - NODE_ENV=production
      # ... other env vars
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.elova.rule=Host(`analytics.yourdomain.com`)"
      - "traefik.http.routers.elova.entrypoints=websecure"
      - "traefik.http.routers.elova.tls.certresolver=letsencrypt"
      - "traefik.http.services.elova.loadbalancer.server.port=3000"
    networks:
      - traefik

  traefik:
    image: traefik:v2.10
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/etc/traefik/traefik.yml:ro
      - traefik_certs:/certificates
    networks:
      - traefik

networks:
  traefik:
    external: true

volumes:
  analytics_data:
  traefik_certs:
```

## Kubernetes

### Basic Deployment

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: elova

---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: elova-config
  namespace: elova
data:
  NODE_ENV: "production"
  DATABASE_TYPE: "postgresql"
  AUTH_TYPE: "simple"
  PORT: "3000"

---
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: elova-secrets
  namespace: elova
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:password@postgres:5432/elova"
  AUTH_SECRET: "your-super-secure-secret"
  N8N_HOST: "https://your-n8n-instance.com"
  N8N_API_KEY: "your-n8n-api-key"

---
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elova
  namespace: elova
spec:
  replicas: 2
  selector:
    matchLabels:
      app: elova
  template:
    metadata:
      labels:
        app: elova
    spec:
      containers:
      - name: elova
        image: elova:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: elova-config
        - secretRef:
            name: elova-secrets
        volumeMounts:
        - name: data
          mountPath: /app/data
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: elova-pvc

---
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: elova-pvc
  namespace: elova
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi

---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: elova
  namespace: elova
spec:
  selector:
    app: elova
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP

---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: elova
  namespace: elova
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - analytics.yourdomain.com
    secretName: elova-tls
  rules:
  - host: analytics.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: elova
            port:
              number: 80
```

### Helm Chart

Create `values.yaml`:

```yaml
# values.yaml
image:
  repository: elova
  tag: latest
  pullPolicy: Always

replicaCount: 2

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: analytics.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: elova-tls
      hosts:
        - analytics.yourdomain.com

persistence:
  enabled: true
  size: 10Gi
  storageClass: "fast-ssd"

resources:
  limits:
    cpu: 500m
    memory: 1Gi
  requests:
    cpu: 250m
    memory: 512Mi

config:
  nodeEnv: production
  databaseType: postgresql
  authType: simple

secrets:
  databaseUrl: "postgresql://user:password@postgres:5432/elova"
  authSecret: "your-super-secure-secret"
  n8nHost: "https://your-n8n-instance.com"
  n8nApiKey: "your-n8n-api-key"

postgresql:
  enabled: true
  auth:
    postgresPassword: "postgres-password"
    username: "elova"
    password: "user-password"
    database: "elova"
  primary:
    persistence:
      enabled: true
      size: 20Gi

redis:
  enabled: false

monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
```

Deploy with Helm:

```bash
# Add helm chart
helm repo add elova https://charts.elova.com
helm repo update

# Install
helm install elova elova/elova \
  --namespace elova \
  --create-namespace \
  --values values.yaml

# Upgrade
helm upgrade elova elova/elova \
  --values values.yaml
```

## Cloud Platforms

### Railway

1. **Connect Repository**
  - Fork the elova repository
   - Connect to Railway
   - Deploy from GitHub

2. **Configure Environment Variables**
   ```
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   N8N_HOST=https://your-n8n-instance.com
   N8N_API_KEY=your-n8n-api-key
   AUTH_SECRET=your-super-secure-secret
   ```

3. **Add PostgreSQL Service**
   - Add PostgreSQL from Railway marketplace
   - Connect to your application

### DigitalOcean Apps

Create `app.yaml`:

```yaml
name: elova
services:
- name: web
  source_dir: /
  github:
    repo: your-username/elova
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  env_vars:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
  - key: N8N_HOST
    value: https://your-n8n-instance.com
  - key: N8N_API_KEY
    value: your-n8n-api-key
    type: SECRET
  - key: AUTH_SECRET
    value: your-super-secure-secret
    type: SECRET

databases:
- name: db
  engine: PG
  version: "15"
  size: basic-xs
```

Deploy:

```bash
doctl apps create --spec app.yaml
```

### AWS ECS/Fargate

Create `task-definition.json`:

```json
{
  "family": "elova",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "elova",
      "image": "elova:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:ssm:region:account:parameter/elova/database-url"
        },
        {
          "name": "N8N_API_KEY",
          "valueFrom": "arn:aws:ssm:region:account:parameter/elova/n8n-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/elova",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Run

Create `cloudbuild.yaml`:

```yaml
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', 'gcr.io/$PROJECT_ID/elova', '.']
- name: 'gcr.io/cloud-builders/docker'
  args: ['push', 'gcr.io/$PROJECT_ID/elova']
- name: 'gcr.io/cloud-builders/gcloud'
  args:
  - 'run'
  - 'deploy'
  - 'elova'
  - '--image'
  - 'gcr.io/$PROJECT_ID/elova'
  - '--region'
  - 'us-central1'
  - '--platform'
  - 'managed'
  - '--allow-unauthenticated'
  - '--set-env-vars'
  - 'NODE_ENV=production'
  - '--set-secrets'
  - 'DATABASE_URL=database-url:latest,N8N_API_KEY=n8n-api-key:latest'
```

## Manual Deployment

### Ubuntu/Debian Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE elova;"
sudo -u postgres psql -c "CREATE USER elova WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE elova TO elova;"

# Create application user
sudo useradd --system --home /opt/elova --shell /bin/bash elova
sudo mkdir -p /opt/elova
sudo chown elova:elova /opt/elova

# Clone and setup application
sudo -u elova git clone https://github.com/your-org/elova.git /opt/elova/app
cd /opt/elova/app
sudo -u elova npm install
sudo -u elova npm run build

# Create environment file
sudo -u elova tee /opt/elova/.env.local > /dev/null <<EOF
NODE_ENV=production
PORT=3000
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://elova:secure_password@localhost:5432/elova
AUTH_TYPE=simple
AUTH_SECRET=your-super-secure-secret
N8N_HOST=https://your-n8n-instance.com
N8N_API_KEY=your-n8n-api-key
EOF

# Create systemd service
sudo tee /etc/systemd/system/elova.service > /dev/null <<EOF
[Unit]
Description=Elova
After=network.target postgresql.service

[Service]
Type=simple
User=elova
WorkingDirectory=/opt/elova/app
EnvironmentFile=/opt/elova/.env.local
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable elova
sudo systemctl start elova

# Check status
sudo systemctl status elova
```

### Process Manager (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'elova',
    script: './server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/elova'
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save
pm2 startup
```

## Reverse Proxy

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/elova
upstream elova {
    server 127.0.0.1:3000;
    # Add more servers for load balancing
    # server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name analytics.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name analytics.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/analytics.yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/analytics.yourdomain.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_dhparam /etc/ssl/certs/dhparam.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval';" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://elova;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://elova;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API routes
    location /api/ {
        proxy_pass http://elova;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }
}

# Rate limiting zone
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=5r/s;
}
```

### Apache Configuration

```apache
# /etc/apache2/sites-available/elova.conf
<VirtualHost *:80>
    ServerName analytics.yourdomain.com
    Redirect permanent / https://analytics.yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName analytics.yourdomain.com
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/analytics.yourdomain.com.crt
    SSLCertificateKeyFile /etc/ssl/private/analytics.yourdomain.com.key
    SSLProtocol -all +TLSv1.2 +TLSv1.3
    SSLCipherSuite ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
    
    # Security headers
    Header always set X-Frame-Options SAMEORIGIN
    Header always set X-Content-Type-Options nosniff
    Header always set X-XSS-Protection "1; mode=block"
    
    # Proxy configuration
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    
    # WebSocket support
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://127.0.0.1:3000/$1" [P,L]
</VirtualHost>
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Generate certificate
sudo certbot --nginx -d analytics.yourdomain.com

# Auto-renewal test
sudo certbot renew --dry-run

# Add cron job for auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### Manual SSL Certificate

```bash
# Generate private key
openssl genrsa -out analytics.yourdomain.com.key 2048

# Generate certificate signing request
openssl req -new -key analytics.yourdomain.com.key -out analytics.yourdomain.com.csr

# Generate self-signed certificate (for testing)
openssl x509 -req -days 365 -in analytics.yourdomain.com.csr -signkey analytics.yourdomain.com.key -out analytics.yourdomain.com.crt
```

## Monitoring & Logging

### Prometheus Metrics

Add to `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus:latest
  container_name: prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'

grafana:
  image: grafana/grafana:latest
  container_name: grafana
  ports:
    - "3001:3000"
  volumes:
    - grafana_data:/var/lib/grafana
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'elova'
    static_configs:
      - targets: ['elova:3000']
    scrape_interval: 5s
    metrics_path: /api/metrics
```

### Centralized Logging

```yaml
# Add to docker-compose.yml
logging:
  image: grafana/loki:2.8.0
  ports:
    - "3100:3100"
  volumes:
    - loki_data:/loki

promtail:
  image: grafana/promtail:2.8.0
  volumes:
    - /var/log:/var/log:ro
    - ./promtail-config.yml:/etc/promtail/config.yml
  command: -config.file=/etc/promtail/config.yml
```

## Backup & Recovery

### Automated Backups

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="elova"

# Database backup
docker exec elova-db pg_dump -U elova $DB_NAME > "$BACKUP_DIR/db_$DATE.sql"

# Application data backup
docker run --rm -v elova-data:/source -v $BACKUP_DIR:/backup alpine \
  tar czf /backup/data_$DATE.tar.gz -C /source .

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Recovery Process

```bash
#!/bin/bash
# restore.sh

BACKUP_DATE=$1
BACKUP_DIR="/backups"

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    echo "Available backups:"
    ls -la $BACKUP_DIR/db_*.sql
    exit 1
fi

# Stop application
docker-compose stop elova

# Restore database
docker exec -i elova-db psql -U elova -d elova < "$BACKUP_DIR/db_$BACKUP_DATE.sql"

# Restore data
docker run --rm -v elova-data:/target -v $BACKUP_DIR:/backup alpine \
  tar xzf /backup/data_$BACKUP_DATE.tar.gz -C /target

# Start application
docker-compose start elova

echo "Restore completed from backup: $BACKUP_DATE"
```

## Performance Tuning

### Database Optimization

```sql
-- PostgreSQL performance tuning
-- Add to postgresql.conf or as Docker environment variables

# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Connection settings  
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'

# Logging
log_statement = 'all'
log_min_duration_statement = 1000
```

### Node.js Performance

```bash
# Environment variables for performance
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=1024 --max-http-header-size=16384"
UV_THREADPOOL_SIZE=8

# PM2 cluster mode
pm2 start ecosystem.config.js --instances max
```

### Caching Strategy

```yaml
# Redis configuration for caching
redis:
  image: redis:7-alpine
  container_name: elova-redis
  restart: unless-stopped
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data

# Application configuration
environment:
  - REDIS_URL=redis://redis:6379
  - CACHE_TTL=300
  - ENABLE_CACHE=true
```

This completes the comprehensive deployment guide. The guide covers all major deployment scenarios from simple Docker containers to enterprise Kubernetes deployments, with detailed configuration examples and best practices for production environments.