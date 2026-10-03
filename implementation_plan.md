# AuthCore → Clerk-Alternative Implementation Plan

**Goal**: Transform AuthCore from a "backend auth API" into a **complete, production-ready, open-source Clerk alternative** with pre-built UI components, admin dashboard, and enterprise features.

---

## 📊 Current State vs Target State

| Category | AuthCore (Current) | Clerk (Target) | Gap |
|----------|-------------------|----------------|-----|
| **Backend API** | ✅ 90% complete | ✅ Complete | Minor |
| **Pre-built UI Components** | ❌ None | ✅ React/Next.js/Vue/Svelte | **Major** |
| **Admin Dashboard** | ❌ API only | ✅ Full web UI | **Major** |
| **SSO/SAML/SCIM** | ❌ None | ✅ Enterprise | **Major** |
| **Passwordless Auth** | ❌ Email only | ✅ Magic links, SMS, Email OTP | **Major** |
| **Bot Protection** | ❌ Rate limit only | ✅ Turnstile/hCaptcha | **Medium** |
| **Email Templates** | ❌ Basic | ✅ Visual editor + React Email | **Medium** |
| **User Metadata** | ❌ JSON fields | ✅ Public/Private/Unsafe with perms | **Medium** |
| **Session UI** | ❌ API only | ✅ User-facing session mgmt | **Medium** |
| **Account Recovery** | ⚠️ Basic | ✅ Robust multi-factor recovery | **Medium** |

---

## 🎯 Implementation Phases

### Phase 1: Foundation & Developer Experience (Weeks 1-4)
*Prerequisite for everything else*

#### 1.1 SDK & Client Libraries
- [ ] **TypeScript/JavaScript SDK** - `@authcore/client` with type-safe methods
- [ ] **React SDK** - `useAuth()`, `useUser()`, `useOrganization()`, `useSession()`
- [ ] **Next.js SDK** - Server components, middleware, `auth()` helper
- [ ] **Vue/Svelte SDKs** - Composables/stores
- [ ] **CLI Tool** - `authcore dev`, `authcore deploy`, `authcore generate:keys`

#### 1.2 API Enhancements
- [ ] **OpenAPI 3.1 Spec** - Complete, versioned, with examples
- [ ] **API Versioning** - Header-based versioning (`Accept: application/vnd.authcore.v1+json`)
- [ ] **Rate Limit Headers** - `X-RateLimit-*` on all responses
- [ ] **Idempotency Keys** - For mutation endpoints
- [ ] **Request Validation** - Zod schemas exposed via API

#### 1.3 Developer Portal
- [ ] **Interactive API Docs** - Scalar/Redoc with "Try it" (authenticated)
- [ ] **SDK Documentation** - Auto-generated from TypeScript types
- [ ] **Quickstart Guides** - Next.js, React, Vue, Node, Python, Go
- [ ] **Code Samples** - Copy-paste ready for common flows

---

### Phase 2: Pre-built UI Components (Weeks 4-10)
*Core differentiator - this is what makes Clerk "Clerk"*

#### 2.1 Core Auth Components (`@authcore/ui-react`)
```tsx
// Drop-in components matching Clerk's API
<SignIn />           // Complete sign-in flow (email, password, OAuth, MFA)
<SignUp />           // Complete sign-up flow
<UserProfile />     // Avatar, name, email, password, MFA, sessions, danger zone
<UserButton />      // Dropdown with profile, settings, sign out
<OrganizationSwitcher /> // Org selector + create/join
<OrganizationProfile />  // Org settings, members, roles, domains
<CreateOrganization />   // Org creation wizard
```

**Technical Approach**:
- Headless logic via `@authcore/client` + React Query/TanStack Query
- Unstyled (Radix UI primitives) + Tailwind CSS default theme
- Full customization via `className`, `renderProps`, CSS variables
- Server-component compatible (Next.js App Router)

#### 2.2 Component Architecture
```
packages/
├── ui-core/           # Headless logic, state machines, validators
├── ui-react/          # React components (Radix + Tailwind)
├── ui-vue/            # Vue components
├── ui-svelte/         # Svelte components
├── ui-html/           # Vanilla JS web components (for any framework)
└── theme/             # Design tokens, Tailwind config, CSS variables
```

#### 2.3 Customization System
- [ ] **Theme Configuration** - Colors, fonts, border radius, spacing
- [ ] **Component Slots** - Override any sub-component (Input, Button, Card)
- [ ] **Custom Fields** - Add fields to SignUp (name, phone, custom)
- [ ] **Flow Customization** - Enable/disable steps (email verification, MFA, org creation)
- [ ] **Localization (i18n)** - 20+ languages, RTL support

---

### Phase 3: Admin Dashboard (Weeks 8-14)
*Self-hosted web UI for managing the auth system*

#### 3.1 Dashboard Architecture
- **Framework**: Next.js 15 (App Router) + React 19 + TanStack Query
- **Auth**: Uses AuthCore's own API (dogfooding)
- **Deployment**: Separate Docker image, can run on same infra

#### 3.2 Core Pages
| Page | Features |
|------|----------|
| **Overview** | Stats: MAU, signups, logins, MFA adoption, security alerts |
| **Users** | List, search, filter, paginate; view details; impersonate; lock/unlock; delete |
| **User Detail** | Profile, sessions, devices, MFA, OAuth accounts, audit logs, metadata |
| **Organizations** | List, create, settings, members, roles, domains, SSO config |
| **Applications** | API keys, redirect URLs, branding, custom domains |
| **Security** | Rate limits, bot protection, breach monitoring, session policies |
| **Emails** | Template editor (React Email), preview, test send, provider config |
| **Webhooks** | Create, test, view deliveries, retry failed |
| **Audit Logs** | Search, filter, export, risk score visualization |
| **Settings** | General, authentication, sessions, passwords, MFA, OAuth providers |

#### 3.3 Admin-Specific Features
- [ ] **User Impersonation** - Generate short-lived impersonation token
- [ ] **Bulk Actions** - Invite users, assign roles, export CSV
- [ ] **Role Builder** - Visual permission matrix editor
- [ ] **Domain Verification** - DNS TXT verification for org domains
- [ ] **Custom Domain** - CNAME verification + SSL (Let's Encrypt integration)

---

### Phase 4: Enterprise Authentication (Weeks 10-18)
*Features required for B2B SaaS sales*

#### 4.1 SAML 2.0 / SSO
- [ ] **SP-Initiated & IdP-Initiated** flows
- [ ] **Metadata Exchange** - XML generation/parsing
- [ ] **Attribute Mapping** - Map SAML attrs → user fields
- [ ] **JIT Provisioning** - Auto-create users on first SSO login
- [ ] **SCIM 2.0** - Provisioning/deprovisioning (Okta, Azure AD, Google)
- [ ] **Certificates** - Upload IdP cert, auto-rotate SP cert

#### 4.2 Social Login Expansion
| Provider | Status | Effort |
|----------|--------|--------|
| Google, GitHub, Microsoft, GitLab | ✅ Done | - |
| Slack, Discord, Apple, Facebook | ❌ | 1 week each |
| Bitbucket, GitHub Enterprise | ❌ | 1 week |
| Generic OIDC | ❌ | 2 weeks |
| Generic SAML | ❌ | 3 weeks |

#### 4.3 Passwordless Authentication
- [ ] **Magic Links** - Email-based, configurable TTL, single-use
- [ ] **Email OTP** - 6-digit codes, rate limited
- [ ] **SMS OTP** - Twilio/Plivo/Vonage providers, configurable
- [ ] **WhatsApp OTP** - Via Twilio/WhatsApp Business API
- [ ] **Passkey-Only** - WebAuthn as primary factor (no password)

#### 4.4 Bot Detection & Abuse Prevention
- [ ] **Cloudflare Turnstile** - Invisible + checkbox modes
- [ ] **hCaptcha** - Alternative provider
- [ ] **Custom Rules** - IP reputation, ASN blocking, geo-blocking
- [ ] **Credential Stuffing Detection** - HaveIBeenPwned integration
- [ ] **Device Fingerprinting** - Client-side JS + server correlation

---

### Phase 5: Advanced User & Session Management (Weeks 12-16)

#### 5.1 User Metadata System (Clerk-compatible)
```typescript
// Three metadata tiers with different permissions
user.publicMetadata   // Readable by frontend, writable by backend
user.privateMetadata  // Readable by backend only
user.unsafeMetadata   // Readable & writable by frontend (use sparingly)
```
- [ ] **Metadata API** - Get/set with permission checks
- [ ] **Metadata in JWT** - Optional inclusion in access token
- [ ] **Validation Schemas** - Zod schemas per metadata type

#### 5.2 Session Management UI
- [ ] **Active Sessions List** - Device, location, last active, revoke
- [ ] **Device Trust** - Trust current device (extend session TTL)
- [ ] **Concurrent Session Limits** - Per-user/org config
- [ ] **Session Activity Log** - IP, UA, location, actions

#### 5.3 Account Recovery
- [ ] **Recovery Codes** - Generated at MFA setup, single-use
- [ ] **Recovery Email** - Secondary email for account recovery
- [ ] **Recovery Phone** - SMS-based recovery
- [ ] **Admin-Initiated Recovery** - Dashboard "Send recovery link"
- [ ] **WebAuthn Recovery** - Platform authenticator as recovery factor

---

### Phase 6: Email & Communications (Weeks 6-10)

#### 6.1 Email Template System
- [ ] **React Email Components** - Pre-built: magic link, verification, invitation, password reset, MFA, security alerts
- [ ] **Visual Editor** - In admin dashboard, live preview
- [ ] **Variables** - `{{user.name}}`, `{{organization.name}}`, `{{magic_link}}`, `{{otp_code}}`
- [ ] **Localization** - Per-template per-language
- [ ] **Branding** - Logo, colors, custom CSS injection

#### 6.2 Email Providers
| Provider | Status |
|----------|--------|
| Resend | ✅ Done |
| SendGrid | ❌ |
| Mailgun | ❌ |
| Postmark | ❌ |
| AWS SES | ❌ |
| Nodemailer (SMTP) | ✅ Done |
| Custom HTTP | ❌ |

#### 6.3 SMS Providers
- [ ] Twilio, Plivo, Vonage, AWS SNS, Infobip

---

### Phase 7: Security Hardening & Compliance (Weeks 4-12, ongoing)

#### 7.1 Security Features
- [ ] **Password Strength** - zxcvbn integration, configurable min score
- [ ] **Breached Password Detection** - HaveIBeenPwned API (k-anonymity)
- [ ] **Risk-Based Auth** - Impossible travel, new device, anomalous IP
- [ ] **Step-Up Authentication** - Require MFA for sensitive actions
- [ ] **Session Binding** - Bind to device fingerprint, IP subnet

#### 7.2 Compliance
- [ ] **GDPR** - Right to erasure API, data export, DPA template
- [ ] **SOC 2** - Audit log completeness, access controls, encryption
- [ ] **HIPAA** - BAA-ready config, audit logging, encryption at rest
- [ ] **Data Residency** - Multi-region deployment guides

---

### Phase 8: Observability & Operations (Weeks 2-6)

#### 8.1 Metrics & Dashboards (Grafana)
- [ ] **Auth Overview** - Signups, logins, success rates, latency
- [ ] **Security** - Failed logins, MFA challenges, token reuse, lockouts
- [ ] **Business** - MAU, org growth, feature adoption
- [ ] **Infrastructure** - DB pool, Redis, queue depth, email delivery

#### 8.2 Alerting Rules (PrometheusRule)
- [ ] High login failure rate
- [ ] Token reuse detected
- [ ] DB connection pool exhaustion
- [ ] Email queue backlog
- [ ] Certificate expiry
- [ ] New device login spikes

#### 8.3 Distributed Tracing
- [ ] OpenTelemetry instrumentation (already partial)
- [ ] Jaeger/Tempo integration
- [ ] Trace correlation across services

---

### Phase 9: Deployment & Operations (Weeks 2-4)

#### 9.1 Docker & Kubernetes
- [ ] **Multi-arch Images** - amd64/arm64
- [ ] **Helm Chart** - Values for dev/staging/prod
- [ ] **Kustomize Overlays** - Environment-specific configs
- [ ] **ArgoCD/Flux** - GitOps deployment

#### 9.2 Database Operations
- [ ] **Migration Strategy** - Zero-downtime migrations
- [ ] **Backup/Restore** - Automated, tested, encrypted
- [ ] **Read Replicas** - For analytics/reporting queries
- [ ] **Connection Pooling** - PgBouncer config

#### 9.3 Secrets Management
- [ ] **External Secrets Operator** - AWS Secrets Manager, Vault, GCP Secret Manager
- [ ] **Key Rotation** - JWT keys, encryption keys, webhook secrets

---

## 📦 Repository Restructure (Monorepo)

```
authcore/
├── apps/
│   ├── api/                 # Fastify backend (existing src/)
│   ├── dashboard/           # Next.js admin dashboard (NEW)
│   └── docs/                # Documentation site (NEW)
├── packages/
│   ├── core/                # Shared types, utilities, constants
│   ├── client/              # @authcore/client - TS/JS SDK
│   ├── client-react/        # @authcore/client-react - React hooks
│   ├── client-nextjs/       # @authcore/nextjs - Next.js integration
│   ├── client-vue/          # @authcore/vue - Vue composables
│   ├── client-svelte/       # @authcore/svelte - Svelte stores
│   ├── ui-core/             # Headless UI logic, state machines
│   ├── ui-react/            # @authcore/ui-react - React components
│   ├── ui-vue/              # @authcore/ui-vue
│   ├── ui-svelte/           # @authcore/ui-svelte
│   ├── ui-html/             # @authcore/ui-html - Web components
│   ├── theme/               # Design tokens, Tailwind preset
│   ├── email/               # @authcore/email - React Email templates
│   ├── crypto/              # Crypto primitives (keys, tokens, encryption)
│   ├── database/            # Prisma client + extensions
│   ├── validators/          # Zod schemas (shared client/server)
│   └── plugins/             # Fastify plugins (auth, rate-limit, etc.)
├── tools/
│   ├── cli/                 # authcore CLI
│   ├── generate/            # Code generators (SDK, types, etc.)
│   └── migration/           # Migration utilities
├── docker/                  # Dockerfiles, compose files
├── k8s/                     # Kubernetes manifests, Helm chart
├── docs/                    # Documentation content
├── turbo.json               # Turborepo config
├── pnpm-workspace.yaml
└── package.json
```

---

## 🎯 Priority Matrix (MoSCoW)

### MUST HAVE (MVP - Clerk Parity)
1. React SDK + Core UI Components (SignIn, SignUp, UserProfile, UserButton)
2. Admin Dashboard (Users, Organizations, Settings)
3. Magic Links + Email OTP
4. SAML/SSO + SCIM 2.0
5. Email Template System + Visual Editor
6. User Metadata (public/private/unsafe)
7. Session Management UI
8. Comprehensive SDK Documentation

### SHOULD HAVE (Post-MVP)
1. Vue/Svelte/HTML SDKs & UI Components
2. SMS/WhatsApp OTP
3. Turnstile/hCaptcha
4. Custom Domains + SSL
5. Advanced Risk-Based Auth
6. Breached Password Detection

### COULD HAVE (Differentiators)
1. Passkey-Only Authentication
2. Device Trust / Trusted Devices
3. Embedded Login (iframe-safe)
4. Multi-region Active-Active
5. Plugin/Extension System
6. Marketplace (community templates, providers)

### WON'T HAVE (v1.0)
1. Hosted offering (AuthCore Cloud)
2. Mobile SDKs (React Native, Flutter, Swift, Kotlin) - separate repo
3. Legacy Protocol Support (LDAP, Kerberos, WS-Federation)
4. Built-in Analytics/BI - integrate with PostHog/Mixpanel/Amplitude

---

## 🤔 Open Questions for User

> [!IMPORTANT]
> **Please review and provide direction on these key decisions:**

### Q1: UI Component Strategy
**Option A**: Build custom unstyled components (Radix + Tailwind) - Full control, more work
**Option B**: Fork/adapt Clerk's open-source components (@clerk/clerk-react) - Faster, but licensing/compatibility?
**Option C**: Use shadcn/ui + custom auth logic - Modern, popular, good DX

### Q2: Admin Dashboard
**Option A**: Build in Next.js (separate app, dogfoods API) - Full control
**Option B**: Build as React Admin / Refine / AdminJS plugin - Faster, less customizable
**Option C**: No separate dashboard - Only API + CLI (like Supabase Auth)

### Q3: SAML/SCIM Priority
- Is enterprise SSO a **launch blocker** or **post-launch**?
- Do you have SAML IdPs to test against (Okta, Azure AD, Google)?

### Q4: Monetization / Sustainability
- Pure MIT/Apache 2.0?
- Open Core (community + enterprise editions)?
- Hosted offering (AuthCore Cloud) eventually?

### Q5: Timeline & Resources
- What's your target **launch date**?
- How many **engineers** available?
- Any **budget** for external audits, design, infrastructure?

### Q6: Immediate Next Steps
Should I start with:
1. **SDK + React UI Components** (highest user impact)
2. **Admin Dashboard** (enables self-service)
3. **SAML/SCIM** (enables enterprise sales)
4. **Email Templates + Magic Links** (completes auth flows)

---

## 📋 Verification Plan

### Automated Tests
```bash
# Backend
pnpm test              # Unit + integration
pnpm test:e2e          # Playwright API tests
pnpm test:contract     # Pact contract tests

# SDKs
pnpm --filter @authcore/client test
pnpm --filter @authcore/client-react test

# UI Components
pnpm --filter @authcore/ui-react test        # Vitest + React Testing Library
pnpm --filter @authcore/ui-react test:visual # Chromatic/Storybook

# Dashboard
pnpm --filter dashboard test
pnpm --filter dashboard test:e2e
```

### Manual Verification
- [ ] Deploy to staging (Kubernetes)
- [ ] Complete signup → verify → login → MFA → session management flow
- [ ] Create org → invite member → assign role → SSO config
- [ ] Admin dashboard: user search, impersonation, bulk actions
- [ ] SAML flow with Okta/Azure AD test tenant
- [ ] SCIM provisioning with Okta
- [ ] Load test: 10k RPS sustained (k6)
- [ ] Security audit: OWASP ZAP, dependency scan
- [ ] Accessibility audit: WCAG 2.1 AA (UI components)

---

## 📅 Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Foundation | 4 weeks | 4 weeks |
| Phase 2: UI Components | 6 weeks | 10 weeks |
| Phase 3: Admin Dashboard | 6 weeks | 16 weeks |
| Phase 4: Enterprise Auth | 8 weeks | 24 weeks |
| Phase 5: Advanced User/Session | 4 weeks | 28 weeks |
| Phase 6: Email/Communications | 4 weeks | 32 weeks |
| Phase 7: Security/Compliance | 8 weeks (parallel) | - |
| Phase 8: Observability | 4 weeks (parallel) | - |
| Phase 9: Deployment/Ops | 2 weeks (parallel) | - |
| **Total (sequential)** | **~32 weeks** | **~8 months** |
| **With 3-4 engineers (parallel)** | **~16-20 weeks** | **~4-5 months** |

---

## 🚀 Quick Wins (Can Start This Week)

1. **Extract shared types** → `@authcore/core` package
2. **Publish OpenAPI spec** → Generate TypeScript client
3. **Add magic link endpoint** → `/auth/magic-link` + email template
4. **Create CLI** → `authcore dev`, `authcore generate:keys`
5. **Documentation site** → Docusaurus/Nextra with API reference

---

**Next Step**: Please review this plan and answer the open questions above. Once approved, I'll create a detailed task breakdown and begin implementation starting with Phase 1.
