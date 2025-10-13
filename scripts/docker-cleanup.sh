#!/bin/bash

# Docker Cleanup Script for Elova
# Helps maintain a clean Docker environment by removing unused images, containers, and volumes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Docker Cleanup for Elova${NC}"
echo "This script will help clean up your Docker environment"
echo ""

# Function to show current Docker disk usage
show_usage() {
    echo -e "${BLUE}📊 Current Docker Disk Usage:${NC}"
    docker system df
    echo ""
}

# Function to clean dangling images
clean_dangling_images() {
    echo -e "${YELLOW}🗑️  Removing dangling images...${NC}"
    RESULT=$(docker image prune -f)
    if [[ $RESULT == *"Total reclaimed space"* ]]; then
        echo "  $RESULT"
    else
        echo "  No dangling images to clean"
    fi
    echo ""
}

# Function to clean unused containers
clean_unused_containers() {
    echo -e "${YELLOW}📦 Removing stopped containers...${NC}"
    RESULT=$(docker container prune -f)
    if [[ $RESULT == *"Total reclaimed space"* ]]; then
        echo "  $RESULT"
    else
        echo "  No stopped containers to clean"
    fi
    echo ""
}

# Function to clean unused volumes
clean_unused_volumes() {
    echo -e "${YELLOW}💾 Removing unused volumes...${NC}"
    RESULT=$(docker volume prune -f)
    if [[ $RESULT == *"Total reclaimed space"* ]]; then
        echo "  $RESULT"
    else
        echo "  No unused volumes to clean"
    fi
    echo ""
}

# Function to clean unused networks
clean_unused_networks() {
    echo -e "${YELLOW}🌐 Removing unused networks...${NC}"
    RESULT=$(docker network prune -f)
    if [[ $RESULT == *"Total reclaimed space"* ]]; then
        echo "  $RESULT"
    else
        echo "  No unused networks to clean"
    fi
    echo ""
}

# Function to clean build cache
clean_build_cache() {
    echo -e "${YELLOW}🏗️  Removing build cache...${NC}"
    RESULT=$(docker builder prune -f)
    if [[ $RESULT == *"Total reclaimed space"* ]]; then
        echo "  $RESULT"
    else
        echo "  No build cache to clean"
    fi
    echo ""
}

# Function to remove old Elova images (keep latest 3)
clean_old_elova_images() {
    echo -e "${YELLOW}🏷️  Cleaning old Elova images (keeping latest 3)...${NC}"
    
    # Get all elova images except the latest tag, sorted by creation date (newest first)
    OLD_IMAGES=$(docker images --format "{{.ID}} {{.CreatedAt}} {{.Repository}}:{{.Tag}}" | \
                grep -E "(elova|n8n-analytics)" | \
                grep -v ":latest" | \
                sort -k2 -r | \
                tail -n +4 | \
                cut -d' ' -f1)
    
    if [ -z "$OLD_IMAGES" ]; then
        echo "  No old Elova images to remove"
    else
        echo "  Removing $(echo "$OLD_IMAGES" | wc -l) old Elova images..."
        echo "$OLD_IMAGES" | xargs docker rmi -f 2>/dev/null || true
    fi
    echo ""
}

# Main cleanup function
main_cleanup() {
    case ${1:-"standard"} in
        "light")
            show_usage
            clean_dangling_images
            ;;
        "standard")
            show_usage
            clean_dangling_images
            clean_unused_containers
            clean_unused_volumes
            clean_unused_networks
            ;;
        "aggressive")
            show_usage
            clean_dangling_images
            clean_unused_containers
            clean_unused_volumes
            clean_unused_networks
            clean_build_cache
            clean_old_elova_images
            ;;
        "nuclear")
            echo -e "${RED}⚠️  NUCLEAR OPTION: This will remove ALL unused Docker resources!${NC}"
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                show_usage
                docker system prune -a -f --volumes
            else
                echo "Aborted."
                exit 0
            fi
            ;;
        *)
            echo -e "${RED}Invalid option: $1${NC}"
            echo "Usage: $0 [light|standard|aggressive|nuclear]"
            echo ""
            echo "Options:"
            echo "  light      - Remove only dangling images"
            echo "  standard   - Remove dangling images, unused containers, volumes, networks"
            echo "  aggressive - Standard + build cache + old Elova images (keep latest 3)"
            echo "  nuclear    - Remove ALL unused Docker resources (use with caution!)"
            exit 1
            ;;
    esac
}

# Run cleanup
main_cleanup "$1"

# Show final usage
echo -e "${GREEN}✅ Cleanup completed!${NC}"
echo ""
show_usage

echo -e "${BLUE}💡 Pro Tips:${NC}"
echo "• Run '$(basename $0) light' after each build"
echo "• Run '$(basename $0) standard' weekly"
echo "• Run '$(basename $0) aggressive' monthly"
echo "• Add this to your build scripts for automatic cleanup"
echo ""
echo -e "${GREEN}🎉 Happy developing!${NC}"