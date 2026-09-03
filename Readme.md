
---

## README.md

```markdown
# AuthCore

> A production-grade, self-hosted authentication platform built with TypeScript, Fastify, and PostgreSQL.

[![CI](https://github.com/yourorg/authcore/actions/workflows/ci.yml/badge.svg)](https://github.com/yourorg/authcore/actions/workflows/ci.yml)
[![Security](https://github.com/yourorg/authcore/actions/workflows/security.yml/badge.svg)](https://github.com/yourorg/authcore/actions/workflows/security.yml)
[![Coverage](https://img.shields.io/codecov/c/github/yourorg/authcore)](https://codecov.io/gh/yourorg/authcore)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Overview

AuthCore replaces third-party authentication providers (Clerk, Auth0, Supabase Auth) with a fully self-hosted, open-source alternative. Designed for security-first teams who need complete control over their authentication infrastructure.

### Key Features

- 🔐 **Secure by Default**: Argon2id password hashing, RS256 JWT with key rotation, refresh token rotation with reuse detection
- 🛡 **Multi-Factor Auth**: TOTP (RFC 6238) + WebAuthn/Passkeys (FIDO2 Level 2)
- 🌐 **OAuth 2.0 / OIDC**: Google, GitHub, Microsoft, GitLab with PKCE
- 🏢 **Multi-Tenant**: Organizations, teams, RBAC with custom roles/permissions
- 📊 **Observability**: OpenTelemetry tracing, Prometheus metrics, structured logging, audit logs
- ⚡ **High Performance**: <50ms token validation, horizontal scaling, connection pooling
- 🔧 **Developer Experience**: Type-safe SDK, interactive API docs, comprehensive runbooks

## Quick Start

### Prerequisites
- Node.js 20.10+
- pnpm 9+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)
- Redis 7 (via Docker)

### Development Setup

```bash
# Clone repository
git clone https://github.com/yourorg/authcore.git
cd authcore

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, Mailpit)
docker compose -f docker/docker-compose.yml up -d

# Configure environment
cp .env.example .env
# Edit .env with generated keys (see scripts/generate-keys.ts)

# Initialize database
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start development server
pnpm dev

Server runs at http://localhost:3000
API Docs: http://localhost:3000/docs
Mailpit UI: http://localhost:8025

Generate Keys
bash
# Generate JWT keys
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
# Generate encryption keys (32 bytes base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
Project Structure
authcore/
├── .github/workflows/     # CI/CD pipelines
├── docs/                  # Documentation
│   ├── api/              # OpenAPI specs
│   ├── architecture/     # ADRs, diagrams
│   └── runbooks/         # Operational procedures
├── prisma/
│   ├── migrations/       # Database migrations
│   └── schema.prisma     # Prisma schema
├── src/
│   ├── app.ts            # Fastify app factory
│   ├── main.ts           # Entry point
│   ├── config/           # Validated configuration
│   ├── modules/          # Feature modules
│   │   ├── auth/         # Core authentication
│   │   ├── mfa/          # Multi-factor authentication
│   │   ├── oauth/        # OAuth/OIDC providers
│   │   ├── users/        # User management
│   │   ├── sessions/     # Session management
│   │   ├── admin/        # Admin operations
│   │   ├── webhooks/     # Webhook delivery
│   │   └── audit/        # Audit logging
│   ├── shared/           # Shared utilities
│   ├── plugins/          # Fastify plugins
│   └── types/            # Global types
├── tests/                # Test suites
├── scripts/              # Operational scripts
├── docker/               # Docker files
└── k8s/                  # Kubernetes manifests
API Documentation
Interactive API documentation available at /docs (Scalar UI) or /.well-known/openid-configuration (OIDC Discovery).

Core Endpoints
Method	Endpoint	Description
POST	/auth/register	Register new account
POST	/auth/login	Credential login
POST	/auth/refresh	Refresh access token
POST	/auth/logout	Revoke current session
GET	/auth/me	Current user profile
POST	/auth/verify-email	Verify email address
POST	/auth/forgot-password	Request password reset
POST	/auth/reset-password	Reset password with token
POST	/auth/mfa/totp/setup	Setup TOTP MFA
GET	/auth/oauth/:provider	Initiate OAuth flow
Configuration
All configuration via environment variables (validated with Zod at startup).

Key variables:

bash
# Required
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_PRIVATE_KEY=...
JWT_PUBLIC_KEY=...
ENCRYPTION_KEY=...
RESEND_API_KEY=...
# Optional (with defaults)
PORT=3000
JWT_ACCESS_TOKEN_TTL=900
JWT_REFRESH_TOKEN_TTL=2592000
RATE_LIMIT_LOGIN_MAX=5
See 

.env.example
 for complete list.

Testing
bash
# Unit + Integration tests
pnpm test
# E2E tests
pnpm test:e2e
# Load tests
pnpm test:load
# Coverage report
pnpm test:coverage
Deployment
Docker
bash
# Build image
pnpm docker:build
# Run container
docker run -p 3000:3000 --env-file .env yourregistry/authcore:latest
Kubernetes (Production)
bash
# Install via Helm
helm repo add authcore https://yourorg.github.io/authcore-helm
helm install authcore authcore/authcore -n auth --create-namespace
# Or apply manifests directly
kubectl apply -k k8s/overlays/prod
Environment-Specific Configs
k8s/overlays/dev/ - Development
k8s/overlays/staging/ - Staging
k8s/overlays/prod/ - Production
Security
Responsible Disclosure
Report security vulnerabilities to 

security@yourdomain.com
 (PGP key available).

Security Features
Argon2id password hashing (OWASP recommended)
RS256 JWT with automatic key rotation
Refresh token rotation + reuse detection
Rate limiting on all auth endpoints
CSP, HSTS, secure headers via Helmet
Encrypted PII at rest (AES-256-GCM)
Comprehensive audit logging
Regular dependency scanning
Compliance
GDPR ready (right to erasure, data portability)
SOC 2 Type II aligned controls
HIPAA-ready configuration available
Monitoring
Key Dashboards (Grafana)
Auth Overview: Login success rate, latency, active sessions
Security: Failed logins, token reuse, account lockouts
Infrastructure: DB connections, Redis memory, queue depth
Critical Alerts
Alert	Threshold	Action
High login failure rate	>10% for 5min	Investigate immediately
Token reuse detected	Any occurrence	Critical - potential account takeover
DB pool exhausted	>90% for 5min	Scale workers
Email queue backlog	>1000 messages	Check email provider