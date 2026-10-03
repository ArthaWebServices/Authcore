import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserRepository } from '@modules/users/user.repository';
import { prisma } from '@shared/prisma';
import { AuthService } from '@modules/auth/auth.service';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from '@modules/auth/auth.middleware';
import { NotFoundError, AuthorizationError } from '@shared/errors';
import { logAuditEvent } from '@shared/audit/log';

const adminListQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['active', 'locked', 'deleted', 'all']).default('all'),
});

const userIdParamSchema = z.object({ id: z.string().uuid() });

const adminUpdateUserSchema = z.object({
  fullName: z.string().optional(),
  emailVerified: z.boolean().optional(),
  status: z.enum(['active', 'locked', 'deleted']).optional(),
  mfaEnabled: z.boolean().optional(),
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
});

export interface AdminUserControllerDeps {
  authService: AuthService;
}

export async function adminUserRoutes(fastify: FastifyInstance, deps: AdminUserControllerDeps): Promise<void> {
  const { authService } = deps;
  const userRepo = new UserRepository();

  // GET /admin/users — list with pagination/search/filter (TASK-056)
  fastify.get(
    '/admin/users',
    {
      preHandler: [
        requireAuth(authService),
        createValidatorHook({ querystring: adminListQuerySchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.validatedQuerystring as z.infer<typeof adminListQuerySchema>;
      const skip = (query.page - 1) * query.perPage;

      const where: Record<string, unknown> = {};
      if (query.status !== 'all') where.status = query.status;
      if (query.search) {
        where.OR = [
          { email: { contains: query.search, mode: 'insensitive' } },
          { fullName: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: query.perPage,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            emailVerified: true,
            fullName: true,
            status: true,
            mfaEnabled: true,
            lastLoginAt: true,
            lastLoginIp: true,
            createdAt: true,
            deletedAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      return reply.send({
        users,
        pagination: {
          page: query.page,
          perPage: query.perPage,
          total,
          totalPages: Math.ceil(total / query.perPage),
        },
      });
    },
  );

  // GET /admin/users/:id (TASK-057)
  fastify.get(
    '/admin/users/:id',
    {
      preHandler: [
        requireAuth(authService),
        createValidatorHook({ params: userIdParamSchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof userIdParamSchema>;
      const user = await userRepo.findById(id);
      if (!user) throw new NotFoundError('User');

      const [sessionCount, oauthCount, auditCount] = await Promise.all([
        prisma.session.count({ where: { userId: id, revokedAt: null } }),
        prisma.oAuthAccount.count({ where: { userId: id } }),
        prisma.auditLog.count({ where: { userId: id } }),
      ]);

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          status: user.status,
          mfaEnabled: user.mfaEnabled,
          failedLoginAttempts: user.failedLoginAttempts,
          lockedUntil: user.lockedUntil,
          lastLoginAt: user.lastLoginAt,
          lastLoginIp: user.lastLoginIp,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          deletedAt: user.deletedAt,
        },
        stats: { sessionCount, oauthCount, auditCount },
      });
    },
  );

  // PATCH /admin/users/:id (TASK-057)
  fastify.patch(
    '/admin/users/:id',
    {
      preHandler: [
        requireAuth(authService),
        createValidatorHook({ params: userIdParamSchema, body: adminUpdateUserSchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const adminId = (request as FastifyRequest & { user: { id: string } }).user.id;
      const { id } = request.params as z.infer<typeof userIdParamSchema>;
      const updates = request.validatedBody as z.infer<typeof adminUpdateUserSchema>;

      const before = await userRepo.findById(id);
      if (!before) throw new NotFoundError('User');

      const updated = await prisma.user.update({ where: { id }, data: updates });

      await logAuditEvent({
        eventType: 'admin.user.updated',
        userId: adminId,
        ipAddress: request.ip,
        metadata: { targetUserId: id, changes: updates },
      });

      return reply.send({
        id: updated.id,
        email: updated.email,
        emailVerified: updated.emailVerified,
        fullName: updated.fullName,
        status: updated.status,
        mfaEnabled: updated.mfaEnabled,
        updatedAt: updated.updatedAt,
      });
    },
  );

  // DELETE /admin/users/:id (TASK-058) — soft delete + revoke sessions
  fastify.delete(
    '/admin/users/:id',
    {
      preHandler: [
        requireAuth(authService),
        createValidatorHook({ params: userIdParamSchema }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const adminId = (request as FastifyRequest & { user: { id: string } }).user.id;
      const { id } = request.params as z.infer<typeof userIdParamSchema>;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: { status: 'deleted', deletedAt: new Date() },
        });
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });

      await logAuditEvent({
        eventType: 'admin.user.deleted',
        userId: adminId,
        ipAddress: request.ip,
        metadata: { targetUserId: id },
        riskScore: 80,
      });

      return reply.send({ message: 'User soft-deleted and sessions revoked.' });
    },
  );
}
