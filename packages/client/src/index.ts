import {
  AuthCoreClientOptions,
  TokenPair,
  User,
  Session,
  Organization,
  Membership,
  Role,
  Permission,
  ApiKey,
  Webhook,
  WebhookDelivery,
  AuditLog,
  PaginatedResponse,
  AuthError,
} from './types';

export {
  AuthCoreClientOptions,
  TokenPair,
  User,
  Session,
  Organization,
  Membership,
  Role,
  Permission,
  ApiKey,
  Webhook,
  WebhookDelivery,
  AuditLog,
  PaginatedResponse,
  AuthError,
};

interface ErrorResponse {
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class AuthCoreClient {
  private baseUrl: string;
  private apiKey?: string;
  private accessToken?: string;
  private refreshToken?: string;
  private onTokenRefresh?: (tokens: { accessToken: string; refreshToken: string }) => void;
  private fetchOptions?: RequestInit;

  constructor(options: AuthCoreClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.onTokenRefresh = options.onTokenRefresh;
    this.fetchOptions = options.fetchOptions;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      ...this.fetchOptions,
      ...options,
      headers,
    });

    if (response.status === 401 && this.refreshToken && !path.includes('/auth/refresh')) {
      await this.refreshAccessToken();
      return this.request(path, options);
    }

    const data = await response.json().catch(() => ({})) as ErrorResponse;

    if (!response.ok) {
      const error: AuthError = {
        code: data.error?.code || 'UNKNOWN_ERROR',
        message: data.error?.message || response.statusText,
        details: data.error?.details,
      };
      throw new AuthCoreError(error);
    }

    return data as T;
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new AuthCoreError({
        code: 'TOKEN_EXPIRED',
        message: 'No refresh token available',
      });
    }

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (!response.ok) {
      throw new AuthCoreError({
        code: 'TOKEN_EXPIRED',
        message: 'Failed to refresh token',
      });
    }

    const tokens = await response.json() as { accessToken: string; refreshToken: string };
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    
    if (this.onTokenRefresh) {
      this.onTokenRefresh({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    }
  }

  // Auth methods
  async register(data: { email: string; password: string; fullName?: string; redirectUrl?: string }): Promise<{ user: User; message: string }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string; rememberMe?: boolean; mfaCode?: string; mfaBackupCode?: string }): Promise<TokenPair & { user: User }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async refresh(refreshToken?: string): Promise<TokenPair> {
    const token = refreshToken || this.refreshToken;
    if (!token) {
      throw new AuthCoreError({
        code: 'TOKEN_EXPIRED',
        message: 'No refresh token available',
      });
    }
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: token }),
    });
  }

  async logout(everywhere?: boolean, sessionId?: string): Promise<void> {
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ everywhere, sessionId }),
    });
  }

  async getMe(): Promise<User> {
    return this.request('/auth/me');
  }

  async updateProfile(data: { fullName?: string; avatarUrl?: string; locale?: string; timezone?: string }): Promise<User> {
    return this.request('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    return this.request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    return this.request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async forgotPassword(email: string, redirectUrl?: string): Promise<{ message: string }> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, redirectUrl }),
    });
  }

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Session methods
  async listSessions(params?: { page?: number; limit?: number; activeOnly?: boolean }): Promise<PaginatedResponse<Session>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.activeOnly) searchParams.set('activeOnly', 'true');
    
    const query = searchParams.toString();
    return this.request(`/auth/sessions${query ? `?${query}` : ''}`);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.request(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // MFA methods
  async setupTotp(): Promise<{ secret: string; uri: string; backupCodes: string[] }> {
    return this.request('/auth/mfa/totp/setup', {
      method: 'POST',
    });
  }

  async verifyTotp(code: string): Promise<{ message: string; backupCodes: string[] }> {
    return this.request('/auth/mfa/totp/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disableTotp(password: string, code?: string, backupCode?: string): Promise<{ message: string }> {
    return this.request('/auth/mfa/totp/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code, backupCode }),
    });
  }

  async getBackupCodes(): Promise<{ backupCodes: string[] }> {
    return this.request('/auth/mfa/backup-codes');
  }

  async regenerateBackupCodes(password: string): Promise<{ backupCodes: string[] }> {
    return this.request('/auth/mfa/backup-codes/regenerate', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  // WebAuthn methods
  async startWebAuthnRegistration(nickname?: string): Promise<{ challenge: string; options: any }> {
    return this.request('/auth/mfa/webauthn/register/start', {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    });
  }

  async finishWebAuthnRegistration(credential: any, nickname?: string): Promise<{ message: string }> {
    return this.request('/auth/mfa/webauthn/register/finish', {
      method: 'POST',
      body: JSON.stringify({ credential, nickname }),
    });
  }

  async startWebAuthnAuthentication(): Promise<{ challenge: string; options: any }> {
    return this.request('/auth/mfa/webauthn/authenticate/start', {
      method: 'POST',
    });
  }

  async finishWebAuthnAuthentication(credential: any): Promise<TokenPair & { user: User }> {
    return this.request('/auth/mfa/webauthn/authenticate/finish', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
  }

  // OAuth methods
  async getOAuthUrl(provider: string, redirectUrl?: string): Promise<{ url: string }> {
    const searchParams = new URLSearchParams();
    if (redirectUrl) searchParams.set('redirectUrl', redirectUrl);
    return this.request(`/auth/oauth/${provider}${searchParams.toString() ? `?${searchParams}` : ''}`);
  }

  async linkOAuthAccount(provider: string, code: string, redirectUrl?: string): Promise<{ message: string }> {
    return this.request('/auth/oauth/link', {
      method: 'POST',
      body: JSON.stringify({ provider, code, redirectUrl }),
    });
  }

  async unlinkOAuthAccount(provider: string, password: string): Promise<{ message: string }> {
    return this.request('/auth/oauth/unlink', {
      method: 'POST',
      body: JSON.stringify({ provider, password }),
    });
  }

  // Organization methods
  async listOrganizations(): Promise<Organization[]> {
    return this.request('/organizations');
  }

  async getOrganization(orgId: string): Promise<Organization> {
    return this.request(`/organizations/${orgId}`);
  }

  async createOrganization(data: { name: string; slug: string; description?: string }): Promise<Organization> {
    return this.request('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOrganization(orgId: string, data: { name?: string; description?: string; metadata?: Record<string, unknown> }): Promise<Organization> {
    return this.request(`/organizations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteOrganization(orgId: string): Promise<void> {
    await this.request(`/organizations/${orgId}`, {
      method: 'DELETE',
    });
  }

  async listMembers(orgId: string): Promise<Membership[]> {
    return this.request(`/organizations/${orgId}/members`);
  }

  async inviteMember(orgId: string, data: { email: string; roleId: string; redirectUrl?: string }): Promise<{ message: string }> {
    return this.request(`/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMemberRole(orgId: string, userId: string, roleId: string): Promise<Membership> {
    return this.request(`/organizations/${orgId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ roleId }),
    });
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    await this.request(`/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  async listRoles(orgId: string): Promise<Role[]> {
    return this.request(`/organizations/${orgId}/roles`);
  }

  async getRole(orgId: string, roleId: string): Promise<Role> {
    return this.request(`/organizations/${orgId}/roles/${roleId}`);
  }

  async createRole(orgId: string, data: { name: string; description?: string; permissionIds?: string[] }): Promise<Role> {
    return this.request(`/organizations/${orgId}/roles`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRole(orgId: string, roleId: string, data: { name?: string; description?: string; permissionIds?: string[] }): Promise<Role> {
    return this.request(`/organizations/${orgId}/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteRole(orgId: string, roleId: string): Promise<void> {
    await this.request(`/organizations/${orgId}/roles/${roleId}`, {
      method: 'DELETE',
    });
  }

  // API Key methods
  async listApiKeys(): Promise<ApiKey[]> {
    return this.request('/api-keys');
  }

  async createApiKey(data: { name: string; permissions?: string[]; expiresAt?: string }): Promise<ApiKey & { key: string }> {
    return this.request('/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateApiKey(keyId: string, data: { name?: string; permissions?: string[]; expiresAt?: string; revoked?: boolean }): Promise<ApiKey> {
    return this.request(`/api-keys/${keyId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteApiKey(keyId: string): Promise<void> {
    await this.request(`/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // Webhook methods
  async listWebhooks(): Promise<Webhook[]> {
    return this.request('/webhooks');
  }

  async getWebhook(webhookId: string): Promise<Webhook> {
    return this.request(`/webhooks/${webhookId}`);
  }

  async createWebhook(data: { name: string; url: string; events: string[]; secret?: string }): Promise<Webhook> {
    return this.request('/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWebhook(webhookId: string, data: { name?: string; url?: string; events?: string[]; secret?: string; isActive?: boolean }): Promise<Webhook> {
    return this.request(`/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request(`/webhooks/${webhookId}`, {
      method: 'DELETE',
    });
  }

  async listWebhookDeliveries(webhookId: string, params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<WebhookDelivery>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.status) searchParams.set('status', params.status);
    
    const query = searchParams.toString();
    return this.request(`/webhooks/${webhookId}/deliveries${query ? `?${query}` : ''}`);
  }

  async retryWebhookDelivery(webhookId: string, deliveryId: string): Promise<void> {
    await this.request(`/webhooks/${webhookId}/deliveries/${deliveryId}/retry`, {
      method: 'POST',
    });
  }

  // Audit log methods
  async listAuditLogs(params?: { 
    page?: number; 
    limit?: number; 
    userId?: string; 
    eventType?: string; 
    startDate?: string; 
    endDate?: string; 
    minRiskScore?: number; 
    maxRiskScore?: number; 
  }): Promise<PaginatedResponse<AuditLog>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.userId) searchParams.set('userId', params.userId);
    if (params?.eventType) searchParams.set('eventType', params.eventType);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.minRiskScore) searchParams.set('minRiskScore', String(params.minRiskScore));
    if (params?.maxRiskScore) searchParams.set('maxRiskScore', String(params.maxRiskScore));
    
    const query = searchParams.toString();
    return this.request(`/audit-logs${query ? `?${query}` : ''}`);
  }

  // Admin methods
  async adminListUsers(params?: { 
    page?: number; 
    limit?: number; 
    query?: string; 
    status?: string; 
    mfaEnabled?: boolean; 
    emailVerified?: boolean; 
    hasPassword?: boolean; 
    organizationId?: string; 
    roleId?: string; 
    createdAfter?: string; 
    createdBefore?: string; 
  }): Promise<PaginatedResponse<User>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.query) searchParams.set('query', params.query);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.mfaEnabled !== undefined) searchParams.set('mfaEnabled', String(params.mfaEnabled));
    if (params?.emailVerified !== undefined) searchParams.set('emailVerified', String(params.emailVerified));
    if (params?.hasPassword !== undefined) searchParams.set('hasPassword', String(params.hasPassword));
    if (params?.organizationId) searchParams.set('organizationId', params.organizationId);
    if (params?.roleId) searchParams.set('roleId', params.roleId);
    if (params?.createdAfter) searchParams.set('createdAfter', params.createdAfter);
    if (params?.createdBefore) searchParams.set('createdBefore', params.createdBefore);
    
    const query = searchParams.toString();
    return this.request(`/admin/users${query ? `?${query}` : ''}`);
  }

  async adminGetUser(userId: string): Promise<User> {
    return this.request(`/admin/users/${userId}`);
  }

  async adminUpdateUser(userId: string, data: { 
    email?: string; 
    fullName?: string; 
    status?: string; 
    emailVerified?: boolean; 
    mfaEnabled?: boolean; 
    roles?: Array<{ organizationId: string; roleId: string }>; 
  }): Promise<User> {
    return this.request(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async adminDeleteUser(userId: string): Promise<void> {
    await this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async adminImpersonate(userId: string, ttl?: number): Promise<{ accessToken: string; refreshToken: string }> {
    return this.request(`/admin/users/${userId}/impersonate`, {
      method: 'POST',
      body: JSON.stringify({ ttl }),
    });
  }

  async adminGetStats(): Promise<Record<string, unknown>> {
    return this.request('/admin/stats');
  }

  // Metadata methods
  async getPublicMetadata(userId: string): Promise<Record<string, unknown>> {
    return this.request(`/users/${userId}/metadata/public`);
  }

  async getPrivateMetadata(userId: string): Promise<Record<string, unknown>> {
    return this.request(`/users/${userId}/metadata/private`);
  }

  async setPublicMetadata(userId: string, metadata: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request(`/users/${userId}/metadata/public`, {
      method: 'POST',
      body: JSON.stringify(metadata),
    });
  }

  async setPrivateMetadata(userId: string, metadata: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request(`/users/${userId}/metadata/private`, {
      method: 'POST',
      body: JSON.stringify(metadata),
    });
  }
}

export class AuthCoreError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(error: AuthError) {
    super(error.message);
    this.name = 'AuthCoreError';
    this.code = error.code;
    this.details = error.details;
  }
}

export function createClient(options: AuthCoreClientOptions): AuthCoreClient {
  return new AuthCoreClient(options);
}
