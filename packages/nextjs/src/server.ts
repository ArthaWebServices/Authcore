import { AuthCoreClient } from '@authcore/client';
import type { User, Session } from '@authcore/client';

export interface AuthSession {
  userId: string | null;
  sessionId: string | null;
  user: User | null;
  session: Session | null;
  getToken: () => Promise<string | null>;
}

export async function auth(options?: {
  req?: Request | { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string> };
}): Promise<AuthSession> {
  const baseUrl = process.env.AUTHCORE_URL || process.env.NEXT_PUBLIC_AUTHCORE_URL || 'http://localhost:3000';

  let accessToken: string | null = null;

  if (options?.req) {
    if ('headers' in options.req && typeof (options.req.headers as any).get === 'function') {
      const header = (options.req.headers as any).get('authorization');
      if (header?.startsWith('Bearer ')) {
        accessToken = header.substring(7);
      }
    } else if ('headers' in options.req) {
      const header = (options.req.headers as Record<string, any>)['authorization'];
      if (typeof header === 'string' && header.startsWith('Bearer ')) {
        accessToken = header.substring(7);
      }
    }
  }

  if (!accessToken) {
    return {
      userId: null,
      sessionId: null,
      user: null,
      session: null,
      getToken: async () => null,
    };
  }

  try {
    const client = new AuthCoreClient({ baseUrl, accessToken });
    const me = await client.getMe();
    return {
      userId: me.id,
      sessionId: null,
      user: me,
      session: null,
      getToken: async () => accessToken,
    };
  } catch {
    return {
      userId: null,
      sessionId: null,
      user: null,
      session: null,
      getToken: async () => null,
    };
  }
}
