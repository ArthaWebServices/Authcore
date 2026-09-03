import type { Prisma, PrismaClient, User } from '@prisma/client';
import { prisma } from '@shared/prisma';

export type CreateUserInput = {
  email: string;
  passwordHash?: string;
  fullName?: string;
  avatarUrl?: string;
  locale?: string;
  timezone?: string;
};

export type UpdateUserInput = Partial<{
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  passwordUpdatedAt: Date;
  fullName: string;
  avatarUrl: string;
  locale: string;
  timezone: string;
  mfaEnabled: boolean;
  mfaSecret: string;
  backupCodes: string[];
  status: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date;
  lastLoginIp: string | null;
  deletedAt: Date;
}>;

export class UserRepository {
  private readonly client: PrismaClient;

  constructor(client: PrismaClient = prisma) {
    this.client = client;
  }

  async create(data: CreateUserInput): Promise<User> {
    return this.client.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash ?? null,
        fullName: data.fullName ?? null,
        avatarUrl: data.avatarUrl ?? null,
        locale: data.locale ?? 'en',
        timezone: data.timezone ?? 'UTC',
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.client.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.client.user.findUnique({ where: { email } });
  }

  async findByIdWithDeleted(id: string): Promise<User | null> {
    return this.client.user.findUnique({ where: { id } });
  }

  async findManyActive(args?: { skip?: number; take?: number }): Promise<User[]> {
    return this.client.user.findMany({
      where: { status: { not: 'deleted' } },
      skip: args?.skip,
      take: args?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async countActive(): Promise<number> {
    return this.client.user.count({ where: { status: { not: 'deleted' } } });
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    return this.client.user.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<User> {
    return this.client.user.update({
      where: { id },
      data: { status: 'deleted', deletedAt: new Date() },
    });
  }

  async incrementFailedLoginAttempts(id: string): Promise<User> {
    return this.client.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
    });
  }

  async resetFailedLoginAttempts(id: string): Promise<User> {
    return this.client.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  async lock(id: string, until: Date): Promise<User> {
    return this.client.user.update({
      where: { id },
      data: { lockedUntil: until },
    });
  }

  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.client.$transaction(fn);
  }
}
