import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OAuthService } from './oauth.service';
import { AuthService } from '@modules/auth/auth.service';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from '@modules/auth/auth.middleware';
import { ValidationError } from '@shared/errors';

const providerParamSchema = z.object({ provider: z.enum(['google', 'github', 'microsoft', 'gitlab']) });
const linkAccountSchema = z.object({
  providerAccessToken: z.string().min(10, 'Access token required'),
  provider: z.enum(['google', 'github', 'microsoft', 'gitlab']),
});

export interface OAuthControllerDeps {
  oauthService: OAuthService;
  authService: AuthService;
}

export async function oauthRoutes(fastify: FastifyInstance, deps: OAuthControllerDeps): Promise<void> {
  const { oauthService, authService } = deps;

  // GET /auth/oauth/providers — list enabled OAuth providers
  fastify.get('/auth/oauth/providers', async () => {
    return { providers: oauthService.getEnabledProviders() };
  });

  // GET /auth/oauth/:provider — start OAuth flow (redirect to provider)
  fastify.get(
    '/auth/oauth/:provider',
    {
      preHandler: createValidatorHook({ params: providerParamSchema }),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as z.infer<typeof providerParamSchema>;
      const redirectUrl = (request.query as { redirectUrl?: string })?.redirectUrl;
      const result = await oauthService.startAuthFlow(provider, redirectUrl);
      return reply.redirect(result.authorizationUrl);
    },
  );

  // GET /auth/oauth/:provider/callback — handle provider callback (TASK-047)
  fastify.get(
    '/auth/oauth/:provider/callback',
    {
      preHandler: createValidatorHook({ params: providerParamSchema }),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as z.infer<typeof providerParamSchema>;
      const query = request.query as { code?: string; state?: string; redirectUrl?: string };
      if (!query.code) {
        throw new ValidationError('Authorization code missing');
      }
      const result = await oauthService.handleCallback(provider, query.code, query.state);
      return reply.send({
        userId: result.userId,
        accessToken: result.accessToken,
        message: 'OAuth login successful.',
        redirectUrl: query.redirectUrl || '/dashboard',
      });
    },
  );

  // POST /auth/oauth/link — link OAuth account to current user
  fastify.post(
    '/auth/oauth/link',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ body: linkAccountSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const body = request.validatedBody as z.infer<typeof linkAccountSchema>;
      const result = await oauthService.linkAccount(userId, body.provider, body.providerAccessToken);
      return reply.send({
        message: result.message,
        linked: result.linked,
        account: result.account,
      });
    },
  );

  // POST /auth/oauth/unlink — unlink OAuth account
  fastify.post(
    '/auth/oauth/unlink',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ body: z.object({ provider: z.enum(['google', 'github', 'microsoft', 'gitlab']) }) })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const { provider } = request.validatedBody as { provider: string };
      const result = await oauthService.unlinkAccount(userId, provider);
      return reply.send({ unlinked: result.unlinked, provider: result.provider });
    },
  );
}
