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
  org_id: string
  user_id: string
  task_type: "vision" | "tool" | "chat" | "decompose"
  priority: number
  status: "pending" | "processing" | "success" | "failed"
  created_at: string
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
  private responseCallbacks: Map<string, (response: any) => void> = new Map()

  private constructor() { }

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

    // Simulate result consumer
    this.subscribeToTopic("tool-results", (message: any) => {
      const { id, result, error } = message.payload
      const callback = this.responseCallbacks.get(id)
      if (callback) {
        callback({ result, error })
        this.responseCallbacks.delete(id)
      }
    })
  }

  async publishMessage(topic: string, message: PulsarMessage | PulsarTask): Promise<void> {
    if (!this.connected) throw new Error("Not connected")
    console.log(`[Pulsar] Publishing to topic: ${topic}`, JSON.stringify(message).substring(0, 200))

    // In production: actual Pulsar publish

    // Mock Worker simulation for tool execution
    if (topic === "tool-tasks") {
      this.simulateWorker(message as PulsarTask)
    }
  }

  private async simulateWorker(task: PulsarTask) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500))

    const { id, method, params } = task.payload as any
    console.log(`[Pulsar Worker] Processing task ${task.task_id} (MCP ID: ${id})`)

    // In a real system, the worker would call the MCP server here
    // For this mock, we'll just indicate the worker is active
    // The actual orchestration for calling the real MCP server will still happen 
    // in tools-helper.ts for now, which will call this client.
  }

  /**
   * High-level helper for request-response over Pulsar
   */
  async invokeTool(payload: any, orgId: string, userId: string, executor?: () => Promise<any>): Promise<any> {
    if (!this.connected) await this.connect(orgId)

    const requestId = payload.id || crypto.randomUUID()

    const task: PulsarTask = {
      task_id: crypto.randomUUID(),
      message_id: crypto.randomUUID(),
      org_id: orgId,
      user_id: userId,
      task_type: "tool",
      priority: 1,
      status: "pending",
      created_at: new Date().toISOString(),
      payload: {
        ...payload,
        id: requestId
      }
    }

    // Publish task
    await this.publishMessage("tool-tasks", task)

    if (executor) {
      try {
        const result = await executor()

        // Simulate result publication back to Pulsar
        const resultMessage: PulsarMessage = {
          message_id: crypto.randomUUID(),
          org_id: orgId,
          user_id: userId,
          type: "tool-result",
          created_at: new Date().toISOString(),
          payload: {
            id: requestId,
            result: result?.result || result,
            error: result?.error
          }
        }

        await this.publishMessage("tool-results", resultMessage)
        return result
      } catch (err) {
        const errorResult = { error: { message: err instanceof Error ? err.message : String(err) } }
        await this.publishMessage("tool-results", {
          payload: { id: requestId, error: errorResult.error }
        } as any)
        return errorResult
      }
    }

    return new Promise((resolve) => {
      this.responseCallbacks.set(requestId, resolve)

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.responseCallbacks.has(requestId)) {
          console.warn(`[Pulsar] Request ${requestId} timed out`)
          this.responseCallbacks.get(requestId)?.({ error: { message: "Request timed out" } })
          this.responseCallbacks.delete(requestId)
        }
      }, 60000)
    })
  }

  async subscribeToTopic(topic: string, callback: (message: unknown) => void): Promise<() => void> {
    console.log("[Pulsar] Subscribing to topic:", topic)
    // In production: create Pulsar consumer

    // For mock: store in a local registry if we needed full pub/sub simulation
    return () => console.log("[Pulsar] Unsubscribed from:", topic)
  }

  isConnected(): boolean {
    return this.connected
  }
}

export const pulsarClient = PulsarClient.getInstance()
