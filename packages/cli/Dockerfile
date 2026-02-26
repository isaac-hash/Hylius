# syntax=docker/dockerfile:1

# Development stage
FROM node:22-alpine AS development
WORKDIR /app

# Create a non-privileged user.
RUN adduser -D -u 10001 appuser

# Download dependencies using cache and bind mounts.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    npm install

COPY . .
RUN chown -R appuser:appuser /app

# Switch to non-privileged user.
USER appuser
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM node:22-alpine AS production
WORKDIR /app

# Create a non-privileged user.
RUN adduser -D -u 10001 appuser

# Download dependencies using cache and bind mounts.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=bind,source=package.json,target=package.json \
    npm install --omit=dev

COPY . .
RUN chown -R appuser:appuser /app

# Switch to non-privileged user.
USER appuser
CMD ["npm", "start"]
