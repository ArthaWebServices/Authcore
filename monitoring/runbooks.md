# AuthCore Runbooks

## AuthCoreDown

**Symptom:** Instance unreachable for 2+ minutes.

**Steps:**
1. Check pod status: `kubectl get pods -l app=authcore`
2. View logs: `kubectl logs -l app=authcore --tail=200`
3. Check recent deployments: `kubectl rollout history deployment/authcore`
4. If deployment caused it: `kubectl rollout undo deployment/authcore`
5. Check node health: `kubectl describe nodes`
6. Escalate to platform team if no obvious cause

## HighErrorRate

**Symptom:** 5xx error rate > 5% for 5+ minutes.

**Steps:**
1. Check Sentry dashboard for stack traces
2. Look at the most common 5xx path: query `authcore_http_requests_total{status=~"5.."}` by `route`
3. If DB errors: check connection pool, recent schema changes
4. If external service errors (email, OAuth): check provider status pages
5. Enable rate-limit tightening if abuse-related
6. Notify on-call if not resolved in 15 min

## HighLoginFailureRate

**Symptom:** Failed login ratio > 50% for 10+ minutes.

**Steps:**
1. Check if attack: query top offending IPs from `authcore_user_login_failed_total`
2. If attack confirmed: enable aggressive rate limiting on `/auth/login`
3. Consider blocking top IPs at WAF/CDN
4. Check Sentry for repeated exceptions during password verification
5. Notify security team if attack pattern is sophisticated

## DatabaseConnectionPoolExhausted

**Symptom:** DB pool > 90% used for 5+ minutes.

**Steps:**
1. Check long-running queries: `SELECT * FROM pg_stat_activity WHERE state = 'active' ORDER BY now() - query_start DESC LIMIT 20`
2. Kill stuck queries if found
3. Check for N+1 patterns in recent deploys
4. Scale pool size temporarily: update `DATABASE_POOL_SIZE` env var
5. If recurring, increase pool size permanently and add query timeouts

## APILatencyP99High

**Symptom:** p99 > 1s for 10+ minutes.

**Steps:**
1. Identify slow routes from metrics
2. Check DB query plan: `EXPLAIN ANALYZE` on slow endpoints
3. Check Redis latency: `redis-cli --latency`
4. Verify no large payload regressions
5. Profile in staging with `clinic.js` if persistent
6. Consider enabling response caching for read-heavy endpoints

## RedisDown

**Symptom:** AuthCore reports Redis unhealthy for 2+ minutes.

**Steps:**
1. Check Redis pod: `kubectl get pods -l app=redis`
2. Check connectivity: `redis-cli -h $REDIS_HOST ping`
3. Restart Redis if unresponsive
4. Sessions created during outage are not cached — expect higher DB load
5. Rate limiting may be bypassed — monitor for abuse

## WebhookBacklog

**Symptom:** Pending webhook deliveries > 100 for 10+ minutes.

**Steps:**
1. Check delivery log: `GET /admin/webhooks/{id}/deliveries`
2. Identify failing endpoints (4xx/5xx responses)
3. Contact webhook consumers if endpoint is broken
4. If consumer down, consider pausing delivery: `PATCH /admin/webhooks/{id} {isActive: false}`
5. Manually retry: re-enable and let cron retry catch up
