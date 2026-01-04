"use client"

import * as React from "react"
import { WorkflowNode, type NodeStatus, type NodeType } from "./workflow-node"
import { ArrowRight } from "lucide-react"

interface WorkflowStep {
  id: string
  type: NodeType
  status: NodeStatus
  label: string
  description?: string
  metadata?: Record<string, unknown>
}

interface WorkflowCanvasProps {
  steps: WorkflowStep[]
}

export function WorkflowCanvas({ steps }: WorkflowCanvasProps) {
  return (
    <div className="flex w-full items-center justify-center gap-4 py-4">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <WorkflowNode
            type={step.type}
            status={step.status}
            label={step.label}
            description={step.description}
            metadata={step.metadata}
          />
          {index < steps.length - 1 && (
            <div className="flex shrink-0 items-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
