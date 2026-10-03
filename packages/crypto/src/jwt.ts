import { SignJWT, jwtVerify, importPKCS8, importSPKI, exportJWK, generateKeyPair, calculateJwkThumbprint } from 'jose';
import { ERROR_CODES, TOKEN_DEFAULTS, JWT_CLAIMS } from '@authcore/core';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';

// Web Crypto API types
interface JsonWebKey {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
  n?: string;
  e?: string;
  ext?: boolean;
  key_ops?: string[];
  [key: string]: unknown;
}

export interface JwtPayload {
  [JWT_CLAIMS.ISSUER]: string;
  [JWT_CLAIMS.SUBJECT]: string;
  [JWT_CLAIMS.AUDIENCE]: string | string[];
  [JWT_CLAIMS.EXPIRATION]: number;
  [JWT_CLAIMS.ISSUED_AT]: number;
  [JWT_CLAIMS.JWT_ID]: string;
  [JWT_CLAIMS.SESSION_ID]: string;
  [JWT_CLAIMS.EMAIL]: string;
  [JWT_CLAIMS.EMAIL_VERIFIED]: boolean;
  [JWT_CLAIMS.ROLES]: string[];
  [JWT_CLAIMS.PERMISSIONS]: string[];
  [JWT_CLAIMS.ORG_ID]?: string;
  [JWT_CLAIMS.MFA_VERIFIED]: boolean;
  [key: string]: unknown;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

let privateKey: crypto.KeyObject | null = null;
let publicKey: crypto.KeyObject | null = null;
let jwks: { keys: JsonWebKey[] } | null = null;

export async function initializeKeys(privateKeyPem: string, publicKeyPem: string): Promise<void> {
  privateKey = crypto.createPrivateKey({ key: privateKeyPem, format: 'pem', type: 'pkcs8' });
  publicKey = crypto.createPublicKey({ key: publicKeyPem, format: 'pem', type: 'spki' });
  
  const publicKeyJwk = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publicKeyJwk);
  
  jwks = {
    keys: [{
      ...publicKeyJwk,
      kid,
      use: 'sig',
      alg: 'RS256',
    }],
  };
}

export function getJwks(): { keys: JsonWebKey[] } {
  if (!jwks) {
    throw new Error('Keys not initialized. Call initializeKeys first.');
  }
  return jwks;
}

export function getPrivateKey(): crypto.KeyObject {
  if (!privateKey) {
    throw new Error('Private key not initialized. Call initializeKeys first.');
  }
  return privateKey;
}

export function getPublicKey(): crypto.KeyObject {
  if (!publicKey) {
    throw new Error('Public key not initialized. Call initializeKeys first.');
  }
  return publicKey;
}

export async function generateAccessToken(
  payload: Omit<JwtPayload, typeof JWT_CLAIMS.EXPIRATION | typeof JWT_CLAIMS.ISSUED_AT | typeof JWT_CLAIMS.JWT_ID>,
  ttl: number = TOKEN_DEFAULTS.ACCESS_TOKEN_TTL
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  
  const token = await new SignJWT({ ...payload, [JWT_CLAIMS.JWT_ID]: jti })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(getPrivateKey());
  
  return token;
}

export async function verifyAccessToken(token: string, issuer: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getPublicKey(), {
    issuer,
    algorithms: ['RS256'],
  });
  
  return payload as unknown as JwtPayload;
}

export function decodeAccessToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as JwtPayload;
  } catch {
    return null;
  }
}

export async function generateRefreshToken(): Promise<string> {
  return crypto.randomBytes(32).toString('base64url');
}

export async function hashRefreshToken(token: string): Promise<string> {
  const { hash } = await import('@node-rs/bcrypt');
  return hash(token, 12);
}

export async function verifyRefreshToken(token: string, hash: string): Promise<boolean> {
  const { verify } = await import('@node-rs/bcrypt');
  return verify(token, hash);
}

export async function generateTokenPair(
  payload: Omit<JwtPayload, typeof JWT_CLAIMS.EXPIRATION | typeof JWT_CLAIMS.ISSUED_AT | typeof JWT_CLAIMS.JWT_ID>,
  accessTokenTtl: number = TOKEN_DEFAULTS.ACCESS_TOKEN_TTL,
  refreshTokenTtl: number = TOKEN_DEFAULTS.REFRESH_TOKEN_TTL
): Promise<TokenPair> {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await generateAccessToken(payload, accessTokenTtl);
  const refreshToken = await generateRefreshToken();
  
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: now + accessTokenTtl,
    refreshTokenExpiresAt: now + refreshTokenTtl,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const { hash } = await import('@node-rs/argon2');
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const { verify } = await import('@node-rs/argon2');
  return verify(hash, password);
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotpCode(secret: string, code: string, window: number = 1): boolean {
  return authenticator.check(code, secret);
}

export function getTotpUri(secret: string, email: string, issuer: string = 'AuthCore'): string {
  return authenticator.keyuri(email, issuer, secret);
}

export async function encryptData(data: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = Buffer.from(key, 'base64');
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(data)
  );
  
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);
  
  return Buffer.from(result).toString('base64');
}

export async function decryptData(encryptedData: string, key: string): Promise<string> {
  const decoder = new TextDecoder();
  const keyData = Buffer.from(key, 'base64');
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const data = Buffer.from(encryptedData, 'base64');
  const iv = data.slice(0, 12);
  const encrypted = data.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  );
  
  return decoder.decode(decrypted);
}

export async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
  const prefix = 'ak_' + crypto.randomBytes(4).toString('hex');
  const key = prefix + '_' + crypto.randomBytes(24).toString('base64url');
  const hash = await hashPassword(key);
  return { key, prefix, hash };
}
