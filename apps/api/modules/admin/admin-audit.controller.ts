import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@shared/prisma';
import { AuthService } from '@modules/auth/auth.service';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from '@modules/auth/auth.middleware';

const auditQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(200).default(50),
  eventType: z.string().optional(),
  userId: z.string().uuid().optional(),
  ipAddress: z.string().optional(),
  minRiskScore: z.coerce.number().min(0).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export interface AdminAuditControllerDeps {
  authService: AuthService;
}

export async function adminAuditRoutes(fastify: FastifyInstance, deps: AdminAuditControllerDeps): Promise<void> {
  const { authService } = deps;

  // GET /admin/audit-logs (TASK-059)
  fastify.get(
    '/admin/audit-logs',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ querystring: auditQuerySchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.validatedQuerystring as z.infer<typeof auditQuerySchema>;
      const skip = (query.page - 1) * query.perPage;

      const where: Record<string, unknown> = {};
      if (query.eventType) where.eventType = query.eventType;
      if (query.userId) where.userId = query.userId;
      if (query.ipAddress) where.ipAddress = query.ipAddress;
      if (query.minRiskScore !== undefined) where.riskScore = { gte: query.minRiskScore };

      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) (where.createdAt as Record<string, Date>).gte = new Date(query.startDate);
        if (query.endDate) (where.createdAt as Record<string, Date>).lte = new Date(query.endDate);
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: query.perPage,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return reply.send({
        logs,
        pagination: {
          page: query.page,
          perPage: query.perPage,
          total,
          totalPages: Math.ceil(total / query.perPage),
        },
      });
    },
  );

  // GET /admin/audit-logs/stats — aggregated metrics for ops dashboard
  fastify.get(
    '/admin/audit-logs/stats',
    { preHandler: [requireAuth(authService)] },
    async (_request, reply) => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [totalLast24h, highRiskLast24h, byEventType, loginsLast24h, failedLoginsLast24h] = await Promise.all([
        prisma.auditLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
        prisma.auditLog.count({ where: { createdAt: { gte: oneDayAgo }, riskScore: { gte: 50 } } }),
        prisma.auditLog.groupBy({
          by: ['eventType'],
          where: { createdAt: { gte: oneDayAgo } },
          _count: true,
          orderBy: { _count: { eventType: 'desc' } },
          take: 10,
        }),
        prisma.auditLog.count({
          where: { createdAt: { gte: oneDayAgo }, eventType: 'user.login' },
        }),
        prisma.auditLog.count({
          where: { createdAt: { gte: oneDayAgo }, eventType: 'user.login.failed' },
        }),
      ]);

      return reply.send({
        totalLast24h,
        highRiskLast24h,
        loginsLast24h,
        failedLoginsLast24h,
        failureRate: loginsLast24h > 0 ? failedLoginsLast24h / (loginsLast24h + failedLoginsLast24h) : 0,
        topEventTypes: byEventType.map((row) => ({ eventType: row.eventType, count: row._count })),
      });
    },
  );
}
