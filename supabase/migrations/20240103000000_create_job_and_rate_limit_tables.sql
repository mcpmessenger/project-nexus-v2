-- Migration: Create Job Results and Rate Limiting Tables
-- Description: Creates job_results and rate_limit_tracking tables

-- Job Results Table
CREATE TABLE IF NOT EXISTS job_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_type text NOT NULL,  -- 'tool_invoke', 'resource_fetch', etc.
  server_id text NOT NULL,
  tool_name text,
  params jsonb,  -- Original parameters for job execution
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  result jsonb,
  error text,
  pg_net_job_id bigint,  -- Reference to pg_net scheduled job
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  INDEX idx_job_results_user_status (user_id, status),
  INDEX idx_job_results_status (status, created_at),
  INDEX idx_job_results_pg_net (pg_net_job_id)
);

-- RLS Policy for job_results
ALTER TABLE job_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own jobs"
  ON job_results FOR ALL
  USING (auth.uid() = user_id);

-- Rate Limit Tracking Table
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  server_id text NOT NULL,
  user_id uuid,
  window_start timestamptz NOT NULL,
  request_count integer DEFAULT 1,
  PRIMARY KEY (server_id, user_id, window_start),
  INDEX idx_rate_limit_window (server_id, user_id, window_start)
);

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_server_id text,
  p_user_id uuid,
  p_limit_per_minute integer
)
RETURNS boolean AS $$
DECLARE
  v_window_start timestamptz;
  v_request_count integer;
BEGIN
  -- Round down to minute
  v_window_start := date_trunc('minute', now());
  
  -- Get or create rate limit record
  INSERT INTO rate_limit_tracking (server_id, user_id, window_start, request_count)
  VALUES (p_server_id, COALESCE(p_user_id, '00000000-0000-0000-0000-000000000000'::uuid), v_window_start, 1)
  ON CONFLICT (server_id, user_id, window_start)
  DO UPDATE SET request_count = rate_limit_tracking.request_count + 1
  RETURNING request_count INTO v_request_count;
  
  -- Check if limit exceeded
  RETURN v_request_count <= p_limit_per_minute;
END;
$$ LANGUAGE plpgsql;

-- Tool Permissions Table
CREATE TABLE IF NOT EXISTS tool_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  server_id text NOT NULL,
  tool_name text NOT NULL,
  enabled boolean DEFAULT true,
  UNIQUE(user_id, server_id, tool_name),
  INDEX idx_tool_permissions_user (user_id, enabled)
);

-- RLS Policy for tool_permissions
ALTER TABLE tool_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own permissions"
  ON tool_permissions FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE job_results IS 'Async job results for long-running operations';
COMMENT ON TABLE rate_limit_tracking IS 'Rate limit tracking per server and user';
COMMENT ON TABLE tool_permissions IS 'Tool-level permissions for fine-grained control';
