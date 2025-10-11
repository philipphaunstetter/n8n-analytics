#!/bin/bash

# Elova Release Management Script
# Usage: ./scripts/release.sh [major|minor|patch|beta|rc] [--dry-run]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PACKAGE_JSON="package.json"
DRY_RUN=false

# Parse arguments
RELEASE_TYPE=$1
if [[ "$2" == "--dry-run" || "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    if [[ "$1" == "--dry-run" ]]; then
        RELEASE_TYPE=$2
    fi
fi

# Help function
show_help() {
    echo "Elova Release Management Script"
    echo ""
    echo "Usage: $0 [RELEASE_TYPE] [--dry-run]"
    echo ""
    echo "RELEASE_TYPES:"
    echo "  major     - Bump major version (1.0.0 -> 2.0.0)"
    echo "  minor     - Bump minor version (1.0.0 -> 1.1.0)"
    echo "  patch     - Bump patch version (1.0.0 -> 1.0.1)"
    echo "  beta      - Create beta pre-release (1.0.0 -> 1.1.0-beta.1)"
    echo "  rc        - Create release candidate (1.1.0-beta.2 -> 1.1.0-rc.1)"
    echo ""
    echo "Options:"
    echo "  --dry-run - Show what would be done without making changes"
    echo ""
    echo "Examples:"
    echo "  $0 patch              # Release v1.0.1"
    echo "  $0 beta --dry-run     # Preview beta release"
    echo "  $0 minor              # Release v1.1.0"
}

# Validation
if [[ -z "$RELEASE_TYPE" ]]; then
    show_help
    exit 1
fi

if [[ ! "$RELEASE_TYPE" =~ ^(major|minor|patch|beta|rc)$ ]]; then
    echo -e "${RED}❌ Invalid release type: $RELEASE_TYPE${NC}"
    show_help
    exit 1
fi

# Check if we're in git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not in a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
if [[ -n "$(git status --porcelain)" ]]; then
    echo -e "${RED}❌ You have uncommitted changes. Please commit or stash them first.${NC}"
    git status --short
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}ℹ️  Current version: ${CURRENT_VERSION}${NC}"

# Calculate next version
case $RELEASE_TYPE in
    major)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print ($1+1)".0.0"}')
        BRANCH="main"
        ;;
    minor)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print $1"."($2+1)".0"}')
        BRANCH="main"
        ;;
    patch)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print $1"."$2"."($3+1)}')
        BRANCH="main"
        ;;
    beta)
        # Extract base version and increment minor for beta
        BASE_VERSION=$(echo $CURRENT_VERSION | sed 's/-.*$//')
        if [[ $CURRENT_VERSION == *"beta"* ]]; then
            # Increment beta number
            BETA_NUM=$(echo $CURRENT_VERSION | sed 's/.*beta\.//' | sed 's/-.*//')
            NEW_VERSION="${BASE_VERSION}-beta.$((BETA_NUM + 1))"
        else
            # First beta of next minor version
            NEXT_MINOR=$(echo $BASE_VERSION | awk -F. '{print $1"."($2+1)".0"}')
            NEW_VERSION="${NEXT_MINOR}-beta.1"
        fi
        BRANCH="develop"
        ;;
    rc)
        # Convert beta to rc or increment rc
        if [[ $CURRENT_VERSION == *"beta"* ]]; then
            BASE_VERSION=$(echo $CURRENT_VERSION | sed 's/-beta.*$//')
            NEW_VERSION="${BASE_VERSION}-rc.1"
        elif [[ $CURRENT_VERSION == *"rc"* ]]; then
            BASE_VERSION=$(echo $CURRENT_VERSION | sed 's/-rc.*$//')
            RC_NUM=$(echo $CURRENT_VERSION | sed 's/.*rc\.//')
            NEW_VERSION="${BASE_VERSION}-rc.$((RC_NUM + 1))"
        else
            echo -e "${RED}❌ Can only create RC from beta or existing RC versions${NC}"
            exit 1
        fi
        BRANCH="develop"
        ;;
esac

# Check if we're on the right branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
    echo -e "${YELLOW}⚠️  You're on branch '$CURRENT_BRANCH' but should be on '$BRANCH' for $RELEASE_TYPE release${NC}"
    echo -e "${BLUE}ℹ️  Switching to $BRANCH...${NC}"
    if [[ "$DRY_RUN" == "false" ]]; then
        git checkout "$BRANCH"
        git pull origin "$BRANCH"
    fi
fi

echo -e "${GREEN}🎯 Planning $RELEASE_TYPE release: ${CURRENT_VERSION} -> ${NEW_VERSION}${NC}"

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}🔍 DRY RUN - The following would be executed:${NC}"
    echo "  1. Update package.json version to $NEW_VERSION"
    echo "  2. Commit changes"
    echo "  3. Create and push git tag v$NEW_VERSION"
    echo "  4. Push to origin/$BRANCH"
    echo ""
    echo -e "${BLUE}ℹ️  Run without --dry-run to execute these changes${NC}"
    exit 0
fi

# Confirm the release
echo -e "${YELLOW}❓ Continue with $RELEASE_TYPE release v${NEW_VERSION}? [y/N]${NC}"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Release cancelled${NC}"
    exit 1
fi

# Update package.json version
echo -e "${BLUE}📝 Updating package.json version...${NC}"
npm version "$NEW_VERSION" --no-git-tag-version

# Commit changes
echo -e "${BLUE}💾 Committing changes...${NC}"
git add package.json
git commit -m "chore: bump version to v${NEW_VERSION}

Release type: $RELEASE_TYPE
Previous version: $CURRENT_VERSION"

# Create and push tag
echo -e "${BLUE}🏷️  Creating git tag...${NC}"
if [[ "$RELEASE_TYPE" =~ ^(beta|rc)$ ]]; then
    TAG_MESSAGE="Pre-release v${NEW_VERSION}

This is a $RELEASE_TYPE pre-release version.
- Use for testing and development
- Not recommended for production use"
else
    TAG_MESSAGE="Release v${NEW_VERSION}

Stable release ready for production use."
fi

git tag -a "v${NEW_VERSION}" -m "$TAG_MESSAGE"

# Push changes
echo -e "${BLUE}🚀 Pushing to origin...${NC}"
git push origin "$BRANCH"
git push origin "v${NEW_VERSION}"

echo -e "${GREEN}✅ Release v${NEW_VERSION} completed successfully!${NC}"
echo ""
echo -e "${BLUE}ℹ️  Next steps:${NC}"
if [[ "$RELEASE_TYPE" =~ ^(beta|rc)$ ]]; then
    echo "  • GitHub Actions will build and publish Docker image with tags:"
    echo "    - ghcr.io/philipphaunstetter/n8n-analytics:${NEW_VERSION}"
    echo "    - ghcr.io/philipphaunstetter/n8n-analytics:beta (for beta releases)"
    echo "  • Users can test with: docker pull ghcr.io/philipphaunstetter/n8n-analytics:beta"
else
    echo "  • GitHub Actions will build and publish Docker image with tags:"
    echo "    - ghcr.io/philipphaunstetter/n8n-analytics:${NEW_VERSION}"
    echo "    - ghcr.io/philipphaunstetter/n8n-analytics:latest"
    echo "  • Consider creating a GitHub Release with release notes"
    echo "  • Merge develop back to main if this was a stable release"
fi