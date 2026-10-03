/**
 * AuthCore TypeScript SDK
 *
 * Official client library for the AuthCore authentication platform.
 * Provides typed access to all public APIs.
 *
 * @example
 * ```typescript
 * import { AuthCore } from '@authcore/sdk';
 *
 * const client = new AuthCore({
 *   baseUrl: 'https://api.authcore.example.com',
 *   apiKey: 'ak_live_...',
 * });
 *
 * // Register a new user
 * const { user } = await client.auth.register({
 *   email: 'user@example.com',
 *   password: 'secure-password-123!',
 * });
 *
 * // Login
 * const { accessToken, user } = await client.auth.login({
 *   email: 'user@example.com',
 *   password: 'secure-password-123!',
 * });
 *
 * // Get current user
 * const me = await client.users.me();
 * ```
 */

export interface AuthCoreConfig {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  fetch?: typeof fetch;
}

export class AuthCoreError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthCoreError';
  }
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
  avatarUrl: string | null;
  mfaEnabled: boolean;
  status: 'active' | 'locked' | 'deleted';
  createdAt: string;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export class AuthCore {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private accessToken: string | null;

  constructor(config: AuthCoreConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.accessToken = config.accessToken ?? null;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  auth = {
    /**
     * Register a new user account.
     * @throws {AuthCoreError} 409 if email already exists
     */
    register: async (input: RegisterInput): Promise<{ user: User }> => {
      return this.request('/auth/register', { method: 'POST', body: input });
    },

    /**
     * Authenticate with email and password.
     * @throws {AuthCoreError} 401 on bad credentials, 423 on locked account
     */
    login: async (input: LoginInput): Promise<AuthTokens & { user: User }> => {
      const result = await this.request<AuthTokens & { user: User }>('/auth/login', {
        method: 'POST',
        body: input,
      });
      this.accessToken = result.accessToken;
      return result;
    },

    /**
     * Refresh the access token using the refresh cookie.
     */
    refresh: async (): Promise<AuthTokens> => {
      return this.request('/auth/refresh', { method: 'POST' });
    },

    /**
     * Logout the current session.
     */
    logout: async (): Promise<void> => {
      await this.request('/auth/logout', { method: 'POST' });
      this.accessToken = null;
    },

    /**
     * Logout all sessions for the current user.
     */
    logoutAll: async (): Promise<{ revokedCount: number }> => {
      return this.request('/auth/logout-all', { method: 'POST' });
    },

    /**
     * Request a password reset email.
     */
    forgotPassword: async (email: string): Promise<{ message: string }> => {
      return this.request('/auth/forgot-password', { method: 'POST', body: { email } });
    },

    /**
     * Reset password with a token from email.
     */
    resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
      return this.request('/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword },
      });
    },

    /**
     * Change the current user's password.
     */
    changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
      return this.request('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
    },

    verifyEmail: async (token: string): Promise<{ message: string; user: User }> => {
      return this.request('/auth/verify-email', { method: 'POST', body: { token } });
    },
  };

  users = {
    /**
     * Get the currently authenticated user.
     */
    me: async (): Promise<User> => {
      return this.request('/auth/me');
    },

    /**
     * Update the currently authenticated user.
     */
    updateMe: async (data: Partial<Pick<User, 'fullName' | 'avatarUrl'>>): Promise<User> => {
      return this.request('/auth/me', { method: 'PATCH', body: data });
    },

    /**
     * List all active sessions for the current user.
     */
    listSessions: async (): Promise<Array<{
      id: string;
      userAgent: string | null;
      ipAddress: string | null;
      createdAt: string;
      isCurrent: boolean;
    }>> => {
      const result = await this.request<{ sessions: Array<{
        id: string;
        userAgent: string | null;
        ipAddress: string | null;
        createdAt: string;
        isCurrent: boolean;
      }> }>('/auth/sessions');
      return result.sessions;
    },

    /**
     * Revoke a specific session.
     */
    revokeSession: async (sessionId: string): Promise<{ message: string }> => {
      return this.request(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
    },
  };

  mfa = {
    /**
     * Begin TOTP setup. Returns the secret and QR URL.
     * User must scan QR and call verify() with a code to activate.
     */
    setupTotp: async (): Promise<{
      secret: string;
      otpauthUrl: string;
      backupCodes: string[];
    }> => {
      return this.request('/auth/mfa/totp/setup', { method: 'POST', body: {} });
    },

    /**
     * Verify a TOTP code to activate MFA.
     */
    verifyTotp: async (code: string): Promise<{ message: string }> => {
      return this.request('/auth/mfa/totp/verify', { method: 'POST', body: { code } });
    },

    /**
     * Disable MFA (requires current TOTP code).
     */
    disableTotp: async (code: string): Promise<{ message: string }> => {
      return this.request('/auth/mfa/totp/disable', { method: 'POST', body: { code } });
    },

    /**
     * Consume a backup code.
     */
    verifyBackupCode: async (code: string): Promise<{ message: string }> => {
      return this.request('/auth/mfa/backup-code/verify', {
        method: 'POST',
        body: { code },
      });
    },
  };

  webauthn = {
    /**
     * Begin passkey registration. Returns options to pass to navigator.credentials.create().
     */
    setup: async (deviceName?: string): Promise<unknown> => {
      return this.request('/auth/webauthn/setup', {
        method: 'POST',
        body: { deviceName },
      });
    },

    /**
     * Complete passkey registration with the credential response.
     */
    verify: async (challenge: string, credential: unknown): Promise<{ message: string }> => {
      return this.request('/auth/webauthn/verify', {
        method: 'POST',
        body: { challenge, credential },
      });
    },

    /**
     * List registered passkeys.
     */
    list: async (): Promise<Array<{
      id: string;
      name: string;
      deviceType: string;
      createdAt: string;
    }>> => {
      const result = await this.request<{ credentials: Array<{
        id: string;
        name: string;
        deviceType: string;
        createdAt: string;
      }> }>('/auth/webauthn/credentials');
      return result.credentials;
    },

    /**
     * Delete a passkey.
     */
    delete: async (credentialId: string): Promise<{ message: string }> => {
      return this.request(`/auth/webauthn/credentials/${credentialId}`, {
        method: 'DELETE',
        body: { credentialId },
      });
    },
  };

  organizations = {
    list: async (): Promise<Array<{ id: string; name: string; slug: string }>> => {
      const result = await this.request<{ organizations: Array<{ id: string; name: string; slug: string }> }>('/orgs');
      return result.organizations;
    },

    create: async (data: { name: string; slug: string; description?: string }): Promise<{ id: string; name: string; slug: string }> => {
      return this.request('/orgs', { method: 'POST', body: data });
    },
  };

  apiKeys = {
    list: async (): Promise<Array<{ id: string; name: string; prefix: string; createdAt: string }>> => {
      const result = await this.request<{ keys: Array<{ id: string; name: string; prefix: string; createdAt: string }> }>('/api-keys');
      return result.keys;
    },

    create: async (data: { name: string; scopes?: string[]; expiresAt?: string }): Promise<{ id: string; key: string }> => {
      return this.request('/api-keys', { method: 'POST', body: data });
    },

    revoke: async (keyId: string): Promise<{ message: string }> => {
      return this.request(`/api-keys/${keyId}`, { method: 'DELETE' });
    },
  };

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const res = await this.fetchImpl(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new AuthCoreError(
        (errorBody.code as string) ?? 'UNKNOWN_ERROR',
        res.status,
        (errorBody.message as string) ?? res.statusText,
        errorBody
      );
    }

    return res.json() as Promise<T>;
  }
}

export default AuthCore;
