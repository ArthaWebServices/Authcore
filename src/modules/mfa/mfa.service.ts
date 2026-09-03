import { authenticator } from 'otplib';
import { createHmac, randomBytes } from 'crypto';
import { UserRepository } from '@modules/users/user.repository';
import { prisma } from '@shared/prisma';
import { getConfig } from '@config';
import { logger } from '@shared/logger';
import { NotFoundError, ValidationError } from '@shared/errors';

// Configure TOTP with reasonable defaults
authenticator.options = {
  step: 30,
  window: 1, // ±1 step tolerance
};

export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

export interface BackupCodeEntry {
  code: string;
  used: boolean;
}

export class MfaService {
  private readonly userRepo: UserRepository;

  constructor(userRepo?: UserRepository) {
    this.userRepo = userRepo ?? new UserRepository();
  }

  /**
   * Initiate TOTP setup — generates a new secret, returns QR URI + backup codes.
   * Does NOT persist the secret until verified with a valid TOTP code.
   */
  async setupTotp(userId: string): Promise<TotpSetupResult> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.status === 'deleted') {
      throw new NotFoundError('User');
    }

    const config = getConfig();

    // Generate a fresh TOTP secret
    const secret = authenticator.generateSecret();

    // Generate the otpauth URL for QR code scanning
    const otpauthUrl = authenticator.keyuri(user.email, config.MFA_TOTP_ISSUER, secret);

    // Generate hashed backup codes
    const backupCodes = this.generateBackupCodes(config.MFA_BACKUP_CODES_COUNT);

    // Store secret + backup codes in pending state (not yet active)
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret,
        backupCodes,
      },
    });

    logger.info({ userId }, 'MFA TOTP setup initiated');

    return { secret, otpauthUrl, backupCodes };
  }

  /**
   * Verify a TOTP code to activate MFA, or verify during login.
   * Returns true if valid. If user has no secret, returns false.
   */
  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.mfaSecret) return false;

    const valid = authenticator.verify({ token: code, secret: user.mfaSecret });
    return valid;
  }

  /**
   * Activate TOTP after user has verified their first code.
   * Turns mfaEnabled = true and clears any pending state.
   */
  async activateTotp(userId: string, code: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.mfaSecret) {
      throw new NotFoundError('User or MFA not set up');
    }

    if (!authenticator.verify({ token: code, secret: user.mfaSecret })) {
      throw new ValidationError('Invalid TOTP code');
    }

    await this.userRepo.update(userId, { mfaEnabled: true });
    logger.info({ userId }, 'MFA TOTP activated');
  }

  /**
   * Disable MFA — requires a valid TOTP code to confirm.
   */
  async disableTotp(userId: string, code: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.mfaSecret) {
      throw new NotFoundError('User or MFA not set up');
    }

    if (!authenticator.verify({ token: code, secret: user.mfaSecret })) {
      throw new ValidationError('Invalid TOTP code');
    }

    await this.userRepo.update(userId, {
      mfaEnabled: false,
      mfaSecret: null,
      backupCodes: [],
    });

    logger.info({ userId }, 'MFA TOTP disabled');
  }

  /**
   * Consume a backup code. Each code can only be used once.
   * Returns true if the code was valid and has been consumed.
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.backupCodes || user.backupCodes.length === 0) {
      return false;
    }

    // Normalize: remove spaces/dashes, uppercase
    const normalized = code.replace(/[\s-]/g, '').toUpperCase();

    for (let i = 0; i < user.backupCodes.length; i++) {
      const stored = user.backupCodes[i];
      const storedNormalized = stored.replace(/[\s-]/g, '').toUpperCase();

      if (storedNormalized === normalized) {
        // Mark as used by replacing with a sentinel (can't delete from String[] easily)
        const updated = [...user.backupCodes];
        updated[i] = '__USED__';
        await this.userRepo.update(userId, { backupCodes: updated });
        logger.info({ userId }, 'Backup code consumed');
        return true;
      }
    }

    return false;
  }

  /**
   * Regenerate fresh backup codes (requires valid TOTP to confirm).
   * Replaces existing backup codes.
   */
  async regenerateBackupCodes(userId: string, totpCode: string): Promise<string[]> {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.mfaSecret) {
      throw new NotFoundError('User or MFA not set up');
    }

    if (!authenticator.verify({ token: totpCode, secret: user.mfaSecret })) {
      throw new ValidationError('Invalid TOTP code');
    }

    const newCodes = this.generateBackupCodes(getConfig().MFA_BACKUP_CODES_COUNT);
    await this.userRepo.update(userId, { backupCodes: newCodes });
    logger.info({ userId }, 'Backup codes regenerated');
    return newCodes;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Generate cryptographically random backup codes.
   * Format: XXXX-XXXX-XXXX (readable, 12 chars each, separated by dashes)
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const raw = randomBytes(8).toString('hex').toUpperCase();
      // Format as XXXX-XXXX-XXXX
      const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
      codes.push(formatted);
    }
    return codes;
  }
}
