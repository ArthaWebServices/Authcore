import { logger } from '@shared/logger';
import { getConfig } from '@config';
import { NotFoundError, ValidationError } from '@shared/errors';

export interface OAuthAccountPublic {
  id: string;
  provider: string;
  providerUserId: string;
  email: string | null;
  scope: string | null;
  createdAt: Date;
}

export interface OAuthLinkResult {
  message: string;
  linked: boolean;
  account: OAuthAccountPublic;
}

// Stub implementation for Sprint 9 OAuth/OIDC
// Real production version uses openid-client + provider SDKs
export class OAuthService {
  private readonly providers: Record<string, boolean>;

  constructor() {
    const config = getConfig();
    this.providers = {
      google: !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
      github: !!(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET),
      microsoft: !!(config.MICROSOFT_CLIENT_ID && config.MICROSOFT_CLIENT_SECRET),
      gitlab: !!(config.GITLAB_CLIENT_ID && config.GITLAB_CLIENT_SECRET),
    };
  }

  getEnabledProviders(): string[] {
    return Object.entries(this.providers)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);
  }

  getProviderConfig(provider: string) {
    if (!this.providers[provider]) {
      throw new ValidationError(`Provider not configured: ${provider}`);
    }
    const config = getConfig();
    const clients: Record<string, { id: string; secret: string }> = {};
    if (provider === 'google') clients[provider] = { id: config.GOOGLE_CLIENT_ID ?? '', secret: config.GOOGLE_CLIENT_SECRET ?? '' };
    if (provider === 'github') clients[provider] = { id: config.GITHUB_CLIENT_ID ?? '', secret: config.GITHUB_CLIENT_SECRET ?? '' };
    if (provider === 'microsoft') clients[provider] = { id: config.MICROSOFT_CLIENT_ID ?? '', secret: config.MICROSOFT_CLIENT_SECRET ?? '' };
    if (provider === 'gitlab') clients[provider] = { id: config.GITLAB_CLIENT_ID ?? '', secret: config.GITLAB_CLIENT_SECRET ?? '' };
    return clients[provider];
  }

  async startAuthFlow(provider: string, redirectUrl?: string): Promise<{ authorizationUrl: string }> {
    if (!this.providers[provider]) {
      throw new ValidationError(`Provider not configured: ${provider}`);
    }
    // In production: generate state, build authorization URL using openid-client
    const config = getConfig();
    const authorizationUrl = `${config.APP_URL}/auth/oauth/${provider}/callback?state=dev_state`;
    logger.info({ provider, redirectUrl }, 'OAuth auth flow started');
    return { authorizationUrl: authorizationUrl + (redirectUrl ? `&redirect_url=${encodeURIComponent(redirectUrl)}` : '') };
  }

  async handleCallback(provider: string, code: string, state?: string): Promise<{ userId: string; accessToken: string; account: OAuthAccountPublic }> {
    logger.info({ provider, code: code.slice(0, 8) + '...' }, 'OAuth callback received');
    // Production: exchange code for tokens via openid-client, fetch user info
    return {
      userId: 'stub-user-id',
      accessToken: 'stub-access-token',
      account: {
        id: 'stub-account-id',
        provider,
        providerUserId: 'stub-provider-user',
        email: 'user@example.com',
        scope: 'openid profile email',
        createdAt: new Date(),
      },
    };
  }

  async linkAccount(userId: string, provider: string, providerAccessToken: string): Promise<OAuthLinkResult> {
    logger.info({ userId, provider }, 'Account linking requested');
    return {
      message: 'Account linked successfully.',
      linked: true,
      account: {
        id: 'stub-linked-id',
        provider,
        providerUserId: 'stub-linked-user',
        email: null,
        scope: 'openid profile',
        createdAt: new Date(),
      },
    };
  }

  async unlinkAccount(userId: string, provider: string): Promise<{ unlinked: boolean; provider: string }> {
    logger.info({ userId, provider }, 'Account unlink requested');
    return { unlinked: true, provider };
  }
}
