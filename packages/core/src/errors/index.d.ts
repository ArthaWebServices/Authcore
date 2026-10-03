export declare class AuthError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: Record<string, unknown>;
    constructor(code: string, message: string, statusCode?: number, details?: Record<string, unknown>);
}
export declare class ValidationError extends AuthError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class AuthenticationError extends AuthError {
    constructor(message?: string, details?: Record<string, unknown>);
}
export declare class AuthorizationError extends AuthError {
    constructor(message?: string, details?: Record<string, unknown>);
}
export declare class NotFoundError extends AuthError {
    constructor(resource?: string);
}
export declare class ConflictError extends AuthError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class RateLimitError extends AuthError {
    constructor(message?: string, retryAfter?: number);
}
export declare class TokenError extends AuthError {
    constructor(code: string, message: string, details?: Record<string, unknown>);
}
export declare class TokenExpiredError extends TokenError {
    constructor(details?: Record<string, unknown>);
}
export declare class TokenRevokedError extends TokenError {
    constructor(details?: Record<string, unknown>);
}
export declare class TokenReuseDetectedError extends TokenError {
    constructor(details?: Record<string, unknown>);
}
export declare class MfaRequiredError extends AuthError {
    constructor(message?: string, details?: Record<string, unknown>);
}
export declare class AccountLockedError extends AuthError {
    constructor(lockedUntil: Date, details?: Record<string, unknown>);
}
export declare class EmailNotVerifiedError extends AuthError {
    constructor(details?: Record<string, unknown>);
}
export declare class OAuthError extends AuthError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class InternalError extends AuthError {
    constructor(message?: string, details?: Record<string, unknown>);
}
export declare function isAuthError(error: unknown): error is AuthError;
export declare function toAuthError(error: unknown): AuthError;
//# sourceMappingURL=index.d.ts.map