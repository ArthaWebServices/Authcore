# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

# Install required system tools for build & Prisma engine
RUN apk add --no-cache openssl libc6-compat

# Enable Corepack for pnpm
RUN corepack enable

# Copy workspace and lock files first for Docker layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/core/package.json ./packages/core/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/database/package.json ./packages/database/
COPY packages/validators/package.json ./packages/validators/
COPY packages/client/package.json ./packages/client/
COPY packages/client-react/package.json ./packages/client-react/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/migration-tool/package.json ./packages/migration-tool/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the repository source
COPY . .

# Generate Prisma Client
RUN pnpm --filter @authcore/database db:generate

# Build all packages and apps
RUN pnpm build

# --- Production Runner Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache dumb-init openssl

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules and built packages from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

EXPOSE 3000

USER node

ENTRYPOINT ["dumb-init", "node", "--import", "tsx", "apps/api/dist/main.js"]