// Prisma client singleton with logging and error handling

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    { level: 'query', emit: 'stdout' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Prisma 5: use $on with proper event types
prisma.$on('query' as never, (e: { query: string; params: string; duration: number }) => {
  logger.debug({ query: e.query, params: e.params, duration: `${e.duration}ms` }, 'Database query');
});

prisma.$on('error' as never, (e: Error) => {
  logger.error({ error: e }, 'Database error');
});

prisma.$on('warn' as never, (e: Error) => {
  logger.warn({ warning: e }, 'Database warning');
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

export async function healthCheckDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
