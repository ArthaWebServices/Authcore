# AuthCore Penetration Test Plan (TASK-067)

**Engagement Type:** Black-box + Grey-box
**Duration:** 2 weeks
**Scope:** All API endpoints, admin console, webhooks, OIDC flow

## 1. Pre-engagement

- Scope: `https://staging.authcore.example.com`
- Out of scope: DDoS, social engineering, physical
- Rules of engagement: No destructive tests, no data exfiltration
- Communication: Slack #sec-engagements, daily standups

## 2. Reconnaissance

### Public Endpoint Discovery
- [ ] Map all endpoints via Swagger / OpenAPI
- [ ] Identify OIDC Discovery: `/.well-known/openid-configuration`
- [ ] Check JWKS exposure: `/.well-known/jwks.json`
- [ ] Verify admin endpoints NOT indexed by search engines
- [ ] Scan for common paths: `/.env`, `/.git`, `/admin`, `/phpmyadmin`

### Information Disclosure
- [ ] Server header leakage (should be hidden)
- [ ] X-Powered-By header
- [ ] Stack traces in error responses
- [ ] Verbose error messages revealing schema

## 3. Authentication Testing

### Password Authentication
- [ ] Brute-force login (5 attempts → verify lockout)
- [ ] Username enumeration (different response for valid/invalid email)
- [ ] Password spraying with top 100 passwords
- [ ] Credential stuffing simulation
- [ ] Verify password is not returned in any response

### Token Security
- [ ] JWT algorithm confusion (none, HS256 with public key)
- [ ] JWT signature stripping
- [ ] JWT payload tampering
- [ ] Replay old refresh token (must be detected)
- [ ] Refresh token leak via referrer/logs
- [ ] Verify access token TTL is 15 min (not longer)
- [ ] Verify refresh token TTL is 30 days max

### MFA
- [ ] TOTP brute force (6 digits = 1M, 30s window = 33k/s, must rate-limit)
- [ ] TOTP replay (should be one-time)
- [ ] Backup code reuse (should mark consumed)
- [ ] MFA bypass via session fixation
- [ ] WebAuthn origin validation
- [ ] WebAuthn challenge replay
- [ ] WebAuthn credential reuse across users

## 4. Authorization Testing

### Vertical Privilege Escalation
- [ ] Regular user → admin endpoints
- [ ] Modify own role via PATCH /admin/users/:id
- [ ] Impersonate another user without admin token

### Horizontal Privilege Escalation
- [ ] User A accesses User B's sessions (`/auth/sessions`)
- [ ] User A revokes User B's session (`DELETE /auth/sessions/:id`)
- [ ] User A reads User B's org data

### IDOR
- [ ] Sequential UUIDs leak via timing
- [ ] Session ID in URL is guessable
- [ ] API key enumeration via timing

## 5. Injection

### SQL Injection
- [ ] Login form, search box, all user-controlled strings
- [ ] Prisma parameterization should block all standard vectors
- [ ] Test raw SQL escape hatches

### NoSQL Injection
- [ ] JSON body field injection (Mongo-style operators)
- [ ] Redis injection (Lua scripts)

### Command Injection
- [ ] Webhook URL — does the system fetch arbitrary URLs?
- [ ] Email template injection

## 6. Webhooks

- [ ] SSRF: webhook URL pointing to internal metadata (`http://169.254.169.254/`)
- [ ] SSRF: webhook URL pointing to localhost
- [ ] DNS rebinding
- [ ] Webhook signature forgery
- [ ] Webhook replay (timestamp validation)
- [ ] Webhook payload injection (XSS in consumer UI)

## 7. Rate Limiting & DoS

- [ ] Bypass via different IPs (X-Forwarded-For spoofing)
- [ ] Bypass via different User-Agents
- [ ] Bypass via different paths (path normalization)
- [ ] Concurrent session creation (memory pressure)
- [ ] Large payload DoS (verify body limit = 1MB)

## 8. CSRF

- [ ] Verify CSRF token required on all state-changing requests
- [ ] Bypass via content-type (e.g., `application/x-www-form-urlencoded`)
- [ ] Bypass via missing token in cross-origin request

## 9. Reporting

Findings classified by **CVSS v3.1**:
- **Critical** (9.0-10.0): Immediate fix
- **High** (7.0-8.9): Fix within 7 days
- **Medium** (4.0-6.9): Fix within 30 days
- **Low** (0.1-3.9): Backlog

## 10. Tools

- Burp Suite Pro (primary)
- OWASP ZAP (secondary)
- jwt_tool (JWT testing)
- ffuf (directory fuzzing)
- sqlmap (SQL injection)
- nmap (port scanning)
- Custom scripts for AuthCore-specific tests
