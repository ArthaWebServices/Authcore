import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { getRedisClient } from '@shared/redis';
import { getConfig } from '@config';
import { logger } from '@shared/logger';

const config = getConfig();

export interface RateLimitConfig {
  max: number;
  timeWindow: number;
  keyPrefix: string;
  customKeyGenerator?: (request: FastifyRequest) => string;
}

export async function rateLimitPlugin(fastify: FastifyInstance): Promise<void> {
  const redis = getRedisClient();

  await fastify.register(rateLimit, {
    global: false,
    redis,
    nameSpace: 'authcore-rl:',
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    errorResponseBuilder: (request, context) => {
      logger.warn(
        {
          ip: request.ip,
          url: request.url,
          method: request.method,
          limit: context.max,
          after: context.after,
        },
        'Rate limit exceeded',
      );
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Try again in ${context.after}.`,
        retryAfter: context.after,
      };
    },
  });
}

export function authRateLimit(configOptions: Partial<RateLimitConfig> = {}) {
  return {
    max: configOptions.max ?? config.RATE_LIMIT_LOGIN_MAX,
    timeWindow: configOptions.timeWindow ?? config.RATE_LIMIT_LOGIN_WINDOW_MS,
    keyPrefix: configOptions.keyPrefix ?? 'auth',
    keyGenerator: configOptions.customKeyGenerator ?? ((request: FastifyRequest) => `login:${request.ip}`),
  };
}

export function registerRateLimit(
  max: number,
  timeWindow: number,
  keyPrefix: string,
  customKeyGenerator?: (request: FastifyRequest) => string,
) {
  return {
    max,
    timeWindow,
    keyPrefix,
    keyGenerator:
      customKeyGenerator ??
      ((request: FastifyRequest) => `${keyPrefix}:${request.ip}`),
  };
}
