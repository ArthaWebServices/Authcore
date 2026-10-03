import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@shared/prisma';

/**
 * Base service class providing shared utilities for all services.
 * Includes transaction support, error wrapping, and logger access.
 */
export abstract class BaseService {
  protected readonly prismaClient: PrismaClient;

  constructor(client: PrismaClient = prisma) {
    this.prismaClient = client;
  }

  /**
   * Run a callback inside a Prisma transaction.
   * The callback receives a transaction client; on throw the txn is rolled back.
   */
  protected async withTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    return this.prismaClient.$transaction(fn, {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
      isolationLevel: options?.isolationLevel,
    });
  }

  /**
   * Run an operation with an interactive transaction (caller decides commit/rollback).
   */
  protected async withInteractiveTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
    },
  ): Promise<T> {
    return this.prismaClient.$transaction(async (tx) => fn(tx), {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 15000,
    });
  }
}
