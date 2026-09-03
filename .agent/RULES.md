# Agent Rules: AuthCore Development

## 1. Code Quality Standards

### 1.1 TypeScript
- **Strict mode**: Always enabled (`"strict": true`)
- **No `any`**: Use `unknown` with type guards; `any` requires explicit justification comment
- **Explicit returns**: Public APIs must have explicit return types
- **Discriminated unions**: Prefer over optional fields for state machines
- **Branded types**: Use for IDs (`type UserId = string & { __brand: 'UserId' }`)

### 1.2 Code Style
- **Formatter**: Prettier (single quotes, trailing commas, 100 char line width)
- **Linter**: ESLint with `typescript-eslint`, `plugin:security/recommended`
- **Imports**: Sorted (external → internal → relative), grouped by type
- **Naming**: 
  - `PascalCase`: Types, classes, enums, components
  - `camelCase`: Variables, functions, methods
  - `SCREAMING_SNAKE_CASE`: Constants, env vars
  - `kebab-case`: Files, directories, URLs

### 1.3 Architecture Rules
- **Layer separation**: Routes → Services → Repositories (no cross-layer imports)
- **Dependency direction**: Domain → Infrastructure (never reverse)
- **Single responsibility**: Each module exports one primary class/function
- **No circular dependencies**: Enforced by `eslint-plugin-import` rules

## 2. Security Rules (MANDATORY)

### 2.1 Cryptography
- ✅ **DO**: Use `@node-rs/argon2` for passwords, `@node-rs/bcrypt` for tokens
- ✅ **DO**: Use `jose` for JWT (supports key rotation, JWKS)
- ✅ **DO**: Generate keys via `openssl` or Web Crypto API
- ❌ **DON'T**: Roll your own crypto, use `crypto` directly for high-level ops
- ❌ **DON'T**: Hardcode secrets; use environment variables + secret manager
- ❌ **DON'T**: Log tokens, passwords, or PII (use Pino redaction)

### 2.2 Input Validation
- ✅ **DO**: Validate ALL inputs at route level with Zod schemas
- ✅ **DO**: Transform & sanitize in schema (`.transform()`, `.pipe()`)
- ❌ **DON'T**: Trust client-provided data (including headers, cookies)
- ❌ **DON'T**: Use `eval`, `Function`, or dynamic code execution

### 2.3 Database
- ✅ **DO**: Use parameterized queries (Prisma handles this)
- ✅ **DO**: Enable Row Level Security for multi-tenant data
- ✅ **DO**: Encrypt PII at column level (email, names, tokens)
- ❌ **DON'T**: Raw SQL without review; no dynamic table/column names

### 2.4 Rate Limiting & Abuse Prevention
- ✅ **DO**: Rate limit ALL auth endpoints (login, register, reset, refresh)
- ✅ **DO**: Implement progressive delays (exponential backoff)
- ✅ **DO**: Track by IP + user agent + account (defense in depth)
- ❌ **DON'T**: Allow unlimited attempts on any auth endpoint

## 3. Testing Rules

### 3.1 Coverage Requirements
| Layer | Minimum Coverage |
|-------|-----------------|
| Services (business logic) | 95% |
| Repositories (data access) | 90% |
| Routes (HTTP handling) | 85% |
| Utilities | 90% |

### 3.2 Test Patterns
- **Unit**: Pure functions, services with mocked dependencies
- **Integration**: Real DB (Testcontainers), real Redis, real email queue
- **E2E**: Full stack against staging-like environment
- **Contract**: Provider-side (Pact) for all public APIs

### 3.3 Test Data
- Use factories (`@faker-js/faker`) not static fixtures
- Each test gets isolated DB (transaction rollback)
- No shared state between tests

## 4. Git & Commit Rules

### 4.1 Branch Strategy
