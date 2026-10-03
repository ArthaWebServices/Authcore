import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '@shared/logger';
import { randomUUID } from 'crypto';
import { httpRequestDuration } from '@shared/metrics';

declare module 'fastify' {
  interface FastifyRequest {
    id: string;
    startTime: number;
  }
}

export async function requestLoggingPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.id = (request.headers['x-request-id'] as string) || randomUUID();
    request.startTime = Date.now();

    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        path: request.routeOptions?.url || request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
      'Incoming request',
    );
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = Date.now() - request.startTime;
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
      },
      'Request completed',
    );
    // Record request duration for Prometheus
    const route = request.routeOptions?.url || request.url;
    httpRequestDuration
      .labels(request.method, route, reply.statusCode.toString())
      .observe(duration / 1000);
  });

  fastify.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const duration = Date.now() - request.startTime;
    request.log.error(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        duration,
        error: { message: error.message, stack: error.stack },
      },
      'Request error',
    );
    const route = request.routeOptions?.url || request.url;
    httpRequestDuration
      .labels(request.method, route, '500')
      .observe(duration / 1000);
  });

  fastify.decorateReply('locals', null);
}
