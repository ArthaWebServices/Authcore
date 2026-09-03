import type { PrismaClient, Session } from '@prisma/client';
import { prisma } from '@shared/prisma';

export type CreateSessionInput = {
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  deviceFingerprint?: string;
  expiresAt: Date;
};

export class SessionRepository {
  private readonly client: PrismaClient;

  constructor(client: PrismaClient = prisma) {
    this.client = client;
  }

  async create(data: CreateSessionInput): Promise<Session> {
    return this.client.session.create({ data });
  }

  async findById(id: string): Promise<Session | null> {
    return this.client.session.findUnique({ where: { id } });
  }

  async findByRefreshHash(hash: string): Promise<Session | null> {
    return this.client.session.findFirst({
      where: { refreshTokenHash: hash, revokedAt: null },
    });
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    return this.client.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return this.client.session.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async revoke(id: string): Promise<Session> {
    return this.client.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await this.client.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.client.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  async touch(id: string): Promise<Session> {
    return this.client.session.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }
}
