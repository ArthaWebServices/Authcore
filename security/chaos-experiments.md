# AuthCore Chaos Engineering (TASK-068)

**Tooling:** Chaos Toolkit + custom k8s experiments
**Frequency:** Weekly (Tuesday 14:00 UTC, in staging)
**Hypothesis-driven:** Each experiment states expected behavior

## Experiment 1: PostgreSQL Pod Failure

**Hypothesis:** Service degrades gracefully, /health/ready returns 503, no data loss.

**Actions:**
```yaml
- kill-random-pod:
    label: app=postgres
    count: 1
```

**Expected:**
- `GET /health/ready` returns 503 within 5s
- Existing sessions continue working for cached requests
- New login attempts fail with `DatabaseUnavailableError`
- Sentry fires `db_connection_lost` alert
- Prometheus `authcore_db_pool_total` drops
- After PG restarts, `/health/ready` returns 200 within 30s

**Success criteria:** No data corruption, no auth bypass possible, automatic recovery.

## Experiment 2: Redis Pod Failure

**Hypothesis:** Login still works (DB-backed), rate limiting falls back to memory.

**Actions:**
```yaml
- kill-random-pod:
    label: app=redis
    count: 1
```

**Expected:**
- Login succeeds (sessions stored in PG, not Redis)
- Rate limiting falls back to per-process counter
- `GET /health/ready` returns 503 (or 200 with `degraded: true`)
- BullMQ email queue stops processing — emails queued in PG
- Sentry fires alert

**Success criteria:** Users can still log in, no data loss, queue resumes on recovery.

## Experiment 3: AuthCore Pod Killed Mid-Request

**Hypothesis:** No half-completed state, request retries succeed.

**Actions:**
```yaml
- kill-random-pod:
    label: app=authcore
    count: 1
    during: POST /auth/register
```

**Expected:**
- Client receives 502/504
- DB transaction was atomic — no orphan user record
- If registration partial: user record created but verification email NOT sent (rolled back)

**Success criteria:** No ghost users, idempotent retry works.

## Experiment 4: Network Partition (AuthCore ↔ Database)

**Hypothesis:** Service times out cleanly, no hanging requests.

**Actions:**
```yaml
- network-partition:
    from: app=authcore
    to: app=postgres
    duration: 60s
```

**Expected:**
- All DB requests time out after 5s (configured statement timeout)
- 500 errors returned
- No thread exhaustion
- After partition heals, normal operation resumes

**Success criteria:** Fast failure, no cascading failure.

## Experiment 5: Email Provider Outage

**Hypothesis:** Verification emails queue, users can retry.

**Actions:**
```yaml
- block-network:
    from: app=authcore
    to: api.resend.com
    duration: 5m
```

**Expected:**
- Verification emails accumulate in BullMQ
- Users see "queued, retry shortly" message
- Sentry fires `email_provider_down` alert
- On heal: queue drains within 60s

**Success criteria:** No data loss, queue handles backpressure.

## Experiment 6: Surge Login Traffic (10x normal)

**Hypothesis:** Auto-scaling triggers, no rate-limit false-positives.

**Actions:**
```bash
k6 run --vus 5000 --duration 5m stress-test.js
```

**Expected:**
- HPA scales pods from 3 → 20 within 2 min
- p99 latency < 2s during surge
- Rate limiting correctly throttles attackers without blocking real users
- No OOM kills

**Success criteria:** Service remains responsive, no abuse window.

## Experiment 7: TLS Certificate Expiry

**Hypothesis:** Service refuses connections before expiry, no data leaks.

**Actions:** Manually replace cert with expired cert, observe behavior.

**Expected:**
- TLS handshake fails immediately
- Health checks fail
- No plaintext fallback

**Success criteria:** Clean failure, alerting fires in time for renewal.

## Schedule & Ownership

| Day | Experiment | Owner |
|-----|-----------|-------|
| Week 1 Tue | PG failure | Platform |
| Week 1 Thu | Redis failure | Platform |
| Week 2 Tue | AuthCore pod kill | Platform |
| Week 2 Thu | Network partition | Platform |
| Week 3 Tue | Email outage | Integrations |
| Week 3 Thu | Surge traffic | Performance |
| Week 4 Tue | TLS expiry | Security |

## Reporting

- Findings logged in `chaos-experiments/results/<date>.md`
- Each experiment adds to a counter of validated hypotheses
- Any unexpected behavior is filed as a bug
