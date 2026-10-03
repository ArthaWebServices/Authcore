import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RbacService } from './rbac.service';
import { AuthService } from '@modules/auth/auth.service';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from '@modules/auth/auth.middleware';

const createRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  permissions: z.array(z.string()).default([]),
});

const roleIdParamSchema = z.object({ id: z.string().uuid() });

const grantPermissionSchema = z.object({ permission: z.string().min(1) });

export interface RbacControllerDeps {
  rbacService: RbacService;
  authService: AuthService;
}

export async function rbacRoutes(fastify: FastifyInstance, deps: RbacControllerDeps): Promise<void> {
  const { rbacService, authService } = deps;

  // POST /roles — create custom role
  fastify.post(
    '/roles',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ body: createRoleSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.validatedBody as z.infer<typeof createRoleSchema>;
      const role = await rbacService.createRole(body);
      return reply.status(201).send(role);
    },
  );

  // GET /roles — list roles (optionally for an organization)
  fastify.get(
    '/roles',
    { preHandler: [requireAuth(authService)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { organizationId?: string };
      const roles = await rbacService.listRoles(query.organizationId);
      return reply.send({ roles });
    },
  );

  // GET /roles/:id — get specific role
  fastify.get(
    '/roles/:id',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: roleIdParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof roleIdParamSchema>;
      const role = await rbacService.getRole(id);
      return reply.send(role);
    },
  );

  // GET /permissions — list all available permissions
  fastify.get(
    '/permissions',
    { preHandler: [requireAuth(authService)] },
    async (_request, reply) => {
      const permissions = await rbacService.listPermissions();
      return reply.send({ permissions });
    },
  );

  // POST /roles/:id/permissions — grant permission to role
  fastify.post(
    '/roles/:id/permissions',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: roleIdParamSchema, body: grantPermissionSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof roleIdParamSchema>;
      const { permission } = request.validatedBody as z.infer<typeof grantPermissionSchema>;
      await rbacService.grantPermission(id, permission);
      return reply.send({ message: 'Permission granted.' });
    },
  );

  // DELETE /roles/:id/permissions — revoke permission from role
  fastify.delete(
    '/roles/:id/permissions',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: roleIdParamSchema, body: grantPermissionSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof roleIdParamSchema>;
      const { permission } = request.validatedBody as z.infer<typeof grantPermissionSchema>;
      await rbacService.revokePermission(id, permission);
      return reply.send({ message: 'Permission revoked.' });
    },
  );

  // GET /me/permissions — get current user's effective permissions
  fastify.get(
    '/me/permissions',
    { preHandler: [requireAuth(authService)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const query = request.query as { organizationId?: string };
      const permissions = await rbacService.getUserPermissions(userId, query.organizationId);
      return reply.send({ permissions });
    },
  );
}
