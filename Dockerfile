# Development stage
FROM node:22-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ==========================================
# 1. Builder Stage (Compiles TypeScript)
# ==========================================
FROM node:22-alpine AS builder

# Install build tools required by `node-ssh` native bindings
RUN apk add --no-cache libc6-compat make g++ python3

WORKDIR /app

# Copy lockfile and package.json
COPY package*.json ./

# Install ALL dependencies (including devDependencies like typescript)
RUN npm install

# Copy the rest of the source code
COPY . .

# Compile TypeScript to generate the real /dist folder
RUN npm run build


# ==========================================
# 2. Production Stage (Lean Image)
# ==========================================
FROM node:22-alpine AS production

# node-ssh still needs these at runtime/install
RUN apk add --no-cache libc6-compat make g++ python3

WORKDIR /app

# Copy package files
COPY package*.json ./

# CRITICAL FIX: Copy the real dist/ folder BEFORE running npm ci.
# Now npm will see dist/index.js and successfully link the "bin" field!
COPY --from=builder /app/dist ./dist

# Install strictly production dependencies
RUN npm install

# Copy any remaining necessary files (e.g., README, templates)
# Assuming you don't need the src/ folder in production
COPY . .

# Note: You have EXPOSE 3000 in your original file, but a CLI usually doesn't need ports
# unless it spins up a local server. Keep it if needed!
EXPOSE 3000

CMD ["npm", "start"]