import { NextResponse } from "next/server"

// Mock worker status endpoint
export async function GET() {
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

  return NextResponse.json({ workers: mockWorkers })
}
