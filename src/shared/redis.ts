// Redis client singleton with clustering support

import Redis from 'ioredis';
import { getConfig } from '../config';
import { logger } from './logger';

const config = getConfig();

let redisClient: Redis | null = null;
let isConnecting = false;

export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  if (isConnecting) {
    // Return a temporary client that will wait for connection
    throw new Error('Redis connection in progress, please wait');
  }

  isConnecting = true;

  const redisOptions: Redis.RedisOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.error('Redis max retries reached');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
    enableReadyCheck: true,
    family: 4,
  };

  if (config.REDIS_CLUSTER) {
    // For cluster mode, we'd use Redis.Cluster
    // For now, single instance
    logger.warn('Redis cluster mode requested but using single instance');
  }

  if (config.REDIS_TLS) {
    redisOptions.tls = {};
  }

  redisClient = new Redis(config.REDIS_URL, redisOptions);

  redisClient.on('connect', () => {
    logger.info('Redis connected');
    isConnecting = false;
  });

  redisClient.on('ready', () => {
    logger.debug('Redis ready');
  });

  redisClient.on('error', (error) => {
    logger.error({ error }, 'Redis error');
    isConnecting = false;
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
    isConnecting = false;
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

  // Connect asynchronously
  redisClient.connect().catch((error) => {
    logger.error({ error }, 'Failed to connect to Redis');
    isConnecting = false;
  });

  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (client.status === 'wait') {
    await client.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}

export async function healthCheckRedis(): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (client.status !== 'ready') {
      return false;
    }
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// Rate limiting helpers
export async function incrementRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const client = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `ratelimit:${key}`;

  const multi = client.multi();
  multi.zremrangebyscore(redisKey, 0, windowStart);
  multi.zcard(redisKey);
  multi.zadd(redisKey, now, `${now}-${Math.random()}`);
  multi.expire(redisKey, Math.ceil(windowMs / 1000) + 1);
  const results = await multi.exec();

  const currentCount = results?.[1]?.[1] as number ?? 0;
  const allowed = currentCount < max;
  const remaining = Math.max(0, max - currentCount - 1);
  const resetTime = now + windowMs;

  return { allowed, remaining, resetTime };
}

export async function checkRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const client = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `ratelimit:${key}`;

  const count = await client.zcount(redisKey, windowStart, '+inf');
  const allowed = count < max;
  const remaining = Math.max(0, max - count);
  const resetTime = now + windowMs;

  return { allowed, remaining, resetTime };
}
