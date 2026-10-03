// Utility functions for AuthCore

import { randomBytes, createHash, timingSafeEqual } from 'crypto';

/**
 * Generate a cryptographically secure random string
 */
export function generateRandomString(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Generate a cryptographically secure random hex string
 */
export function generateRandomHex(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a URL-safe base64 string (no padding)
 */
export function generateUrlSafeBase64(bytes: number = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Hash a string using SHA-256
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Hash a string using SHA-256 and return base64url
 */
export function sha256Base64Url(input: string): string {
  return createHash('sha256').update(input).digest('base64url');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

/**
 * Generate a secure token with prefix
 */
export function generateToken(prefix: string, length: number = 24): string {
  const randomPart = generateUrlSafeBase64(length);
  return `${prefix}_${randomPart}`;
}

/**
 * Extract token prefix
 */
export function extractTokenPrefix(token: string): string | null {
  const underscoreIndex = token.indexOf('_');
  if (underscoreIndex === -1) return null;
  return token.substring(0, underscoreIndex);
}

/**
 * Parse a JWT token (without verification)
 */
export function parseJwt(token: string): { header: Record<string, unknown>; payload: Record<string, unknown> } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    
    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Check if a JWT is expired (without verification)
 */
export function isJwtExpired(token: string): boolean {
  const parsed = parseJwt(token);
  if (!parsed) return true;
  
  const exp = parsed.payload.exp as number;
  if (!exp) return false;
  
  return Date.now() >= exp * 1000;
}

/**
 * Get time until JWT expiration in seconds
 */
export function getJwtTimeToExpiry(token: string): number | null {
  const parsed = parseJwt(token);
  if (!parsed) return null;
  
  const exp = parsed.payload.exp as number;
  if (!exp) return null;
  
  return Math.max(0, Math.floor((exp * 1000 - Date.now()) / 1000));
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Omit keys from an object
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Pick keys from an object
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Flatten an object with dot notation
 */
export function flattenObject(obj: Record<string, unknown>, prefix: string = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Sanitize an object for logging (remove sensitive fields)
 */
export function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'key', 'authorization', 'cookie', 'ssn', 'creditCard'];
  const result = deepClone(obj);
  
  function sanitize(o: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(o)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(s => lowerKey.includes(s))) {
        o[key] = '[REDACTED]';
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        sanitize(value as Record<string, unknown>);
      }
    }
  }
  
  sanitize(result);
  return result;
}

/**
 * Format date to ISO string
 */
export function toIsoString(date: Date | string | number): string {
  return new Date(date).toISOString();
}

/**
 * Parse duration string (e.g., "15m", "1h", "7d") to seconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Format seconds to human readable duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Generate a slug from a string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Mask email for display (e.g., j***@example.com)
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  
  const maskedLocal = local.length <= 2 
    ? '*'.repeat(local.length)
    : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  
  return `${maskedLocal}@${domain}`;
}

/**
 * Mask IP address for display
 */
export function maskIp(ip: string): string {
  if (ip.includes(':')) {
    // IPv6
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::****';
  } else {
    // IPv4
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.${parts[3]}`;
  }
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelay?: number; maxDelay?: number; shouldRetry?: (error: unknown) => boolean } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 1000, maxDelay = 10000, shouldRetry = () => true } = options;
  
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Create a deferred promise
 */
export function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve, reject };
}
