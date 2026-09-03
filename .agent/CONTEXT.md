# Project Context: AuthCore

## 1. Project Background

### 1.1 Origin
AuthCore was initiated to replace Clerk authentication in the **College Announcement Portal** project. The current Clerk integration works but has limitations:
- Cost scaling with MAU
- Limited customization of auth flows
- Vendor lock-in concerns
- Learning opportunity for team

### 1.2 Current State (as of 2024-01-15)
- **Frontend**: React 18 + Vite + TypeScript (in `frontend/`)
- **Backend**: Express + TypeScript (in `backend/`)
- **Auth**: Clerk (React SDK + Express middleware)
- **Database**: PostgreSQL (shared with app)
- **Deployment**: Vercel (frontend) + Railway (backend)

### 1.3 Migration Constraints
- **Zero downtime** required during migration
- **Existing users** must retain access (password hashes portable from Clerk)
- **Session continuity** preferred but not required
- **Rollback plan** must exist at each step

## 2. Domain Context

### 2.1 Application: College Announcement Portal
- **Users**: Students, Faculty, Administrators
- **Organizations**: Colleges/Universities (multi-tenant)
- **Core Features**: Announcements, File sharing, Notifications, Calendar
- **Scale**: ~50 colleges, ~10k active users, ~100k MAU projected

### 2.2 User Types & Permissions

| Role | Permissions |
|------|-------------|
| **Super Admin** | Platform-wide: manage colleges, view analytics, impersonate |
| **College Admin** | Manage users, announcements, settings for their college |
| **Faculty** | Create/edit announcements, upload files, manage courses |
| **Student** | View announcements, download files, subscribe to courses |
| **Guest** | View public announcements only |

### 2.3 Current Clerk Configuration
```typescript
// Current Clerk setup (to be migrated)
{
  // Providers: Google, Microsoft (edu emails)
  // MFA: TOTP optional
  // Session: 30 days
  // Custom claims: role, college_id, permissions
  // Webhooks: user.created, user.updated, session.revoked
}
