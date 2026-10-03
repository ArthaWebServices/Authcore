import { z } from 'zod';
import { PASSWORD_DEFAULTS, ERROR_CODES } from '@authcore/core';

// Email validation
export const emailSchema = z.string().email().toLowerCase().trim();
export const optionalEmailSchema = emailSchema.optional();

// Password validation
export const passwordSchema = z
  .string()
  .min(PASSWORD_DEFAULTS.MIN_LENGTH, `Password must be at least ${PASSWORD_DEFAULTS.MIN_LENGTH} characters`)
  .max(PASSWORD_DEFAULTS.MAX_LENGTH, `Password must not exceed ${PASSWORD_DEFAULTS.MAX_LENGTH} characters`)
  .refine(
    (password) => !PASSWORD_DEFAULTS.REQUIRE_UPPERCASE || /[A-Z]/.test(password),
    { message: 'Password must contain at least one uppercase letter' }
  )
  .refine(
    (password) => !PASSWORD_DEFAULTS.REQUIRE_LOWERCASE || /[a-z]/.test(password),
    { message: 'Password must contain at least one lowercase letter' }
  )
  .refine(
    (password) => !PASSWORD_DEFAULTS.REQUIRE_NUMBER || /\d/.test(password),
    { message: 'Password must contain at least one number' }
  )
  .refine(
    (password) => !PASSWORD_DEFAULTS.REQUIRE_SYMBOL || /[!@#$%^&*(),.?":{}|<>]/.test(password),
    { message: 'Password must contain at least one special character' }
  );

// Name validation
export const nameSchema = z.string().min(1).max(255).trim();

// Username/slug validation
export const slugSchema = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens').trim();

// URL validation
export const urlSchema = z.string().url();

// IP address validation
export const ipAddressSchema = z.string().ip({ version: 'v4' });
export const ipAddressV6Schema = z.string().ip({ version: 'v6' });

// UUID validation
export const uuidSchema = z.string().uuid();

// Date validation
export const isoDateSchema = z.string().datetime();
export const optionalIsoDateSchema = isoDateSchema.optional();

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const paginationResponseSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type PaginationResponse = z.infer<typeof paginationResponseSchema>;

// Auth request schemas
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: nameSchema.optional(),
  redirectUrl: urlSchema.optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  mfaCode: z.string().optional(),
  mfaBackupCode: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const logoutSchema = z.object({
  everywhere: z.boolean().optional(),
  sessionId: uuidSchema.optional(),
});

export type LogoutInput = z.infer<typeof logoutSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  redirectUrl: urlSchema.optional(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  fullName: nameSchema.optional(),
  avatarUrl: urlSchema.optional(),
  locale: z.string().min(2).max(10).optional(),
  timezone: z.string().min(1).max(50).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// MFA schemas
export const setupTotpSchema = z.object({});

export const verifyTotpSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
});

export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>;

export const disableMfaSchema = z.object({
  password: z.string().min(1),
  code: z.string().optional(),
  backupCode: z.string().optional(),
});

export type DisableMfaInput = z.infer<typeof disableMfaSchema>;

export const backupCodesSchema = z.object({});

// WebAuthn schemas
export const webauthnRegisterStartSchema = z.object({
  nickname: z.string().max(50).optional(),
});

export type WebAuthnRegisterStartInput = z.infer<typeof webauthnRegisterStartSchema>;

export const webauthnRegisterFinishSchema = z.object({
  credential: z.any(),
  nickname: z.string().max(50).optional(),
});

export type WebAuthnRegisterFinishInput = z.infer<typeof webauthnRegisterFinishSchema>;

export const webauthnAuthenticateStartSchema = z.object({});

export const webauthnAuthenticateFinishSchema = z.object({
  credential: z.any(),
});

export type WebAuthnAuthenticateFinishInput = z.infer<typeof webauthnAuthenticateFinishSchema>;

// OAuth schemas
export const oauthLinkSchema = z.object({
  provider: z.enum(['google', 'github', 'microsoft', 'gitlab']),
  code: z.string().min(1),
  redirectUrl: urlSchema.optional(),
});

export type OAuthLinkInput = z.infer<typeof oauthLinkSchema>;

export const oauthUnlinkSchema = z.object({
  provider: z.enum(['google', 'github', 'microsoft', 'gitlab']),
  password: z.string().min(1),
});

export type OAuthUnlinkInput = z.infer<typeof oauthUnlinkSchema>;

// Session schemas
export const sessionListSchema = z.object({
  ...paginationSchema.shape,
  activeOnly: z.boolean().optional(),
});

export type SessionListInput = z.infer<typeof sessionListSchema>;

export const revokeSessionSchema = z.object({
  sessionId: uuidSchema,
});

export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;

// Organization schemas
export const createOrganizationSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: z.string().max(1000).optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  roleId: uuidSchema,
  redirectUrl: urlSchema.optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const updateMemberRoleSchema = z.object({
  roleId: uuidSchema,
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const removeMemberSchema = z.object({
  userId: uuidSchema,
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

// Role schemas
export const createRoleSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  permissionIds: z.array(uuidSchema).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  permissionIds: z.array(uuidSchema).optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// Permission schemas
export const createPermissionSchema = z.object({
  name: z.string().min(1).max(128).regex(/^[a-z]+:[a-z]+$/, 'Permission must be in format "resource:action"'),
  description: z.string().max(500).optional(),
  resource: z.string().min(1).max(64),
  action: z.string().min(1).max(64),
});

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;

// API Key schemas
export const createApiKeySchema = z.object({
  name: nameSchema,
  permissions: z.array(z.string()).optional(),
  expiresAt: isoDateSchema.optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const updateApiKeySchema = z.object({
  name: nameSchema.optional(),
  permissions: z.array(z.string()).optional(),
  expiresAt: isoDateSchema.optional(),
  revoked: z.boolean().optional(),
});

export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;

// Webhook schemas
export const createWebhookSchema = z.object({
  name: nameSchema,
  url: urlSchema,
  events: z.array(z.string()).min(1),
  secret: z.string().optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  name: nameSchema.optional(),
  url: urlSchema.optional(),
  events: z.array(z.string()).optional(),
  secret: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// Audit log schemas
export const auditLogQuerySchema = z.object({
  ...paginationSchema.shape,
  userId: uuidSchema.optional(),
  eventType: z.string().optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  minRiskScore: z.number().int().min(0).max(100).optional(),
  maxRiskScore: z.number().int().min(0).max(100).optional(),
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;

// Admin schemas
export const adminUserQuerySchema = z.object({
  ...paginationSchema.shape,
  query: z.string().optional(),
  status: z.enum(['active', 'locked', 'deleted', 'pending_verification']).optional(),
  mfaEnabled: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  hasPassword: z.boolean().optional(),
  organizationId: uuidSchema.optional(),
  roleId: uuidSchema.optional(),
  createdAfter: isoDateSchema.optional(),
  createdBefore: isoDateSchema.optional(),
});

export type AdminUserQueryInput = z.infer<typeof adminUserQuerySchema>;

export const adminUpdateUserSchema = z.object({
  email: emailSchema.optional(),
  fullName: nameSchema.optional(),
  status: z.enum(['active', 'locked', 'deleted']).optional(),
  emailVerified: z.boolean().optional(),
  mfaEnabled: z.boolean().optional(),
  roles: z.array(z.object({
    organizationId: uuidSchema,
    roleId: uuidSchema,
  })).optional(),
});

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export const adminImpersonateSchema = z.object({
  userId: uuidSchema,
  ttl: z.number().int().positive().max(3600).optional(),
});

export type AdminImpersonateInput = z.infer<typeof adminImpersonateSchema>;

// Metadata schemas
export const publicMetadataSchema = z.record(z.unknown());
export const privateMetadataSchema = z.record(z.unknown());
export const unsafeMetadataSchema = z.record(z.unknown());

export const metadataSchema = z.object({
  publicMetadata: publicMetadataSchema.optional(),
  privateMetadata: privateMetadataSchema.optional(),
  unsafeMetadata: unsafeMetadataSchema.optional(),
});

export type MetadataInput = z.infer<typeof metadataSchema>;

// Rate limit schemas
export const rateLimitConfigSchema = z.object({
  max: z.number().int().positive(),
  window: z.number().int().positive(),
});

export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;

// Email schemas
export const emailTemplateSchema = z.object({
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  text: z.string().optional(),
  variables: z.record(z.string()).optional(),
});

export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;

// Common response schemas
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export const apiErrorSchema = z.object({
  code: z.nativeEnum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

// Utility function to create a standard API response schema
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.union([
    successResponseSchema(dataSchema),
    errorResponseSchema,
  ]);
}
