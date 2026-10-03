import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { WebAuthnService } from './webauthn.service';
import { AuthService } from '@modules/auth/auth.service';
import { createValidatorHook } from '@plugins/validation';
import { requireAuth } from '@modules/auth/auth.middleware';
import { NotFoundError } from '@shared/errors';

const webauthnSetupSchema = z.object({ deviceName: z.string().optional() });
const webauthnVerifySchema = z.object({
  challenge: z.string(),
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      attestationObject: z.string(),
      clientDataJSON: z.string(),
    }),
    type: z.literal('public-key'),
  }),
});
const webauthnAuthenticateSchema = z.object({});
const webauthnCompleteAuthSchema = z.object({
  assertion: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal('public-key'),
  }),
});
const webauthnDeleteCredentialSchema = z.object({ credentialId: z.string().uuid() });

export interface WebAuthnControllerDeps {
  webauthnService: WebAuthnService;
  authService: AuthService;
}

export async function webauthnRoutes(fastify: FastifyInstance, deps: WebAuthnControllerDeps): Promise<void> {
  const { webauthnService, authService } = deps;

  // POST /auth/webauthn/setup — begin passkey registration
  fastify.post(
    '/auth/webauthn/setup',
    { preHandler: [requireAuth(authService), createValidatorHook({ body: webauthnSetupSchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const body = request.validatedBody as z.infer<typeof webauthnSetupSchema>;
      const result = await webauthnService.beginRegistration(userId, body.deviceName);
      return reply.send({ ...result.options });
    },
  );

  // POST /auth/webauthn/verify — complete passkey registration
  fastify.post(
    '/auth/webauthn/verify',
    { preHandler: [requireAuth(authService), createValidatorHook({ body: webauthnVerifySchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const { challenge, credential } = request.validatedBody as z.infer<typeof webauthnVerifySchema>;
      const saved = await webauthnService.completeRegistration(userId, challenge, credential);
      return reply.send({
        message: 'Passkey registered successfully.',
        credential: {
          id: saved.id,
          name: saved.name,
          deviceType: saved.deviceType,
          createdAt: saved.createdAt,
        },
      });
    },
  );

  // POST /auth/webauthn/authenticate-options — get auth options (user must be logged in first)
  fastify.post(
    '/auth/webauthn/authenticate-options',
    { preHandler: [requireAuth(authService), createValidatorHook({ body: webauthnAuthenticateSchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      try {
        const options = await webauthnService.beginAuthentication(userId);
        return reply.send({ ...options });
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw err;
        }
        throw err;
      }
    },
  );

  // POST /auth/webauthn/authenticate-verify — verify auth assertion
  fastify.post(
    '/auth/webauthn/authenticate-verify',
    { preHandler: [requireAuth(authService), createValidatorHook({ body: webauthnCompleteAuthSchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const { assertion } = request.validatedBody as z.infer<typeof webauthnCompleteAuthSchema>;
      await webauthnService.completeAuthentication(userId, assertion);
      return reply.send({ message: 'WebAuthn authentication successful.' });
    },
  );

  // GET /auth/webauthn/credentials — list user's passkeys
  fastify.get(
    '/auth/webauthn/credentials',
    { preHandler: [requireAuth(authService)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const credentials = await webauthnService.listCredentials(userId);
      return reply.send({ credentials });
    },
  );

  // DELETE /auth/webauthn/credentials/:id — delete a passkey
  fastify.delete(
    '/auth/webauthn/credentials/:id',
    { preHandler: [requireAuth(authService), createValidatorHook({ body: webauthnDeleteCredentialSchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: userId } = (request as FastifyRequest & { user: { id: string } }).user;
      const { credentialId } = request.validatedBody as z.infer<typeof webauthnDeleteCredentialSchema>;
      await webauthnService.deleteCredential(userId, credentialId);
      return reply.send({ message: 'Passkey deleted.' });
    },
  );
}
