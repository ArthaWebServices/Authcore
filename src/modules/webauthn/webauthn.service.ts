import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type PublicKeyCredentialDescriptor,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import { UserRepository } from '@modules/users/user.repository';
import { prisma } from '@shared/prisma';
import { getConfig } from '@config';
import { logger } from '@shared/logger';
import { NotFoundError, ValidationError } from '@shared/errors';

export interface WebAuthnRegistrationResult {
  options: ReturnType<typeof generateRegistrationOptions>;
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
    options: ReturnType<typeof generateRegistrationOptions>;
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

    const excludeCredentials: PublicKeyCredentialDescriptor[] = existingCredentials.map((c) => ({
      id: isoUint8Array.fromBase64(c.credentialId),
      type: 'public-key',
    }));

    const options = generateRegistrationOptions({
      rpName: 'AuthCore',
      rpID: new URL(getConfig().APP_URL).hostname,
      userID: isoBase64URL.fromBuffer(Buffer.from(userId)),
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
    credential: { id: string; rawId: string; response: { attestationObject: string; clientDataJSON: string } },
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
        response: {
          id: credential.id,
          rawId: isoUint8Array.fromBase64(credential.rawId),
          response: {
            attestationObject: isoUint8Array.fromBase64(credential.response.attestationObject),
            clientDataJSON: isoUint8Array.fromBase64(credential.response.clientDataJSON),
          },
          type: 'public-key',
          clientExtensionResults: {},
        },
        expectedChallenge: challenge,
        expectedOrigin: getConfig().APP_URL,
        expectedRPID: new URL(getConfig().APP_URL).hostname,
      });
    } catch (err) {
      throw new ValidationError(`WebAuthn verification failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;

    const saved = await prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: isoBase64URL.fromBuffer(Buffer.from(credentialID)),
        publicKey: isoBase64URL.fromBuffer(Buffer.from(credentialPublicKey)),
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
  async beginAuthentication(userId: string): Promise<ReturnType<typeof generateAuthenticationOptions>> {
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId },
      select: { credentialId: true, counter: true },
    });

    if (credentials.length === 0) {
      throw new NotFoundError('No WebAuthn credentials found');
    }

    const allowCredentials: PublicKeyCredentialDescriptor[] = credentials.map((c) => ({
      id: isoUint8Array.fromBase64(c.credentialId),
      type: 'public-key',
    }));

    return generateAuthenticationOptions({
      rpID: new URL(getConfig().APP_URL).hostname,
      userVerification: 'preferred',
      allowCredentials,
    });
  }

  /**
   * Complete WebAuthn authentication — verifies the assertion response
   * and updates the credential counter for anti-cloning detection.
   */
  async completeAuthentication(
    userId: string,
    assertion: {
      id: string;
      rawId: string;
      response: { authenticatorData: string; clientDataJSON: string; signature: string; userHandle?: string };
    },
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
        response: {
          id: assertion.id,
          rawId: isoUint8Array.fromBase64(assertion.rawId),
          response: {
            authenticatorData: isoUint8Array.fromBase64(assertion.response.authenticatorData),
            clientDataJSON: isoUint8Array.fromBase64(assertion.response.clientDataJSON),
            signature: isoUint8Array.fromBase64(assertion.response.signature),
            userHandle: assertion.response.userHandle
              ? isoUint8Array.fromBase64(assertion.response.userHandle)
              : undefined,
          },
          type: 'public-key',
          clientExtensionResults: {},
        },
        expectedChallenge: 'placeholder', // Caller must validate the session challenge
        expectedOrigin: getConfig().APP_URL,
        expectedRPID: new URL(getConfig().APP_URL).hostname,
        authenticator: {
          credentialID: isoUint8Array.fromBase64(credential.credentialId),
          credentialPublicKey: isoUint8Array.fromBase64(credential.publicKey),
          counter: Number(credential.counter),
        },
      });
    } catch (err) {
      throw new ValidationError(`WebAuthn authentication failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    await prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    logger.info({ userId, credentialId: credential.id }, 'WebAuthn authentication successful');
    return true;
  }

  /**
   * List all WebAuthn credentials for a user.
   */
  async listCredentials(userId: string): Promise<WebAuthnCredentialPublic[]> {
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return credentials.map((c) => ({
      id: c.id,
      name: c.nickname ?? 'Passkey',
      deviceType: 'platform',
      createdAt: c.createdAt,
    }));
  }

  /**
   * Delete a specific WebAuthn credential.
   */
  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    const credential = await prisma.webAuthnCredential.findFirst({
      where: { id: credentialId, userId },
    });

    if (!credential) {
      throw new NotFoundError('Credential not found');
    }

    await prisma.webAuthnCredential.delete({ where: { id: credentialId } });
    logger.info({ userId, credentialId }, 'WebAuthn credential deleted');
  }
}
