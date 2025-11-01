# syntax=docker/dockerfile:1
# Final: TSX runtime + safe Prisma generation with dummy URL

FROM node:20-alpine
WORKDIR /app

# -----------------------------
# 1. Copy manifests & prisma
# -----------------------------
COPY package*.json ./

# Install dependencies (include dev for tsx)
RUN npm ci

# -----------------------------
# 2. Copy source
# -----------------------------
COPY . .

# -----------------------------
# 3. Runtime setup
# -----------------------------
ENV NODE_ENV=production

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

# -----------------------------
# 4. Start app (tsx)
# -----------------------------
# package.json should have:
# "start:prod": "npm run migrate:deploy && tsx src/server.ts"
CMD ["npm", "run", "start:prod"]
