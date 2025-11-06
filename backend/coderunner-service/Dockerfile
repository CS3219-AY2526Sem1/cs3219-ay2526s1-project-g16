# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app

# -----------------------------
# 0. System dependencies
# -----------------------------
# openjdk17-jdk → Java compiler and runtime
# python3 → Python interpreter
# curl → for healthchecks
# bash → optional for debugging and shell scripts
RUN apk add --no-cache \
    python3 \
    openjdk17-jdk \
    curl \
    bash

# -----------------------------
# 1. Copy manifests & install npm deps
# -----------------------------
COPY package*.json ./
RUN npm ci

# -----------------------------
# 2. Copy source
# -----------------------------
COPY . .

# -----------------------------
# 3. Environment setup
# -----------------------------
ENV NODE_ENV=production
ENV PORT=3005

# Expose port for container networking
EXPOSE 3005

# Healthcheck endpoint
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/health || exit 1

# -----------------------------
# 4. Start app with TSX
# -----------------------------
# Add this in package.json:
# "scripts": { "start:prod": "tsx src/app.ts" }
CMD ["npm", "run", "start:prod"]
