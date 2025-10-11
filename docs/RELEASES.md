# Release Process & Version Management

This document describes how Elova manages stable and pre-release versions.

## Overview

Elova uses a **dual-channel release strategy**:
- **Stable Channel**: Production-ready releases from `main` branch
- **Pre-release Channel**: Beta and RC versions from `develop` branch

## Branching Strategy

```
main (stable)           →  v1.0.0, v1.1.0, v1.2.0
├─ develop (pre-release) →  v1.1.0-beta.1, v1.1.0-rc.1
├─ feature/xxx          →  Feature development
└─ hotfix/xxx           →  Critical production fixes
```

### Branch Purposes

- **`main`**: Stable production releases only
- **`develop`**: Integration branch for pre-releases
- **`feature/*`**: Feature development branches
- **`hotfix/*`**: Critical production fixes

## Version Schema

### Stable Versions
- **Format**: `v1.2.3` (semantic versioning)
- **Docker Tags**: `latest`, `1.2.3`, `1.2`, `1`
- **Branch**: `main`
- **Use Case**: Production deployments

### Pre-release Versions
- **Beta**: `v1.2.0-beta.1`, `v1.2.0-beta.2`
- **Release Candidate**: `v1.2.0-rc.1`, `v1.2.0-rc.2`
- **Docker Tags**: `beta`, `1.2.0-beta.1`, `pre-release`
- **Branch**: `develop`
- **Use Case**: Testing, early access, development

## Release Process

### Using the Release Script

The `./scripts/release.sh` script automates version management:

```bash
# Preview what would happen (dry run)
./scripts/release.sh beta --dry-run

# Create releases
./scripts/release.sh patch     # v1.0.1 (stable)
./scripts/release.sh minor     # v1.1.0 (stable)
./scripts/release.sh major     # v2.0.0 (stable)
./scripts/release.sh beta      # v1.1.0-beta.1 (pre-release)
./scripts/release.sh rc        # v1.1.0-rc.1 (pre-release)
```

### Manual Release Process

If you prefer manual control:

#### Stable Release (main branch)
```bash
# 1. Switch to main and update
git checkout main
git pull origin main

# 2. Update version in package.json
npm version patch  # or minor, major

# 3. Create and push tag
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin main
git push origin v1.0.1
```

#### Pre-release (develop branch)
```bash
# 1. Switch to develop and update
git checkout develop
git pull origin develop

# 2. Update version for pre-release
npm version 1.1.0-beta.1 --no-git-tag-version

# 3. Commit and tag
git add package.json
git commit -m "chore: bump version to v1.1.0-beta.1"
git tag -a v1.1.0-beta.1 -m "Pre-release v1.1.0-beta.1"
git push origin develop
git push origin v1.1.0-beta.1
```

## Docker Image Distribution

### Stable Channel
- **Registry**: `ghcr.io/philipphaunstetter/n8n-analytics`
- **Tags**: `latest`, `1.2.3`, `1.2`, `1`
- **Installation**:
  ```yaml
  services:
    elova:
      image: ghcr.io/philipphaunstetter/n8n-analytics:latest
  ```

### Pre-release Channel
- **Registry**: `ghcr.io/philipphaunstetter/n8n-analytics`
- **Tags**: `beta`, `1.2.0-beta.1`, `pre-release`
- **Installation**:
  ```yaml
  services:
    elova:
      image: ghcr.io/philipphaunstetter/n8n-analytics:beta
  ```

## Workflow Automation

GitHub Actions automatically:
1. **Builds** Docker images on tag push
2. **Publishes** to GitHub Container Registry
3. **Tags** appropriately based on version type
4. **Runs** security scans and tests

### Triggered Events
- **Tag Push**: `v*` → Build and publish release
- **Main Push**: → Build `latest` tag
- **Develop Push**: → Build `beta` tag
- **PR**: → Build and test only

## Development Workflow

### Feature Development
```bash
# 1. Create feature branch from develop
git checkout develop
git checkout -b feature/new-analytics-view

# 2. Develop and test
# ... make changes ...

# 3. Create PR to develop branch
# PR triggers automated tests
```

### Pre-release Testing
```bash
# 1. Create beta from develop
./scripts/release.sh beta

# 2. Test beta version
docker run -d -p 3000:3000 ghcr.io/philipphaunstetter/n8n-analytics:beta

# 3. Create RC when ready
./scripts/release.sh rc

# 4. Final testing of RC
```

### Stable Release
```bash
# 1. Merge develop to main (via PR)
git checkout main
git merge develop

# 2. Create stable release
./scripts/release.sh minor

# 3. Update develop with new version base
git checkout develop
git merge main
```

## Version Support Policy

### Stable Releases
- **Latest Major**: Full support with security updates
- **Previous Major**: Security updates only for 6 months
- **Older Versions**: Community support only

### Pre-releases
- **Current Beta/RC**: Active development support
- **Previous Beta/RC**: No official support
- **Use Case**: Testing and development only

## Migration Between Channels

### Stable to Pre-release (Testing)
```bash
# Switch to beta for testing new features
docker pull ghcr.io/philipphaunstetter/n8n-analytics:beta
docker-compose down
# Update docker-compose.yml image tag to :beta
docker-compose up -d
```

### Pre-release to Stable
```bash
# Return to stable after testing
docker pull ghcr.io/philipphaunstetter/n8n-analytics:latest
docker-compose down
# Update docker-compose.yml image tag to :latest
docker-compose up -d
```

## Troubleshooting

### Common Issues

**Release script fails with uncommitted changes**
```bash
git status              # Check what's uncommitted
git add .              # Stage changes
git commit -m "fix: ..." # Commit changes
```

**Wrong branch for release type**
- Script will automatically switch branches
- Ensure you have push access to both `main` and `develop`

**Docker image not found**
- Check if GitHub Actions workflow completed successfully
- Verify tag was pushed: `git tag -l`
- Check GitHub Container Registry for published images

### Getting Help

1. **Check GitHub Actions**: Look at workflow runs for build status
2. **Verify Tags**: `git tag -l | grep v1.`
3. **Docker Registry**: Visit GitHub Package page for available images
4. **Logs**: Check container logs for runtime issues

## Best Practices

1. **Always use dry-run first**: `./scripts/release.sh beta --dry-run`
2. **Test pre-releases thoroughly** before promoting to stable
3. **Keep develop in sync** with main after stable releases
4. **Use semantic versioning** consistently
5. **Write meaningful release notes** for major versions
6. **Monitor production deployments** after stable releases