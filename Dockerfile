# ====================================
# HoloDex - Production Build
# ====================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production && \
    cp -R node_modules /prod_node_modules && \
    npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# ====================================
# Production Image
# ====================================
FROM node:20-alpine AS production

# Install sharp dependencies for Alpine
RUN apk add --no-cache \
    vips-dev \
    build-base \
    python3 \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy production dependencies
COPY --from=builder /prod_node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Create output and brands directories
RUN mkdir -p /app/output /app/brands && \
    chown -R node:node /app

# Use non-root user
USER node

# Environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    MODE=all \
    OUTPUT_DIR=/app/output \
    BRAND_STORAGE_DIR=/app/brands \
    LOG_LEVEL=info

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
