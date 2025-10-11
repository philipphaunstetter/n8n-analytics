# Multi-stage Dockerfile for Elova - Workflow Observability Platform

# Build arguments
ARG VERSION="0.1.0"
ARG GIT_COMMIT="unknown"
ARG BUILD_DATE="unknown"

# Stage 1: Build dependencies and application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Set dummy Supabase environment variables for build (real ones will be provided at runtime)
ENV NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key
ENV SUPABASE_SERVICE_ROLE_KEY=dummy_service_key

# Build the Next.js application
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine AS runner

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S elova -u 1001

# Install runtime dependencies
RUN apk add --no-cache dumb-init curl

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# NOTE: Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, etc.) 
# should be provided at container runtime, not build time

# Set build metadata as environment variables
ARG VERSION
ARG GIT_COMMIT  
ARG BUILD_DATE
ENV APP_VERSION=${VERSION}
ENV APP_GIT_COMMIT=${GIT_COMMIT}
ENV APP_BUILD_DATE=${BUILD_DATE}

# Copy built application from builder stage
COPY --from=builder --chown=elova:nodejs /app/.next/standalone ./
COPY --from=builder --chown=elova:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=elova:nodejs /app/public ./public

# Create necessary directories
RUN mkdir -p /app/data /app/logs && \
    chown elova:nodejs /app/data /app/logs

# Switch to non-root user
USER elova

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node healthcheck.js || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]