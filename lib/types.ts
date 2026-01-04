// Shared types for Project Nexus v2

export interface User {
  id: string
  email: string
  name: string
  org_id: string
  avatar_url?: string
  stripe_customer_id?: string
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

export interface StripeCustomer {
  id: string
  stripe_customer_id: string
  created_at: string
  updated_at: string
}

export interface BillingUsageEvent {
  id: string
  user_id: string
  stripe_event_id: string | null
  tool_name: string
  server_id: string
  event_name: string
  value: number
  metadata: Record<string, unknown>
  created_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete" | "incomplete_expired" | "unpaid"
  current_period_start: string | null
  current_period_end: string | null
  plan_type: "free" | "premium" | "enterprise"
  created_at: string
  updated_at: string
}
