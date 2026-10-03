// AuthCore Constants
export const ERROR_CODES = {
    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    // Authentication
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    TOKEN_REVOKED: 'TOKEN_REVOKED',
    TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
    MFA_REQUIRED: 'MFA_REQUIRED',
    // Resources
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    // Rate limiting
    RATE_LIMITED: 'RATE_LIMITED',
    // OAuth
    OAUTH_ERROR: 'OAUTH_ERROR',
    OAUTH_PROVIDER_ERROR: 'OAUTH_PROVIDER_ERROR',
    OAUTH_ACCOUNT_LINKED: 'OAUTH_ACCOUNT_LINKED',
    OAUTH_ACCOUNT_NOT_LINKED: 'OAUTH_ACCOUNT_NOT_LINKED',
    // MFA
    MFA_INVALID_CODE: 'MFA_INVALID_CODE',
    MFA_INVALID_BACKUP_CODE: 'MFA_INVALID_BACKUP_CODE',
    MFA_NOT_ENABLED: 'MFA_NOT_ENABLED',
    MFA_ALREADY_ENABLED: 'MFA_ALREADY_ENABLED',
    WEBAUTHN_REGISTRATION_FAILED: 'WEBAUTHN_REGISTRATION_FAILED',
    WEBAUTHN_AUTHENTICATION_FAILED: 'WEBAUTHN_AUTHENTICATION_FAILED',
    // Sessions
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    SESSION_REVOKED: 'SESSION_REVOKED',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    // Users
    USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    USER_DELETED: 'USER_DELETED',
    // Organizations
    ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
    ORGANIZATION_SLUG_TAKEN: 'ORGANIZATION_SLUG_TAKEN',
    MEMBERSHIP_NOT_FOUND: 'MEMBERSHIP_NOT_FOUND',
    MEMBERSHIP_ALREADY_EXISTS: 'MEMBERSHIP_ALREADY_EXISTS',
    CANNOT_REMOVE_OWNER: 'CANNOT_REMOVE_OWNER',
    CANNOT_LEAVE_ORG: 'CANNOT_LEAVE_ORG',
    // Roles & Permissions
    ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
    PERMISSION_NOT_FOUND: 'PERMISSION_NOT_FOUND',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    // API Keys
    API_KEY_NOT_FOUND: 'API_KEY_NOT_FOUND',
    API_KEY_EXPIRED: 'API_KEY_EXPIRED',
    API_KEY_REVOKED: 'API_KEY_REVOKED',
    // Webhooks
    WEBHOOK_NOT_FOUND: 'WEBHOOK_NOT_FOUND',
    WEBHOOK_DELIVERY_FAILED: 'WEBHOOK_DELIVERY_FAILED',
    // Email
    EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
    EMAIL_TEMPLATE_NOT_FOUND: 'EMAIL_TEMPLATE_NOT_FOUND',
    // Verification
    VERIFICATION_TOKEN_INVALID: 'VERIFICATION_TOKEN_INVALID',
    VERIFICATION_TOKEN_EXPIRED: 'VERIFICATION_TOKEN_EXPIRED',
    VERIFICATION_TOKEN_USED: 'VERIFICATION_TOKEN_USED',
    // Password
    PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
    PASSWORD_REUSED: 'PASSWORD_REUSED',
    PASSWORD_RESET_TOKEN_INVALID: 'PASSWORD_RESET_TOKEN_INVALID',
    PASSWORD_RESET_TOKEN_EXPIRED: 'PASSWORD_RESET_TOKEN_EXPIRED',
    // Internal
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    REDIS_ERROR: 'REDIS_ERROR',
    ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
};
export const EVENT_TYPES = {
    // User events
    'user.register': 'user.register',
    'user.login': 'user.login',
    'user.logout': 'user.logout',
    'user.logout_all': 'user.logout_all',
    'user.profile_update': 'user.profile_update',
    'user.email_change': 'user.email_change',
    'user.email_verified': 'user.email_verified',
    'user.password_change': 'user.password_change',
    'user.password_reset': 'user.password_reset',
    'user.delete': 'user.delete',
    'user.lock': 'user.lock',
    'user.unlock': 'user.unlock',
    // Session events
    'session.create': 'session.create',
    'session.refresh': 'session.refresh',
    'session.revoke': 'session.revoke',
    'session.revoke_all': 'session.revoke_all',
    'session.reuse_detected': 'session.reuse_detected',
    // MFA events
    'mfa.totp.enable': 'mfa.totp.enable',
    'mfa.totp.disable': 'mfa.totp.disable',
    'mfa.webauthn.register': 'mfa.webauthn.register',
    'mfa.webauthn.authenticate': 'mfa.webauthn.authenticate',
    'mfa.backup_codes.generate': 'mfa.backup_codes.generate',
    'mfa.backup_codes.use': 'mfa.backup_codes.use',
    // OAuth events
    'oauth.link': 'oauth.link',
    'oauth.unlink': 'oauth.unlink',
    'oauth.login': 'oauth.login',
    // Organization events
    'organization.create': 'organization.create',
    'organization.update': 'organization.update',
    'organization.delete': 'organization.delete',
    'organization.member.invite': 'organization.member.invite',
    'organization.member.add': 'organization.member.add',
    'organization.member.remove': 'organization.member.remove',
    'organization.member.role_change': 'organization.member.role_change',
    'organization.domain.verify': 'organization.domain.verify',
    // API Key events
    'api_key.create': 'api_key.create',
    'api_key.revoke': 'api_key.revoke',
    'api_key.use': 'api_key.use',
    // Admin events
    'admin.user.impersonate': 'admin.user.impersonate',
    'admin.user.update': 'admin.user.update',
    'admin.user.delete': 'admin.user.delete',
};
export const JWT_CLAIMS = {
    ISSUER: 'iss',
    SUBJECT: 'sub',
    AUDIENCE: 'aud',
    EXPIRATION: 'exp',
    ISSUED_AT: 'iat',
    JWT_ID: 'jti',
    SESSION_ID: 'sid',
    EMAIL: 'email',
    EMAIL_VERIFIED: 'email_verified',
    ROLES: 'roles',
    PERMISSIONS: 'permissions',
    ORG_ID: 'org_id',
    MFA_VERIFIED: 'mfa_verified',
};
export const TOKEN_DEFAULTS = {
    ACCESS_TOKEN_TTL: 900, // 15 minutes
    REFRESH_TOKEN_TTL: 2592000, // 30 days
    VERIFICATION_TOKEN_TTL: 3600, // 1 hour
    PASSWORD_RESET_TOKEN_TTL: 3600, // 1 hour
    MAGIC_LINK_TOKEN_TTL: 900, // 15 minutes
    API_KEY_PREFIX_LENGTH: 8,
    BACKUP_CODE_COUNT: 10,
    BACKUP_CODE_LENGTH: 8,
};
export const RATE_LIMIT_DEFAULTS = {
    LOGIN_MAX: 5,
    LOGIN_WINDOW: 900, // 15 minutes
    REGISTER_MAX: 3,
    REGISTER_WINDOW: 3600, // 1 hour
    REFRESH_MAX: 10,
    REFRESH_WINDOW: 60, // 1 minute
    MFA_MAX: 5,
    MFA_WINDOW: 300, // 5 minutes
    OAUTH_MAX: 10,
    OAUTH_WINDOW: 300, // 5 minutes
    PASSWORD_RESET_MAX: 3,
    PASSWORD_RESET_WINDOW: 3600, // 1 hour
    EMAIL_VERIFICATION_MAX: 5,
    EMAIL_VERIFICATION_WINDOW: 3600, // 1 hour
};
export const MFA_DEFAULTS = {
    TOTP_ISSUER: 'AuthCore',
    TOTP_DIGITS: 6,
    TOTP_PERIOD: 30,
    WEBAUTHN_RP_NAME: 'AuthCore',
    WEBAUTHN_TIMEOUT: 60000,
};
export const PASSWORD_DEFAULTS = {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SYMBOL: true,
    MIN_ZXCVBN_SCORE: 3,
    HISTORY_COUNT: 5,
};
export const SESSION_DEFAULTS = {
    MAX_CONCURRENT_SESSIONS: 10,
    DEVICE_FINGERPRINT_ENABLED: true,
    IP_BINDING_ENABLED: false,
    TRUSTED_DEVICE_TTL: 2592000, // 30 days
};
export const OAUTH_PROVIDERS = {
    GOOGLE: 'google',
    GITHUB: 'github',
    MICROSOFT: 'microsoft',
    GITLAB: 'gitlab',
};
export const USER_STATUS = {
    ACTIVE: 'active',
    LOCKED: 'locked',
    DELETED: 'deleted',
    PENDING_VERIFICATION: 'pending_verification',
};
export const SESSION_STATUS = {
    ACTIVE: 'active',
    REVOKED: 'revoked',
    EXPIRED: 'expired',
};
export const WEBHOOK_DELIVERY_STATUS = {
    PENDING: 'pending',
    DELIVERED: 'delivered',
    FAILED: 'failed',
};
export const AUDIT_RISK_SCORE = {
    LOW: 0,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 90,
};
export const METADATA_VISIBILITY = {
    PUBLIC: 'public',
    PRIVATE: 'private',
    UNSAFE: 'unsafe',
};
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};
//# sourceMappingURL=index.js.map