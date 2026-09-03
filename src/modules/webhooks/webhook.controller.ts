import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { WebhookService, WEBHOOK_EVENTS, type WebhookEvent } from './webhook.service';
import { AuthService } from '@modules/auth/auth.service';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from '@modules/auth/auth.middleware';

const createWebhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS as [WebhookEvent, ...WebhookEvent[]])).min(1),
});

const webhookIdParamSchema = z.object({ id: z.string().uuid() });

const updateWebhookSchema = z.object({
  name: z.string().optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const testWebhookSchema = z.object({ payload: z.record(z.string(), z.unknown()).optional() });

export interface WebhookControllerDeps {
  webhookService: WebhookService;
  authService: AuthService;
}

export async function webhookRoutes(fastify: FastifyInstance, deps: WebhookControllerDeps): Promise<void> {
  const { webhookService, authService } = deps;

  // GET /admin/webhooks — list all webhooks
  fastify.get(
    '/admin/webhooks',
    { preHandler: [requireAuth(authService)] },
    async (_request, reply) => {
      const webhooks = await webhookService.list();
      return reply.send({ webhooks });
    },
  );

  // POST /admin/webhooks — create new webhook subscription
  fastify.post(
    '/admin/webhooks',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ body: createWebhookSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.validatedBody as z.infer<typeof createWebhookSchema>;
      const webhook = await webhookService.create(body);
      return reply.status(201).send({
        ...webhook,
        message: 'Save the secret now — it will not be shown again.',
      });
    },
  );

  // GET /admin/webhooks/events — list all available event types
  fastify.get(
    '/admin/webhooks/events',
    { preHandler: [requireAuth(authService)] },
    async (_request, reply) => {
      return reply.send({ events: WEBHOOK_EVENTS });
    },
  );

  // GET /admin/webhooks/:id
  fastify.get(
    '/admin/webhooks/:id',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: webhookIdParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof webhookIdParamSchema>;
      const webhook = await webhookService.getById(id);
      return reply.send(webhook);
    },
  );

  // PATCH /admin/webhooks/:id
  fastify.patch(
    '/admin/webhooks/:id',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: webhookIdParamSchema, body: updateWebhookSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof webhookIdParamSchema>;
      const body = request.validatedBody as z.infer<typeof updateWebhookSchema>;
      const webhook = await webhookService.update(id, body);
      return reply.send(webhook);
    },
  );

  // DELETE /admin/webhooks/:id
  fastify.delete(
    '/admin/webhooks/:id',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: webhookIdParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof webhookIdParamSchema>;
      await webhookService.delete(id);
      return reply.send({ message: 'Webhook deleted.' });
    },
  );

  // POST /admin/webhooks/:id/test — send a test event
  fastify.post(
    '/admin/webhooks/:id/test',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: webhookIdParamSchema, body: testWebhookSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof webhookIdParamSchema>;
      const body = request.validatedBody as z.infer<typeof testWebhookSchema>;
      const result = await webhookService.dispatch('webhook.test', body.payload ?? { test: true });
      return reply.send({ message: 'Test event dispatched.', ...result });
    },
  );

  // GET /admin/webhooks/:id/deliveries — recent delivery log
  fastify.get(
    '/admin/webhooks/:id/deliveries',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ params: webhookIdParamSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof webhookIdParamSchema>;
      const deliveries = await webhookService.listDeliveries(id);
      return reply.send({ deliveries });
    },
  );
}
