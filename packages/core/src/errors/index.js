// Error classes for AuthCore
export class AuthError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode = 400, details) {
        super(message);
        this.name = 'AuthError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
export class ValidationError extends AuthError {
    constructor(message, details) {
        super('VALIDATION_ERROR', message, 400, details);
        this.name = 'ValidationError';
    }
}
export class AuthenticationError extends AuthError {
    constructor(message = 'Authentication required', details) {
        super('AUTHENTICATION_ERROR', message, 401, details);
        this.name = 'AuthenticationError';
    }
}
export class AuthorizationError extends AuthError {
    constructor(message = 'Insufficient permissions', details) {
        super('AUTHORIZATION_ERROR', message, 403, details);
        this.name = 'AuthorizationError';
    }
}
export class NotFoundError extends AuthError {
    constructor(resource = 'Resource') {
        super('NOT_FOUND', `${resource} not found`, 404);
        this.name = 'NotFoundError';
    }
}
export class ConflictError extends AuthError {
    constructor(message, details) {
        super('CONFLICT', message, 409, details);
        this.name = 'ConflictError';
    }
}
export class RateLimitError extends AuthError {
    constructor(message = 'Too many requests', retryAfter) {
        super('RATE_LIMITED', message, 429, { retryAfter });
        this.name = 'RateLimitError';
    }
}
export class TokenError extends AuthError {
    constructor(code, message, details) {
        super(code, message, 401, details);
        this.name = 'TokenError';
    }
}
export class TokenExpiredError extends TokenError {
    constructor(details) {
        super('TOKEN_EXPIRED', 'Access token expired', details);
        this.name = 'TokenExpiredError';
    }
}
export class TokenRevokedError extends TokenError {
    constructor(details) {
        super('TOKEN_REVOKED', 'Session revoked', details);
        this.name = 'TokenRevokedError';
    }
}
export class TokenReuseDetectedError extends TokenError {
    constructor(details) {
        super('TOKEN_REUSE_DETECTED', 'Security violation: token reuse detected', details);
        this.name = 'TokenReuseDetectedError';
    }
}
export class MfaRequiredError extends AuthError {
    constructor(message = 'MFA verification required', details) {
        super('MFA_REQUIRED', message, 403, details);
        this.name = 'MfaRequiredError';
    }
}
export class AccountLockedError extends AuthError {
    constructor(lockedUntil, details) {
        super('ACCOUNT_LOCKED', 'Account temporarily locked', 403, { lockedUntil, ...details });
        this.name = 'AccountLockedError';
    }
}
export class EmailNotVerifiedError extends AuthError {
    constructor(details) {
        super('EMAIL_NOT_VERIFIED', 'Please verify your email address', 403, details);
        this.name = 'EmailNotVerifiedError';
    }
}
export class OAuthError extends AuthError {
    constructor(message, details) {
        super('OAUTH_ERROR', message, 400, details);
        this.name = 'OAuthError';
    }
}
export class InternalError extends AuthError {
    constructor(message = 'Internal server error', details) {
        super('INTERNAL_ERROR', message, 500, details);
        this.name = 'InternalError';
    }
}
export function isAuthError(error) {
    return error instanceof AuthError;
}
export function toAuthError(error) {
    if (isAuthError(error)) {
        return error;
    }
    if (error instanceof Error) {
        return new InternalError(error.message);
    }
    return new InternalError('Unknown error');
}
//# sourceMappingURL=index.js.map