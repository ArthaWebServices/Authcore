import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { randomBytes } from 'crypto';

const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF double-submit cookie pattern.
 * - On a state-changing request, require `x-csrf-token` header
 *   matching the value of the `csrf_token` cookie.
 * - Tokens are 32 bytes, base64url-encoded.
 */
async function csrfPlugin(app: FastifyInstance): Promise<void> {
  // Issue CSRF cookie on first read
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.cookies['csrf_token']) {
      const token = randomBytes(32).toString('base64url');
      reply.setCookie('csrf_token', token, {
        httpOnly: false, // JS must be able to read it
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24, // 24h
      });
    }
  });

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (SAFE_METHODS.has(request.method)) {
      return;
    }
    // Skip CSRF check for endpoints that use their own bearer-token auth (no cookies)
    if (request.headers.authorization?.startsWith('Bearer ')) {
      return;
    }
    const header = request.headers[CSRF_HEADER] as string | undefined;
    const cookie = request.cookies['csrf_token'] as string | undefined;
    if (!header || !cookie || header !== cookie) {
      return reply.status(403).send({
        error: 'CSRF token missing or invalid',
        code: 'CSRF_INVALID',
      });
    }
  });
}

export default fp(csrfPlugin, { name: 'csrf' });
