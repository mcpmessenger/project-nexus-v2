"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, Eye, Wrench, MessageSquare, CheckCircle2, Loader2, AlertCircle } from "lucide-react"

export type NodeType = "router" | "vision" | "tool" | "chat" | "result"
export type NodeStatus = "idle" | "processing" | "completed" | "failed"

interface WorkflowNodeProps {
  type: NodeType
  status: NodeStatus
  label: string
  description?: string
  metadata?: Record<string, unknown>
}

const nodeConfig = {
  router: {
    icon: Brain,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
  },
  vision: {
    icon: Eye,
    color: "text-accent",
    bgColor: "bg-accent/10",
    borderColor: "border-accent/30",
  },
  tool: {
    icon: Wrench,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
  },
  chat: {
    icon: MessageSquare,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-muted-foreground/30",
  },
  result: {
    icon: CheckCircle2,
    color: "text-accent",
    bgColor: "bg-accent/10",
    borderColor: "border-accent/30",
  },
}

const statusIcons = {
  idle: null,
  processing: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  completed: <CheckCircle2 className="h-4 w-4 text-accent" />,
  failed: <AlertCircle className="h-4 w-4 text-destructive" />,
}

export function WorkflowNode({ type, status, label, description, metadata }: WorkflowNodeProps) {
  const config = nodeConfig[type]
  const Icon = config.icon
  const statusIcon = statusIcons[status]

  return (
    <Card className={`min-w-[280px] max-w-[280px] w-[280px] shrink-0 border-2 ${config.borderColor} transition-all hover:shadow-lg`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bgColor}`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          {statusIcon && <div>{statusIcon}</div>}
        </div>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      {(description || metadata) && (
        <CardContent className="pt-0">
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {metadata && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(metadata)
                .slice(0, 3)
                .map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {String(value)}
                  </Badge>
                ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
