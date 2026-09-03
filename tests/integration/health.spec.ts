import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app';

describe('Health Endpoints Integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live should return ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('authcore');
  });

  it('GET /health/ready should return ok or degraded', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect([200, 503]).toContain(res.statusCode);
    const body = JSON.parse(res.body);
    expect(body.service).toBe('authcore');
    expect(body.checks).toHaveProperty('database');
    expect(body.checks).toHaveProperty('redis');
  });

  it('GET / should return app info', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('AuthCore');
    expect(body.version).toBe('1.0.0');
    expect(body.status).toBe('running');
  });
});
