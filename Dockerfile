# ==========================================
# Builder
# ==========================================
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat make g++ python3 openssl

WORKDIR /app

# Install all dependencies (workspaces need all package.json files first)
COPY package*.json ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/docs/package.json ./apps/docs/
COPY packages/cli/package.json ./packages/cli/
COPY packages/core/package.json ./packages/core/
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate --schema=apps/dashboard/prisma/schema.prisma

# Build packages/core and packages/cli first (dashboard depends on them)
RUN npm run build -w packages/core
RUN npm run build -w packages/cli

# Build Next.js app
RUN npm run build -w apps/dashboard

# Compile server.ts -> apps/dashboard/dist_server/server.js
RUN npx tsc -p apps/dashboard/tsconfig.server.json


# ==========================================
# Production
# ==========================================
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Install production dependencies only (workspaces)
COPY package*.json ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/docs/package.json ./apps/docs/
COPY packages/cli/package.json ./packages/cli/
COPY packages/core/package.json ./packages/core/
RUN npm ci --omit=dev

# Copy built artifacts from builder
COPY --from=builder /app/apps/dashboard/.next            ./apps/dashboard/.next
COPY --from=builder /app/apps/dashboard/public           ./apps/dashboard/public
COPY --from=builder /app/apps/dashboard/dist_server      ./apps/dashboard/dist_server
COPY --from=builder /app/apps/dashboard/prisma           ./apps/dashboard/prisma
COPY --from=builder /app/packages/core/dist              ./packages/core/dist
COPY --from=builder /app/packages/cli/dist               ./packages/cli/dist

# Expose dashboard port
EXPOSE 3000

# Run DB migrations then start the custom server
CMD ["sh", "-c", "npx prisma db push --schema=apps/dashboard/prisma/schema.prisma --accept-data-loss && node apps/dashboard/dist_server/server.js"]
