-- Create Job Tables and Rate Limiting
-- Run this after creating cache tables

-- Enable pg_net extension (required for background HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Job Results Table
CREATE TABLE IF NOT EXISTS job_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_type text NOT NULL,
  server_id text NOT NULL,
  tool_name text,
  params jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  result jsonb,
  error text,
  pg_net_job_id bigint,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_job_results_user_status ON job_results(user_id, status);
CREATE INDEX IF NOT EXISTS idx_job_results_status ON job_results(status, created_at);
CREATE INDEX IF NOT EXISTS idx_job_results_pg_net ON job_results(pg_net_job_id);

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
  PRIMARY KEY (server_id, user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_tracking(server_id, user_id, window_start);

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

-- Function to execute job via pg_net
CREATE OR REPLACE FUNCTION execute_job_via_pg_net(job_id uuid)
RETURNS void AS $$
DECLARE
  job_record job_results%ROWTYPE;
  edge_function_url text;
  service_role_key text;
BEGIN
  -- Get job record
  SELECT * INTO job_record FROM job_results WHERE id = job_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % not found', job_id;
  END IF;
  
  -- Update status to running
  UPDATE job_results 
  SET status = 'running', started_at = now()
  WHERE id = job_id;
  
  -- Get Edge Function URL and service role key from environment
  edge_function_url := current_setting('app.edge_function_url', true);
  service_role_key := current_setting('app.service_role_key', true);
  
  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    -- Fallback: Update job as failed if config not set
    UPDATE job_results 
    SET status = 'failed', error = 'Edge function URL or service role key not configured'
    WHERE id = job_id;
    RETURN;
  END IF;
  
  -- Schedule job execution via pg_net HTTP request
  PERFORM net.http_post(
    url := edge_function_url || '/internal/job-executor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'job_id', job_id,
      'job_type', job_record.job_type,
      'server_id', job_record.server_id,
      'tool_name', job_record.tool_name,
      'params', job_record.params,
      'user_id', job_record.user_id
    )
  );
  
  -- Note: pg_net handles the HTTP request asynchronously
  -- The Edge Function /internal/job-executor endpoint will update job_results
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE job_results IS 'Async job results for long-running operations';
COMMENT ON TABLE rate_limit_tracking IS 'Rate limit tracking per server and user';
COMMENT ON FUNCTION check_rate_limit IS 'Checks and increments rate limit, returns true if within limit';
COMMENT ON FUNCTION execute_job_via_pg_net IS 'Triggers async job execution via pg_net HTTP request to Edge Function';
