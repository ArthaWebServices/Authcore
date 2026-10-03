/**
 * Generate a cryptographically secure random string
 */
export declare function generateRandomString(length?: number): string;
/**
 * Generate a cryptographically secure random hex string
 */
export declare function generateRandomHex(length?: number): string;
/**
 * Generate a URL-safe base64 string (no padding)
 */
export declare function generateUrlSafeBase64(bytes?: number): string;
/**
 * Hash a string using SHA-256
 */
export declare function sha256(input: string): string;
/**
 * Hash a string using SHA-256 and return base64url
 */
export declare function sha256Base64Url(input: string): string;
/**
 * Constant-time string comparison to prevent timing attacks
 */
export declare function timingSafeCompare(a: string, b: string): boolean;
/**
 * Generate a secure token with prefix
 */
export declare function generateToken(prefix: string, length?: number): string;
/**
 * Extract token prefix
 */
export declare function extractTokenPrefix(token: string): string | null;
/**
 * Parse a JWT token (without verification)
 */
export declare function parseJwt(token: string): {
    header: Record<string, unknown>;
    payload: Record<string, unknown>;
} | null;
/**
 * Check if a JWT is expired (without verification)
 */
export declare function isJwtExpired(token: string): boolean;
/**
 * Get time until JWT expiration in seconds
 */
export declare function getJwtTimeToExpiry(token: string): number | null;
/**
 * Deep clone an object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Omit keys from an object
 */
export declare function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
/**
 * Pick keys from an object
 */
export declare function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
/**
 * Flatten an object with dot notation
 */
export declare function flattenObject(obj: Record<string, unknown>, prefix?: string): Record<string, unknown>;
/**
 * Sanitize an object for logging (remove sensitive fields)
 */
export declare function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown>;
/**
 * Format date to ISO string
 */
export declare function toIsoString(date: Date | string | number): string;
/**
 * Parse duration string (e.g., "15m", "1h", "7d") to seconds
 */
export declare function parseDuration(duration: string): number;
/**
 * Format seconds to human readable duration
 */
export declare function formatDuration(seconds: number): string;
/**
 * Generate a slug from a string
 */
export declare function slugify(str: string): string;
/**
 * Validate email format
 */
export declare function isValidEmail(email: string): boolean;
/**
 * Normalize email (lowercase, trim)
 */
export declare function normalizeEmail(email: string): string;
/**
 * Mask email for display (e.g., j***@example.com)
 */
export declare function maskEmail(email: string): string;
/**
 * Mask IP address for display
 */
export declare function maskIp(ip: string): string;
/**
 * Sleep utility for async operations
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry a function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, options?: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
}): Promise<T>;
/**
 * Create a deferred promise
 */
export declare function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
};
//# sourceMappingURL=index.d.ts.map