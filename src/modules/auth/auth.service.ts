import { UserRepository } from '@modules/users/user.repository';
import { SessionRepository } from '@modules/sessions/session.repository';
import { hashPassword, generateSecureToken, hashToken } from '@shared/crypto/password';
import { logger } from '@shared/logger';
import { getConfig } from '@config';
import { prisma } from '@shared/prisma';
import { ConflictError, NotFoundError, EmailNotVerifiedError } from '@shared/errors';
import { renderEmail } from '@shared/email/template-renderer';
import { addEmailJob } from '@shared/queue/email.queue';
import type { User, Session } from '@prisma/client';

export interface RegisterInput {
  email: string;
  password: string;
  fullName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult {
  user: User;
  tokens: AuthTokens;
  sessionId: string;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

export class AuthService {
  private readonly userRepo: UserRepository;
  private readonly sessionRepo: SessionRepository;

  constructor(userRepo?: UserRepository, sessionRepo?: SessionRepository) {
    this.userRepo = userRepo ?? new UserRepository();
    this.sessionRepo = sessionRepo ?? new SessionRepository();
  }

  async register(input: RegisterInput, userAgent?: string, ipAddress?: string): Promise<{ user: User; verificationToken: string }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check uniqueness
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing && existing.status !== 'deleted') {
      // Don't leak user existence - use generic message in real code
      throw new ConflictError('A user with this email already exists');
    }

    // Block common passwords
    const { checkPasswordStrength } = await import('@shared/crypto/password-blocklist');
    const strength = checkPasswordStrength(input.password);
    if (!strength.valid) {
      throw new (await import('@shared/errors')).ValidationError(strength.reason ?? 'Weak password');
    }

    // Hash password (Argon2id)
    const passwordHash = await hashPassword(input.password);

    // Create user in transaction
    const user = await prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: input.fullName ?? null,
          passwordUpdatedAt: new Date(),
          status: 'active',
        },
      });
    });

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    // Generate verification token (opaque, stored in DB)
    const verificationToken = await this.createVerificationToken(user.id, 'email_verification');

    // Queue verification email
    const verificationUrl = `${getConfig().APP_URL}/auth/verify-email?token=${verificationToken}`;
    const rendered = await renderEmail('verification', {
      name: input.fullName,
      verificationUrl,
      expiresInHours: 24,
    });

    await addEmailJob(user.email, rendered.subject, rendered.html, rendered.text);

    return { user, verificationToken };
  }

  async login(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string,
    deviceFingerprint?: string,
  ): Promise<LoginResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);

    if (!user || !user.passwordHash) {
      logger.warn({ email: normalizedEmail }, 'Login attempt with invalid email');
      throw new (await import('@shared/errors')).AuthenticationError('Invalid email or password');
    }

    // Check account status
    if (user.status === 'locked') {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new (await import('@shared/errors')).AccountLockedError(user.lockedUntil);
      }
      // Lock expired - reset
      await this.userRepo.update(user.id, { status: 'active', lockedUntil: null, failedLoginAttempts: 0 });
    }

    if (user.status === 'deleted') {
      throw new (await import('@shared/errors')).AuthenticationError('Invalid email or password');
    }

    // Verify password
    const { verifyPassword } = await import('@shared/crypto/password');
    const passwordValid = await verifyPassword(password, user.passwordHash);

    if (!passwordValid) {
      // Track failed attempts
      const newCount = user.failedLoginAttempts + 1;
      if (newCount >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
        await this.userRepo.lock(user.id, lockedUntil);
        logger.warn({ userId: user.id, failedAttempts: newCount }, 'Account locked due to failed attempts');
        throw new (await import('@shared/errors')).AccountLockedError(lockedUntil);
      }
      await this.userRepo.incrementFailedLoginAttempts(user.id);
      throw new (await import('@shared/errors')).AuthenticationError('Invalid email or password');
    }

    // Password valid - reset attempts and update last login
    await this.userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress ?? null,
    });

    // Check email verification
    if (!user.emailVerified) {
      throw new EmailNotVerifiedError({ email: user.email });
    }

    // Generate session and tokens
    const tokens = await this.issueTokens(user, userAgent, ipAddress, deviceFingerprint);

    return {
      user,
      tokens,
      sessionId: tokens.sessionId,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionRepo.revoke(sessionId);
    logger.info({ sessionId }, 'User logged out');
  }

  async logoutAll(userId: string, exceptSessionId?: string): Promise<number> {
    const count = await this.sessionRepo.revokeAllForUser(userId, exceptSessionId);
    logger.info({ userId, count }, 'User logged out from all devices');
    return count;
  }

  async verifyEmail(userId: string): Promise<User> {
    const user = await this.userRepo.update(userId, {
      emailVerified: true,
      status: 'active',
    });
    logger.info({ userId }, 'Email verified');
    return user;
  }

  async resendVerificationEmail(userId: string): Promise<string> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    if (user.emailVerified) {
      throw new (await import('@shared/errors')).ValidationError('Email already verified');
    }
    const token = await this.createVerificationToken(user.id, 'email_verification');
    const { renderEmail } = await import('@shared/email/template-renderer');
    const { addEmailJob } = await import('@shared/queue/email.queue');
    const verificationUrl = `${getConfig().APP_URL}/auth/verify-email?token=${token}`;
    const rendered = await renderEmail('verification', {
      name: user.fullName,
      verificationUrl,
      expiresInHours: 24,
    });
    await addEmailJob(user.email, rendered.subject, rendered.html, rendered.text);
    return token;
  }

  async refreshTokens(refreshToken: string, userAgent?: string, ipAddress?: string): Promise<AuthTokens> {
    const { verifyToken } = await import('@shared/crypto/password');
    // We need to find the session by comparing hashes (bcrypt)
    // The token itself is random - we need to find it via comparison
    // For DB lookup, we'd use a hash. Since refresh tokens are opaque,
    // the standard pattern is: hash the incoming token with bcrypt, find by hash.
    // However, bcrypt is slow for this. Better: store SHA-256 of the token in DB and compare.

    // For now, we'll use the verification path.
    // In production, use SHA-256 for fast lookup:
    const { createHash } = await import('crypto');
    const sha256Hash = createHash('sha256').update(refreshToken).digest('hex');

    // Try fast SHA-256 lookup first (preferred)
    let session = await prisma.session.findFirst({
      where: { refreshTokenHash: sha256Hash, revokedAt: null },
    });

    // Fallback: bcrypt comparison (for tokens hashed with bcrypt)
    if (!session) {
      const allUserSessions = await prisma.session.findMany({
        where: { revokedAt: null },
        take: 100,
      });
      for (const s of allUserSessions) {
        if (s.refreshTokenHash.length === 60) {
          // bcrypt hash
          const isValid = await verifyToken(refreshToken, s.refreshTokenHash);
          if (isValid) {
            session = s;
            break;
          }
        }
      }
    }

    if (!session) {
      throw new (await import('@shared/errors')).TokenReuseDetectedError();
    }

    if (session.expiresAt < new Date()) {
      throw new (await import('@shared/errors')).TokenExpiredError();
    }

    // Rotate: revoke old, create new
    await this.sessionRepo.revoke(session.id);

    const user = await this.userRepo.findById(session.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    return this.issueTokens(user, userAgent, ipAddress);
  }

  private async issueTokens(
    user: User,
    userAgent?: string,
    ipAddress?: string,
    deviceFingerprint?: string,
  ): Promise<AuthTokens & { sessionId: string }> {
    const config = getConfig();
    const refreshToken = generateSecureToken(32);
    const refreshHash = refreshToken; // Store as-is (it's random and unique)

    // Concurrent session limit — revoke oldest if over limit
    const maxSessions = config.MAX_CONCURRENT_SESSIONS;
    const activeCount = await this.sessionRepo.countActiveByUserId(user.id);
    if (activeCount >= maxSessions) {
      const sessions = await this.sessionRepo.findActiveByUserId(user.id);
      const oldest = sessions[sessions.length - 1];
      if (oldest) {
        await this.sessionRepo.revoke(oldest.id);
        logger.info({ userId: user.id, revokedSessionId: oldest.id }, 'Revoked oldest session due to limit');
      }
    }

    // We use SHA-256 for fast lookup and store it hashed
    const { createHash } = await import('crypto');
    const sha256Hash = createHash('sha256').update(refreshToken).digest('hex');

    const session = await this.sessionRepo.create({
      userId: user.id,
      refreshTokenHash: sha256Hash,
      userAgent,
      ipAddress,
      deviceFingerprint,
      expiresAt: new Date(Date.now() + config.JWT_REFRESH_TOKEN_TTL * 1000),
    });

    // Generate access token (JWT)
    const accessToken = await this.generateAccessToken(user, session.id);

    return {
      accessToken,
      refreshToken: refreshHash,
      sessionId: session.id,
      expiresIn: config.JWT_ACCESS_TOKEN_TTL,
    };
  }

  private async generateAccessToken(user: User, sessionId: string): Promise<string> {
    const { sign } = await import('jsonwebtoken').catch(() => ({} as any));
    // We use jose for RS256
    const { SignJWT, importPKCS8 } = await import('jose');
    const config = getConfig();

    let privateKey: Uint8Array;
    try {
      privateKey = new TextEncoder().encode(config.JWT_PRIVATE_KEY);
    } catch {
      privateKey = new TextEncoder().encode(config.JWT_PRIVATE_KEY);
    }

    const key = await importPKCS8(config.JWT_PRIVATE_KEY, 'RS256');

    const jwt = await new SignJWT({
      sub: user.id,
      email: user.email,
      email_verified: user.emailVerified,
      sid: sessionId,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'authcore-default' })
      .setIssuedAt()
      .setIssuer(config.JWT_ISSUER)
      .setAudience(config.JWT_AUDIENCE)
      .setExpirationTime(`${config.JWT_ACCESS_TOKEN_TTL}s`)
      .sign(key);

    return jwt;
  }

  async forgotPassword(email: string): Promise<string> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user || user.status === 'deleted') {
      // Don't leak whether email exists
      return 'If an account exists, a reset link has been sent';
    }

    const token = await this.createPasswordResetToken(user.id);
    const { renderEmail } = await import('@shared/email/template-renderer');
    const { addEmailJob } = await import('@shared/queue/email.queue');
    const resetUrl = `${getConfig().APP_URL}/auth/reset-password?token=${token}`;
    const rendered = await renderEmail('password-reset', {
      name: user.fullName,
      resetUrl,
      expiresInHours: 1,
    });
    await addEmailJob(user.email, rendered.subject, rendered.html, rendered.text);

    logger.info({ userId: user.id }, 'Password reset email sent');
    return 'If an account exists, a reset link has been sent';
  }

  async resetPassword(token: string, newPassword: string): Promise<User> {
    const { prisma } = await import('@shared/prisma');
    const record = await prisma.verificationToken.findFirst({
      where: { token, type: 'password_reset', expiresAt: { gt: new Date() } },
    });
    if (!record) {
      throw new (await import('@shared/errors')).ValidationError('Invalid or expired reset token');
    }
    const { checkPasswordStrength } = await import('@shared/crypto/password-blocklist');
    const strength = checkPasswordStrength(newPassword);
    if (!strength.valid) {
      throw new (await import('@shared/errors')).ValidationError(strength.reason ?? 'Weak password');
    }
    const passwordHash = await hashPassword(newPassword);
    const user = await this.userRepo.update(record.identifier, {
      passwordHash,
      passwordUpdatedAt: new Date(),
    });
    await prisma.verificationToken.delete({ where: { id: record.id } });
    logger.info({ userId: user.id }, 'Password reset completed');
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.passwordHash) {
      throw new (await import('@shared/errors')).NotFoundError('User');
    }
    const { verifyPassword } = await import('@shared/crypto/password');
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw new (await import('@shared/errors')).AuthenticationError('Current password is incorrect');
    }
    // Prevent reusing current password
    if (currentPassword === newPassword) {
      throw new (await import('@shared/errors')).ValidationError('New password must be different from current password');
    }
    const { checkPasswordStrength } = await import('@shared/crypto/password-blocklist');
    const strength = checkPasswordStrength(newPassword);
    if (!strength.valid) {
      throw new (await import('@shared/errors')).ValidationError(strength.reason ?? 'Weak password');
    }
    const passwordHash = await hashPassword(newPassword);
    const updated = await this.userRepo.update(userId, {
      passwordHash,
      passwordUpdatedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    // Revoke all sessions except current (optional — for simplicity revoke all)
    await this.sessionRepo.revokeAllForUser(userId);
    logger.info({ userId }, 'Password changed');
    return updated;
  }

  async getMe(userId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.status === 'deleted') {
      throw new (await import('@shared/errors')).NotFoundError('User');
    }
    return user;
  }

  async updateMe(userId: string, data: Partial<{ fullName: string; timezone: string; locale: string; avatarUrl: string }>): Promise<User> {
    return this.userRepo.update(userId, data);
  }

  async verifyAccessToken(token: string): Promise<{ sub: string; email: string; sid: string }> {
    const { jwtVerify, createRemoteJWKSet } = await import('jose');
    const config = getConfig();
    const JWKS = createRemoteJWKSet(new URL(`${config.JWT_ISSUER}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    });
    if (!payload.sub || !payload.sid) {
      throw new (await import('@shared/errors')).AuthenticationError('Invalid token claims');
    }
    return { sub: payload.sub, email: payload.email as string, sid: payload.sid as string };
  }

  async getSessions(userId: string): Promise<Session[]> {
    return this.sessionRepo.findActiveByUserId(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new (await import('@shared/errors')).NotFoundError('Session');
    }
    await this.sessionRepo.revoke(sessionId);
    logger.info({ userId, sessionId }, 'Session revoked');
  }

  private async createPasswordResetToken(userId: string): Promise<string> {
    const token = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const { prisma } = await import('@shared/prisma');
    await prisma.verificationToken.create({
      data: { identifier: userId, token, type: 'password_reset', expiresAt },
    });
    return token;
  }

  private async createVerificationToken(userId: string, type: 'email_verification'): Promise<string> {
    const token = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.verificationToken.create({
      data: {
        identifier: userId,
        token,
        type,
        expiresAt,
      },
    });

    return token;
  }
}
