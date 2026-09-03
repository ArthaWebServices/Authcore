import { createHash, randomBytes } from 'crypto';
import { prisma } from '@shared/prisma';
import { logger } from '@shared/logger';
import { NotFoundError, ValidationError, AuthenticationError } from '@shared/errors';

export interface ImpersonationSession {
  token: string;
  expiresAt: Date;
  adminId: string;
  targetUserId: string;
  reason: string;
}

export class ImpersonationService {
  private activeSessions = new Map<string, ImpersonationSession>();

  /**
   * Start impersonation — admin assumes identity of target user.
   * Returns a short-lived token that should be used in place of the user's normal token.
   */
  async startImpersonation(adminId: string, targetUserId: string, reason: string): Promise<ImpersonationSession> {
    if (adminId === targetUserId) {
      throw new ValidationError('Cannot impersonate self');
    }

    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.status === 'deleted') {
      throw new NotFoundError('Admin user');
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target || target.status === 'deleted') {
      throw new NotFoundError('Target user');
    }

    // Generate short-lived token (15 minutes)
    const token = `imp_${randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const session: ImpersonationSession = {
      token,
      expiresAt,
      adminId,
      targetUserId,
      reason,
    };

    this.activeSessions.set(token, session);

    // Audit log
    await prisma.auditLog.create({
      data: {
        eventType: 'admin.impersonation.start',
        userId: adminId,
        ipAddress: null,
        metadata: { targetUserId, reason, token: token.slice(0, 8) + '...' },
        riskScore: 100, // high-risk event
      },
    });

    logger.warn({ adminId, targetUserId, reason }, 'Impersonation started');
    return session;
  }

  /**
   * Validate an impersonation token. Returns the target user ID if valid.
   */
  validateToken(token: string): string | null {
    if (!token.startsWith('imp_')) return null;

    const session = this.activeSessions.get(token);
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      this.activeSessions.delete(token);
      return null;
    }
    return session.targetUserId;
  }

  /**
   * End an impersonation session.
   * Only the admin who started the session may end it.
   */
  async endImpersonation(token: string, requesterId: string): Promise<{ ended: boolean; adminId?: string }> {
    const session = this.activeSessions.get(token);
    if (!session) return { ended: false };

    // Authorization: only the originating admin can end their session
    if (session.adminId !== requesterId) {
      throw new AuthenticationError('Only the admin who started this impersonation may end it');
    }

    this.activeSessions.delete(token);

    await prisma.auditLog.create({
      data: {
        eventType: 'admin.impersonation.end',
        userId: session.adminId,
        metadata: { targetUserId: session.targetUserId, reason: session.reason },
        riskScore: 50,
      },
    });

    logger.warn({ adminId: session.adminId, targetUserId: session.targetUserId }, 'Impersonation ended');
    return { ended: true, adminId: session.adminId };
  }

  /**
   * List active impersonation sessions (for admin dashboard).
   */
  listActive(): ImpersonationSession[] {
    const now = new Date();
    const result: ImpersonationSession[] = [];
    for (const [token, session] of this.activeSessions.entries()) {
      if (session.expiresAt > now) {
        result.push({ ...session, token: token.slice(0, 8) + '...' });
      } else {
        this.activeSessions.delete(token);
      }
    }
    return result;
  }
}
