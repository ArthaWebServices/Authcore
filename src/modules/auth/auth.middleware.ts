import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { AuthService } from './auth.service';
import { AuthenticationError } from '@shared/errors';

/** JWT Bearer token verifier — attaches userId + sessionId to request */
export function requireAuth(authService: AuthService) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid Authorization header');
    }
    const token = authHeader.slice(7);
    try {
      const payload = await authService.verifyAccessToken(token);
      (request as FastifyRequest & { user: { id: string; sessionId: string } }).user = {
        id: payload.sub,
        sessionId: payload.sid,
      };
    } catch {
      throw new AuthenticationError('Invalid or expired access token');
    }
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      sessionId: string;
    };
  }
}
