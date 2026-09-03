import { Counter, Histogram, Gauge, register } from 'prom-client';

// Auth operation counters
export const authOperationsTotal = new Counter({
  name: 'authcore_auth_operations_total',
  help: 'Total number of authentication operations',
  labelNames: ['operation', 'status'] as const,
  registers: [register],
});

// HTTP request duration
export const httpRequestDuration = new Histogram({
  name: 'authcore_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Active sessions gauge
export const activeSessionsGauge = new Gauge({
  name: 'authcore_active_sessions_total',
  help: 'Number of currently active sessions',
  registers: [register],
});

// Email operations counter
export const emailOperationsTotal = new Counter({
  name: 'authcore_email_operations_total',
  help: 'Total number of email operations',
  labelNames: ['operation', 'status'] as const,
  registers: [register],
});

// Rate limit hits counter
export const rateLimitHitsTotal = new Counter({
  name: 'authcore_ratelimit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['route', 'ip'] as const,
  registers: [register],
});
