# Elova Quick Start

Elova monitors and analyzes your n8n workflows. Get it running in 3 simple steps.

## Prerequisites

- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- An n8n instance with API access
- ~5 minutes

## 1) Create docker-compose.yml

Use the example in this repo: [docker-compose.yml](./docker-compose.yml)

Or create it manually:

```yaml
version: '3.8'
services:
  elova:
    image: ghcr.io/philipphaunstetter/n8n-analytics:latest
    container_name: elova
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GENERIC_TIMEZONE=UTC
      - TZ=UTC
    volumes:
      - elova_data:/app/data

volumes:
  elova_data:
```

## 2) Start Elova

```bash
docker compose up -d
```

## 3) Complete setup

Open http://localhost:3000 and follow the setup wizard:
- Enter your n8n URL and API key
- Set your timezone
- Optionally enable demo mode

All configuration (including n8n credentials) is stored securely in the database.

## Verify

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f elova

# Health endpoint
curl http://localhost:3000/api/health
```

## Common issues

Port 3000 in use:
```yaml
ports:
  - "8080:3000"
```

Connection to n8n:
- Ensure your n8n host is reachable from the Elova container
- Verify the API key is valid

## Need help?
- Logs: `docker compose logs -f elova`
- Issues: https://github.com/philipphaunstetter/n8n-analytics/issues

---

Tip: Try demo mode first to explore the interface before connecting to production.
