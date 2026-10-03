import type { FastifyInstance } from 'fastify';
import { getConfig } from '@config';
import { createHash } from 'crypto';

/**
 * OIDC Discovery & JWKS endpoints (TASK-049)
 * - /.well-known/openid-configuration
 * - /.well-known/jwks.json
 *
 * Public endpoints — no auth required.
 */
export async function oidcRoutes(fastify: FastifyInstance): Promise<void> {
  const config = getConfig();

  // Discovery document
  fastify.get('/.well-known/openid-configuration', async () => ({
    issuer: config.JWT_ISSUER,
    authorization_endpoint: `${config.APP_URL}/auth/oauth/authorize`,
    token_endpoint: `${config.APP_URL}/auth/oauth/token`,
    userinfo_endpoint: `${config.APP_URL}/auth/oauth/userinfo`,
    jwks_uri: `${config.JWT_ISSUER}/.well-known/jwks.json`,
    registration_endpoint: `${config.APP_URL}/auth/oauth/register`,
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    response_types_supported: ['code', 'token', 'id_token', 'token id_token'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    subject_types_supported: ['public'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256', 'plain'],
    claims_supported: ['sub', 'email', 'email_verified', 'name', 'picture', 'iss', 'aud', 'iat', 'exp'],
  }));

  // JWKS — public key for verifying access tokens (RS256)
  fastify.get('/.well-known/jwks.json', async () => {
    const publicKey = config.JWT_PUBLIC_KEY;
    if (!publicKey) {
      return { keys: [] };
    }

    // Generate kid from the public key
    const kid = createHash('sha256').update(publicKey).digest('hex').slice(0, 16);

    // For PEM public keys, extract the modulus and exponent
    // Stubbed — real implementation parses the DER/PEM
    return {
      keys: [
        {
          kty: 'RSA',
          use: 'sig',
          alg: 'RS256',
          kid: `authcore-${kid}`,
          n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajN1czSbM9w7woc-HjQjM7a8d1WZ4d1d2-2DK0x4Vb5rcGmM8w1KuS0XmFfR8N9uqoQ8iJbqJe7VxJ5n9KX8xF7Xq-t9R7sE5K2pA', // placeholder
          e: 'AQAB',
        },
      ],
    };
  });
}
