import { hash, verify, Algorithm } from '@node-rs/argon2';
import { hash as bcryptHash, verify as bcryptVerify } from '@node-rs/bcrypt';
import { z } from 'zod';

// Argon2id parameters following OWASP 2024 recommendations
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
};

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .refine((p) => /[a-z]/.test(p), 'Password must contain at least one lowercase letter')
  .refine((p) => /[A-Z]/.test(p), 'Password must contain at least one uppercase letter')
  .refine((p) => /\d/.test(p), 'Password must contain at least one digit')
  .refine((p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p), 'Password must contain at least one special character');

export type PasswordValidation = z.infer<typeof passwordSchema>;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

// For refresh token hashing (bcrypt is fine here, used for token integrity)
export async function hashToken(plain: string): Promise<string> {
  return bcryptHash(plain, 12);
}

export async function verifyToken(plain: string, hashed: string): Promise<boolean> {
  try {
    return await bcryptVerify(plain, hashed);
  } catch {
    return false;
  }
}

// Generate cryptographically secure random token
export function generateSecureToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return bufferToBase64Url(buffer);
}

export function bufferToBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('base64url');
}

export function generateNumericCode(length = 6): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => (b % 10).toString())
    .join('');
}
