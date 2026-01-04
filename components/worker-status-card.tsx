"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, Eye, Wrench, Circle } from "lucide-react"
import type { WorkerStatus } from "@/lib/pulsar-client"

interface WorkerStatusCardProps {
  worker: WorkerStatus
}

const workerIcons = {
  router: Brain,
  vision: Eye,
  tool: Wrench,
}

const workerColors = {
  router: "text-primary bg-primary/10",
  vision: "text-accent bg-accent/10",
  tool: "text-primary bg-primary/10",
}

const statusColors = {
  idle: "bg-muted-foreground",
  processing: "bg-primary animate-pulse",
  error: "bg-destructive",
}

export function WorkerStatusCard({ worker }: WorkerStatusCardProps) {
  const Icon = workerIcons[worker.type]
  const colorClass = workerColors[worker.type]
  const statusColor = statusColors[worker.status]

  const uptime = new Date(worker.last_heartbeat).toLocaleTimeString()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <Circle className={`h-2 w-2 rounded-full ${statusColor}`} />
            <Badge variant={worker.status === "error" ? "destructive" : "secondary"} className="capitalize">
              {worker.status}
            </Badge>
          </div>
        </div>
        <CardTitle className="text-base font-mono">{worker.worker_id}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span className="font-medium capitalize">{worker.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Processed</span>
            <span className="font-medium">{worker.processed_count.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Errors</span>
            <span className={`font-medium ${worker.error_count > 0 ? "text-destructive" : ""}`}>
              {worker.error_count}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Heartbeat</span>
            <span className="font-mono text-xs">{uptime}</span>
          </div>
          {worker.current_task_id && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Task</span>
              <span className="font-mono text-xs">{worker.current_task_id}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
