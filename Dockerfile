# Development stage
FROM node:22-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM node:22-alpine AS production
# Install build tools and compatibility libraries for native modules
RUN apk add --no-cache libc6-compat make g++ python3
WORKDIR /app
COPY package*.json ./
# Create dummy dist to satisfy npm ci bin linking
RUN mkdir -p dist && touch dist/index.js
RUN npm ci --omit=dev
COPY . .
CMD ["npm", "start"]
