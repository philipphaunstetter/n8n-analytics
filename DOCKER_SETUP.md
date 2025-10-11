# 🐳 Elova Docker Setup Complete!

Elova is now fully dockerized with automated builds and deployment scripts. Here's everything you need to know:

## 🎉 What's Been Set Up

### ✅ Docker Configuration Files
- **`Dockerfile`** - Multi-stage optimized production build
- **`docker-compose.yml`** - Basic development stack  
- **`docker-compose.production.yml`** - Full production stack with PostgreSQL
- **`.dockerignore`** - Optimized build context
- **`healthcheck.js`** - Container health monitoring

### ✅ Environment Separation
- **`.env.development`** - Your real n8n instance for development
- **`.env.production.template`** - Production template with setup wizard
- **`.env.example`** - Basic example configuration

### ✅ Automation Scripts
- **`scripts/build-docker.sh`** - Build and tag Docker images
- **`scripts/deploy.sh`** - Unified deployment script for dev/prod
- **`.github/workflows/docker-build.yml`** - GitHub Actions CI/CD

### ✅ Documentation
- **`docs/DOCKER.md`** - Comprehensive Docker guide
- Updated deployment documentation

## 🚀 Quick Start Commands

### Development (with your real n8n data)
```bash
# Start development server with your n8n instance
./scripts/deploy.sh dev
```

### Production Docker Deployment
```bash
# Deploy production environment
./scripts/deploy.sh prod --build

# View logs
./scripts/deploy.sh logs --follow

# Stop containers  
./scripts/deploy.sh stop
```

### Build Docker Image
```bash
# Build with versioning and metadata
./scripts/build-docker.sh

# Build and deploy production
./scripts/deploy.sh prod --build
```

## 📋 Best Practices for Managing Changes

### When to Rebuild Docker Images

**Always rebuild when you change:**
- ✅ Source code (React components, API routes, etc.)
- ✅ Dependencies in `package.json`
- ✅ Next.js configuration (`next.config.ts`)
- ✅ Dockerfile or build process

**No rebuild needed when you change:**
- ❌ Environment variables (`.env` files)
- ❌ Docker Compose configurations
- ❌ Documentation files
- ❌ Database data or volumes

### Automated Rebuilds

The GitHub Actions workflow will automatically:
- 🔄 Build on every push to `main` branch
- 🔄 Build and test on pull requests  
- 🔄 Create versioned releases on git tags
- 🔄 Security scan published images

### Manual Rebuild Process

```bash
# 1. After making code changes
git add .
git commit -m "Update application logic"

# 2. Rebuild Docker image
./scripts/build-docker.sh

# 3. Deploy updated image
./scripts/deploy.sh prod

# 4. Verify health
curl http://localhost:3000/api/health
```

## 🔄 Versioning Strategy

### Semantic Versioning
- `v1.0.0` - Major releases
- `v1.1.0` - Feature additions
- `v1.0.1` - Bug fixes

### Docker Tags Created
- `elova:latest` - Latest stable
- `elova:v1.0.0` - Specific version
- `elova:v1.0.0-abc123` - Version + git commit

### Release Process
```bash
# 1. Update version in package.json
npm version patch  # or minor/major

# 2. Create git tag
git push --tags

# 3. GitHub Actions automatically builds and publishes
```

## 🌍 Distribution Options

### GitHub Container Registry (Recommended)
- **Location**: `ghcr.io/your-username/elova`
- **Benefits**: Free, integrated with GitHub
- **Authentication**: Uses GitHub tokens

### Docker Hub (Optional)
- **Location**: `elova/elova` 
- **Benefits**: Public visibility, Docker Hub features
- **Setup**: Configure in GitHub Actions

### Self-Hosted Registry
```bash
export DOCKER_REGISTRY=your-registry.com
./scripts/build-docker.sh
```

## 🔧 Development Workflow

### Local Development
```bash
# Work with your real n8n instance
./scripts/deploy.sh dev

# Your changes are immediately reflected
# No Docker rebuild needed for development
```

### Testing Production Build
```bash
# Build and test production image locally
./scripts/deploy.sh prod --build

# Test the production environment
curl http://localhost:3000/api/health
```

### Before Committing
```bash
# 1. Test development mode
./scripts/deploy.sh dev

# 2. Test production build
./scripts/deploy.sh prod --build

# 3. Clean up
./scripts/deploy.sh clean

# 4. Commit changes
git add .
git commit -m "Your changes"
```

## 📊 Monitoring & Maintenance

### Health Monitoring
```bash
# Check application health
curl http://localhost:3000/api/health

# Check container status
docker ps --format "table {{.Names}}\t{{.Status}}"

# View container logs
./scripts/deploy.sh logs --follow
```

### Regular Maintenance
```bash
# Update base images (monthly)
docker pull node:18-alpine
docker pull postgres:15-alpine

# Clean up old images
./scripts/deploy.sh clean

# Update dependencies
npm update
```

### Security Updates
```bash
# Scan for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image elova:latest

# Update and rebuild if needed
./scripts/build-docker.sh
```

## 🎯 Next Steps

1. **Start Docker Desktop** (if not already running)
2. **Test the build**: `./scripts/build-docker.sh`
3. **Configure production**: Copy `.env.production.template` to `.env.production`
4. **Deploy**: `./scripts/deploy.sh prod --build`
5. **Set up GitHub Actions**: Push to GitHub to trigger automated builds

## 📚 Documentation

- 📖 **[Docker Guide](docs/DOCKER.md)** - Comprehensive Docker documentation
- 🚀 **[Deployment Guide](DEPLOYMENT.md)** - Production deployment options
- ⚙️ **[Setup Guide](SETUP.md)** - Initial configuration

## 🐛 Troubleshooting

### Common Issues
1. **Docker not running**: Start Docker Desktop
2. **Build failures**: Check Dockerfile and dependencies
3. **Container won't start**: Check logs with `docker logs elova`
4. **Health check fails**: Verify application is responding

### Getting Help
1. Check the logs: `./scripts/deploy.sh logs`
2. Test health endpoint: `curl http://localhost:3000/api/health`
3. Review [troubleshooting docs](docs/DOCKER.md#troubleshooting)
4. Open a GitHub issue

---

## 🎉 You're All Set!

Elova is now fully containerized with:
- ✅ Optimized production Docker images
- ✅ Automated CI/CD pipeline
- ✅ Separate development and production configurations
- ✅ Easy deployment scripts
- ✅ Comprehensive documentation

**Happy containerizing! 🚀**