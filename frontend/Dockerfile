# syntax=docker/dockerfile:1
# Final: TSX runtime + safe Prisma generation with dummy URL

FROM node:20-alpine
WORKDIR /app

# -----------------------------
# 1. Copy manifests & prisma
# -----------------------------
COPY package*.json ./
# COPY prisma ./prisma

# Install dependencies (include dev for tsx)
RUN npm ci

# -----------------------------
# 2. Copy source
# -----------------------------
COPY . .

# -----------------------------
# 3. Build
# -----------------------------
RUN npm run build

# -----------------------------
# 4. Runtime setup
# -----------------------------
ENV NODE_ENV=production

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8000/healthz || exit 1

# -----------------------------
# 5. Start app (tsx)
# -----------------------------
# package.json should have:
# "start:prod": "npm run migrate:deploy && tsx src/server.ts"
CMD ["npm", "run", "serve"]
