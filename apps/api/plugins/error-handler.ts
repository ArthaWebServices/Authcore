import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@shared/logger';
import { AuthError, isAuthError } from '@shared/errors';
import { captureSentryError } from '@plugins/sentry';

export async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Known AuthError types
    if (isAuthError(error)) {
      const err = error as AuthError;
      request.log.warn(
        { code: err.code, statusCode: err.statusCode, details: err.details, message: err.message },
        'Application error',
      );
      return reply.status(err.statusCode).send({
        error: err.message,
        code: err.code,
        details: err.details,
      });
    }

    // Fastify validation errors
    if (error.validation) {
      request.log.warn(
        { validation: error.validation, message: error.message },
        'Validation error',
      );
      return reply.status(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.validation,
      });
    }

    // 4xx client errors
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      request.log.warn(
        { statusCode: error.statusCode, message: error.message, code: error.code },
        'Client error',
      );
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code || 'CLIENT_ERROR',
      });
    }

    // 5xx or unknown - capture in Sentry
    request.log.error(
      {
        err: { message: error.message, stack: error.stack, name: error.name },
        url: request.url,
        method: request.method,
      },
      'Unhandled server error',
    );

    captureSentryError(error, {
      url: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    const isProduction = process.env.NODE_ENV === 'production';
    return reply.status(500).send({
      error: isProduction ? 'Internal server error' : error.message,
      code: 'INTERNAL_ERROR',
    });
  });

  fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    request.log.warn({ url: request.url, method: request.method }, 'Route not found');
    return reply.status(404).send({
      error: `Route ${request.method} ${request.url} not found`,
      code: 'NOT_FOUND',
    });
  });
}
