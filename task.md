# AuthCore → Clerk Alternative: Task Tracker

## Phase 1: Foundation & Developer Experience (Weeks 1-4)

### 1.1 Monorepo Setup & Restructure
- [ ] Initialize Turborepo configuration
- [ ] Create pnpm-workspace.yaml with proper package structure
- [ ] Restructure existing `src/` into `apps/api/`
- [ ] Create `packages/` directory structure
- [ ] Configure TypeScript project references
- [ ] Set up shared ESLint/Prettier configs

### 1.2 Core Package (`@authcore/core`)
- [ ] Extract shared types from existing codebase
- [ ] Create constants (error codes, event types, claim names)
- [ ] Shared utilities (crypto helpers, validation, date formatting)
- [ ] Zod schemas for API requests/responses
- [ ] Publish as internal package

### 1.3 Database Package (`@authcore/database`)
- [ ] Extract Prisma client with extensions
- [ ] Add middleware for soft deletes, audit logging
- [ ] Connection pooling configuration
- [ ] Migration utilities

### 1.4 Crypto Package (`@authcore/crypto`)
- [ ] JWT signing/verification (RS256, key rotation)
- [ ] Token generation (access, refresh, verification, magic links)
- [ ] Encryption utilities (AES-256-GCM for PII, OAuth tokens)
- [ ] Password hashing (Argon2id)
- [ ] WebAuthn crypto helpers

### 1.5 Validators Package (`@authcore/validators`)
- [ ] Zod schemas for all API endpoints
- [ ] Shared validation logic (email, password strength, etc.)
- [ ] Type inference exports

### 1.6 TypeScript/JavaScript SDK (`@authcore/client`)
- [ ] HTTP client with interceptors (auth, retry, idempotency)
- [ ] Type-safe methods for all API endpoints
- [ ] Token storage & auto-refresh logic
- [ ] Organization context switching
- [ ] React-query/TanStack Query integration hooks
- [ ] SSR-compatible (no window/localStorage on server)

### 1.7 React SDK (`@authcore/client-react`)
- [ ] `AuthProvider` context
- [ ] `useAuth()` - authentication state & methods
- [ ] `useUser()` - user profile, metadata
- [ ] `useSession()` - session management
- [ ] `useOrganization()` - org context, switching
- [ ] `useSignIn()`, `useSignUp()` - form helpers
- [ ] `ProtectedRoute`, `SignedIn`, `SignedOut` components

### 1.8 Next.js SDK (`@authcore/nextjs`)
- [ ] `auth()` server helper (get session in Server Components)
- [ ] Middleware for route protection
- [ ] `AuthCoreProvider` for client components
- [ ] API route handlers (sign-in, sign-out, callback)
- [ ] App Router & Pages Router support

### 1.9 API Enhancements
- [ ] OpenAPI 3.1 specification generation
- [ ] API versioning middleware
- [ ] Idempotency key support
- [ ] Rate limit headers on all responses
- [ ] Request/response logging middleware

### 1.10 CLI Tool (`authcore`)
- [ ] `authcore dev` - Start dev environment
- [ ] `authcore build` - Build all packages
- [ ] `authcore generate:keys` - Generate JWT keys, encryption keys
- [ ] `authcore db:migrate` - Run migrations
- [ ] `authcore db:seed` - Seed database
- [ ] `authcore deploy` - Deploy helpers

### 1.11 Documentation Site
- [ ] Docusaurus/Nextra setup
- [ ] API reference (auto-generated from OpenAPI)
- [ ] SDK documentation
- [ ] Quickstart guides (Next.js, React, Vue, Node)
- [ ] Component storybook

---

## Phase 2: UI Components (Weeks 4-10) - NOT STARTED
## Phase 3: Admin Dashboard (Weeks 8-14) - NOT STARTED
## Phase 4: Enterprise Auth (Weeks 10-18) - NOT STARTED
## Phase 5-9: Advanced Features - NOT STARTED

---

## Current Sprint: Phase 1 (Completed & Deployment Fixes)

### Completed
- [x] Monorepo setup with Turborepo & pnpm workspace
- [x] Package structure creation (@authcore/core, @authcore/database, @authcore/crypto, @authcore/validators, @authcore/client, @authcore/nextjs)
- [x] Database migrations created (`20240101000000_init`)
- [x] Database seed script implemented (`prisma/seed.ts`)
- [x] Key generator script implemented (`scripts/generate-keys.ts`)
- [x] Multi-stage production Dockerfile fixed
- [x] Render cloud deployment blueprint (`render.yaml`) created
- [x] Fastify API path alias resolution fixed for production
- [x] Integration test import paths updated
- [x] CI workflow updated for automated Prisma generation

### Next Up (Priority 2 & 3)
- [ ] Pre-built React UI Components (<SignIn />, <SignUp />, <UserProfile />)
- [ ] Admin Dashboard UI in Next.js (`apps/dashboard`)
- [ ] Magic links & email OTP authentication
