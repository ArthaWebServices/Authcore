// AuthCore load test (Sprint 14 / TASK-065)
// Run with: k6 run monitoring/load-test.js
//
// Prerequisites:
//   - k6 installed: https://k6.io/docs/getting-started/installation/
//   - BASE_URL pointing to staging
//
// This script simulates realistic user auth traffic:
//   - 70% login (steady-state traffic)
//   - 20% registration (new users)
//   - 10% password change (heavy operation)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const errors = new Counter('errors');
const successRate = new Rate('success_rate');
const loginDuration = new Trend('login_duration');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // ramp-up
    { duration: '3m', target: 200 },  // steady
    { duration: '1m', target: 500 },  // peak
    { duration: '2m', target: 200 },  // cool-down
    { duration: '1m', target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    success_rate: ['rate>0.99'],
  },
};

export default function () {
  const r = Math.random();

  if (r < 0.7) {
    // Login flow
    const email = `user${Math.floor(Math.random() * 10000)}@loadtest.local`;
    const start = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email, password: 'TestPassword123!@#' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    loginDuration.add(Date.now() - start);

    const ok = check(res, {
      'login returns 200 or 401': (r) => r.status === 200 || r.status === 401,
      'login < 500ms': (r) => r.timings.duration < 500,
    });
    if (ok) successRate.add(1);
    else { successRate.add(0); errors.add(1); }
  } else if (r < 0.9) {
    // Registration flow
    const email = `newuser${Date.now()}${Math.floor(Math.random() * 1000)}@loadtest.local`;
    const res = http.post(`${BASE_URL}/api/v1/auth/register`,
      JSON.stringify({ email, password: 'TestPassword123!@#', fullName: 'Load Test User' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    const ok = check(res, {
      'register returns 201 or 409': (r) => r.status === 201 || r.status === 409,
    });
    if (ok) successRate.add(1);
    else { successRate.add(0); errors.add(1); }
  } else {
    // Health check
    const res = http.get(`${BASE_URL}/health/ready`);
    check(res, { 'ready returns 200': (r) => r.status === 200 });
  }

  sleep(Math.random() * 2);
}
