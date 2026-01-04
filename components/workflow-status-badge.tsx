import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react"

type WorkflowStatus = "pending" | "processing" | "completed" | "failed"

interface WorkflowStatusBadgeProps {
  status: WorkflowStatus
  size?: "sm" | "md" | "lg"
}

export function WorkflowStatusBadge({ status, size = "md" }: WorkflowStatusBadgeProps) {
  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"

  const variants = {
    pending: {
      variant: "secondary" as const,
      icon: <Circle className={iconSize} />,
      label: "Pending",
    },
    processing: {
      variant: "default" as const,
      icon: <Loader2 className={`${iconSize} animate-spin`} />,
      label: "Processing",
    },
    completed: {
      variant: "outline" as const,
      icon: <CheckCircle2 className={`${iconSize} text-accent`} />,
      label: "Completed",
    },
    failed: {
      variant: "destructive" as const,
      icon: <XCircle className={iconSize} />,
      label: "Failed",
    },
  }

  const config = variants[status]

  return (
    <Badge variant={config.variant} className="flex items-center gap-1.5">
      {config.icon}
      {config.label}
    </Badge>
  )
}
