# ==========================================
# Development
# ==========================================
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]


# ==========================================
# Builder
# ==========================================
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat make g++ python3
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build


# ==========================================
# Production
# ==========================================
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
