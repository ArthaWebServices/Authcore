import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ImpersonationService } from './impersonation.service';
import { AuthService } from '@modules/auth/auth.service';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from '@modules/auth/auth.middleware';
import { AuthorizationError } from '@shared/errors';
import { RBACService } from '@modules/rbac/rbac.service';

const startImpersonationSchema = z.object({
  targetUserId: z.string().uuid(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

export interface ImpersonationControllerDeps {
  impersonationService: ImpersonationService;
  authService: AuthService;
  rbacService: RBACService;
}

export async function impersonationRoutes(fastify: FastifyInstance, deps: ImpersonationControllerDeps): Promise<void> {
  const { impersonationService, authService, rbacService } = deps;

  // POST /admin/impersonation/start — admin assumes a user's identity
  fastify.post(
    '/admin/impersonation/start',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ body: startImpersonationSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: adminId } = (request as FastifyRequest & { user: { id: string } }).user;

      // Admin role check
      const hasPermission = await rbacService.hasPermission(adminId, 'admin:impersonate');
      if (!hasPermission) {
        throw new AuthorizationError('Only admins with impersonation permission may impersonate users');
      }

      const { targetUserId, reason } = request.validatedBody as z.infer<typeof startImpersonationSchema>;
      const session = await impersonationService.startImpersonation(adminId, targetUserId, reason);
      return reply.send({
        message: 'Impersonation started. Token valid for 15 minutes.',
        token: session.token,
        expiresAt: session.expiresAt,
        targetUserId: session.targetUserId,
        reason: session.reason,
      });
    },
  );

  // POST /admin/impersonation/end — end the current impersonation session
  // Requires authentication so the caller proves their identity before ending a session
  fastify.post(
    '/admin/impersonation/end',
    {
      preHandler: [requireAuth(authService)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: adminId } = (request as FastifyRequest & { user: { id: string } }).user;
      const authHeader = request.headers.authorization ?? '';
      const token = authHeader.replace(/^Bearer /, '');
      const result = await impersonationService.endImpersonation(token, adminId);
      return reply.send(result);
    },
  );

  // GET /admin/impersonation/active — list active impersonation sessions
  fastify.get(
    '/admin/impersonation/active',
    { preHandler: [requireAuth(authService)] },
    async (_request, reply) => {
      const sessions = impersonationService.listActive();
      return reply.send({ sessions });
    },
  );
}
