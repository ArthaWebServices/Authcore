import * as crypto from 'crypto';

/**
 * Generate cryptographic keys for AuthCore:
 * - RS256 Key Pair for JWT signing & verification
 * - 32-byte base64 encryption keys for PII and OAuth tokens
 * - Random hex secret for webhooks
 */
function generateKeys() {
  console.log('Generating cryptographic keys for AuthCore...\n');

  // 1. Generate RSA key pair for JWT (RS256)
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Format PEM as single-line string with literal \n for .env
  const jwtPrivateKey = privateKey.replace(/\r?\n/g, '\\n');
  const jwtPublicKey = publicKey.replace(/\r?\n/g, '\\n');

  // 2. Generate 32-byte (256-bit) encryption keys (base64, 44 chars)
  const encryptionKey = crypto.randomBytes(32).toString('base64');
  const oauthEncryptionKey = crypto.randomBytes(32).toString('base64');

  // 3. Generate webhook secret
  const webhookSecret = 'whsec_' + crypto.randomBytes(24).toString('hex');

  console.log('Copy and paste the following into your .env file:\n');
  console.log('--------------------------------------------------');
  console.log(`JWT_PUBLIC_KEY="${jwtPublicKey}"\n`);
  console.log(`JWT_PRIVATE_KEY="${jwtPrivateKey}"\n`);
  console.log(`ENCRYPTION_KEY=${encryptionKey}`);
  console.log(`OAUTH_ENCRYPTION_KEY=${oauthEncryptionKey}`);
  console.log(`WEBHOOK_SECRET=${webhookSecret}`);
  console.log('--------------------------------------------------\n');
}

generateKeys();
