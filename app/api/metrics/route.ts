import { NextResponse } from "next/server"

// JSON metrics endpoint for dashboard consumption
export async function GET() {
  try {
    // Fetch worker status
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
    
    // Try to fetch from workers API, fallback to mock data
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

    // Calculate aggregated metrics
    const metrics = {
      workers: {
        total: workers.length,
        active: workers.filter((w: any) => w.status === 'processing').length,
        idle: workers.filter((w: any) => w.status === 'idle').length,
        error: workers.filter((w: any) => w.status === 'error').length,
        byType: {
          router: workers.filter((w: any) => w.type === 'router').length,
          vision: workers.filter((w: any) => w.type === 'vision').length,
          tool: workers.filter((w: any) => w.type === 'tool').length,
        },
      },
      tasks: {
        processed: workers.reduce((sum: number, w: any) => sum + (w.processed_count || 0), 0),
        failed: workers.reduce((sum: number, w: any) => sum + (w.error_count || 0), 0),
        byType: {
          router: workers
            .filter((w: any) => w.type === 'router')
            .reduce((sum: number, w: any) => sum + (w.processed_count || 0), 0),
          vision: workers
            .filter((w: any) => w.type === 'vision')
            .reduce((sum: number, w: any) => sum + (w.processed_count || 0), 0),
          tool: workers
            .filter((w: any) => w.type === 'tool')
            .reduce((sum: number, w: any) => sum + (w.processed_count || 0), 0),
        },
        failedByType: {
          router: workers
            .filter((w: any) => w.type === 'router')
            .reduce((sum: number, w: any) => sum + (w.error_count || 0), 0),
          vision: workers
            .filter((w: any) => w.type === 'vision')
            .reduce((sum: number, w: any) => sum + (w.error_count || 0), 0),
          tool: workers
            .filter((w: any) => w.type === 'tool')
            .reduce((sum: number, w: any) => sum + (w.error_count || 0), 0),
        },
      },
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
