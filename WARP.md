# Elova - n8n Analytics Platform

## Project Overview
Elova is a workflow observability platform designed to monitor and analyze n8n workflows. This project is **container-first** and does not use a traditional development server setup.

## Development Rules

### ⚠️ No Development Server in Development Repo
**Important**: This project does NOT run a development server or Docker containers in the development repository.

- **Do NOT use**: `npm run dev` in the development repo
- **Do NOT use**: `docker compose up` in the development repo
- **Development repo is for**: Code changes, testing builds, documentation
- **Deployment/Testing**: Done on remote containers or separate deployment environment

### Development Workflow

#### 1. Development Repository (This Repo)
```bash
# Make code changes, test builds, update docs
# NO servers or containers are run here

# Test TypeScript compilation
npm run build

# Run linting
npm run lint
```

#### 2. Testing/Deployment Environment (Separate)
```bash
# Deploy to remote container or testing environment
# This happens OUTSIDE of the development repository

# Example: Deploy to remote server
git push origin main  # Triggers deployment pipeline

# Or: Test in separate environment
# Copy code to testing directory and run containers there
```

#### 3. Debugging (Remote Container)
```bash
# Debug on remote deployment, not in development repo
# Access via SSH or container management tools
```

## Configuration

### Environment Setup
The application uses database-stored configuration, NOT environment variables for n8n integration.

1. **Copy environment template**: `cp .env.example .env.local`
2. **Key settings**:
   ```env
   # Disable demo mode to show real data
   NEXT_PUBLIC_ENABLE_DEMO_MODE=false
   ELOVA_DEMO_MODE=false
   
   # Timezone
   GENERIC_TIMEZONE=UTC
   TZ=UTC
   ```

### n8n Integration Setup
n8n credentials are stored in the database through the setup wizard, not environment variables.

**Setup Process**:
1. Start the container: `docker compose up -d`
2. Access http://localhost:3000
3. Complete the setup wizard with your n8n credentials
4. The app will store configuration in SQLite database

## Debugging

### Check Demo Mode Status
If you see demo workflows instead of real data:

1. **Check environment variables**:
   ```bash
   grep DEMO .env.local
   # Should show: NEXT_PUBLIC_ENABLE_DEMO_MODE=false
   ```

2. **Check database configuration**:
   ```bash
   docker compose exec app sqlite3 /app/app.db "SELECT key, value FROM config WHERE key LIKE '%n8n%';"
   ```

3. **Check setup completion**:
   ```bash
   docker compose exec app sqlite3 /app/app.db "SELECT key, value FROM config WHERE key LIKE '%setup%';"
   ```

### Debug Endpoints
- **n8n API Test**: `GET /api/debug/n8n-raw` - Tests n8n connectivity
- **Admin Status**: `GET /api/debug/admin-status` - Shows setup status

### Common Issues

#### Issue: Still showing demo workflows
**Cause**: Either demo mode is enabled OR n8n is not properly configured in database

**Solution**:
1. Verify `NEXT_PUBLIC_ENABLE_DEMO_MODE=false` in `.env.local`
2. Complete the setup wizard if not done
3. Check database for n8n configuration

#### Issue: Setup wizard keeps appearing
**Cause**: Database doesn't have proper admin user setup

**Solution**: Check that all setup flags are properly set in database

## File Structure

### Configuration Files
- `.env.example` - Environment template
- `.env.local` - Local environment (create from example)
- `docker-compose.yml` - Container orchestration
- `Dockerfile` - Container build instructions

### Key Directories
- `src/app/api/` - API endpoints
- `src/lib/` - Utility libraries
- `docs/` - Documentation
- `scripts/` - Deployment scripts

## Security Notes

- All sensitive API keys are stored in database, not files
- Environment files (`.env.*`) are gitignored
- Never commit real API credentials to git

## Deployment

The application is designed for container deployment:

```bash
# Production build
docker compose up -d

# With PostgreSQL
docker compose --profile with-postgres up -d

# Full stack with Redis
docker compose --profile full-stack up -d
```

## Remember

1. **No `npm run dev`** - Use Docker containers only
2. **Database-first config** - n8n credentials go in database, not env files
3. **Container-native** - All development happens in containers
4. **Demo mode toggle** - Set `NEXT_PUBLIC_ENABLE_DEMO_MODE=false` for real data