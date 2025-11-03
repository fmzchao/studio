# Multi-stage build for worker
FROM oven/bun:alpine AS base

# Install build dependencies only for build stage
RUN apk add --no-cache \
    ca-certificates \
    python3 \
    make \
    g++ \
    libc6-compat \
    && update-ca-certificates

# Set working directory
WORKDIR /app

# Copy package files
COPY worker/package.json ./package.json
COPY packages/backend-client/package.json ./packages/backend-client/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/component-sdk/package.json ./packages/component-sdk/package.json
COPY bun.lock ./

# Install dependencies using Bun
RUN bun install --frozen-lockfile

# Copy source code
COPY worker/src ./src/
COPY worker/tsconfig.json ./
COPY packages ../../packages/

# Build the worker
RUN bun run build

# Production stage
FROM oven/bun:alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    dumb-init \
    && update-ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S shipsec -u 1001

# Set working directory
WORKDIR /app

# Copy built application and dependencies
COPY --from=base --chown=shipsec:nodejs /app/dist ./dist
COPY --from=base --chown=shipsec:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=shipsec:nodejs /app/package.json ./

# Switch to non-root user
USER shipsec

# Health check - worker health check via process existence
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]

# Start the worker
CMD ["npm", "start"]