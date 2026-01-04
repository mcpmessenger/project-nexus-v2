# Nexus Hub Operational Guide

## Overview

This guide covers operational procedures for maintaining the Nexus Hub in production, including key rotation, job cleanup, monitoring, and troubleshooting.

## Table of Contents

1. [Vault Key Rotation](#vault-key-rotation)
2. [Job Cleanup](#job-cleanup)
3. [Monitoring & Alerting](#monitoring--alerting)
4. [Troubleshooting](#troubleshooting)
5. [Backup & Recovery](#backup--recovery)

## Vault Key Rotation

### Overview

The vault encryption key (`VAULT_ENCRYPTION_KEY`) should be rotated periodically (recommended: every 90 days) for security compliance. This process re-encrypts all user server configurations with a new key.

### Prerequisites

- Database backup completed
- Maintenance window scheduled
- Access to Supabase dashboard or CLI
- New encryption key generated (32 bytes = 64 hex characters)

### Step 1: Generate New Key

```bash
# Generate new 32-byte (256-bit) encryption key
openssl rand -hex 32

# Example output:
# a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Important**: Store this key securely. You'll need it for the rotation process.

### Step 2: Backup Database

Before rotation, create a database backup:

```bash
# Using Supabase CLI
supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql

# Or use Supabase Dashboard → Database → Backups → Create Backup
```

### Step 3: Test Rotation (Staging First)

**Always test on staging environment first!**

```bash
# Set environment variables
export VAULT_OLD_KEY="<current_key_hex>"
export VAULT_NEW_KEY="<new_key_hex>"
export SUPABASE_URL="<staging_url>"
export SUPABASE_SERVICE_ROLE_KEY="<staging_service_role_key>"

# Run rotation script
deno run --allow-net --allow-env scripts/rotate-vault-key.ts

# Verify:
# - All servers can be decrypted
# - Edge Functions work correctly
# - Tool invocations succeed
```

### Step 4: Production Rotation

1. **Schedule Maintenance Window** (recommended: low-traffic period)

2. **Set Temporary Environment Variables**:
```bash
export VAULT_OLD_KEY="<current_production_key>"
export VAULT_NEW_KEY="<new_key_from_step_1>"
export SUPABASE_URL="<production_url>"
export SUPABASE_SERVICE_ROLE_KEY="<production_service_role_key>"
```

3. **Run Rotation Script**:
```bash
deno run --allow-net --allow-env scripts/rotate-vault-key.ts
```

4. **Verify Rotation**:
```sql
-- Check rotation results
SELECT * FROM rotate_vault_key();
-- Should show: servers_updated count and empty errors array
```

5. **Update Supabase Secret**:
```bash
# Using Supabase CLI
supabase secrets set VAULT_ENCRYPTION_KEY=<new_key_hex>

# Or via Dashboard: Settings → API → Secrets
```

6. **Restart Edge Functions** (to pick up new key):
```bash
# Redeploy Edge Function (picks up new secret)
supabase functions deploy nexus-hub
```

7. **Verify System Operation**:
   - Add a test server
   - Invoke a tool
   - Check error logs for decryption failures

8. **Clean Up**:
   - Remove `VAULT_OLD_KEY` from environment
   - Document rotation date
   - Archive old key securely (for recovery if needed)

### Rotation Checklist

- [ ] New key generated and stored securely
- [ ] Database backup completed
- [ ] Rotation tested on staging
- [ ] Maintenance window scheduled
- [ ] Users notified (if maintenance affects availability)
- [ ] Rotation script executed
- [ ] Rotation verified (no errors)
- [ ] Supabase secret updated
- [ ] Edge Functions restarted
- [ ] System operation verified
- [ ] Old key archived securely
- [ ] Rotation documented

### Rollback Procedure

If rotation fails, you can rollback:

1. **Restore Supabase Secret** (old key):
```bash
supabase secrets set VAULT_ENCRYPTION_KEY=<old_key_hex>
```

2. **Restore Database Backup** (if data corrupted):
```bash
supabase db reset
# Then restore from backup
```

3. **Restart Edge Functions**:
```bash
supabase functions deploy nexus-hub
```

## Job Cleanup

### Overview

The `job_results` table stores async job execution results. Without cleanup, it grows indefinitely, impacting database performance.

### Automatic Cleanup (pg_cron)

Automatic cleanup is configured via pg_cron to run daily at 2 AM UTC:

```sql
-- View scheduled jobs
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-job-results';

-- View job execution history
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-old-job-results')
ORDER BY start_time DESC
LIMIT 10;
```

**What gets cleaned**:
- Completed/failed/cancelled jobs older than 7 days
- Orphaned pending/running jobs older than 1 day

### Manual Cleanup

For immediate cleanup or custom retention periods:

```sql
-- Clean up jobs manually (default: 7 days completed, 1 day orphaned)
SELECT * FROM cleanup_job_results_manual();

-- Custom retention periods (e.g., 14 days completed, 2 days orphaned)
SELECT * FROM cleanup_job_results_manual(14, 2);
```

Or via Edge Function:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/nexus-hub/internal/cleanup-jobs \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"days_completed": 7, "days_orphaned": 1}'
```

### Monitoring Job Table Size

```sql
-- Check table statistics
SELECT 
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'running') as running,
  COUNT(*) FILTER (WHERE created_at < now() - interval '7 days') as older_than_7_days,
  pg_size_pretty(pg_total_relation_size('job_results')) as table_size,
  pg_size_pretty(pg_relation_size('job_results')) as table_data_size,
  pg_size_pretty(pg_indexes_size('job_results')) as indexes_size
FROM job_results;
```

**Alert Threshold**: If `total_jobs` > 1,000,000, consider:
- Reducing retention period
- Running manual cleanup
- Investigating for job creation issues

## Monitoring & Alerting

### Key Metrics to Monitor

#### 1. Job Results Table Growth

```sql
-- Daily growth rate
SELECT 
  DATE(created_at) as date,
  COUNT(*) as jobs_created,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM job_results
WHERE created_at > now() - interval '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Alert**: If daily growth > 100,000 jobs, investigate for:
- Excessive async job creation
- Jobs not completing (stuck in pending/running)
- Possible abuse or runaway workflows

#### 2. Cache Hit Rates

```sql
-- Tool cache effectiveness
SELECT 
  COUNT(*) FILTER (WHERE expires_at > now()) as active_cached_tools,
  COUNT(*) FILTER (WHERE expires_at < now()) as expired_tools,
  COUNT(DISTINCT server_ref_id) as unique_servers_cached
FROM tool_cache;
```

**Alert**: If `expired_tools` > 50% of total, consider:
- Reducing cache TTL
- Running cache refresh
- Investigating server availability issues

#### 3. Rate Limiting Effectiveness

```sql
-- Rate limit violations (requires logging table)
SELECT 
  server_id,
  COUNT(*) as violations,
  MAX(window_start) as last_violation
FROM rate_limit_tracking
WHERE request_count > (
  SELECT rate_limit_per_minute 
  FROM system_servers 
  WHERE id = rate_limit_tracking.server_id
)
GROUP BY server_id
ORDER BY violations DESC;
```

#### 4. Edge Function Errors

Monitor Supabase Edge Function logs:

```bash
# View recent logs
supabase functions logs nexus-hub --limit 100

# Filter for errors
supabase functions logs nexus-hub | grep -i error
```

**Common errors to watch for**:
- Decryption failures (vault key issues)
- Job execution failures (MCP server timeouts)
- Rate limit violations
- Cache refresh failures

### Alerting Setup

#### Recommended Alerts

1. **Job Table Size**: Alert if > 1M rows
2. **Failed Jobs**: Alert if failure rate > 10%
3. **Cache Expiration**: Alert if > 50% expired
4. **Edge Function Errors**: Alert on error rate spikes
5. **Rate Limit Violations**: Alert on persistent violations

#### Supabase Alerts

Configure alerts in Supabase Dashboard:
- Settings → Alerts → Create Alert
- Set thresholds based on metrics above
- Configure notification channels (email, Slack, PagerDuty)

## Troubleshooting

### Common Issues

#### 1. Decryption Failures

**Symptoms**: Errors like "Failed to decrypt token" or "Invalid encryption"

**Causes**:
- Vault key mismatch (after rotation)
- Corrupted encrypted data
- Key not set in Supabase secrets

**Solutions**:
```sql
-- Check if vault key is set
SELECT current_setting('app.vault_key', true);

-- Verify encryption format (should be bytea)
SELECT id, length(config_encrypted) as encrypted_length
FROM user_servers
LIMIT 5;
```

**Fix**:
- Verify `VAULT_ENCRYPTION_KEY` in Supabase secrets
- Redeploy Edge Function
- If corrupted, restore from backup

#### 2. Jobs Stuck in Pending/Running

**Symptoms**: Jobs remain in `pending` or `running` status indefinitely

**Causes**:
- pg_net job failed to trigger
- Edge Function `/internal/job-executor` endpoint down
- MCP server timeout

**Solutions**:
```sql
-- Find stuck jobs
SELECT id, job_type, server_id, created_at, status
FROM job_results
WHERE status IN ('pending', 'running')
  AND created_at < now() - interval '1 hour'
ORDER BY created_at;

-- Manually cancel stuck jobs
UPDATE job_results
SET status = 'cancelled', completed_at = now()
WHERE status IN ('pending', 'running')
  AND created_at < now() - interval '1 hour';
```

**Fix**:
- Check Edge Function logs for errors
- Verify pg_net extension is enabled
- Check MCP server availability
- Increase timeout if needed

#### 3. Cache Not Refreshing

**Symptoms**: Tools not appearing after server updates

**Causes**:
- Cache TTL not expired
- Cache refresh job failed
- Server list_tools endpoint error

**Solutions**:
```sql
-- Check cache expiration
SELECT server_ref_id, MAX(expires_at) as latest_expiration
FROM tool_cache
GROUP BY server_ref_id;

-- Manually refresh cache for a server
-- (via Edge Function endpoint or SQL trigger)
```

**Fix**:
- Use "Sync Tools" button in UI
- Manually trigger cache refresh
- Check server availability

#### 4. High Database Load

**Symptoms**: Slow queries, connection timeouts

**Causes**:
- Large job_results table
- Missing indexes
- Cache refresh storms

**Solutions**:
```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Run manual cleanup
SELECT * FROM cleanup_job_results_manual(7, 1);

-- Analyze table statistics
ANALYZE job_results;
ANALYZE tool_cache;
```

**Fix**:
- Run job cleanup immediately
- Add missing indexes
- Optimize cache refresh frequency

## Backup & Recovery

### Backup Strategy

#### Automated Backups

Supabase provides automated daily backups:
- Dashboard → Database → Backups
- Retention: 7 days (free tier), 30 days (pro tier)

#### Manual Backups

```bash
# Full database backup
supabase db dump -f backup-$(date +%Y%m%d).sql

# Specific tables only
supabase db dump -t user_servers -t system_servers -f servers-backup.sql
```

### Recovery Procedures

#### Restore Full Database

```bash
# Restore from backup
supabase db reset
psql -h <host> -U postgres -d postgres < backup-YYYYMMDD.sql
```

#### Restore Specific Tables

```sql
-- Restore user_servers table
TRUNCATE user_servers;
\copy user_servers FROM 'user_servers_backup.csv' CSV HEADER;
```

#### Disaster Recovery Checklist

- [ ] Identify backup to restore from
- [ ] Verify backup integrity
- [ ] Schedule maintenance window
- [ ] Restore database
- [ ] Verify data integrity
- [ ] Restart Edge Functions
- [ ] Test system operations
- [ ] Document recovery procedure

## Maintenance Schedule

### Daily
- Monitor job_results table size
- Check Edge Function error logs
- Review failed jobs

### Weekly
- Review cache expiration rates
- Analyze job execution patterns
- Check rate limit violations

### Monthly
- Review database performance
- Analyze table growth trends
- Update documentation

### Quarterly
- Rotate vault encryption key
- Review and update retention periods
- Security audit

## Support Contacts

- **Supabase Support**: https://supabase.com/support
- **Documentation**: https://supabase.com/docs
- **Community**: https://github.com/supabase/supabase/discussions

---

**Last Updated**: 2024-01-01
**Version**: 1.0
