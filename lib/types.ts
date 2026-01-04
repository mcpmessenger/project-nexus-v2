// Shared types for Project Nexus v2

export interface User {
  id: string
  email: string
  name: string
  org_id: string
  avatar_url?: string
}

export interface Organization {
  id: string
  name: string
  tenant_id: string
  created_at: string
}

export interface WorkflowEvent {
  id: string
  org_id: string
  message_id: string
  task_id?: string
  event_type: "submitted" | "routed" | "processing" | "completed" | "failed"
  timestamp: string
  metadata: Record<string, unknown>
}

export interface MessageContract {
  message_id: string
  org_id: string
  user_id: string
  type: "upload" | "chat" | "tool_request"
  created_at: string
  payload: {
    file_url?: string
    mime?: string
    instructions?: string
    content?: string
  }
  meta?: Record<string, unknown>
}

export interface TaskResult {
  task_id: string
  status: "success" | "failed"
  result?: unknown
  error?: string
  duration_ms: number
  timestamp: string
}
