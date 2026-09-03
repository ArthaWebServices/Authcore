// Configuration module for AuthCore
// Validates all environment variables using Zod

import { z } from 'zod';

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().default(20),
  DATABASE_SSL: z.coerce.boolean().default(false),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_CLUSTER: z.coerce.boolean().default(false),
  REDIS_TLS: z.coerce.boolean().default(false),

  // JWT (RS256)
  JWT_PRIVATE_KEY: z.string().min(100),
  JWT_PUBLIC_KEY: z.string().min(50),
  JWT_ACCESS_TOKEN_TTL: z.coerce.number().default(900), // 15 minutes
  JWT_REFRESH_TOKEN_TTL: z.coerce.number().default(2592000), // 30 days
  JWT_ISSUER: z.string().url().default('https://auth.yourdomain.com'),
  JWT_AUDIENCE: z.string().url().default('api.yourdomain.com'),

  // Encryption (32-byte base64 keys)
  ENCRYPTION_KEY: z.string().length(44), // 32 bytes base64 = 44 chars
  OAUTH_ENCRYPTION_KEY: z.string().length(44),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(10),
  EMAIL_FROM: z.string().email().default('noreply@yourdomain.com'),
  EMAIL_REPLY_TO: z.string().email().default('support@yourdomain.com'),

  // OAuth Providers
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  GITLAB_CLIENT_ID: z.string().optional(),
  GITLAB_CLIENT_SECRET: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(5),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_REGISTER_MAX: z.coerce.number().default(3),
  RATE_LIMIT_REGISTER_WINDOW_MS: z.coerce.number().default(300000),

  // MFA
  MFA_TOTP_ISSUER: z.string().default('AuthCore'),
  MFA_BACKUP_CODES_COUNT: z.coerce.number().default(10),

  // Sessions
  MAX_CONCURRENT_SESSIONS: z.coerce.number().default(10),

  // Webhooks
  WEBHOOK_SECRET: z.string().min(20).default('whsec_dev_secret_change_in_production'),
  WEBHOOK_RETRY_MAX: z.coerce.number().default(3),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().default(5000),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  PROMETHEUS_PORT: z.coerce.number().default(9090),

  // Feature Flags
  FF_WEBAUTHN_ENABLED: z.coerce.boolean().default(true),
  FF_OAUTH_ENABLED: z.coerce.boolean().default(true),
  FF_ADMIN_API_ENABLED: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getConfig(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function resetConfig(): void {
  cachedEnv = null;
}
