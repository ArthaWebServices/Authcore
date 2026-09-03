# Development Workflow: AuthCore

## 1. Local Development Setup

### 1.1 Prerequisites
- Node.js 20.10+ (use `nvm` or `volta`)
- pnpm 9+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)
- Redis 7 (via Docker)
- Git + GitHub CLI (`gh`)

### 1.2 Initial Setup
```bash
# Clone & install
git clone https://github.com/yourorg/authcore.git
cd authcore
pnpm install

# Start infrastructure
docker compose -f docker/docker-compose.yml up -d

# Copy environment
cp .env.example .env
# Edit .env with your values (generate keys with scripts/generate-keys.ts)

# Database setup
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run migrations
pnpm db:seed        # Seed development data

# Start dev server
pnpm dev
