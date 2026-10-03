import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { UserRepository } from '@modules/users/user.repository';
import { prisma } from '@shared/prisma';
import { getConfig } from '@config';
import { logger } from '@shared/logger';
import { NotFoundError, ValidationError } from '@shared/errors';

export interface WebAuthnRegistrationResult {
  options: any;
  challenge: string;
}

export interface WebAuthnCredentialPublic {
  id: string;
  name: string;
  deviceType: string;
  createdAt: Date;
}

export class WebAuthnService {
  private readonly userRepo: UserRepository;

  constructor(userRepo?: UserRepository) {
    this.userRepo = userRepo ?? new UserRepository();
  }

  /**
   * Begin WebAuthn registration — generates registration options
   * including a new challenge for the user to create a passkey.
   */
  async beginRegistration(userId: string, deviceName?: string): Promise<{
    options: any;
    challenge: string;
  }> {
    const user = await this.userRepo.findById(userId);
    if (!user || user.status === 'deleted') {
      throw new NotFoundError('User');
    }

    const existingCredentials = await prisma.webAuthnCredential.findMany({
      where: { userId },
      select: { credentialId: true, counter: true },
    });

    const excludeCredentials = existingCredentials.map((c) => ({
      id: c.credentialId,
      type: 'public-key' as const,
    }));

    const options = await generateRegistrationOptions({
      rpName: 'AuthCore',
      rpID: new URL(getConfig().APP_URL).hostname,
      userID: Buffer.from(userId),
      userName: user.email,
      userDisplayName: user.fullName ?? user.email,
      excludeCredentials,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        residentKey: 'preferred',
      },
    });

    // Store challenge in DB temporarily (expires in 5 min)
    await prisma.verificationToken.create({
      data: {
        identifier: userId,
        token: options.challenge,
        type: 'webauthn_registration',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    logger.info({ userId, deviceName }, 'WebAuthn registration initiated');

    return { options, challenge: options.challenge };
  }

  /**
   * Complete WebAuthn registration — verifies the attestation response
   * and stores the credential in the DB.
   */
  async completeRegistration(
    userId: string,
    challenge: string,
    credential: any,
  ): Promise<WebAuthnCredentialPublic> {
    const storedChallenge = await prisma.verificationToken.findFirst({
      where: {
        identifier: userId,
        token: challenge,
        type: 'webauthn_registration',
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedChallenge) {
      throw new ValidationError('Invalid or expired WebAuthn challenge');
    }

    await prisma.verificationToken.delete({ where: { id: storedChallenge.id } });

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: getConfig().APP_URL,
        expectedRPID: new URL(getConfig().APP_URL).hostname,
      });
    } catch (err) {
      throw new ValidationError(`WebAuthn verification failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new ValidationError('WebAuthn verification failed');
    }

    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

    const saved = await prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: typeof credentialID === 'string' ? credentialID : isoBase64URL.fromBuffer(credentialID),
        publicKey: isoBase64URL.fromBuffer(credentialPublicKey),
        counter: BigInt(counter),
        nickname: 'Passkey',
      },
    });

    logger.info({ userId, credentialId: saved.id }, 'WebAuthn credential registered');

    return {
      id: saved.id,
      name: saved.nickname ?? 'Passkey',
      deviceType: 'platform',
      createdAt: saved.createdAt,
    };
  }

  /**
   * Begin WebAuthn authentication — generates authentication options
   * allowing the user to select any of their registered passkeys.
   */
  async beginAuthentication(userId: string): Promise<any> {
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId },
      select: { credentialId: true, counter: true },
    });

    if (credentials.length === 0) {
      throw new NotFoundError('No WebAuthn credentials found');
    }

    const allowCredentials = credentials.map((c) => ({
      id: c.credentialId,
      type: 'public-key' as const,
    }));

    return generateAuthenticationOptions({
      rpID: new URL(getConfig().APP_URL).hostname,
      userVerification: 'preferred',
      allowCredentials,
    });
  }

  /**
   * Complete WebAuthn authentication — verifies the assertion response
   * and updates the credential counter.
   */
  async completeAuthentication(
    userId: string,
    assertion: any,
  ): Promise<boolean> {
    const credential = await prisma.webAuthnCredential.findFirst({
      where: { userId, credentialId: assertion.id },
    });

    if (!credential) {
      throw new NotFoundError('Credential not found');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: 'placeholder', // Caller must validate the session challenge
        expectedOrigin: getConfig().APP_URL,
        expectedRPID: new URL(getConfig().APP_URL).hostname,
        authenticator: {
          credentialID: credential.credentialId,
          credentialPublicKey: isoBase64URL.toBuffer(credential.publicKey),
          counter: Number(credential.counter),
        },
      });
    } catch (err) {
      throw new ValidationError(`WebAuthn authentication failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!verification.verified) {
      throw new ValidationError('WebAuthn authentication failed');
    }

    await prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
      },
    });

    logger.info({ userId, credentialId: credential.id }, 'WebAuthn authentication succeeded');

    return true;
  }

  async listCredentials(userId: string): Promise<WebAuthnCredentialPublic[]> {
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return credentials.map((c) => ({
      id: c.id,
      name: c.nickname ?? 'Passkey',
      deviceType: 'platform',
      createdAt: c.createdAt,
    }));
  }

  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    const cred = await prisma.webAuthnCredential.findFirst({
      where: { id: credentialId, userId },
    });

    if (!cred) {
      throw new NotFoundError('Credential');
    }

    await prisma.webAuthnCredential.delete({ where: { id: credentialId } });
    logger.info({ userId, credentialId }, 'WebAuthn credential deleted');
  }
}
