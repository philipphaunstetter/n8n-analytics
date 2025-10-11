#!/bin/bash

# Elova Docker Build Script
# This script builds the Docker image with proper tagging and versioning

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="elova"
DOCKERFILE="Dockerfile"
REGISTRY="${DOCKER_REGISTRY:-}"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

echo -e "${BLUE}🐳 Building Elova Docker Image${NC}"
echo -e "${YELLOW}Version: ${VERSION}${NC}"
echo -e "${YELLOW}Git Commit: ${GIT_COMMIT}${NC}"
echo -e "${YELLOW}Build Date: ${BUILD_DATE}${NC}"
echo ""

# Build arguments
BUILD_ARGS=(
    --build-arg "VERSION=${VERSION}"
    --build-arg "GIT_COMMIT=${GIT_COMMIT}"
    --build-arg "BUILD_DATE=${BUILD_DATE}"
)

# Tags to apply
TAGS=(
    "${IMAGE_NAME}:latest"
    "${IMAGE_NAME}:${VERSION}"
    "${IMAGE_NAME}:${VERSION}-${GIT_COMMIT}"
)

# Add registry prefix if specified
if [ -n "$REGISTRY" ]; then
    REGISTRY_TAGS=()
    for tag in "${TAGS[@]}"; do
        REGISTRY_TAGS+=("${REGISTRY}/${tag}")
    done
    TAGS+=("${REGISTRY_TAGS[@]}")
fi

# Build the Docker image
echo -e "${GREEN}📦 Building Docker image...${NC}"
docker build \
    "${BUILD_ARGS[@]}" \
    -t "${TAGS[0]}" \
    -f "$DOCKERFILE" \
    .

# Apply additional tags
echo -e "${GREEN}🏷️  Applying tags...${NC}"
for tag in "${TAGS[@]:1}"; do
    echo "  → $tag"
    docker tag "${TAGS[0]}" "$tag"
done

# Show image info
echo ""
echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo -e "${BLUE}📊 Image Information:${NC}"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep "^${IMAGE_NAME}"

echo ""
echo -e "${BLUE}🚀 Quick Start Commands:${NC}"
echo -e "  ${YELLOW}# Run with Docker Compose${NC}"
echo -e "  docker-compose up -d"
echo ""
echo -e "  ${YELLOW}# Run standalone${NC}"
echo -e "  docker run -d -p 3000:3000 --name elova-app ${IMAGE_NAME}:latest"
echo ""
echo -e "  ${YELLOW}# Push to registry (if configured)${NC}"
if [ -n "$REGISTRY" ]; then
    echo -e "  docker push ${REGISTRY}/${IMAGE_NAME}:latest"
    echo -e "  docker push ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
else
    echo -e "  ${RED}# Set DOCKER_REGISTRY environment variable first${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Happy containerizing!${NC}"