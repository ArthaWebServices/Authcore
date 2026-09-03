# AuthCore Production Launch (TASK-077 / TASK-078 / TASK-079 / TASK-080)

## 1. Pre-Launch Checklist (T-7 days)

- [ ] All Sprints 1-17 complete
- [ ] Pen test findings closed (or accepted with mitigation)
- [ ] Load test passed: 500 RPS for 5 min, p99 < 1s
- [ ] Chaos experiments passed: 4/4 hypothesis-confirmed
- [ ] Key rotation drill completed
- [ ] Runbooks reviewed by on-call team
- [ ] Grafana dashboards imported
- [ ] Alerts wired to PagerDuty
- [ ] ArgoCD app created and synced
- [ ] DNS records provisioned
- [ ] TLS certs issued and tested
- [ ] Backups tested (PG point-in-time recovery)
- [ ] Disaster recovery runbook tested

## 2. Launch Day (T-0)

### Morning (T-2h)
- [ ] Final deploy via ArgoCD
- [ ] Verify all pods Ready
- [ ] Verify /health/ready on all instances
- [ ] Verify Prometheus scraping
- [ ] Verify Sentry receiving events
- [ ] Test a real login (using staging user)

### Cutover (T-0)
- [ ] Update DNS (CNAME → load balancer)
- [ ] Wait for TTL to expire (1 hour if 1h TTL)
- [ ] Verify production traffic flowing (check ingress logs)

### Stabilization (T+0 to T+4h)
- [ ] Two engineers on-call
- [ ] Watch dashboards every 15 min
- [ ] Document any anomalies in real-time

## 3. 48-Hour Intensive Monitoring (TASK-078)

**Schedule:** Two engineers, 12-hour shifts, for 48 hours.

### Hourly Checks
- [ ] Error rate < 1%
- [ ] Login success rate > 95%
- [ ] p99 latency < 1s
- [ ] No critical alerts
- [ ] Database CPU < 70%
- [ ] Redis memory < 80%

### Every 4 Hours
- [ ] Review new Sentry errors
- [ ] Check audit log for suspicious events
- [ ] Verify backups completed

### Daily
- [ ] Customer communication if issues
- [ ] Status page update
- [ ] Metrics review with team

## 4. Performance Tuning (TASK-079)

After 48 hours, analyze:

### Common Optimizations
- [ ] Add indexes for slow queries identified in logs
- [ ] Increase PG `shared_buffers` if memory-bound
- [ ] Increase Redis `maxmemory` if cache evictions
- [ ] Add read replicas if DB CPU-bound
- [ ] Increase pod resources if CPU-bound
- [ ] Add response caching for idempotent GETs

### Target SLOs
- **Availability:** 99.9% (43 min downtime / month)
- **Login p99:** < 500ms
- **Registration p99:** < 1s
- **Error rate:** < 0.1%

## 5. Retrospective (TASK-080)

**Date:** 2 weeks post-launch
**Facilitator:** Tech lead
**Attendees:** All Sprint 1-18 contributors

### What Went Well
- ___________
- ___________

### What Went Poorly
- ___________
- ___________

### What We'd Do Differently
- ___________
- ___________

### Action Items
- [ ] ___________ (owner, due date)

## 6. Documentation Update

After retro, update:
- [ ] README.md with deployment status
- [ ] docs/architecture.md with actual architecture
- [ ] docs/runbook.md with real incident learnings
- [ ] docs/api.md with any API drift
- [ ] CHANGELOG.md with v1.0.0 release notes

## 7. Long-Term Operations

### Weekly
- [ ] Review metrics dashboard
- [ ] Review alerts fired
- [ ] Triage Sentry errors
- [ ] Review audit log anomalies

### Monthly
- [ ] Rotate webhook secrets
- [ ] Review access logs
- [ ] Capacity planning review
- [ ] Dependency update (Dependabot PRs)

### Quarterly
- [ ] Key rotation drill
- [ ] Pen test (external)
- [ ] DR drill
- [ ] Performance review

### Annually
- [ ] Security audit (external)
- [ ] Architecture review
- [ ] Tech debt sprint
- [ ] Major version upgrade planning
