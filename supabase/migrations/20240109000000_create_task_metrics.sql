-- Migration: Create Task Metrics Table
-- Description: Tracks tool invocations and task executions for real-time metrics

-- Task Metrics Table
CREATE TABLE IF NOT EXISTS task_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  server_id text NOT NULL,
  tool_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  execution_time_ms integer, -- Time taken to execute in milliseconds
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_metrics_created_at ON task_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_task_metrics_server ON task_metrics(server_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_metrics_status ON task_metrics(status, created_at);
CREATE INDEX IF NOT EXISTS idx_task_metrics_user ON task_metrics(user_id, created_at);

-- RLS Policy for task_metrics
ALTER TABLE task_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own metrics, or all metrics if service role
CREATE POLICY "Users can view their own metrics"
  ON task_metrics
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    auth.role() = 'service_role'
  );

-- Policy: Allow inserting metrics (for system tracking)
CREATE POLICY "Allow metric insertion"
  ON task_metrics
  FOR INSERT
  WITH CHECK (true);

-- Function to get metrics for the last N minutes
CREATE OR REPLACE FUNCTION get_task_metrics(
  minutes_back integer DEFAULT 5
)
RETURNS TABLE (
  processed_count bigint,
  failed_count bigint,
  active_workers_count bigint,
  timestamp timestamptz
) AS $$
BEGIN
  RETURN QUERY
  WITH time_windows AS (
    SELECT 
      date_trunc('minute', generate_series(
        now() - (minutes_back || ' minutes')::interval,
        now(),
        '1 minute'::interval
      )) AS window_start
  ),
  metrics_by_window AS (
    SELECT 
      tw.window_start,
      COUNT(*) FILTER (WHERE tm.status = 'success') AS processed,
      COUNT(*) FILTER (WHERE tm.status = 'failed') AS failed,
      COUNT(*) FILTER (WHERE tm.status = 'pending' OR tm.status = 'success' AND tm.created_at > now() - interval '30 seconds') AS active
    FROM time_windows tw
    LEFT JOIN task_metrics tm ON date_trunc('minute', tm.created_at) = tw.window_start
    GROUP BY tw.window_start
    ORDER BY tw.window_start
  )
  SELECT 
    COALESCE(SUM(processed), 0)::bigint,
    COALESCE(SUM(failed), 0)::bigint,
    COALESCE(MAX(active), 0)::bigint,
    MAX(window_start)
  FROM metrics_by_window;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get aggregated metrics
CREATE OR REPLACE FUNCTION get_aggregated_metrics()
RETURNS TABLE (
  total_processed bigint,
  total_failed bigint,
  active_workers bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'success')::bigint AS total_processed,
    COUNT(*) FILTER (WHERE status = 'failed')::bigint AS total_failed,
    COUNT(*) FILTER (WHERE status IN ('pending', 'success') AND created_at > now() - interval '30 seconds')::bigint AS active_workers
  FROM task_metrics
  WHERE created_at > now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE task_metrics IS 'Tracks tool invocations and task executions for metrics dashboard';
COMMENT ON FUNCTION get_task_metrics IS 'Returns metrics aggregated by time windows';
COMMENT ON FUNCTION get_aggregated_metrics IS 'Returns current aggregated metrics totals';
