import { NextResponse } from "next/server"

// Prometheus metrics endpoint
// This endpoint exposes metrics in Prometheus format for scraping
export async function GET() {
  try {
    // Import worker status logic directly to avoid self-referencing
    // In production, this would fetch from actual worker registry
    const mockWorkers = [
      {
        worker_id: "router-01",
        type: "router",
        status: "processing",
        current_task_id: "task-456",
        processed_count: 1247,
        error_count: 3,
        last_heartbeat: new Date().toISOString(),
      },
      {
        worker_id: "vision-01",
        type: "vision",
        status: "processing",
        current_task_id: "task-789",
        processed_count: 892,
        error_count: 12,
        last_heartbeat: new Date().toISOString(),
      },
      {
        worker_id: "vision-02",
        type: "vision",
        status: "idle",
        processed_count: 743,
        error_count: 8,
        last_heartbeat: new Date().toISOString(),
      },
      {
        worker_id: "tool-01",
        type: "tool",
        status: "idle",
        processed_count: 523,
        error_count: 5,
        last_heartbeat: new Date().toISOString(),
      },
    ]
    
    // In production, replace with actual worker status fetch from Pulsar/Supabase
    // For now, try to fetch from workers API, fallback to mock data
    let workers = mockWorkers
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const workersResponse = await fetch(`${baseUrl}/api/workers/status`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      if (workersResponse.ok) {
        const workersData = await workersResponse.json()
        workers = workersData.workers || mockWorkers
      }
    } catch (err) {
      // Fallback to mock data if fetch fails
      console.warn('Could not fetch worker status, using mock data:', err)
    }

    // Calculate metrics
    const totalWorkers = workers.length
    const activeWorkers = workers.filter((w: any) => w.status === 'processing').length
    const idleWorkers = workers.filter((w: any) => w.status === 'idle').length
    const errorWorkers = workers.filter((w: any) => w.status === 'error').length
    
    const totalProcessed = workers.reduce((sum: number, w: any) => sum + (w.processed_count || 0), 0)
    const totalErrors = workers.reduce((sum: number, w: any) => sum + (w.error_count || 0), 0)
    
    // Group by type
    const routerWorkers = workers.filter((w: any) => w.type === 'router')
    const visionWorkers = workers.filter((w: any) => w.type === 'vision')
    const toolWorkers = workers.filter((w: any) => w.type === 'tool')

    // Build Prometheus metrics format
    const metrics = [
      '# HELP nexus_workers_total Total number of workers',
      '# TYPE nexus_workers_total gauge',
      `nexus_workers_total ${totalWorkers}`,
      '',
      '# HELP nexus_workers_active Number of active (processing) workers',
      '# TYPE nexus_workers_active gauge',
      `nexus_workers_active ${activeWorkers}`,
      '',
      '# HELP nexus_workers_idle Number of idle workers',
      '# TYPE nexus_workers_idle gauge',
      `nexus_workers_idle ${idleWorkers}`,
      '',
      '# HELP nexus_workers_error Number of workers in error state',
      '# TYPE nexus_workers_error gauge',
      `nexus_workers_error ${errorWorkers}`,
      '',
      '# HELP nexus_tasks_processed_total Total number of tasks processed',
      '# TYPE nexus_tasks_processed_total counter',
      `nexus_tasks_processed_total ${totalProcessed}`,
      '',
      '# HELP nexus_tasks_failed_total Total number of failed tasks',
      '# TYPE nexus_tasks_failed_total counter',
      `nexus_tasks_failed_total ${totalErrors}`,
      '',
      '# HELP nexus_workers_by_type Number of workers by type',
      '# TYPE nexus_workers_by_type gauge',
      `nexus_workers_by_type{type="router"} ${routerWorkers.length}`,
      `nexus_workers_by_type{type="vision"} ${visionWorkers.length}`,
      `nexus_workers_by_type{type="tool"} ${toolWorkers.length}`,
      '',
      '# HELP nexus_tasks_processed_by_type Total tasks processed by worker type',
      '# TYPE nexus_tasks_processed_by_type counter',
      `nexus_tasks_processed_by_type{type="router"} ${routerWorkers.reduce((sum: number, w: any) => sum + (w.processed_count || 0), 0)}`,
      `nexus_tasks_processed_by_type{type="vision"} ${visionWorkers.reduce((sum: number, w: any) => sum + (w.processed_count || 0), 0)}`,
      `nexus_tasks_processed_by_type{type="tool"} ${toolWorkers.reduce((sum: number, w: any) => sum + (w.processed_count || 0), 0)}`,
      '',
      '# HELP nexus_tasks_failed_by_type Total failed tasks by worker type',
      '# TYPE nexus_tasks_failed_by_type counter',
      `nexus_tasks_failed_by_type{type="router"} ${routerWorkers.reduce((sum: number, w: any) => sum + (w.error_count || 0), 0)}`,
      `nexus_tasks_failed_by_type{type="vision"} ${visionWorkers.reduce((sum: number, w: any) => sum + (w.error_count || 0), 0)}`,
      `nexus_tasks_failed_by_type{type="tool"} ${toolWorkers.reduce((sum: number, w: any) => sum + (w.error_count || 0), 0)}`,
      '',
      // Individual worker metrics
      ...workers.map((worker: any) => {
        const labels = `worker_id="${worker.worker_id}",type="${worker.type}",status="${worker.status}"`
        return [
          `# HELP nexus_worker_processed_tasks Tasks processed by individual worker`,
          `# TYPE nexus_worker_processed_tasks counter`,
          `nexus_worker_processed_tasks{${labels}} ${worker.processed_count || 0}`,
          '',
          `# HELP nexus_worker_error_count Errors from individual worker`,
          `# TYPE nexus_worker_error_count counter`,
          `nexus_worker_error_count{${labels}} ${worker.error_count || 0}`,
          '',
          `# HELP nexus_worker_last_heartbeat_seconds Last heartbeat timestamp in seconds`,
          `# TYPE nexus_worker_last_heartbeat_seconds gauge`,
          `nexus_worker_last_heartbeat_seconds{${labels}} ${Math.floor(new Date(worker.last_heartbeat).getTime() / 1000)}`,
        ].join('\n')
      }),
    ].join('\n')

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
      },
    })
  } catch (error) {
    console.error('Error generating Prometheus metrics:', error)
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    )
  }
}
