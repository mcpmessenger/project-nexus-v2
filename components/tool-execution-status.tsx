"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToolExecution {
  id: string
  toolName: string
  serverName: string
  status: "pending" | "running" | "completed" | "failed"
  startTime?: Date
  endTime?: Date
  rawOutput?: any
  error?: string
  requiresPermission?: boolean
}

interface ToolExecutionStatusProps {
  executions: ToolExecution[]
  onPermissionGrant?: (executionId: string, granted: boolean) => void
  className?: string
}

export function ToolExecutionStatus({
  executions,
  onPermissionGrant,
  className,
}: ToolExecutionStatusProps) {
  const [expandedOutputs, setExpandedOutputs] = React.useState<Set<string>>(new Set())

  const toggleOutput = (executionId: string) => {
    setExpandedOutputs((prev) => {
      const next = new Set(prev)
      if (next.has(executionId)) {
        next.delete(executionId)
      } else {
        next.add(executionId)
      }
      return next
    })
  }

  const getStatusIcon = (status: ToolExecution["status"]) => {
    switch (status) {
      case "pending":
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: ToolExecution["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-xs">Pending</Badge>
      case "running":
        return <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">Running</Badge>
      case "completed":
        return <Badge variant="outline" className="text-xs border-green-500 text-green-600">Completed</Badge>
      case "failed":
        return <Badge variant="outline" className="text-xs border-red-500 text-red-600">Failed</Badge>
    }
  }

  const formatOutput = (output: any): string => {
    if (typeof output === "string") return output
    try {
      return JSON.stringify(output, null, 2)
    } catch {
      return String(output)
    }
  }

  // Show only active executions (pending or running) or recent completed/failed
  const activeExecutions = executions.filter(
    (e) => e.status === "pending" || e.status === "running"
  )
  const recentExecutions = executions
    .filter((e) => e.status === "completed" || e.status === "failed")
    .slice(-3) // Show last 3 completed/failed

  const visibleExecutions = [...activeExecutions, ...recentExecutions]

  if (visibleExecutions.length === 0) return null

  return (
    <div className={cn("space-y-2", className)}>
      {visibleExecutions.map((execution) => {
        const isExpanded = expandedOutputs.has(execution.id)
        const isActive = execution.status === "pending" || execution.status === "running"

        return (
          <Card
            key={execution.id}
            className={cn(
              "transition-all",
              isActive && "border-blue-500/50 bg-blue-500/5",
              execution.status === "failed" && "border-red-500/50 bg-red-500/5"
            )}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <div className="mt-0.5">{getStatusIcon(execution.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">
                        {execution.toolName}
                      </span>
                      {getStatusBadge(execution.status)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {execution.serverName}
                    </div>
                    {execution.error && (
                      <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{execution.error}</span>
                      </div>
                    )}
                  </div>
                </div>

                {execution.requiresPermission && execution.status === "pending" && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onPermissionGrant?.(execution.id, true)}
                      className="h-7 px-2 text-xs"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onPermissionGrant?.(execution.id, false)}
                      className="h-7 px-2 text-xs"
                    >
                      Deny
                    </Button>
                  </div>
                )}

                {execution.rawOutput && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => toggleOutput(execution.id)}
                    className="h-6 w-6"
                  >
                    {isExpanded ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>

              {isExpanded && execution.rawOutput && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs font-medium mb-2 text-muted-foreground">
                    Raw Output:
                  </div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
                    {formatOutput(execution.rawOutput)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
