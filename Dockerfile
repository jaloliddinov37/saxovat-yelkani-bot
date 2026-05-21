# --- BUILD STAGE ---
FROM node:20-alpine AS builder

WORKDIR /src/app

# Copy package files first for caching
COPY package*.json ./

# Install all dependencies (development + production)
RUN npm ci

# Copy source code and config files
COPY tsconfig*.json ./
COPY src/ ./src/

# Compile the NestJS application
RUN npm run build

# Remove development dependencies to keep production image light
RUN npm prune --production

# --- PRODUCTION STAGE ---
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production

# Copy built resources and package files from builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Use non-root node user for security
USER node

# Expose port
EXPOSE 3000

# Start NestJS production build
CMD ["node", "dist/main"]
