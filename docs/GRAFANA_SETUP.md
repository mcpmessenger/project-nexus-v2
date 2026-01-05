# Grafana Dashboard Setup for Project Nexus v2

This guide explains how to set up Grafana to monitor Project Nexus v2 workers using Prometheus metrics.

## Prerequisites

1. **Prometheus** - Installed and running
2. **Grafana** - Installed and running
3. **Project Nexus v2** - Running with metrics endpoint accessible

## Step 1: Configure Prometheus

Add the following scrape configuration to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'nexus-v2'
    scrape_interval: 5s
    metrics_path: '/api/metrics/prometheus'
    static_configs:
      - targets: ['localhost:3000']  # Update with your actual host
        labels:
          instance: 'nexus-v2'
          environment: 'production'
```

## Step 2: Configure Grafana Data Source

1. Open Grafana (typically at `http://localhost:3001`)
2. Go to **Configuration** → **Data Sources**
3. Click **Add data source**
4. Select **Prometheus**
5. Configure:
   - **URL**: `http://localhost:9090` (or your Prometheus URL)
   - **Access**: Server (default)
6. Click **Save & Test**

## Step 3: Import Dashboard

1. In Grafana, go to **Dashboards** → **Import**
2. Click **Upload JSON file**
3. Select the `grafana-dashboard.json` file from the project root
4. Select your Prometheus data source
5. Click **Import**

Alternatively, you can copy the JSON content and paste it into the "Import via panel json" text area.

## Step 4: Verify Metrics

The dashboard includes the following panels:

### Summary Statistics
- **Total Workers** - Total number of workers
- **Active Workers** - Currently processing tasks
- **Idle Workers** - Available but not processing
- **Error Workers** - Workers in error state

### Time Series Charts
- **Tasks Processed Over Time** - Rate of task processing
- **Failed Tasks Over Time** - Rate of task failures
- **Workers by Type** - Number of workers per type (router, vision, tool)
- **Tasks Processed by Type** - Processing rate by worker type
- **Task Failure Rate by Type** - Failure rate by worker type
- **Total Tasks Processed (Cumulative)** - Cumulative task count

### Tables
- **Individual Worker Status** - Detailed status for each worker

## Available Metrics

The Prometheus endpoint (`/api/metrics/prometheus`) exposes the following metrics:

### Worker Metrics
- `nexus_workers_total` - Total number of workers
- `nexus_workers_active` - Active workers
- `nexus_workers_idle` - Idle workers
- `nexus_workers_error` - Workers in error state
- `nexus_workers_by_type{type="router|vision|tool"}` - Workers by type

### Task Metrics
- `nexus_tasks_processed_total` - Total tasks processed
- `nexus_tasks_failed_total` - Total failed tasks
- `nexus_tasks_processed_by_type{type="router|vision|tool"}` - Tasks by type
- `nexus_tasks_failed_by_type{type="router|vision|tool"}` - Failed tasks by type

### Individual Worker Metrics
- `nexus_worker_processed_tasks{worker_id,type,status}` - Tasks per worker
- `nexus_worker_error_count{worker_id,type,status}` - Errors per worker
- `nexus_worker_last_heartbeat_seconds{worker_id,type,status}` - Last heartbeat

## Customization

### Update Refresh Interval

The dashboard is set to refresh every 5 seconds. To change:
1. Open the dashboard
2. Click the gear icon (⚙️) in the top right
3. Edit **Time options** → **Auto refresh**
4. Select your desired interval

### Add Alerts

You can create alerts in Grafana based on these metrics:

1. Go to **Alerting** → **Alert rules**
2. Click **New alert rule**
3. Use PromQL queries like:
   - `nexus_workers_error > 0` - Alert when any worker is in error state
   - `rate(nexus_tasks_failed_total[5m]) > 0.1` - Alert on high failure rate
   - `nexus_workers_active == 0` - Alert when no workers are active

## Troubleshooting

### Metrics Not Appearing

1. Verify Prometheus can scrape the endpoint:
   ```bash
   curl http://localhost:3000/api/metrics/prometheus
   ```

2. Check Prometheus targets:
   - Go to Prometheus UI → Status → Targets
   - Verify the nexus-v2 target is UP

3. Check Grafana data source:
   - Go to Configuration → Data Sources
   - Click "Test" on your Prometheus data source

### Dashboard Not Loading

1. Verify the JSON is valid:
   ```bash
   cat grafana-dashboard.json | jq .
   ```

2. Check Grafana logs for import errors

3. Ensure all metric names match what's exposed by the endpoint

## Production Considerations

1. **Security**: Protect the metrics endpoint with authentication
2. **Rate Limiting**: Consider rate limiting for the Prometheus scrape endpoint
3. **Retention**: Configure Prometheus retention policies
4. **High Availability**: Set up Prometheus and Grafana in HA mode for production

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Query Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/)
