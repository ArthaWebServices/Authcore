
---

## TECH_STACK.md

```markdown
# Technology Stack: AuthCore

## 1. Core Runtime

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Runtime** | Node.js | 20 LTS (Iron) | Long-term support, native fetch, stable |
| **Framework** | Fastify | 4.x | High performance, schema validation, TypeScript native |
| **Language** | TypeScript | 5.4+ | Type safety, excellent ecosystem |
| **Package Manager** | pnpm | 9.x | Fast, disk-efficient, strict dependencies |

## 2. Database & ORM

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Primary DB** | PostgreSQL | 16 | ACID, JSONB, row-level security, extensions |
| **ORM** | Prisma | 5.x | Type-safe, migrations, middlewares, preview features |
| **Connection Pool** | PgBouncer | Latest | Efficient connection pooling for serverless |
| **Migrations** | Prisma Migrate | Built-in | Declarative, reviewable, reversible |
| **Read Replicas** | PostgreSQL Streaming Replication | Native | Scale reads, HA |

## 3. Caching & Session Store

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Cache/Session** | Redis | 7.2+ | Cluster mode, Redis Functions, ACLs |
| **Client** | ioredis | 5.x | Cluster support, pipelines, TypeScript |
| **Rate Limiting** | @fastify/rate-limit + Redis | Built-in | Distributed, sliding window |

## 4. Authentication & Security

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Password Hash** | @node-rs/argon2 | 2.x | Rust binding, fast, memory-hard |
| **JWT** | @fastify/jwt + jose | 5.x | RS256, JWKS, key rotation |
| **Crypto** | @node-rs/bcrypt | 1.x | Rust binding for token hashing |
| **TOTP** | otplib | 12.x | RFC 6238 compliant |
| **WebAuthn** | @simplewebauthn/server | 10.x | FIDO2 Level 2 certified |
| **OAuth** | @fastify/oauth2 | 7.x | PKCE, state, multiple providers |
| **Validation** | Zod | 3.22+ | Schema-first, TypeScript inference |
| **Sanitization** | DOMPurify (isomorphic) | 3.x | XSS prevention |

## 5. Email & Communications

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Email Provider** | Resend (primary) / SendGrid (fallback) | API | Developer experience, deliverability |
| **Email Templates** | React Email | 2.x | Type-safe, preview, MJML output |
| **Queue** | BullMQ | 5.x | Redis-based, retries, scheduling, metrics |

## 6. Message Queue & Events

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Message Broker** | RabbitMQ | 3.13+ | Reliable, dead-letter, priority queues |
| **Event Bus** | Custom (Node EventEmitter) | Internal | Low-latency internal events |
| **Outbox Pattern** | Prisma Middleware | Custom | Transactional outbox for reliability |

## 7. Observability

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Metrics** | Prometheus Client | 15.x | Native histograms, exemplars |
| **Logging** | Pino | 8.x | Structured JSON, redaction, child loggers |
| **Tracing** | OpenTelemetry JS | 0.52+ | W3C standard, auto-instrumentation |
| **Visualization** | Grafana | 10.x | Dashboards, alerting, Loki integration |
| **Log Aggregation** | Loki | 2.9+ | Cost-effective, label-based |
| **Error Tracking** | Sentry | Latest | Source maps, release tracking |

## 8. API & Documentation

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **API Spec** | OpenAPI 3.1 | - | Industry standard |
| **Doc Generation** | @fastify/swagger + Scalar | Latest | Beautiful, interactive docs |
| **Client SDK** | Orval | 6.x | Type-safe client from OpenAPI |
| **Contract Testing** | Pact | Latest | Consumer-driven contracts |

## 9. Testing

| Layer | Technology | Version |
|-------|------------|---------|
| **Unit** | Vitest | 1.x |
| **Integration** | Testcontainers | 10.x |
| **E2E** | Playwright | 1.40+ |
| **Load** | k6 | 0.47+ |
| **Contract** | Pact | Latest |
| **Mutation** | Stryker | 8.x |

## 10. CI/CD & Infrastructure

| Component | Technology | Version |
|-----------|------------|---------|
| **CI** | GitHub Actions | - |
| **CD** | ArgoCD | 2.9+ |
| **Container** | Docker | 24+ |
| **Registry** | GHCR / ECR | - |
| **Orchestration** | Kubernetes | 1.28+ |
| **Service Mesh** | Istio | 1.20+ |
| **Secrets** | External Secrets Operator + Vault | Latest |
| **IaC** | Terraform | 1.7+ |
| **Policy** | Kyverno | 1.11+ |

## 11. Development Tools

| Category | Tools |
|----------|-------|
| **Linting** | ESLint (typescript-eslint), Prettier |
| **Git Hooks** | Husky + lint-staged |
| **Commit** | Commitlint (Conventional Commits) |
| **Dependency** | Renovate, npm audit, OWASP Dependency Check |
| **Database** | Prisma Studio, pgAdmin |
| **API Testing** | Bruno / HTTPie |
| **Debugging** | Node.js Inspector, 0x (flame graphs) |

## 12. Version Constraints (package.json)

```json
{
  "engines": {
    "node": ">=20.10.0 <21",
    "pnpm": ">=9.0.0"
  },
  "dependencies": {
    "@fastify/autoload": "^5.8.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/helmet": "^11.1.0",
    "@fastify/jwt": "^8.0.0",
    "@fastify/oauth2": "^7.6.0",
    "@fastify/rate-limit": "^9.1.0",
    "@fastify/sensible": "^5.4.0",
    "@fastify/swagger": "^8.14.0",
    "@fastify/swagger-ui": "^3.0.0",
    "@node-rs/argon2": "^2.0.0",
    "@node-rs/bcrypt": "^1.9.0",
    "@prisma/client": "^5.10.0",
    "@simplewebauthn/server": "^10.0.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0",
    "jose": "^5.2.0",
    "otplib": "^12.0.0",
    "pino": "^8.19.0",
    "pino-pretty": "^10.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.4.0",
    "vitest": "^1.3.0",
    "@vitest/coverage-v8": "^1.3.0",
    "testcontainers": "^10.9.0",
    "prisma": "^5.10.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.2.0"
  }
}
