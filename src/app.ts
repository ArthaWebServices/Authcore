import Fastify, { type FastifyInstance } from 'fastify';
import { getConfig } from '@config';
import { logger } from '@shared/logger';
import { healthCheckDatabase } from '@shared/prisma';
import { healthCheckRedis } from '@shared/redis';
import { errorHandlerPlugin } from '@plugins/error-handler';
import { requestLoggingPlugin } from '@plugins/request-logging';
import { securityPlugin } from '@plugins/security';
import { rateLimitPlugin } from '@plugins/rate-limit';
import { validationPlugin } from '@plugins/validation';
import { authRoutes } from '@modules/auth/auth.controller';
import { AuthService } from '@modules/auth/auth.service';
import { mfaRoutes } from '@modules/mfa/mfa.controller';
import { MfaService } from '@modules/mfa/mfa.service';
import { webauthnRoutes } from '@modules/webauthn/webauthn.controller';
import { WebAuthnService } from '@modules/webauthn/webauthn.service';
import { oauthRoutes } from '@modules/oauth/oauth.controller';
import { OAuthService } from '@modules/oauth/oauth.service';
import { oidcRoutes } from '@modules/oidc/oidc.routes';
import { organizationRoutes } from '@modules/organizations/organization.controller';
import { OrganizationService } from '@modules/organizations/organization.service';
import { rbacRoutes } from '@modules/rbac/rbac.controller';
import { RbacService } from '@modules/rbac/rbac.service';
import { apiKeyRoutes } from '@modules/apikeys/apikey.controller';
import { ApiKeyService } from '@modules/apikeys/apikey.service';
import { impersonationRoutes } from '@modules/admin/impersonation.controller';
import { ImpersonationService } from '@modules/admin/impersonation.service';
import { adminUserRoutes } from '@modules/admin/admin-user.controller';
import { adminAuditRoutes } from '@modules/admin/admin-audit.controller';
import { webhookRoutes } from '@modules/webhooks/webhook.controller';
import { WebhookService } from '@modules/webhooks/webhook.service';
import { startWebhookRetry } from '@modules/webhooks/webhook-retry';
import metricsPlugin from '@plugins/metrics';
import { initSentry } from '@plugins/sentry';
import csrfPlugin from '@plugins/csrf';

export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();

  // Initialize Sentry before any other plugins
  initSentry();

  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
    maxParamLength: 500,
    bodyLimit: 1024 * 1024,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
    trustProxy: true,
  });

  // Error handler first
  await app.register(errorHandlerPlugin);

  // Security
  await app.register(securityPlugin);

  // Rate limiting
  await app.register(rateLimitPlugin);

  // Validation
  await app.register(validationPlugin);

  // CSRF protection (double-submit cookie)
  await app.register(csrfPlugin);

  // Request logging
  await app.register(requestLoggingPlugin);

  // Metrics endpoint (Prometheus)
  await app.register(metricsPlugin);

  // Auth routes
  const authService = new AuthService();
  await authRoutes(app, { authService: authService });

  // MFA routes
  await mfaRoutes(app, { mfaService: new MfaService(), authService: authService });

  // WebAuthn / Passkey routes
  await webauthnRoutes(app, { webauthnService: new WebAuthnService(), authService: authService });

  // OAuth routes (Sprint 9)
  await oauthRoutes(app, { oauthService: new OAuthService(), authService: authService });

  // OIDC Discovery & JWKS (TASK-049)
  await oidcRoutes(app);

  // RBAC / Organization routes (Sprint 10)
  await organizationRoutes(app, { organizationService: new OrganizationService(), authService: authService });
  await rbacRoutes(app, { rbacService: new RbacService(), authService: authService });

  // API Key routes (Sprint 11)
  await apiKeyRoutes(app, { apiKeyService: new ApiKeyService(), authService: authService });

  // Impersonation routes (Sprint 11)
  await impersonationRoutes(app, { impersonationService: new ImpersonationService(), authService: authService });

  // Sprint 12: Admin Dashboard API
  await adminUserRoutes(app, { authService: authService });

  // Sprint 13: Audit Logs
  await adminAuditRoutes(app, { authService: authService });

  // Sprint 13: Webhook system
  const webhookService = new WebhookService();
  await webhookRoutes(app, { webhookService, authService: authService });
  startWebhookRetry(webhookService);

  // Health endpoints
  app.get('/health/live', async () => ({
    status: 'ok',
    service: 'authcore',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/ready', async (_request, reply) => {
    const dbOk = await healthCheckDatabase();
    const redisOk = await healthCheckRedis();
    const ready = dbOk && redisOk;
    return reply.status(ready ? 200 : 503).send({
      status: ready ? 'ok' : 'degraded',
      service: 'authcore',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk,
        redis: redisOk,
      },
    });
  });

  // Root endpoint
  app.get('/', async () => ({
    name: 'AuthCore',
    version: '1.0.0',
    status: 'running',
    docs: `${config.APP_URL}/docs`,
  }));

  return app;
}
