import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Registry, collectDefaultMetrics } from 'prom-client';

const register = new Registry();

async function metricsPlugin(app: FastifyInstance): Promise<void> {
  collectDefaultMetrics({ register, prefix: 'authcore_' });

  app.get('/metrics', async (request, reply) => {
    reply.type(register.contentType);
    return register.metrics();
  });
}

export default fp(metricsPlugin, {
  name: 'metrics',
});

