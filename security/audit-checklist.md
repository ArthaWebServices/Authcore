# AuthCore Internal Security Audit (TASK-066)

**Reviewer:** AuthCore Security Team
**Date:** 2026-09-04
**Scope:** Full application — auth, APIs, admin, infra config
**Standard:** OWASP Top 10 2021 + CWE Top 25 + auth-specific CWE

## 1. Authentication & Session Management

### Password Storage
- [x] **Argon2id** with OWASP 2024 recommended parameters (m=19MiB, t=2, p=1)
- [x] Passwords **never** logged or returned in API responses
- [x] Common-password blocklist (`password-blocklist.ts`) checks top 10K passwords + keyboard sequences + repetition
- [x] Min length 12 enforced via Zod schema
- [ ] **Issue:** Argon2 parameters not validated at startup — verify config matches OWASP recommendations
- [ ] **Recommendation:** Add config assertion at boot

### Account Lockout
- [x] **5 failed attempts → 15-min lockout** (TASK-033 hardening)
- [x] `failedLoginAttempts` counter reset on successful login
- [x] Lockout expiry handled correctly (`lockedUntil > new Date()` check)
- [ ] **Edge case:** Lockout bypass via per-IP rate limiting not coordinated with per-account lockout
- [ ] **Recommendation:** Cross-reference rate-limit + account-lock in login flow

### Session Tokens
- [x] Access token: **RS256 JWT, 15-min TTL**
- [x] Refresh token: **256-bit random, SHA-256 hashed in DB, 30-day TTL**
- [x] Refresh rotation: old token revoked, new issued
- [x] Reuse detection: falls back to bcrypt comparison (legacy hashes)
- [ ] **Issue:** Bcrypt fallback path scans `take: 100` sessions per refresh — not scalable
- [ ] **Recommendation:** Run one-time migration to rehash all bcrypt refresh hashes to SHA-256, then drop fallback

### Logout
- [x] Single session logout revokes that session only
- [x] Logout-all revokes all sessions for the user
- [x] Refresh token cookie cleared (`HttpOnly`, `SameSite=Strict`)
- [x] CSRF protection on POST endpoints (double-submit cookie)

## 2. Authorization

### JWT Verification
- [x] **jose** library with JWKS verification
- [x] Issuer + audience validated on every request
- [x] `kid` header used for key rotation lookup
- [ ] **Issue:** JWKS endpoint is stubbed (placeholder modulus) — must use real public key
- [ ] **Recommendation:** Implement real `n` and `e` extraction from PEM

### Admin Endpoints
- [x] All `/admin/*` routes require `requireAuth` middleware
- [ ] **CRITICAL:** No role check — any authenticated user can access `/admin/users`
- [ ] **Recommendation:** Add `requireRole('admin')` middleware before all admin routes

### Cross-tenant Isolation
- [x] Organization membership queries filter by `userId`
- [ ] **Issue:** `organizationService.updateRole` doesn't verify the calling user has admin role
- [ ] **Recommendation:** Add authorization check at service or middleware level

## 3. Input Validation

### Zod Schemas
- [x] All request bodies validated via Zod
- [x] SQL injection prevented by **Prisma parameterized queries**
- [x] XSS prevented by **no string interpolation in HTML** (React Email templates)
- [x] Path traversal prevented by Fastify route parameter validation

### Rate Limiting
- [x] Login: 5 attempts / 60s
- [x] Register: 3 attempts / 5min
- [x] Forgot-password: 3 attempts / 60s
- [x] Redis-backed (survives restart)
- [ ] **Issue:** No rate limit on `/auth/refresh` (high-frequency endpoint)
- [ ] **Recommendation:** Add 30 req/min limit on refresh

## 4. Cryptography

### Random Number Generation
- [x] `generateSecureToken(32)` uses `crypto.randomBytes(32)`
- [x] TOTP secret uses `otplib` `generateSecret()` (uses `crypto.randomBytes`)
- [x] API keys: `ak_live_` + 32 random bytes
- [x] Backup codes: 12-char hex

### Hashing
- [x] Passwords: Argon2id
- [x] Refresh tokens: SHA-256 (fast DB lookup)
- [x] API keys: SHA-256
- [x] Webhook signatures: HMAC-SHA256

## 5. Secrets Management

- [x] All secrets via env vars, validated by Zod (`config/index.ts`)
- [x] Cookie secret uses `ENCRYPTION_KEY`
- [ ] **Issue:** No secret rotation mechanism for cookie secret — would force-invalidate all sessions
- [ ] **Recommendation:** Support multiple keys with `kid` for graceful rotation
- [ ] **Recommendation:** Integrate with Vault/AWS Secrets Manager for prod

## 6. Logging & Monitoring

- [x] Pino with redaction of: `password`, `mfaSecret`, `totpCode`, `webauthnCredential`
- [x] Sentry for unhandled errors
- [x] Audit log table for sensitive events
- [x] Prometheus metrics endpoint

## 7. OWASP Top 10 Coverage

| Risk | Status | Notes |
|------|--------|-------|
| A01 Broken Access Control | ⚠️ Partial | Admin role check missing |
| A02 Cryptographic Failures | ✅ Pass | Argon2id, RS256, HMAC-SHA256 |
| A03 Injection | ✅ Pass | Prisma + Zod |
| A04 Insecure Design | ✅ Pass | Defense-in-depth |
| A05 Security Misconfig | ⚠️ Partial | Default secrets in dev `.env` |
| A06 Vulnerable Components | ✅ Pass | Dependabot enabled |
| A07 Auth Failures | ✅ Pass | Argon2id, lockout, MFA |
| A08 Data Integrity | ✅ Pass | Webhook HMAC, CSRF |
| A09 Logging Failures | ✅ Pass | Pino + Sentry + audit log |
| A10 SSRF | ✅ Pass | Webhook URLs validated at creation |

## 8. Action Items

1. **HIGH:** Add `requireRole('admin')` middleware
2. **HIGH:** Implement real JWKS modulus/exponent extraction
3. **MEDIUM:** Drop bcrypt refresh-token fallback after one-time migration
4. **MEDIUM:** Add rate limit on `/auth/refresh`
5. **MEDIUM:** Add config assertion for Argon2 parameters
6. **LOW:** Support cookie secret rotation via `kid`
