// --- JavaScript / TypeScript Ecosystem ---

// Vite Template (React, Vue, Svelte, etc.) - CSR
export const viteDockerfile = `# Development stage
FROM node:22-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# Build stage
FROM development AS builder
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;

export const viteCompose = `services:
  app:
    build:
      context: .
      target: development
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
`;

// Next.js Template - SSR
export const nextDockerfile = `# Development stage
FROM node:22-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
# Ensure Host is 0.0.0.0 for Docker
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]

# Production stage
FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
CMD ["npm", "start"]
`;

export const nextCompose = `services:
  app:
    build:
      context: .
      target: development
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
`;

// Generic Node Template (Express, NestJS, etc.)
export const nodeDockerfile = `# Development stage
FROM node:22-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["npm", "start"]
`;

export const nodeCompose = `services:
  app:
    build:
      context: .
      target: development
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
`;

export const nodeDockerignore = `node_modules
dist
.git
.github
.vscode
.next
`;

// --- Generic Language Families ---

// Python Template (Flask, Django, FastAPI)
export const pythonDockerfile = `# Development stage
FROM python:3.11-slim AS development
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
# Adjust CMD based on your framework:
# FastAPI:  CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
# Flask:    CMD ["flask", "run", "--host=0.0.0.0", "--port=8000"]
# Django:   CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
CMD ["python", "-m", "http.server", "8000"]

# Production stage
FROM python:3.11-slim AS production
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Adjust CMD for production:
# FastAPI:  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
# Flask:    CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
# Django:   CMD ["gunicorn", "-b", "0.0.0.0:8000", "myproject.wsgi:application"]
CMD ["python", "-m", "http.server", "8000"]
`;

export const pythonCompose = `services:
  app:
    build:
      context: .
      target: development
    ports:
      - "8000:8000"
    volumes:
      - .:/app
    environment:
      - FLASK_ENV=development
      - PYTHONUNBUFFERED=1
`;

// Go Template (Generic)
export const goDockerfile = `# Development stage
FROM golang:1.22-alpine AS development
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Install Air for hot reload
RUN go install github.com/air-verse/air@latest
CMD ["air"]

# Build stage
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o main .

# Production stage
FROM alpine:latest AS production
WORKDIR /app
COPY --from=builder /app/main .
CMD ["./main"]
`;

export const goCompose = `services:
  app:
    build:
      context: .
      target: development
    ports:
      - "8080:8080"
    volumes:
      - .:/app
      - /go/pkg/mod
`;

// Java Template (Maven/Gradle generic-ish)
export const javaDockerfile = `# Development stage
FROM maven:3.9-eclipse-temurin-21 AS development
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
CMD ["mvn", "spring-boot:run"]

# Production stage
FROM eclipse-temurin:21-jre-alpine AS production
WORKDIR /app
COPY --from=development /app/target/*.jar app.jar
CMD ["java", "-jar", "app.jar"]
`;

export const javaCompose = `services:
  app:
    build:
      context: .
      target: development
    ports:
      - "8080:8080"
    volumes:
      - .:/app
      - ~/.m2:/root/.m2
`;

// PHP Template (Apache)
export const phpDockerfile = `# Development stage
FROM php:8.4-apache AS development
WORKDIR /var/www/html
COPY composer.json composer.lock ./
RUN apt-get update && apt-get install -y unzip
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install
COPY . .
CMD ["apache2-foreground"]

# Production stage
FROM php:8.2-apache AS production
WORKDIR /var/www/html
COPY . .
RUN chown -R www-data:www-data /var/www/html
`;

export const phpCompose = `services:
  app:
    build:
      context: .
      target: development
    ports:
      - "80:80"
    volumes:
      - .:/var/www/html
`;
// Laravel Template
export const laravelDockerfile = `# Development stage
FROM php:8.4-apache AS development
WORKDIR /var/www/html
COPY composer.json composer.lock ./
COPY artisan ./
COPY . .
RUN apt-get update && apt-get install -y unzip
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install --no-interaction --optimize-autoloader
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri "s!/var/www/html!\${APACHE_DOCUMENT_ROOT}!g" /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf \
 && a2enmod rewrite \
 && echo "ServerName localhost" >> /etc/apache2/apache2.conf \
 && chown -R www-data:www-data /var/www/html
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]

# Production stage
FROM php:8.4-apache AS production
WORKDIR /var/www/html
COPY . .
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri "s!/var/www/html!\${APACHE_DOCUMENT_ROOT}!g" /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf \
 && a2enmod rewrite \
 && echo "ServerName localhost" >> /etc/apache2/apache2.conf \
 && chown -R www-data:www-data /var/www/html
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]
`;

export const laravelCompose = `services:
  app:
    build:
      context: .
      target: development
    ports:
      - "80:80"
    volumes:
      - .:/var/www/html
    environment:
      - APP_ENV=local
      - APP_DEBUG=true
`;

export const laravelEntrypoint = `#!/bin/sh
set -e

# Fix permissions for Laravel writable directories and database when the
# project is bind-mounted into the container so the webserver can write files.
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database 2>/dev/null || true
chmod -R 0775 /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database 2>/dev/null || true

# Ensure sqlite database file exists and is writable
if [ -d /var/www/html/database ]; then
	if [ ! -f /var/www/html/database/database.sqlite ]; then
		touch /var/www/html/database/database.sqlite || true
	fi
	chown www-data:www-data /var/www/html/database/database.sqlite 2>/dev/null || true
	chmod 0664 /var/www/html/database/database.sqlite 2>/dev/null || true
fi

# Execute the container command (e.g. apache2-foreground)
exec "$@"
`;
