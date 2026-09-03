# AuthCore Next.js Integration

## Installation

```bash
pnpm add @authcore/sdk
```

## Environment Setup

```bash
# .env.local
AUTHCORE_URL=https://api.authcore.example.com
AUTHCORE_PUBLISHABLE_KEY=pk_live_xxx
```

## App Router Setup

### Middleware (route protection)

```typescript
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register', '/verify-email', '/reset-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  if (!accessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Server-side auth helper

```typescript
// lib/auth.ts
import { cookies } from 'next/headers';
import { AuthCore } from '@authcore/sdk';

const authcore = new AuthCore({
  baseUrl: process.env.AUTHCORE_URL!,
});

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) return null;

  authcore.setAccessToken(accessToken);
  try {
    return await authcore.users.me();
  } catch {
    return null;
  }
}
```

### Server component example

```typescript
// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return <div>Welcome, {user.fullName ?? user.email}</div>;
}
```

### Login page (client component)

```typescript
// app/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCore } from '@authcore/sdk';

const authcore = new AuthCore({ baseUrl: process.env.NEXT_PUBLIC_AUTHCORE_URL! });

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authcore.auth.login({ email, password });
      // Refresh token set as HttpOnly cookie by server
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
```

## Logout

```typescript
'use client';
import { useRouter } from 'next/navigation';
import { AuthCore } from '@authcore/sdk';

const authcore = new AuthCore({ baseUrl: process.env.NEXT_PUBLIC_AUTHCORE_URL! });

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await authcore.auth.logout();
    router.push('/login');
  }

  return <button onClick={logout}>Sign out</button>;
}
```

## API Route Protection

```typescript
// app/api/profile/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AuthCore } from '@authcore/sdk';

const authcore = new AuthCore({ baseUrl: process.env.AUTHCORE_URL! });

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  authcore.setAccessToken(accessToken);
  const user = await authcore.users.me();
  return NextResponse.json(user);
}
```

## Webhook Handling

```typescript
// app/api/webhooks/authcore/route.ts
import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const WEBHOOK_SECRET = process.env.AUTHCORE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-authcore-signature');
  const expected = `sha256=${createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')}`;

  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);

  switch (event.event) {
    case 'user.registered':
      // ... send welcome email
      break;
    case 'user.deleted':
      // ... cleanup
      break;
  }

  return NextResponse.json({ received: true });
}
```

## Server-Side Token Refresh

```typescript
// lib/refresh.ts
import { cookies } from 'next/headers';
import { AuthCore } from '@authcore/sdk';

const authcore = new AuthCore({ baseUrl: process.env.AUTHCORE_URL! });

export async function refreshAccessToken() {
  const cookieStore = await cookies();
  // Refresh is automatic via HttpOnly cookie
  const result = await authcore.auth.refresh();
  cookieStore.set('access_token', result.accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: result.expiresIn,
  });
  return result.accessToken;
}
```
