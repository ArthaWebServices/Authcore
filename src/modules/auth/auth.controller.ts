import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateMeSchema,
} from '../../types/auth.schemas';
import { verifyEmailSchema } from './verify-email';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from './auth.middleware';
import { getConfig } from '@config';
import { logger } from '@shared/logger';
import { logAuditEvent } from '@shared/audit/log';
import { ValidationError, NotFoundError } from '@shared/errors';

export interface AuthControllerDeps {
  authService: AuthService;
}

export async function authRoutes(fastify: FastifyInstance, deps: AuthControllerDeps): Promise<void> {
  const { authService } = deps;
  const config = getConfig();

  // POST /auth/register
  fastify.post(
    '/auth/register',
    {
      preHandler: createValidatorHook({ body: registerSchema }),
      config: {
        rateLimit: {
          max: config.RATE_LIMIT_REGISTER_MAX ?? 3,
          timeWindow: config.RATE_LIMIT_REGISTER_WINDOW_MS ?? 60_000,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.validatedBody as z.infer<typeof registerSchema>;

      try {
        const { user } = await authService.register(
          { email: body.email, password: body.password, fullName: body.fullName },
          request.headers['user-agent'],
          request.ip,
        );

        // Audit log
        await logAuditEvent({
          eventType: 'user.register',
          userId: user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        return reply.status(201).send({
          user: {
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            fullName: user.fullName,
            createdAt: user.createdAt,
          },
          message: 'Registration successful. Please check your email to verify your account.',
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          throw new ValidationError('A user with this email already exists', { email: body.email });
        }
        throw error;
      }
    },
  );

  // POST /auth/login
  fastify.post(
    '/auth/login',
    {
      preHandler: createValidatorHook({ body: loginSchema }),
      config: {
        rateLimit: {
          max: config.RATE_LIMIT_LOGIN_MAX ?? 5,
          timeWindow: config.RATE_LIMIT_LOGIN_WINDOW_MS ?? 60_000,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.validatedBody as z.infer<typeof loginSchema>;

      const result = await authService.login(
        body.email,
        body.password,
        request.headers['user-agent'],
        request.ip,
      );

      // Audit log
      await logAuditEvent({
        eventType: 'user.login',
        userId: result.user.id,
        sessionId: result.sessionId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      // Set refresh token as HttpOnly cookie
      reply.setCookie('refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth',
        maxAge: config.JWT_REFRESH_TOKEN_TTL,
      });

      return reply.send({
        user: {
          id: result.user.id,
          email: result.user.email,
          emailVerified: result.user.emailVerified,
          fullName: result.user.fullName,
        },
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
        sessionId: result.sessionId,
      });
    },
  );

  // POST /auth/refresh
  fastify.post(
    '/auth/refresh',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const refreshToken =
        (request.cookies['refresh_token'] as string | undefined) ??
        (request.body as { refreshToken?: string })?.refreshToken;

      if (!refreshToken) {
        throw new ValidationError('Refresh token required', { source: 'cookie or body' });
      }

      const tokens = await authService.refreshTokens(
        refreshToken,
        request.headers['user-agent'],
        request.ip,
      );

      reply.setCookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/auth',
        maxAge: config.JWT_REFRESH_TOKEN_TTL,
      });

      return reply.send({
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      });
    },
  );

  // POST /auth/logout
  fastify.post(
    '/auth/logout',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = request.cookies['refresh_token'] as string | undefined;
      const sessionId = (request.body as { sessionId?: string })?.sessionId;

      if (refreshToken) {
        try {
          // Best-effort revoke by looking up session
          // For simplicity, we revoke by sessionId if provided
          if (sessionId) {
            await authService.logout(sessionId);
          }
        } catch (error) {
          logger.warn({ error }, 'Logout: session lookup failed');
        }
      }

      reply.clearCookie('refresh_token', { path: '/auth' });

      return reply.send({ message: 'Logged out successfully' });
    },
  );

  // POST /auth/verify-email
  fastify.post(
    '/auth/verify-email',
    {
      preHandler: createValidatorHook({ body: z.object({ token: z.string() }) }),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token } = request.body as { token: string };
      const { verifyEmailHandler } = await import('./verify-email.js');
      const result = await verifyEmailHandler(token, authService);
      return reply.send({
        message: result.message,
        user: { id: result.user.id, emailVerified: result.user.emailVerified },
      });
    },
  );

  // POST /auth/resend-verification
  fastify.post(
    '/auth/resend-verification',
    {
      preHandler: createValidatorHook({ body: z.object({ userId: z.string() }) }),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.body as { userId: string };
      const token = await authService.resendVerificationEmail(userId);
      return reply.send({
        message: 'Verification email resent. Check your inbox.',
        token, // Only include if debugging; in prod remove
      });
    },
  );

  // POST /auth/logout-all (authenticated)
  fastify.post(
    '/auth/logout-all',
    {
      preHandler: [requireAuth(authService)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const count = await authService.logoutAll(userId);
      return reply.send({ message: 'All sessions revoked', revokedCount: count });
    },
  );

  // POST /auth/forgot-password
  fastify.post(
    '/auth/forgot-password',
    {
      preHandler: createValidatorHook({ body: forgotPasswordSchema }),
      config: {
        rateLimit: {
          max: 3,
          timeWindow: 60_000,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = request.validatedBody as z.infer<typeof forgotPasswordSchema>;
      await authService.forgotPassword(email);
      // Always return generic message — don't leak account existence
      return reply.send({ message: 'If an account exists, a reset link has been sent.' });
    },
  );

  // POST /auth/reset-password
  fastify.post(
    '/auth/reset-password',
    {
      preHandler: createValidatorHook({ body: resetPasswordSchema }),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token, newPassword } = request.validatedBody as z.infer<typeof resetPasswordSchema>;
      await authService.resetPassword(token, newPassword);
      return reply.send({ message: 'Password reset successful. Please log in.' });
    },
  );

  // POST /auth/change-password (authenticated)
  fastify.post(
    '/auth/change-password',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ body: changePasswordSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { currentPassword, newPassword } = request.validatedBody as z.infer<typeof changePasswordSchema>;
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      await authService.changePassword(userId, currentPassword, newPassword);
      return reply.send({ message: 'Password changed successfully.' });
    },
  );

  // GET /auth/me (authenticated)
  fastify.get(
    '/auth/me',
    {
      preHandler: [requireAuth(authService)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const user = await authService.getMe(userId);
      return reply.send({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
        timezone: user.timezone,
        mfaEnabled: user.mfaEnabled,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      });
    },
  );

  // PATCH /auth/me (authenticated)
  fastify.patch(
    '/auth/me',
    {
      preHandler: [requireAuth(authService), createValidatorHook({ body: updateMeSchema })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const body = request.validatedBody as z.infer<typeof updateMeSchema>;
      const user = await authService.updateMe(userId, body);
      return reply.send({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
        timezone: user.timezone,
        mfaEnabled: user.mfaEnabled,
        status: user.status,
        updatedAt: user.updatedAt,
      });
    },
  );

  // GET /auth/sessions (authenticated) — TASK-034
  fastify.get(
    '/auth/sessions',
    {
      preHandler: [requireAuth(authService)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId, sessionId: currentSid } = (request as FastifyRequest & {
        user: { id: string; sessionId: string };
      }).user;
      const sessions = await authService.getSessions(userId);
      return reply.send({
        sessions: sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
          deviceFingerprint: s.deviceFingerprint,
          createdAt: s.createdAt,
          lastActiveAt: s.lastUsedAt,
          expiresAt: s.expiresAt,
          isCurrent: s.id === currentSid,
        })),
      });
    },
  );

  // DELETE /auth/sessions/:id (authenticated) — TASK-035
  fastify.delete(
    '/auth/sessions/:id',
    {
      preHandler: [requireAuth(authService)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const { id: sessionId } = request.params as { id: string };
      await authService.revokeSession(userId, sessionId);
      return reply.send({ message: 'Session revoked' });
    },
  );
}
