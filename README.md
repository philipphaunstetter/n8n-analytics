# Elova - Workflow Observability for n8n

Monitor and analyze your n8n workflows with clear dashboards and reliable sync.

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](./QUICK_START.md)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![n8n](https://img.shields.io/badge/n8n-Compatible-FF6D5A?logo=n8n)](https://n8n.io)

## Quick Start (3 steps)

1) Create or reuse docker-compose.yml

See the example in this repo: [docker-compose.yml](./docker-compose.yml)

Or copy this minimal setup:

```yaml
version: '3.8'
services:
  elova:
    image: ghcr.io/philipphaunstetter/n8n-analytics:latest
    container_name: elova
    restart: always
    ports:
      - "3000:3000" # change the first port if needed (e.g. 8080:3000)
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

2) Start Elova

```bash
docker compose up -d
```

3) Complete setup

Open http://localhost:3000 and complete the setup wizard:
- Enter your n8n URL and API key
- Set your timezone
- Optionally enable demo mode

All configuration is stored in the application database—no .env is required for n8n credentials.

### Port configuration

Change the host port by editing the `ports` map:

```yaml
ports:
  - "8080:3000"  # Access via http://localhost:8080
```

## Features

- Real-time dashboard and key metrics
- Execution history with modes and statuses
- Workflow inventory (active/inactive/archived)
- Robust sync engine with safe startup behavior
- Container-first, SQLite by default

## Documentation

- [Quick Start](./QUICK_START.md)
- [Docker Installation](./docs/DOCKER_INSTALLATION.md)
- [Compose Variants](./docs/DOCKER_COMPOSE_FILES.md)
- [Volume Persistence Notes](./docs/DOCKER_VOLUME_FIX.md)

## Managing the container

```bash
# Status
docker compose ps

# Logs
docker compose logs -f elova

# Update to latest
docker compose pull && docker compose up -d

# Stop
docker compose down
```

## Common issues

Port already in use:

```yaml
ports:
  - "3001:3000"
```

n8n connection:
- Ensure the n8n API is enabled and reachable
- Verify the API key is correct

## Contributing

We welcome contributions! Please see CONTRIBUTING.md.

## License

MIT License - see [LICENSE](./LICENSE).
