import { z } from 'zod';
import { AuthService } from './auth.service';
import { logger } from '@shared/logger';

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export async function verifyEmailHandler(
  token: string,
  authService: AuthService,
): Promise<{ message: string; user: any }> {
  // Find and validate token
  const { prisma } = await import('@shared/prisma');
  const record = await prisma.verificationToken.findFirst({
    where: { token, type: 'email_verification', expiresAt: { gt: new Date() } },
  });

  if (!record) {
    const err = new Error('Invalid or expired verification token');
    err.name = 'ValidationError';
    throw err;
  }

  const user = await authService.verifyEmail(record.identifier);
  await prisma.verificationToken.delete({ where: { id: record.id } });

  logger.info({ userId: user.id, tokenId: record.id }, 'Email verified');
  return { message: 'Email verified successfully', user };
}
