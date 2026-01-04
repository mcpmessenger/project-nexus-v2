// Pulsar client singleton for managing connections
// This is a mock implementation for frontend development
// In production, this would connect to actual Pulsar cluster

export interface PulsarMessage {
  message_id: string
  org_id: string
  user_id: string
  type: string
  created_at: string
  payload: Record<string, unknown>
  meta?: Record<string, unknown>
}

export interface PulsarTask {
  task_id: string
  message_id: string
  task_type: "vision" | "tool" | "chat" | "decompose"
  priority: number
  status: "pending" | "processing" | "success" | "failed"
  payload: Record<string, unknown>
  trace?: Record<string, unknown>
}

export interface WorkerStatus {
  worker_id: string
  type: "router" | "vision" | "tool"
  status: "idle" | "processing" | "error"
  current_task_id?: string
  processed_count: number
  error_count: number
  last_heartbeat: string
}

class PulsarClient {
  private static instance: PulsarClient
  private connected = false

  private constructor() {}

  static getInstance(): PulsarClient {
    if (!PulsarClient.instance) {
      PulsarClient.instance = new PulsarClient()
    }
    return PulsarClient.instance
  }

  async connect(orgId: string): Promise<void> {
    // Mock connection for frontend dev
    console.log("[v0] Connecting to Pulsar tenant:", orgId)
    this.connected = true
  }

  async publishMessage(topic: string, message: PulsarMessage): Promise<void> {
    if (!this.connected) throw new Error("Not connected")
    console.log("[v0] Publishing to topic:", topic, message)
    // In production: actual Pulsar publish
  }

  async subscribeToTopic(topic: string, callback: (message: unknown) => void): Promise<() => void> {
    console.log("[v0] Subscribing to topic:", topic)
    // In production: create Pulsar consumer
    // Return unsubscribe function
    return () => console.log("[v0] Unsubscribed from:", topic)
  }

  isConnected(): boolean {
    return this.connected
  }
}

export const pulsarClient = PulsarClient.getInstance()
