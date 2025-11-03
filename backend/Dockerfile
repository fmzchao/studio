# Multi-stage build for backend
FROM oven/bun:alpine AS base

# Install build dependencies
RUN apk add --no-cache \
    ca-certificates \
    openssl \
    && update-ca-certificates

# Set working directory
WORKDIR /app

# Copy workspace root files
COPY package.json bun.lock ./

# Copy only backend and necessary packages
COPY backend/package.json ./backend/
COPY packages/backend-client/package.json ./packages/backend-client/
COPY packages/shared/package.json ./packages/shared/
COPY packages/component-sdk/package.json ./packages/component-sdk/

# Install dependencies (will only install backend and its dependencies)
WORKDIR /app/backend
RUN bun install --frozen-lockfile

# Copy source code
COPY backend/src ./src/
COPY backend/drizzle.config.ts ./
COPY packages ../../packages/

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    openssl \
    dumb-init \
    && update-ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S shipsec -u 1001

# Set working directory
WORKDIR /app

# Copy built application and dependencies
COPY --from=base --chown=shipsec:nodejs /app/build ./build
COPY --from=base --chown=shipsec:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=shipsec:nodejs /app/package.json ./

# Switch to non-root user
USER shipsec

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3211/health || exit 1

# Expose port
EXPOSE 3211

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["bun", "run", "start:prod"]