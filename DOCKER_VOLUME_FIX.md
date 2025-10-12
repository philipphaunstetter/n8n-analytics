# Docker Volume Persistence Issue - Analysis & Fix

## Problem Identified

The setup was losing configuration data during `docker compose pull && docker compose up -d` due to **two critical issues**:

### Issue 1: Volume Mount Path Mismatch

**Before (Broken):**
- Docker Compose volume mount: `elova_data:/home/node/.elova`
- Init script data directory: `/app/data`
- Database location: `/app/data/elova.db`

**Result:** Database was written to `/app/data` (not persisted), while volume was mounted to `/home/node/.elova` (empty).

**After (Fixed):**
- Docker Compose volume mount: `elova_data:/app/data` ✅
- Init script data directory: `/app/data` ✅
- Database location: `/app/data/elova.db` ✅

### Issue 2: Forced First Run

**Before (Broken):**
```yaml
environment:
  - ELOVA_FIRST_RUN=true  # Always forced first run!
```

**After (Fixed):**
```yaml
environment:
  # - ELOVA_FIRST_RUN=true  # Removed - auto-detect from volume state
```

## Root Cause Analysis

### Why Docker Volumes Seemed to Reset

1. **Volume was actually persistent** - `docker compose down` (without `-v`) preserves volumes
2. **But data was written to wrong location** - outside the mounted volume
3. **First run flag was hardcoded** - initialization ran every startup
4. **New containers always appeared "fresh"** - because real data was never persisted

### Command Sequence That Caused Data Loss

```bash
# Container writes data to /app/data (NOT in volume)
docker compose up -d

# Configure settings via web UI (saved to /app/data/elova.db)
# Data exists in container but NOT in volume

# Update process
docker compose down          # Container destroyed, /app/data lost
docker compose pull          # New image pulled  
docker compose up -d         # New container, ELOVA_FIRST_RUN=true, appears "reset"
```

## The Fix Applied

### 1. Fixed Volume Mount Path
```yaml
# OLD: Volume mounted to unused path
volumes:
  - elova_data:/home/node/.elova

# NEW: Volume mounted to actual data directory  
volumes:
  - elova_data:/app/data
```

### 2. Removed Hardcoded First Run
```yaml
# OLD: Always forced initialization
environment:
  - ELOVA_FIRST_RUN=true

# NEW: Auto-detect based on marker file in volume
environment:
  # - ELOVA_FIRST_RUN=true  # Removed
```

### 3. Updated Init Script
- First run detection now based on marker file: `/app/data/.initialized`
- If marker exists in volume → skip initialization  
- If marker missing from volume → run first-time setup

## Verification

### To Test the Fix:

1. **Deploy with new config:**
   ```bash
   docker compose down
   docker compose pull
   docker compose up -d
   ```

2. **Configure settings via web UI** (e.g., n8n URL/API key)

3. **Simulate update:**
   ```bash
   docker compose down       # Don't use -v!
   docker compose pull  
   docker compose up -d
   ```

4. **Check if settings persist** - they should now be retained!

### Debug Volume Contents:

```bash
# Check what's actually in the volume
docker compose exec elova ls -la /app/data/

# Should show:
# - .initialized (marker file)
# - elova.db (SQLite database)  
# - runtime-config.json
```

### Inspect Volume:

```bash
# See volume info
docker volume inspect n8n-analytics_elova_data

# Check volume contents from host (Linux/macOS)  
docker run --rm -v n8n-analytics_elova_data:/data alpine ls -la /data
```

## Migration for Existing Users

### If You Have Existing Volume with Wrong Path:

```bash
# 1. Backup existing volume (if any data exists)
docker run --rm -v n8n-analytics_elova_data:/old -v $(pwd)/backup:/backup alpine cp -r /old/* /backup/ 2>/dev/null || echo "No data to backup"

# 2. Update to new docker-compose.yml with fixed paths

# 3. Start with new configuration  
docker compose up -d

# 4. Restore data if needed (usually not needed as old path was unused)
# docker run --rm -v n8n-analytics_elova_data:/data -v $(pwd)/backup:/backup alpine cp -r /backup/* /data/ 2>/dev/null || echo "No data to restore"
```

### For Fresh Installs:

Just use the updated `docker-compose.yml` - everything will work correctly from the start.

## Summary

- ✅ **Volume paths now match** between compose file and init script
- ✅ **First run auto-detected** from volume state, not hardcoded  
- ✅ **Configuration persists** through container updates
- ✅ **Database survives** `docker compose down && docker compose up`
- ✅ **Settings retention** works as expected

The "volume reset" was actually a path mismatch + forced reinitialization issue, not a Docker volume problem.