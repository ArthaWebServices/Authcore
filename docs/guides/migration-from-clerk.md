# Migrating from Clerk to AuthCore

This guide walks through moving an existing application from Clerk to AuthCore.

## When to Migrate

Consider migrating when:
- You need full control of auth data (GDPR, compliance)
- Cost grows beyond a few thousand MAU
- You want to remove a third-party dependency
- You need features Clerk doesn't support (custom RBAC, on-prem deployment)

## What You'll Need

- Existing Clerk user data (exported via Clerk API or dashboard)
- Self-hosted AuthCore instance running
- Maintenance window (1-2 hours recommended)

## Step 1: Export Users from Clerk

Use the Clerk Backend API or dashboard export to get:

```json
[
  {
    "id": "user_2abc...",
    "email_address": "user@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "password_hash": "$argon2id$v=19$m=19456,t=2,p=1$...",
    "verified_email": true,
    "created_at": 1693838470000,
    "external_accounts": [
      { "provider": "oauth_google", "external_id": "..." }
    ]
  }
]
```

**Important:** Clerk uses Argon2id, which AuthCore also supports — no rehash needed.

## Step 2: Map Schema

Clerk → AuthCore field mapping:

| Clerk | AuthCore |
|-------|----------|
| `id` | `id` (UUID format, generate new) |
| `email_address` | `email` |
| `first_name + last_name` | `fullName` |
| `password_hash` | `passwordHash` (compatible) |
| `verified_email` | `emailVerified` |
| `external_accounts` | `OAuthAccount` table |
| Sessions (Clerk) | Map to AuthCore `Session` (force re-auth) |

## Step 3: Run the Migration Tool

The AuthCore migration tool reads Clerk export and imports to AuthCore DB:

```bash
# Clone and build the migration tool
git clone https://github.com/authcore/migration-tool.git
cd migration-tool
pnpm install
pnpm build

# Dry run first
DATABASE_URL=postgres://... CLERK_EXPORT=./clerk-export.json pnpm run dry-run

# Real import
DATABASE_URL=postgres://... CLERK_EXPORT=./clerk-export.json pnpm run import
```

The tool will:
- Read `clerk-export.json`
- Transform fields to AuthCore schema
- Insert users in transactions (1000 per batch)
- Create OAuth account records
- Skip users with duplicate emails (configurable)
- Generate a migration report

## Step 4: Dual-Write Period

To avoid disrupting active users, run **both** systems in parallel:

```typescript
// lib/auth.ts — dual-write during transition
import { AuthCore } from '@authcore/sdk';
import { clerkClient } from '@clerk/nextjs/server';

const authcore = new AuthCore({ baseUrl: process.env.AUTHCORE_URL! });

export async function syncUserToAuthCore(clerkUserId: string) {
  const user = await clerkClient.users.getUser(clerkUserId);

  // Forward to AuthCore (idempotent)
  try {
    await authcore.auth.register({
      email: user.emailAddresses[0].emailAddress,
      password: `MIGRATED_${user.id}`, // disabled — user must set
      fullName: `${user.firstName} ${user.lastName}`.trim(),
    });
  } catch (err) {
    if (err.code !== 'USER_EXISTS') throw err;
  }
}
```

During dual-write, every Clerk registration/login is mirrored to AuthCore.

## Step 5: Communicate to Users

Send an email to all users (one week before cutover):

> **Subject:** We're upgrading our authentication
>
> Hi Jane,
>
> On **September 25** we're upgrading our authentication system. Your account will move automatically. **You'll need to reset your password** on or after that date using the "Forgot password" link on the login page.
>
> Thanks for your patience.

## Step 6: Cutover

On the cutover date:

1. **Disable** registration in Clerk
2. **Update** auth client to use AuthCore SDK
3. **Force** all users to re-authenticate (clear Clerk sessions)
4. **Send** users to `/login` with a banner: "Please reset your password"
5. Users click "Forgot password" → reset → log in via AuthCore

## Step 7: Decommission Clerk

After 30 days of stable AuthCore operation:
- Cancel Clerk subscription
- Delete Clerk workspace
- Remove Clerk-related code (env vars, deps, import statements)
- Archive Clerk export for compliance retention

## Rollback Plan

If AuthCore fails critically within 7 days post-cutover:
1. Re-enable Clerk login flow
2. AuthCore stays as write-only backup
3. Investigate root cause
4. Re-attempt cutover after fix

## Checklist

- [ ] Clerk user export completed
- [ ] Schema mapping reviewed
- [ ] Migration tool dry-run reviewed
- [ ] Migration tool real import completed
- [ ] All user passwords are Argon2id hashes (or will be reset)
- [ ] Dual-write period (2-4 weeks) elapsed
- [ ] Cutover email sent to users
- [ ] Rollback plan documented and tested
- [ ] Clerk subscription scheduled for cancellation
