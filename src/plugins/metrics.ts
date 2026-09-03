import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { register } from 'prom-client';

async function metricsPlugin(app: FastifyInstance): Promise<void> {
  register.collectDefaultMetrics({ register, prefix: 'authcore_' });

  app.get('/metrics', async (request, reply) => {
    reply.type('text/plain');
    return register.metrics();
  });
}

export default fp(metricsPlugin, {
  name: 'metrics',
});

