# Multi-stage build for frontend
FROM oven/bun:alpine AS base

# Install build dependencies
RUN apk add --no-cache \
    ca-certificates \
    && update-ca-certificates

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/
COPY packages/backend-client/package.json ./packages/backend-client/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY frontend/src ./frontend/src/
COPY frontend/public ./frontend/public/
COPY frontend/index.html ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY packages ./packages/

# Build the application
WORKDIR /app/frontend
RUN bun run build

# Production stage - use nginx for serving static files
FROM nginx:1.27-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    && update-ca-certificates

# Create nginx config for SPA
RUN echo 'server { \
    listen 8080; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    location / { \
        try_files $uri $uri/ /index.html; \
        add_header Cache-Control "no-cache, no-store, must-revalidate"; \
        add_header Pragma "no-cache"; \
        add_header Expires "0"; \
    } \
    \
    location /assets/ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json; \
}' > /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=base /app/frontend/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S nginx && \
    adduser -S shipsec -u 1001 -G nginx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080 || exit 1

# Expose port
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]