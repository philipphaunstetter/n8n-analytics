#!/bin/bash

# Elova Management Script
# Simple wrapper for common Docker operations

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper functions
success() { echo -e "${GREEN}✓ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
}

case "${1:-help}" in
    start)
        echo "Starting Elova..."
        check_docker
        docker compose up -d
        success "Elova started at http://localhost:3000"
        ;;
    stop)
        echo "Stopping Elova..."
        check_docker
        docker compose down
        success "Elova stopped"
        ;;
    restart)
        echo "Restarting Elova..."
        check_docker
        docker compose restart
        success "Elova restarted"
        ;;
    logs)
        check_docker
        docker compose logs -f elova
        ;;
    status)
        check_docker
        docker compose ps
        ;;
    update)
        echo "Updating Elova..."
        check_docker
        docker compose pull
        docker compose up -d
        success "Elova updated"
        ;;
    health)
        if curl -sf http://localhost:3000/api/health > /dev/null; then
            success "Elova is healthy"
        else
            error "Elova is not responding"
            exit 1
        fi
        ;;
    *)
        echo "Elova Management Script"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  start   - Start Elova"
        echo "  stop    - Stop Elova"
        echo "  restart - Restart Elova"
        echo "  logs    - Show logs"
        echo "  status  - Show status"
        echo "  update  - Update to latest version"
        echo "  health  - Check if healthy"
        ;;
esac