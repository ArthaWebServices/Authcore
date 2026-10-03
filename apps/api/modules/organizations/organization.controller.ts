import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OrganizationService } from './organization.service';
import { AuthService } from '@modules/auth/auth.service';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from '@modules/auth/auth.middleware';

const createOrgSchema = z.object({
  name: z.string().min(2, 'Organization name required'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric'),
  description: z.string().optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member']).optional().default('member'),
});

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member']),
});

const orgIdParamSchema = z.object({ id: z.string().uuid() });

export interface OrganizationControllerDeps {
  organizationService: OrganizationService;
  authService: AuthService;
}

export async function organizationRoutes(fastify: FastifyInstance, deps: OrganizationControllerDeps): Promise<void> {
  const { organizationService, authService } = deps;

  // POST /orgs — create organization
  fastify.post(
    '/orgs',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ body: createOrgSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.validatedBody as z.infer<typeof createOrgSchema>;
      const org = await organizationService.create(body);
      return reply.status(201).send(org);
    },
  );

  // GET /orgs — list user's organizations
  fastify.get(
    '/orgs',
    { preHandler: [requireAuth(authService)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const orgs = await organizationService.listForUser(userId);
      return reply.send({ organizations: orgs });
    },
  );

  // GET /orgs/:id — get organization
  fastify.get(
    '/orgs/:id',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: orgIdParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof orgIdParamSchema>;
      const org = await organizationService.findById(id);
      return reply.send(org);
    },
  );

  // GET /orgs/:id/members — list members
  fastify.get(
    '/orgs/:id/members',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: orgIdParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof orgIdParamSchema>;
      const members = await organizationService.listMembers(id);
      return reply.send({ members });
    },
  );

  // POST /orgs/:id/members — add member
  fastify.post(
    '/orgs/:id/members',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: orgIdParamSchema, body: addMemberSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof orgIdParamSchema>;
      const body = request.validatedBody as z.infer<typeof addMemberSchema>;
      const member = await organizationService.addMember(id, body.userId, body.role);
      return reply.status(201).send(member);
    },
  );

  // PATCH /orgs/:id/members — update member role
  fastify.patch(
    '/orgs/:id/members',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: orgIdParamSchema, body: updateRoleSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof orgIdParamSchema>;
      const body = request.validatedBody as z.infer<typeof updateRoleSchema>;
      const member = await organizationService.updateRole(id, body.userId, body.role);
      return reply.send(member);
    },
  );

  // DELETE /orgs/:id/members/:userId — remove member
  fastify.delete(
    '/orgs/:id/members/:userId',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: orgIdParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      await organizationService.removeMember(id, userId);
      return reply.send({ message: 'Member removed.' });
    },
  );
}
