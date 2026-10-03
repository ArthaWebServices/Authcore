import { createHash, randomBytes } from 'crypto';
import { prisma } from '@shared/prisma';
import { logger } from '@shared/logger';
import { NotFoundError } from '@shared/errors';

export interface ApiKeyPublic {
  id: string;
  name: string;
  prefix: string; // first 12 chars of raw key
  permissions: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyCreated extends ApiKeyPublic {
  key: string; // raw key — only shown once at creation
}

export class ApiKeyService {
  /**
   * Create a new API key. Returns the raw key ONCE — caller must save it.
   * The stored hash cannot be reversed.
   */
  async create(data: {
    userId: string;
    organizationId?: string;
    name: string;
    permissions?: string[];
    expiresAt?: Date;
  }): Promise<ApiKeyCreated> {
    // Generate key: ak_live_ + 32 random bytes hex
    const raw = `ak_live_${randomBytes(32).toString('hex')}`;
    const keyPrefix = raw.slice(0, 12); // "ak_live_xxxx"
    const keyHash = createHash('sha256').update(raw).digest('hex');

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId ?? null,
        name: data.name,
        keyPrefix,
        keyHash,
        permissions: data.permissions ?? [],
        expiresAt: data.expiresAt ?? null,
      },
    });

    logger.info({ apiKeyId: apiKey.id, userId: data.userId, name: data.name }, 'API key created');

    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.keyPrefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      key: raw, // ONLY returned at creation
    };
  }

  async listForUser(userId: string): Promise<ApiKeyPublic[]> {
    const keys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.keyPrefix,
      permissions: k.permissions,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));
  }

  async revoke(userId: string, keyId: string): Promise<void> {
    const key = await prisma.apiKey.findFirst({ where: { id: keyId, userId } });
    if (!key) throw new NotFoundError('API key');

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    logger.info({ userId, keyId }, 'API key revoked');
  }

  /**
   * Validate an API key. Returns the associated user/org on success.
   */
  async validate(rawKey: string): Promise<{ userId: string; organizationId: string | null; permissions: string[] } | null> {
    if (!rawKey.startsWith('ak_live_')) return null;

    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const key = await prisma.apiKey.findFirst({ where: { keyHash } });

    if (!key) return null;
    if (key.revokedAt) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;
    if (!key.userId) return null;

    // Update last used (fire-and-forget)
    prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return {
      userId: key.userId,
      organizationId: key.organizationId,
      permissions: key.permissions,
    };
  }
}
