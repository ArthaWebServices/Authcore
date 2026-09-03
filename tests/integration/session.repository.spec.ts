import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionRepository, CreateSessionInput } from '../src/modules/sessions/session.repository';

const mockSession = {
  id: 'session-123',
  userId: 'user-123',
  refreshTokenHash: 'hashed-refresh-token',
  userAgent: 'Mozilla/5.0',
  ipAddress: '127.0.0.1',
  country: null,
  city: null,
  deviceFingerprint: null,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrismaClient = {
  session: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};

// @ts-expect-error - mock module
vi.mock('../src/shared/prisma', () => ({
  prisma: mockPrismaClient,
}));

describe('SessionRepository', () => {
  let repo: SessionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SessionRepository(mockPrismaClient as any);
  });

  describe('create', () => {
    it('should create new session', async () => {
      const input: CreateSessionInput = {
        userId: 'user-123',
        refreshTokenHash: 'hashed-refresh-token',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        expiresAt: mockSession.expiresAt,
      };

      mockPrismaClient.session.create.mockResolvedValue(mockSession);

      const result = await repo.create(input);

      expect(mockPrismaClient.session.create).toHaveBeenCalledWith({ data: input });
      expect(result).toEqual(mockSession);
    });
  });

  describe('findByRefreshHash', () => {
    it('should find active session by refresh token hash', async () => {
      mockPrismaClient.session.findFirst.mockResolvedValue(mockSession);

      const result = await repo.findByRefreshHash('hashed-refresh-token');

      expect(mockPrismaClient.session.findFirst).toHaveBeenCalledWith({
        where: { refreshTokenHash: 'hashed-refresh-token', revokedAt: null },
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null if no active session found', async () => {
      mockPrismaClient.session.findFirst.mockResolvedValue(null);

      const result = await repo.findByRefreshHash('invalid-hash');

      expect(result).toBeNull();
    });
  });

  describe('findActiveByUserId', () => {
    it('should return active sessions for user sorted by createdAt desc', async () => {
      const sessions = [mockSession, { ...mockSession, id: 'session-456' }];
      mockPrismaClient.session.findMany.mockResolvedValue(sessions);

      const result = await repo.findActiveByUserId('user-123');

      expect(mockPrismaClient.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('countActiveByUserId', () => {
    it('should count active sessions', async () => {
      mockPrismaClient.session.count.mockResolvedValue(3);

      const result = await repo.countActiveByUserId('user-123');

      expect(mockPrismaClient.session.count).toHaveBeenCalled();
      expect(result).toBe(3);
    });
  });

  describe('revoke', () => {
    it('should revoke a session by setting revokedAt', async () => {
      const revokedSession = { ...mockSession, revokedAt: new Date() };
      mockPrismaClient.session.update.mockResolvedValue(revokedSession);

      const result = await repo.revoke('session-123');

      expect(mockPrismaClient.session.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.revokedAt).toBeDefined();
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all sessions for user', async () => {
      mockPrismaClient.session.updateMany.mockResolvedValue({ count: 3 });

      const result = await repo.revokeAllForUser('user-123');

      expect(mockPrismaClient.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toBe(3);
    });

    it('should exclude specified session from revoke', async () => {
      mockPrismaClient.session.updateMany.mockResolvedValue({ count: 2 });

      const result = await repo.revokeAllForUser('user-123', 'keep-session-123');

      expect(mockPrismaClient.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', revokedAt: null, id: { not: 'keep-session-123' } },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toBe(2);
    });
  });

  describe('deleteExpired', () => {
    it('should delete expired sessions', async () => {
      mockPrismaClient.session.deleteMany.mockResolvedValue({ count: 5 });

      const result = await repo.deleteExpired();

      expect(mockPrismaClient.session.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
      expect(result).toBe(5);
    });
  });
});
