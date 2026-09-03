// Structured logging with Pino and redaction for sensitive data

import pino from 'pino';
import { getConfig } from '../config';

const config = getConfig();

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.passwordHash',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.confirmPassword',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.accessToken',
  'req.body.secret',
  'req.body.clientSecret',
  'req.body.apiKey',
  'req.body.verificationToken',
  'req.body.resetToken',
  'req.body.mfaSecret',
  'req.body.backupCodes',
  'req.body.totpCode',
  'req.body.webauthnCredential',
  'res.headers["set-cookie"]',
  '*.passwordHash',
  '*.password',
  '*.token',
  '*.secret',
  '*.key',
  '*.apiKey',
];

export const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  transport:
    config.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'authcore',
    environment: config.NODE_ENV,
  },
});

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
