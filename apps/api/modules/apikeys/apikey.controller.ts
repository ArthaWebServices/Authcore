import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApiKeyService } from './apikey.service';
import { AuthService } from '@modules/auth/auth.service';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from '@modules/auth/auth.middleware';

const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name required'),
  organizationId: z.string().uuid().optional(),
  permissions: z.array(z.string()).optional().default([]),
  expiresAt: z.string().datetime().optional(),
});

const keyIdParamSchema = z.object({ id: z.string().uuid() });

export interface ApiKeyControllerDeps {
  apiKeyService: ApiKeyService;
  authService: AuthService;
}

export async function apiKeyRoutes(fastify: FastifyInstance, deps: ApiKeyControllerDeps): Promise<void> {
  const { apiKeyService, authService } = deps;

  // POST /api-keys — create new key
  fastify.post(
    '/api-keys',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ body: createApiKeySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const body = request.validatedBody as z.infer<typeof createApiKeySchema>;
      const key = await apiKeyService.create({
        userId,
        name: body.name,
        organizationId: body.organizationId,
        permissions: body.permissions,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });
      return reply.status(201).send({
        ...key,
        message: 'Save the key now — it will not be shown again.',
      });
    },
  );

  // GET /api-keys — list user's keys
  fastify.get(
    '/api-keys',
    { preHandler: [requireAuth(authService)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const keys = await apiKeyService.listForUser(userId);
      return reply.send({ keys });
    },
  );

  // DELETE /api-keys/:id — revoke key
  fastify.delete(
    '/api-keys/:id',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: keyIdParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const { id } = request.params as z.infer<typeof keyIdParamSchema>;
      await apiKeyService.revoke(userId, id);
      return reply.send({ message: 'API key revoked.' });
    },
  );
}
