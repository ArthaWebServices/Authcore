# Architecture Document: AuthCore

## 1. System Overview

                    AUTHCORE ARCHITECTURE

┌──────────────┐
│ Client       │
│ React        │
└──────┬───────┘
       │
       ▼
┌────────────────────┐
│ API Gateway        │
│ Kong / NGINX       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Auth Workers       │
│ Stateless          │
└─────┬────────┬─────┘
      │        │
      ▼        ▼
┌──────────┐  ┌────────────────┐
│PostgreSQL│  │ Redis Cluster  │
│ Primary  │  │ Sessions       │
└──────────┘  │ Rate Limits    │
              │ Token Blacklist│
              └────────────────┘
                    │
                    ▼
              ┌───────────────┐
              │ Message Queue │
              │ RabbitMQ/Kafka│
              └───────┬───────┘
                      │
          ┌───────────┼────────────┐
          ▼           ▼            ▼
   ┌────────────┐ ┌──────────┐ ┌─────────────┐
   │Email Service│ │ Object   │ │ Monitoring  │
   │Resend/      │ │ Storage  │ │ Prometheus  │
   │SendGrid     │ │Avatars/  │ │Grafana/     │
   │             │ │Backups   │ │Jaeger       │
   └────────────┘ └──────────┘ └─────────────┘


## 2. Component Architecture

### 2.1 Auth Workers (Stateless Microservices)

                 AUTH WORKER PROCESS

┌───────────────────────────────────────────────┐
│               ENTRY POINTS                    │
│                                               │
│  HTTP Router       gRPC Server    Internal    │
│  (Fastify)         (Internal)     Events      │
└─────────┬──────────────┬──────────────┬──────┘
          │              │              │
          └──────────────┼──────────────┘
                         ▼
┌───────────────────────────────────────────────┐
│              MIDDLEWARE CHAIN                 │
│                                               │
│ RateLimit → Helmet → CORS → RequestId         │
│ → Validation                                  │
└──────────────────────┬────────────────────────┘
                       ▼
┌───────────────────────────────────────────────┐
│                ROUTE HANDLERS                 │
│                                               │
│ /auth/register    /auth/login                 │
│ /auth/refresh     /auth/mfa                   │
│ /auth/oauth/*     /admin/*                    │
│ /webhooks/*                                    │
└──────────────────────┬────────────────────────┘
                       ▼
┌───────────────────────────────────────────────┐
│                 SERVICE LAYER                 │
│                                               │
│ UserService       SessionService              │
│ TokenService      MfaService                  │
│ OAuthService      AuditService                │
│ EmailService      WebhookService              │
└──────────────────────┬────────────────────────┘
                       ▼
┌───────────────────────────────────────────────┐
│              REPOSITORY LAYER                │
│                                               │
│ UserRepo          SessionRepo                 │
│ TokenRepo         AuditRepo                   │
└───────────────────────────────────────────────┘


### 2.2 Data Models

#### Users Table
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT NOT NULL UNIQUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash   TEXT,                    -- NULL for OAuth-only accounts
    password_updated_at TIMESTAMPTZ,
    full_name       VARCHAR(255),
    avatar_url      TEXT,
    locale          VARCHAR(10) DEFAULT 'en',
    timezone        VARCHAR(50) DEFAULT 'UTC',
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret      TEXT,                    -- Encrypted TOTP secret
    backup_codes    TEXT[],                  -- Hashed backup codes
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active, locked, deleted
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status) WHERE status != 'deleted';


#Sessions Table :

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,        -- bcrypt hash of refresh token
    user_agent      TEXT,
    ip_address      INET,
    country         CHAR(2),
    city            VARCHAR(100),
    device_fingerprint VARCHAR(64),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_hash ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE revoked_at IS NULL;


#OAuth Accounts Table :
CREATE TABLE oauth_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        VARCHAR(50) NOT NULL,    -- google, github, microsoft, gitlab
    provider_user_id VARCHAR(255) NOT NULL,
    email           CITEXT,
    access_token    TEXT,                    -- Encrypted
    refresh_token   TEXT,                    -- Encrypted
    expires_at      TIMESTAMPTZ,
    scope           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

#Audit Logs Table
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    event_type      VARCHAR(100) NOT NULL,   -- user.login, user.register, mfa.enabled, etc.
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id      UUID REFERENCES sessions(id) ON DELETE SET NULL,
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    risk_score      SMALLINT DEFAULT 0,      -- 0-100 anomaly score
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);
-- Partition by month for performance

##2.3 Token Architecture

┌─────────────────────────────────────────────────────────────────┐
│                        TOKEN FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOGIN                                                            │
│  ┌─────────┐    ┌─────────────┐    ┌──────────────┐             │
│  │ Client  │───►│ Auth Worker │───►│ PostgreSQL   │             │
│  │         │    │             │    │ (Session)    │             │
│  └────┬────┘    └──────┬──────┘    └──────┬───────┘             │
│       │                │                   │                     │
│       │  Access Token  │                   │                     │
│       │  (JWT, 15min)  │                   │                     │
│       │◄───────────────│                   │                     │
│       │                │                   │                     │
│       │  Refresh Token │                   │                     │
│       │  (Opaque,      │                   │                     │
│       │   30 days)     │                   │                     │
│       │◄───────────────│                   │                     │
│       │                │  Store hash       │                     │
│       └────────────────┴───────────────────┘                     │
│                                                                 │
│  REQUEST (with Access Token)                                     │
│  ┌─────────┐    ┌─────────────┐                                 │
│  │ Client  │───►│ API Gateway │──► Validates JWT locally        │
│  │         │    │  (JWKS)     │     (no DB call)                │
│  └─────────┘    └─────────────┘                                 │
│                                                                 │
│  REFRESH                                                           │
│  ┌─────────┐    ┌─────────────┐    ┌──────────────┐             │
│  │ Client  │───►│ Auth Worker │───►│ PostgreSQL   │             │
│  │         │    │             │    │ Verify hash  │             │
│  └────┬────┘    └──────┬──────┘    │ Rotate token │             │
│       │                │           │ Invalidate   │             │
│       │  New Access    │           │  old         │             │
│       │  New Refresh   │◄──────────┘              │             │
│       │◄───────────────┘                          │             │
│       └───────────────────────────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘


#Access Token (JWT) Claims

json
{
  "iss": "https://auth.yourdomain.com",
  "sub": "user-uuid",
  "aud": ["api.yourdomain.com"],
  "exp": 1735689600,
  "iat": 1735688700,
  "jti": "unique-token-id",
  "sid": "session-uuid",
  "email": "user@example.com",
  "email_verified": true,
  "roles": ["member"],
  "permissions": ["announcements:read", "announcements:write"],
  "org_id": "org-uuid",
  "mfa_verified": false
}

#Refresh Token (Opaque)
256-bit cryptographically random string
Stored as bcrypt hash in database
Rotated on every use (old token invalidated)
Token family tracking for reuse detection

##2.4 Security Boundaries
┌────────────────────────────────────────────────────────────────────┐
│                      TRUST BOUNDARIES                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  INTERNET                                                          │
│     │                                                              │
│     ▼                                                              │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  DMZ / EDGE LAYER                                          │   │
│  │  • TLS Termination                                         │   │
│  │  • WAF (SQLi, XSS, Rate Limit)                            │   │
│  │  • DDoS Protection                                         │   │
│  │  • Certificate Management                                  │   │
│  └────────────────────────┬───────────────────────────────────┘   │
│                           │                                        │
│                           ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  APPLICATION LAYER (Auth Workers)                          │   │
│  │  • Business Logic                                          │   │
│  │  • Input Validation                                        │   │
│  │  • Authorization Checks                                    │   │
│  │  • Audit Logging                                           │   │
│  └────────────────────────┬───────────────────────────────────┘   │
│                           │                                        │
│           ┌───────────────┼───────────────┐                       │
│           ▼               ▼               ▼                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │   DATABASE   │ │    REDIS     │ │  MESSAGE Q   │              │
│  │  (PostgreSQL)│ │  (Cluster)   │ │ (RabbitMQ/   │              │
│  │              │ │              │ │   Kafka)     │              │
│  │ • Encrypted  │ │ • Encrypted  │ │              │              │
│  │   at rest    │ │   in transit │ │ • At-least-  │              │
│  │ • Row-level  │ │ • Auth       │ │   once       │              │
│  │   security   │ │   required   │ │ • Dead letter│              │
│  └──────────────┘ └──────────────┘ └──────────────┘              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘


3. API Design
3.1 REST Endpoints
Method	Path	Description	Auth
POST	/auth/register	Register new account	Public
POST	/auth/login	Credential login	Public
POST	/auth/refresh	Refresh access token	Refresh Token
POST	/auth/logout	Revoke current session	Access Token
POST	/auth/logout-all	Revoke all sessions	Access Token
GET	/auth/me	Current user profile	Access Token
PATCH	/auth/me	Update profile	Access Token
POST	/auth/verify-email	Verify email token	Public
POST	/auth/resend-verification	Resend verification email	Public
POST	/auth/forgot-password	Request password reset	Public
POST	/auth/reset-password	Reset with token	Public
POST	/auth/change-password	Change password (authenticated)	Access Token
GET	/auth/sessions	List active sessions	Access Token
DELETE	/auth/sessions/:id	Revoke specific session	Access Token

3.2 MFA Endpoints
Method	Path	Description
POST	/auth/mfa/totp/setup	Initiate TOTP setup (returns QR)
POST	/auth/mfa/totp/verify	Verify TOTP code (enable)
POST	/auth/mfa/totp/disable	Disable TOTP
GET	/auth/mfa/backup-codes	Get backup codes
POST	/auth/mfa/backup-codes/regenerate	Regenerate backup codes
POST	/auth/mfa/webauthn/register/start	Start passkey registration
POST	/auth/mfa/webauthn/register/finish	Complete passkey registration
POST	/auth/mfa/webauthn/authenticate/start	Start passkey authentication
POST	/auth/mfa/webauthn/authenticate/finish	Complete passkey authentication

3.3 OAuth Endpoints
Method	Path	Description
GET	/auth/oauth/:provider	Redirect to provider
GET	/auth/oauth/:provider/callback	OAuth callback
POST	/auth/oauth/link	Link provider to existing account
POST	/auth/oauth/unlink	Unlink provider
3.4 Admin Endpoints
Method	Path	Description
GET	/admin/users	List users (paginated, filterable)
GET	/admin/users/:id	Get user details
PATCH	/admin/users/:id	Update user (roles, status)
POST	/admin/users/:id/impersonate	Generate impersonation token
DELETE	/admin/users/:id	Soft delete user
GET	/admin/audit-logs	Query audit logs
GET	/admin/stats	System statistics
POST	/admin/webhooks	Register webhook
GET	/admin/api-keys	List API keys
POST	/admin/api-keys	Create API key

3.5 Well-Known Endpoints
Method	Path	Description
GET	/.well-known/openid-configuration	OIDC Discovery
GET	/.well-known/jwks.json	JWKS Public Keys


4. Infrastructure
4.1 Deployment Topology
# docker-compose.yml (Development)
services:
  auth-api:
    build: .
    replicas: 3
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://...
      - JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY}
      - JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY}
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data

  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI


4.2 Kubernetes (Production)
yaml
# k8s/auth-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-api
  namespace: auth
spec:
  replicas: 5
  selector:
    matchLabels:
      app: auth-api
  template:
    metadata:
      labels:
        app: auth-api
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
    spec:
      containers:
        - name: auth-api
          image: yourregistry/auth-api:v1.2.3
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: auth-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: auth-api
  namespace: auth
spec:
  selector:
    app: auth-api
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP


4.3 Database Migration Strategy
sql
-- migrations/001_initial_schema.up.sql
-- Run via golang-migrate or similar
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Users, sessions, oauth_accounts, audit_logs tables from Section 2.2
-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_isolation ON users
  USING (auth.uid() = id OR auth.has_role('admin'));
-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

5. Security Architecture
5.1 Key Management
┌─────────────────────────────────────────────────────────────────┐
│                      KEY HIERARCHY                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ROOT KEY (HSM / Cloud KMS)                                     │
│       │                                                          │
│       ├──► JWT Signing Key (RS256, rotated quarterly)           │
│       │     ├── Private: Sign access tokens                     │
│       │     └── Public: Published at /.well-known/jwks.json     │
│       │                                                          │
│       ├──► Database Encryption Key (AES-256-GCM)                │
│       │     └── Encrypts PII columns (email, PII)               │
│       │                                                          │
│       ├──► OAuth Token Encryption Key (AES-256-GCM)             │
│       │     └── Encrypts provider access/refresh tokens         │
│       │                                                          │
│       └──► Backup Encryption Key (AES-256-GCM)                  │
│             └── Encrypts database backups                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

5.2 Threat Model (STRIDE)
Threat	Mitigation
Spoofing	JWT signature verification; mTLS for service-to-service
Tampering	Signed tokens; HTTPS everywhere; CSP; Subresource Integrity
Repudiation	Immutable audit logs; signed webhook payloads
Information Disclosure	Field-level encryption; minimal JWT claims; no PII in logs
DoS	Rate limiting at edge + app layer; circuit breakers; auto-scaling
Elevation of Privilege	RBAC; least privilege; short-lived tokens; admin approval for sensitive ops


6. Data Flow Diagrams
6.1 User Registration Flow
mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant AuthWorker
    participant DB
    participant Redis
    participant EmailService
    Client->>Gateway: POST /auth/register {email, password}
    Gateway->>AuthWorker: Forward request
    AuthWorker->>AuthWorker: Validate input (Zod)
    AuthWorker->>AuthWorker: Check rate limit (Redis)
    AuthWorker->>AuthWorker: Check email availability (DB)
    AuthWorker->>AuthWorker: Hash password (Argon2id)
    AuthWorker->>DB: INSERT user (email_verified=false)
    AuthWorker->>DB: INSERT audit_log (user.register)
    AuthWorker->>EmailService: Queue verification email
    AuthWorker->>Redis: Set rate limit counters
    AuthWorker-->>Gateway: 201 {user_id, message}
    Gateway-->>Client: 201 Created
    EmailService->>User: Send verification email
    User->>Gateway: GET /auth/verify-email?token=xyz
    Gateway->>AuthWorker: Forward
    AuthWorker->>DB: Verify token, UPDATE user email_verified=true
    AuthWorker->>DB: INSERT audit_log (user.email_verified)

6.2 Token Refresh Flow (with Reuse Detection)
mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant AuthWorker
    participant DB
    participant Redis
    Client->>Gateway: POST /auth/refresh (cookie: refresh_token)
    Gateway->>AuthWorker: Forward
    AuthWorker->>AuthWorker: Extract & hash token
    AuthWorker->>DB: SELECT session WHERE refresh_token_hash = ?
    alt Token not found or revoked
        AuthWorker->>Redis: INCR reuse_detect:{token_family}
        AuthWorker-->>Gateway: 401 {error: "invalid_token"}
        Gateway-->>Client: 401 Unauthorized
    else Token valid
        AuthWorker->>DB: BEGIN TRANSACTION
        AuthWorker->>DB: UPDATE session SET revoked_at=NOW()
        AuthWorker->>DB: INSERT new session (new refresh hash)
        AuthWorker->>DB: COMMIT
        AuthWorker->>AuthWorker: Generate new JWT pair
        AuthWorker-->>Gateway: 200 {access_token, refresh_token}
        Gateway-->>Client: 200 OK (Set-Cookie)
    end


7. Error Handling & Codes
Code	HTTP	Message	Client Action
AUTH_INVALID_CREDENTIALS	401	Invalid email or password	Show generic error
AUTH_ACCOUNT_LOCKED	403	Account temporarily locked	Show lockout timer
AUTH_EMAIL_NOT_VERIFIED	403	Please verify your email	Offer resend
AUTH_TOKEN_EXPIRED	401	Access token expired	Auto-refresh
AUTH_TOKEN_REVOKED	401	Session revoked	Force re-login
AUTH_TOKEN_REUSE_DETECTED	401	Security violation	Revoke all sessions, alert
AUTH_MFA_REQUIRED	403	MFA verification required	Challenge MFA
AUTH_RATE_LIMITED	429	Too many requests	Retry-After header
AUTH_OAUTH_ERROR	400	OAuth provider error	Show provider message

8. Testing Strategy
Layer	Tools	Coverage Target
Unit	Vitest, ts-mockito	90%+
Integration	Testcontainers (PostgreSQL, Redis)	80%+
Contract	Pact (consumer-driven)	All public APIs
E2E	Playwright	Critical user journeys
Load	k6	10k RPS sustained
Chaos	LitmusChaos	DB failover, network partitions
Security	OWASP ZAP, Trivy, Semgrep	Zero critical/high

9. Monitoring & Alerting
9.1 Key Metrics (Prometheus)
promql
# Authentication Success Rate
rate(auth_login_success_total[5m]) / rate(auth_login_attempts_total[5m])
# Token Refresh Latency (p99)
histogram_quantile(0.99, rate(auth_token_refresh_duration_seconds_bucket[5m]))
# Active Sessions
auth_active_sessions_total
# Rate Limit Hits
rate(auth_rate_limit_exceeded_total[5m])
# MFA Adoption
auth_mfa_enabled_users / auth_total_users


9.2 Critical Alerts
Alert	Condition	Severity	Runbook
AuthHighFailureRate	Login failure rate > 10% for 5m	Critical	Check provider status, DB health
AuthTokenReuseDetected	Any token reuse event	Critical	Immediate investigation
AuthDBConnectionPoolExhausted	Pool usage > 90%	Warning	Scale workers, check queries
AuthEmailQueueBacklog	Queue depth > 1000	Warning	Check email provider
AuthCertificateExpiring	TLS cert < 30 days	Warning	Renew certificate

