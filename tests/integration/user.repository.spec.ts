import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserRepository, CreateUserInput, UpdateUserInput } from '../src/modules/users/user.repository';

// Mock Prisma
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  emailVerified: false,
  passwordHash: 'hashed-password',
  passwordUpdatedAt: null,
  fullName: 'Test User',
  avatarUrl: null,
  locale: 'en',
  timezone: 'UTC',
  mfaEnabled: false,
  mfaSecret: null,
  backupCodes: [],
  status: 'active',
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  lastLoginIp: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockPrismaClient = {
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
};

// @ts-expect-error - mock module
vi.mock('../src/shared/prisma', () => ({
  prisma: mockPrismaClient,
}));

describe('UserRepository', () => {
  let repo: UserRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new UserRepository(mockPrismaClient as any);
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const input: CreateUserInput = {
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        fullName: 'Test User',
      };

      mockPrismaClient.user.create.mockResolvedValue(mockUser);

      const result = await repo.create(input);

      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          fullName: input.fullName,
          locale: 'en',
          timezone: 'UTC',
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should create user with default values', async () => {
      const input: CreateUserInput = { email: 'test@example.com' };

      mockPrismaClient.user.create.mockResolvedValue({ ...mockUser, fullName: null });

      const result = await repo.create(input);

      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: {
          email: input.email,
          passwordHash: undefined,
          fullName: undefined,
          locale: 'en',
          timezone: 'UTC',
        },
      });
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findById('user-123');

      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-123' } });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findByEmail('test@example.com');

      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      const updateData: UpdateUserInput = { fullName: 'Updated Name' };
      const updatedUser = { ...mockUser, fullName: 'Updated Name' };

      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      const result = await repo.update('user-123', updateData);

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: updateData,
      });
      expect(result.fullName).toBe('Updated Name');
    });
  });

  describe('softDelete', () => {
    it('should soft delete user by setting status to deleted', async () => {
      const deletedUser = { ...mockUser, status: 'deleted', deletedAt: new Date() };
      mockPrismaClient.user.update.mockResolvedValue(deletedUser);

      const result = await repo.softDelete('user-123');

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { status: 'deleted', deletedAt: expect.any(Date) },
      });
      expect(result.status).toBe('deleted');
    });
  });

  describe('incrementFailedLoginAttempts', () => {
    it('should increment failed login attempts', async () => {
      const lockedUser = { ...mockUser, failedLoginAttempts: 1 };
      mockPrismaClient.user.update.mockResolvedValue(lockedUser);

      const result = await repo.incrementFailedLoginAttempts('user-123');

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { failedLoginAttempts: { increment: 1 } },
      });
    });
  });

  describe('lock', () => {
    it('should lock user account', async () => {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      const lockedUser = { ...mockUser, lockedUntil: lockUntil };
      mockPrismaClient.user.update.mockResolvedValue(lockedUser);

      const result = await repo.lock('user-123', lockUntil);

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lockedUntil: lockUntil },
      });
    });
  });
});
