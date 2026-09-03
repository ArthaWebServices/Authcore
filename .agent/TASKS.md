# Task Breakdown: AuthCore Implementation

## Phase 1: Foundation (Week 1-2)

### Sprint 1: Project Setup & Core Infrastructure
- [ ] **TASK-001** Initialize repository with TypeScript, Fastify, Prisma
- [ ] **TASK-002** Configure ESLint, Prettier, Husky, lint-staged
- [ ] **TASK-003** Set up CI pipeline (GitHub Actions): lint, typecheck, test, build
- [ ] **TASK-004** Configure Docker & docker-compose for local development
- [ ] **TASK-005** Set up Prisma schema with User, Session models
- [ ] **TASK-006** Implement configuration module (Zod-validated env)
- [ ] **TASK-007** Set up structured logging (Pino) with redaction
- [ ] **TASK-008** Implement health check endpoints (`/health/live`, `/health/ready`)
- [ ] **TASK-009** Set up OpenTelemetry tracing + Prometheus metrics
- [ ] **TASK-010** Configure Sentry error tracking

### Sprint 2: Database & Core Patterns
- [ ] **TASK-011** Implement UserRepository (CRUD + findByEmail)
- [ ] **TASK-012** Implement SessionRepository (CRUD + findByRefreshHash)
- [ ] **TASK-013** Create base Service class with transaction support
- [ ] **TASK-014** Implement error classes (AuthError, ValidationError, etc.)
- [ ] **TASK-015** Set up Zod validation middleware for Fastify
- [ ] **TASK-016** Implement rate limiting plugin (Redis-backed)
- [ ] **TASK-017** Set up BullMQ queue for email jobs
- [ ] **TASK-018** Create email service with Resend provider
- [ ] **TASK-019** Implement React Email templates (base layout, verification)
- [ ] **TASK-020** Write integration tests for User/Session repositories

## Phase 2: Core Authentication (Week 3-5)

### Sprint 3: Registration & Email Verification
- [ ] **TASK-021** Implement POST /auth/register
  - [ ] Input validation (email format, password strength)
  - [ ] Argon2id password hashing
  - [ ] Email uniqueness check
  - [ ] Create unverified user record
  - [ ] Generate verification token (JWT, 24h TTL)
  - [ ] Queue verification email
  - [ ] Audit log: `user.register`
- [ ] **TASK-022** Implement POST /auth/verify-email
  - [ ] Validate token signature & expiry
  - [ ] Mark user email_verified = true
  - [ ] Invalidate verification token
  - [ ] Audit log: `user.email_verified`
- [ ] **TASK-023** Implement POST /auth/resend-verification
  - [ ] Rate limit (1/min per email)
  - [ ] Only for unverified users
  - [ ] Queue new verification email

### Sprint 4: Login & Token Management
- [ ] **TASK-024** Implement POST /auth/login
  - [ ] Rate limit (5/min per IP)
  - [ ] Verify credentials (Argon2id)
  - [ ] Check account status (active, not locked)
  - [ ] Track failed attempts (lock after 5)
  - [ ] Generate access token (JWT RS256, 15min)
  - [ ] Generate refresh token (opaque, 30d, bcrypt hash stored)
  - [ ] Create session record
  - [ ] Set secure cookies (HttpOnly, Secure, SameSite=Strict)
  - [ ] Audit log: `user.login` (success/failure)
- [ ] **TASK-025** Implement POST /auth/refresh
  - [ ] Validate refresh token (hash comparison)
  - [ ] Check session not revoked/expired
  - [ ] **Token rotation**: Invalidate old, create new
  - [ ] **Reuse detection**: Track token family, revoke all on reuse
  - [ ] Generate new token pair
  - [ ] Audit log: `token.refresh`
- [ ] **TASK-026** Implement POST /auth/logout
  - [ ] Revoke current session (set revoked_at)
  - [ ] Clear cookies
  - [ ] Audit log: `user.logout`
- [ ] **TASK-027** Implement POST /auth/logout-all
  - [ ] Revoke all user sessions
  - [ ] Clear cookies
  - [ ] Audit log: `user.logout_all`

### Sprint 5: Password Operations & Security Hardening
- [ ] **TASK-028** Implement POST /auth/forgot-password
  - [ ] Rate limit (3/hour per email)
  - [ ] Generate reset token (JWT, 1h TTL, single-use)
  - [ ] Queue reset email
  - [ ] Audit log: `password.reset_requested` (no user enumeration)
- [ ] **TASK-029** Implement POST /auth/reset-password
  - [ ] Validate token
  - [ ] Check password strength (zxcvbn, min 12 chars)
  - [ ] Check against HaveIBeenPwned (k-anonymity)
  - [ ] Hash new password (Argon2id)
  - [ ] Update user, revoke all sessions
  - [ ] Audit log: `password.reset`
- [ ] **TASK-030** Implement POST /auth/change-password
  - [ ] Require current password
  - [ ] Same strength checks
  - [ ] Revoke all OTHER sessions (keep current)
  - [ ] Audit log: `password.changed`
- [ ] **TASK-031** Implement GET /auth/me
  - [ ] Return user profile (no sensitive fields)
- [ ] **TASK-032** Implement PATCH /auth/me
  - [ ] Update name, avatar, locale, timezone
  - [ ] Email change triggers re-verification
  - [ ] Audit log: `user.profile_updated`
- [ ] **TASK-033** Security hardening
  - [ ] Helmet CSP configuration
  - [ ] CORS policy (strict origin allowlist)
  - [ ] Request ID middleware
  - [ ] Input sanitization middleware

## Phase 3: Session Management & MFA (Week 7-9)

### Sprint 6: Session Management
- [ ] **TASK-034** Implement GET /auth/sessions
  - [ ] List active sessions with device info
  - [ ] Sort by last_active desc
- [ ] **TASK-035** Implement DELETE /auth/sessions/:id
  - [ ] Revoke specific session
  - [ ] Prevent self-revoke of current session (separate endpoint)
- [ ] **TASK-036** Implement concurrent session limits
  - [ ] Configurable per organization (default 5)
  - [ ] LRU eviction on new login
- [ ] **TASK-037** Session cleanup job (cron)
  - [ ] Delete expired sessions daily
  - [ ] Archive audit logs monthly

### Sprint 7: TOTP MFA
- [ ] **TASK-038** Implement POST /auth/mfa/totp/setup
  - [ ] Generate TOTP secret (base32, 20 bytes)
  - [ ] Generate QR code (otplib + qrcode)
  - [ ] Return secret + QR + backup codes (plaintext, once)
  - [ ] Store secret encrypted (not enabled yet)
- [ ] **TASK-039** Implement POST /auth/mfa/totp/verify
  - [ ] Rate limit (5/min)
  - [ ] Verify code (allow ±1 window drift)
  - [ ] On success: enable MFA, store secret, hash backup codes
  - [ ] Audit log: `mfa.enabled`
- [ ] **TASK-040** Implement POST /auth/mfa/totp/disable
  - [ ] Require password + TOTP code
  - [ ] Clear secret, backup codes
  - [ ] Audit log: `mfa.disabled`
- [ ] **TASK-041** Implement backup codes
  - [ ] GET /auth/mfa/backup-codes (requires password + TOTP)
  - [ ] POST /auth/mfa/backup-codes/regenerate
  - [ ] Verify endpoint accepts backup codes

### Sprint 8: WebAuthn / Passkeys
- [ ] **TASK-042** Implement WebAuthn registration
  - [ ] POST /auth/mfa/webauthn/register/start (challenge, options)
  - [ ] POST /auth/mfa/webauthn/register/finish (verify attestation)
  - [ ] Store credential (public key, counter, transports)
- [ ] **TASK-043** Implement WebAuthn authentication
  - [ ] POST /auth/mfa/webauthn/authenticate/start (challenge, allowCredentials)
  - [ ] POST /auth/mfa/webauthn/authenticate/finish (verify assertion)
  - [ ] Update credential counter
- [ ] **TASK-044** WebAuthn management
  - [ ] List registered credentials
  - [ ] Rename/remove credentials
  - [ ] Audit logs for all operations

## Phase 4: OAuth & Authorization (Week 10-12)

### Sprint 9: OAuth 2.0 / OIDC
- [ ] **TASK-045** Configure OAuth providers (Google, GitHub, Microsoft, GitLab)
- [ ] **TASK-046** Implement GET /auth/oauth/:provider (authorization redirect)
  - [ ] PKCE (S256) for public clients
  - [ ] State parameter (CSRF protection)
  - [ ] Store state in Redis (10min TTL)
- [ ] **TASK-047** Implement GET /auth/oauth/:provider/callback
  - [ ] Validate state
  - [ ] Exchange code for tokens
  - [ ] Fetch user profile from provider
  - [ ] Link to existing account or create new
  - [ ] Handle email conflicts
  - [ ] Create session + tokens
- [ ] **TASK-048** Implement account linking/unlinking
  - [ ] POST /auth/oauth/link (requires auth)
  - [ ] POST /auth/oauth/unlink (requires auth, cannot unlink last)
- [ ] **TASK-049** Implement OIDC Discovery & JWKS
  - [ ] GET /.well-known/openid-configuration
  - [ ] GET /.well-known/jwks.json

### Sprint 10: RBAC & Organizations
- [ ] **TASK-050** Design Role & Permission models
  - [ ] Roles: system (admin, member, viewer) + custom
  - [ ] Permissions: `resource:action` format
  - [ ] Role-permission mapping
- [ ] **TASK-051** Implement Organization/Team models
  - [ ] Organizations (tenants)
  - [ ] Memberships (user ↔ org + role)
  - [ ] Teams (optional grouping within org)
- [ ] **TASK-052** Authorization middleware
  - [ ] `requirePermission('resource:action')`
  - [ ] `requireRole('admin')`
  - [ ] Organization context from token
- [ ] **TASK-053** Include permissions in JWT claims
  - [ ] Computed at token issuance
  - [ ] Cache in Redis (invalidate on role change)

### Sprint 11: API Keys & Advanced Auth
- [ ] **TASK-054** Implement API Key management
  - [ ] POST /admin/api-keys (create, scoped permissions)
  - [ ] GET /admin/api-keys (list, masked)
  - [ ] DELETE /admin/api-keys/:id (revoke)
  - [ ] Validate API keys in middleware
- [ ] **TASK-055** Implement impersonation (admin)
  - [ ] POST /admin/users/:id/impersonate
  - [ ] Short-lived token (15min) with `impersonator_id` claim
  - [ ] Audit log: `admin.impersonate` (immutable)

## Phase 5: Admin & Operations (Week 13-15)

### Sprint 12: Admin Dashboard API
- [ ] **TASK-056** Implement GET /admin/users
  - [ ] Pagination, filtering (status, role, email), sorting
  - [ ] Admin-only access
- [ ] **TASK-057** Implement GET/PATCH /admin/users/:id
  - [ ] View full user details (including sessions)
  - [ ] Update status, roles, metadata
- [ ] **TASK-058** Implement DELETE /admin/users/:id
  - [ ] Soft delete (GDPR compliance)
  - [ ] Anonymize PII after 30 days

### Sprint 13: Audit Logs & Webhooks
- [ ] **TASK-059** Implement GET /admin/audit-logs
  - [ ] Filter by user, event_type, date range, risk_score
  - [ ] Export (CSV, JSON)
- [ ] **TASK-060** Implement webhook system
  - [ ] POST /admin/webhooks (register URL + events + secret)
  - [ ] Event delivery with retry (exponential backoff)
  - [ ] Signature verification (HMAC-SHA256)
  - [ ] Dead letter queue for failed deliveries
- [ ] **TASK-061** Define webhook events
  - `user.created`, `user.updated`, `user.deleted`
  - `session.created`, `session.revoked`
  - `mfa.enabled`, `mfa.disabled`, `mfa.verified`
  - `password.reset`, `password.changed`
  - `oauth.linked`, `oauth.unlinked`

### Sprint 14: Observability & Operations
- [ ] **TASK-062** Build Grafana dashboards
  - [ ] Auth overview (login success rate, latency, active sessions)
  - [ ] Security (failed logins, token reuse, lockouts)
  - [ ] Infrastructure (DB connections, Redis memory, queue depth)
- [ ] **TASK-063** Configure critical alerts
  - [ ] High failure rate, token reuse, pool exhaustion, cert expiry
- [ ] **TASK-064** Write runbooks for all critical alerts
- [ ] **TASK-065** Load testing (k6)
  - [ ] Baseline: 1k RPS sustained
  - [ ] Stress: 10k RPS for 5 min
  - [ ] Soak: 5k RPS for 1 hour

## Phase 6: Hardening & Migration (Week 16-20)

### Sprint 15: Security Hardening
- [ ] **TASK-066** Internal security audit
  - [ ] Dependency scan (npm audit, OWASP Dependency Check)
  - [ ] SAST (Semgrep rules)
  - [ ] Secret scan (TruffleHog)
- [ ] **TASK-067** Penetration testing (engage external firm)
- [ ] **TASK-068** Chaos engineering
  - [ ] DB primary failure → replica promotion
  - [ ] Redis cluster partition
  - [ ] Network latency injection
- [ ] **TASK-069** Key rotation drill
  - [ ] JWT keys, encryption keys, database passwords

### Sprint 16: Documentation & SDK
- [ ] **TASK-070** Generate API documentation (Scalar/OpenAPI)
- [ ] **TASK-071** Build TypeScript SDK (Orval from OpenAPI)
- [ ] **TASK-072** Write integration guides (React, Next.js, Express)
- [ ] **TASK-073** Document migration from Clerk

### Sprint 17: Clerk Migration
- [ ] **TASK-074** Build migration tooling
  - [ ] Export users from Clerk (API)
  - [ ] Transform to AuthCore format
  - [ ] Import with password hashes (Clerk provides bcrypt)
  - [ ] Verify email_verified status
- [ ] **TASK-075** Dual-write period
  - [ ] Write to both Clerk + AuthCore
  - [ ] Read from AuthCore (feature flag)
  - [ ] Monitor discrepancies
- [ ] **TASK-076** Cutover
  - [ ] Switch frontend to AuthCore
  - [ ] Decommission Clerk
  - [ ] Post-migration validation

### Sprint 18: Launch & Stabilization
- [ ] **TASK-077** Production deployment (ArgoCD)
- [ ] **TASK-078** Post-launch monitoring (48h intensive)
- [ ] **TASK-079** Performance tuning
- [ ] **TASK-080** Retrospective & documentation update
