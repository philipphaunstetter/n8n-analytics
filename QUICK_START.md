# Elova Quick Start

**Elova** monitors and analyzes your n8n workflows. Get it running in 3 simple steps.

## Prerequisites

- **Docker** installed ([Get Docker](https://docs.docker.com/get-docker/))
- **n8n instance** with API access
- **5 minutes** of your time

## Installation

### Step 1: Create docker-compose.yml

**Option A: Download the simple template**
```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/philipphaunstetter/n8n-analytics/main/docker-compose.simple.yml
```

**Option B: Create manually**
Create a new file called `docker-compose.yml`:

```yaml
# Elova - Workflow Observability Platform
# Simple Docker Compose setup (n8n-style)

version: '3.8'

services:
  elova:
    image: ghcr.io/philipphaunstetter/n8n-analytics:latest
    container_name: elova
    restart: always
    ports:
      - "3000:3000"
    environment:
      # n8n connection settings
      - N8N_HOST=${N8N_HOST:-https://your-n8n-instance.com}
      - N8N_API_KEY=${N8N_API_KEY:-your_n8n_api_key_here}
      
      # Timezone (important for workflow schedules)
      - GENERIC_TIMEZONE=${GENERIC_TIMEZONE:-UTC}
      - TZ=${TZ:-UTC}
      
      # Application settings
      - NODE_ENV=production
      - PORT=3000
      
      # Enable demo mode with sample data
      - ELOVA_DEMO_MODE=${ELOVA_DEMO_MODE:-false}
    volumes:
      - elova_data:/home/node/.elova
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

volumes:
  elova_data:
```

### Step 2: Start Elova

```bash
docker compose up -d
```

### Step 3: Complete Initial Setup

Open **http://localhost:3000** in your browser. You'll see a setup wizard that will guide you through:

1. **n8n Connection Setup**
   - Enter your n8n instance URL
   - Add your n8n API key

2. **Application Configuration** 
   - Set your timezone (important for scheduling)
   - Choose demo mode or production settings

3. **Finish Setup**
   - Review your settings
   - Complete the configuration

**Getting your n8n API key:**
1. Open your n8n instance
2. Go to **Settings** > **n8n API** 
3. Create a new API key
4. Copy the key during setup

That's it! All configuration is stored securely in the database.

## Verification

Check if everything is working:

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f elova

# Test health endpoint
curl http://localhost:3000/api/health
```

## What's Next?

- **Dashboard:** View your workflow analytics at http://localhost:3000
- **Demo Mode:** Set `ELOVA_DEMO_MODE=true` to see sample data
- **Updates:** Run `docker compose pull && docker compose up -d` to update

## Common Issues

**Port 3000 already in use?**

Edit the `ports` line in your `docker-compose.yml`:
```yaml
ports:
  - "8080:3000"  # Use port 8080 instead
```

Common alternatives:
- `"8080:3000"` → http://localhost:8080
- `"3001:3000"` → http://localhost:3001  
- `"5000:3000"` → http://localhost:5000

**n8n connection issues?**
- Verify your `N8N_HOST` is accessible
- Check your `N8N_API_KEY` is valid
- Ensure n8n API is enabled

**Need help?**
- Check the logs: `docker compose logs elova`
- Visit: [GitHub Issues](https://github.com/philipphaunstetter/n8n-analytics/issues)

---

**Pro Tip:** Start with demo mode (`ELOVA_DEMO_MODE=true`) to explore the interface before connecting to your actual n8n instance!