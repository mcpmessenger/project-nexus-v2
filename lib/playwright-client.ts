/**
 * Playwright MCP Persistent Client Manager
 * 
 * Maintains a persistent process for Playwright MCP to allow browser context
 * to persist across multiple tool calls (e.g., navigate + screenshot).
 * 
 * This solves the "browser context is closed" error by keeping the process
 * alive between tool invocations.
 */

import { spawn, ChildProcess } from "child_process"
import type { McpServerConfig, JsonRpcEnvelope, JsonRpcResponse } from "./mcpClient"

class PlaywrightMcpManager {
  private static instance: PlaywrightMcpManager
  private process: ChildProcess | null = null
  private requestQueue: Array<{
    payload: JsonRpcEnvelope
    resolve: (value: JsonRpcResponse) => void
    reject: (error: Error) => void
  }> = []
  private processing = false
  private config: McpServerConfig | null = null
  private stdoutBuffer = ""
  private currentRequest: typeof this.requestQueue[0] | null = null

  private constructor() {}

  static getInstance(): PlaywrightMcpManager {
    if (!PlaywrightMcpManager.instance) {
      PlaywrightMcpManager.instance = new PlaywrightMcpManager()
    }
    return PlaywrightMcpManager.instance
  }

  async ensureProcess(config: McpServerConfig): Promise<void> {
    if (this.process && !this.process.killed) {
      return // Process already running
    }

    const isWindows = process.platform === "win32"
    const command = isWindows && config.command === "npx" ? "npx.cmd" : config.command

    console.log(`[Playwright MCP] Spawning persistent process: ${command} ${(config.args || []).join(" ")}`)

    this.process = spawn(command, config.args ?? [], {
      env: { ...process.env, ...(config.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
      shell: isWindows,
    })

    this.config = config
    this.stdoutBuffer = ""
    this.setupProcessHandlers()
  }

  private setupProcessHandlers() {
    if (!this.process) return

    this.process.stdout.on("data", (chunk) => {
      this.stdoutBuffer += chunk.toString()
      
      // MCP/JSON-RPC protocol sends one complete message per line
      // Use line-buffered parsing to handle large base64 data (screenshots)
      let boundary = this.stdoutBuffer.indexOf('\n')
      while (boundary !== -1) {
        const message = this.stdoutBuffer.substring(0, boundary).trim()
        this.stdoutBuffer = this.stdoutBuffer.substring(boundary + 1)
        
        if (message && this.currentRequest) {
          try {
            const parsed = JSON.parse(message) as JsonRpcResponse
            // Match response to request by ID (JSON-RPC standard)
            if (parsed.id === this.currentRequest.payload.id) {
              this.currentRequest.resolve(parsed)
              this.currentRequest = null
              this.processing = false
              this.processNextRequest()
              return // Exit after processing one complete message
            } else {
              console.warn(`[Playwright MCP] Response ID mismatch. Expected: ${this.currentRequest.payload.id}, Got: ${parsed.id}`)
            }
          } catch (e) {
            console.error(`[Playwright MCP] Failed to parse JSON response:`, e)
            console.error(`[Playwright MCP] Message preview:`, message.substring(0, 200))
            if (this.currentRequest) {
              this.currentRequest.reject(new Error(`Failed to parse MCP response: ${e instanceof Error ? e.message : 'Unknown error'}`))
              this.currentRequest = null
              this.processing = false
              this.processNextRequest()
            }
            return
          }
        }
        boundary = this.stdoutBuffer.indexOf('\n')
      }
    })

    this.process.stderr.on("data", (chunk) => {
      const chunkStr = chunk.toString()
      if (chunkStr.trim()) {
        console.error(`[Playwright MCP] stderr:`, chunkStr.trim())
      }
    })

    this.process.on("error", (err) => {
      console.error(`[Playwright MCP] Process error:`, err)
      if (this.currentRequest) {
        this.currentRequest.reject(err)
        this.currentRequest = null
        this.processing = false
      }
      this.process = null
      this.stdoutBuffer = ""
      this.processNextRequest()
    })

    this.process.on("close", (code) => {
      console.log(`[Playwright MCP] Process closed with code ${code}`)
      if (this.currentRequest) {
        // Only reject if it's an unexpected close (non-zero code)
        if (code !== 0) {
          this.currentRequest.reject(new Error(`Playwright MCP process closed with code ${code}`))
        } else {
          // Normal close - might be the process terminating after a command
          // For now, we'll treat this as an error since we expect the process to stay alive
          this.currentRequest.reject(new Error(`Playwright MCP process closed unexpectedly`))
        }
        this.currentRequest = null
        this.processing = false
      }
      this.process = null
      this.stdoutBuffer = ""
      this.processNextRequest()
    })
  }

  async call(payload: JsonRpcEnvelope, config: McpServerConfig): Promise<JsonRpcResponse> {
    await this.ensureProcess(config)

    return new Promise((resolve, reject) => {
      // Wrap resolve to check for browser lock errors and auto-recover
      const wrappedResolve = (value: JsonRpcResponse) => {
        // Check for browser lock/contention errors in the response
        // Playwright MCP can return errors in value.error OR value.result with isError:true
        let errorMessage = ""
        
        if (value.error) {
          const errorText = JSON.stringify(value.error).toLowerCase()
          errorMessage = typeof value.error === 'object' && 'message' in value.error
            ? String(value.error.message).toLowerCase()
            : errorText
        } else if (value.result && typeof value.result === 'object' && 'isError' in value.result && value.result.isError) {
          // Error returned in result with isError flag (Playwright MCP format)
          const resultStr = JSON.stringify(value.result).toLowerCase()
          errorMessage = resultStr
        }
        
        if (errorMessage && (
            errorMessage.includes("browser is currently in use") ||
            errorMessage.includes("browser is already in use") ||
            errorMessage.includes("browser context is closed") ||
            errorMessage.includes("context closed") ||
            errorMessage.includes("target closed"))) {
          console.warn(`[Playwright MCP] Browser lock detected: ${errorMessage.substring(0, 200)}. Resetting process...`)
          // Force cleanup - next call will spawn a fresh process with --isolated flag
          // The --isolated flag should prevent this issue, but cleanup ensures clean state
          this.cleanup().catch(err => {
            console.error(`[Playwright MCP] Error during auto-recovery cleanup:`, err)
          })
        }
        resolve(value)
      }

      this.requestQueue.push({ payload, resolve: wrappedResolve, reject })
      if (!this.processing) {
        this.processNextRequest()
      }
    })
  }

  private processNextRequest() {
    if (this.processing || this.requestQueue.length === 0 || !this.process) {
      return
    }

    const request = this.requestQueue.shift()
    if (!request) return

    this.processing = true
    this.currentRequest = request

    try {
      if (!this.process.stdin || this.process.stdin.destroyed) {
        request.reject(new Error("Playwright MCP process stdin is not available"))
        this.currentRequest = null
        this.processing = false
        this.processNextRequest()
        return
      }

      const payloadStr = JSON.stringify(request.payload) + "\n"
      this.process.stdin.write(payloadStr, (error) => {
        if (error) {
          request.reject(error)
          this.currentRequest = null
          this.processing = false
          this.processNextRequest()
        }
        // Success - stdout handler will resolve when response is received (matched by ID)
      })
    } catch (error) {
      request.reject(error as Error)
      this.currentRequest = null
      this.processing = false
      this.processNextRequest()
    }
  }

  async cleanup(): Promise<void> {
    console.log(`[Playwright MCP] Cleaning up persistent process`)
    
    // Reject any pending requests
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) {
        request.reject(new Error("Playwright MCP process was reset due to browser lock"))
      }
    }
    
    if (this.currentRequest) {
      this.currentRequest.reject(new Error("Playwright MCP process was reset due to browser lock"))
      this.currentRequest = null
    }
    
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM')
      // Give it more time to clean up gracefully (browser processes need time to close)
      await new Promise(resolve => setTimeout(resolve, 2000))
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL')
        // Wait a bit more after force kill
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      this.process = null
    }
    
    this.requestQueue = []
    this.processing = false
    this.stdoutBuffer = ""
    this.currentRequest = null
    
    // Add a small delay after cleanup to ensure browser processes are fully terminated
    // This helps prevent "browser is already in use" errors on the next spawn
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  /**
   * Force reset the browser process (useful for manual recovery)
   */
  async reset(): Promise<void> {
    console.log(`[Playwright MCP] Manual reset requested`)
    await this.cleanup()
  }

  isProcessRunning(): boolean {
    return this.process !== null && !this.process.killed
  }
}

export const playwrightMcpManager = PlaywrightMcpManager.getInstance()

// Register cleanup handlers for graceful shutdown
if (typeof process !== 'undefined') {
  const cleanup = async () => {
    await playwrightMcpManager.cleanup()
    process.exit(0)
  }

  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
  
  // Also cleanup on uncaught exceptions to prevent zombie processes
  process.on('uncaughtException', async (error) => {
    console.error('[Playwright MCP] Uncaught exception, cleaning up:', error)
    await playwrightMcpManager.cleanup()
  })
}
