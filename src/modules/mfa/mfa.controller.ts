import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { MfaService } from './mfa.service';
import { AuthService } from '@modules/auth/auth.service';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from '@modules/auth/auth.middleware';
import { MfaRequiredError } from '@shared/errors';

const totpSetupSchema = z.object({});
const totpVerifySchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Must be a 6-digit code') });
const totpDisableSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Must be a 6-digit code') });
const backupCodeVerifySchema = z.object({
  code: z.string().min(10, 'Backup code required'),
});
const regenerateBackupCodesSchema = z.object({
  totpCode: z.string().regex(/^\d{6}$/, 'Must be a 6-digit code'),
});

export interface MfaControllerDeps {
  mfaService: MfaService;
  authService: AuthService;
}

export async function mfaRoutes(fastify: FastifyInstance, deps: MfaControllerDeps): Promise<void> {
  const { mfaService, authService } = deps;

  // POST /auth/mfa/totp/setup — begin TOTP enrollment
  fastify.post(
    '/auth/mfa/totp/setup',
    { preHandler: [requireAuth(authService), createValidatorHook({ body: totpSetupSchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const result = await mfaService.setupTotp(userId);
      return reply.send({
        secret: result.secret,
        otpauthUrl: result.otpauthUrl,
        backupCodes: result.backupCodes,
        message: 'Scan the QR code with your authenticator app, then verify with a code to activate.',
      });
    },
  );

  // POST /auth/mfa/totp/verify — verify code and activate
  fastify.post(
    '/auth/mfa/totp/verify',
    { preHandler: [requireAuth(authService), createValidatorHook({ body: totpVerifySchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const { code } = request.validatedBody as z.infer<typeof totpVerifySchema>;
      await mfaService.activateTotp(userId, code);
      return reply.send({ message: 'MFA enabled successfully.' });
    },
  );

  // POST /auth/mfa/totp/disable — disable MFA (requires code)
  fastify.post(
    '/auth/mfa/totp/disable',
    { preHandler: [requireAuth(authService), createValidatorHook({ body: totpDisableSchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const { code } = request.validatedBody as z.infer<typeof totpDisableSchema>;
      await mfaService.disableTotp(userId, code);
      return reply.send({ message: 'MFA disabled.' });
    },
  );

  // POST /auth/mfa/backup-code/verify — use a backup code during login
  fastify.post(
    '/auth/mfa/backup-code/verify',
    { preHandler: [requireAuth(authService), createValidatorHook({ body: backupCodeVerifySchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const { code } = request.validatedBody as z.infer<typeof backupCodeVerifySchema>;
      const valid = await mfaService.verifyBackupCode(userId, code);
      if (!valid) {
        throw new (await import('@shared/errors')).ValidationError('Invalid backup code');
      }
      return reply.send({ message: 'Backup code accepted.', remainingCodes: 'not-exposed' });
    },
  );

  // POST /auth/mfa/backup-codes/regenerate — regenerate backup codes (requires TOTP)
  fastify.post(
    '/auth/mfa/backup-codes/regenerate',
    { preHandler: [requireAuth(authService), createValidatorHook({ body: regenerateBackupCodesSchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const { totpCode } = request.validatedBody as z.infer<typeof regenerateBackupCodesSchema>;
      const newCodes = await mfaService.regenerateBackupCodes(userId, totpCode);
      return reply.send({
        backupCodes: newCodes,
        message: 'New backup codes generated. Store them securely.',
      });
    },
  );
}
