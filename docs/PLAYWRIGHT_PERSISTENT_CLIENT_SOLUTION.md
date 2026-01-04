# Playwright Persistent Client Solution

## Problem Statement
The current Playwright MCP implementation is **stateless** - each tool call spawns a new `npx @playwright/mcp@latest` process. When `browser_navigate` completes, its process terminates, losing the browser context. When `browser_screenshot` is called, it spawns a NEW process with no memory of the previous navigation, causing "browser context is closed" errors.

## Recommended Solution: Persistent Process Manager

### Architecture Overview
Create a singleton `PlaywrightMcpManager` that maintains a persistent MCP process across multiple tool calls, allowing browser context to persist between navigation and screenshot operations.

### Implementation Approach

#### Option 1: Singleton Process Manager (Recommended)
Maintain a single persistent process per server instance that handles all Playwright tool calls.

**Pros**:
- Maintains browser context across calls
- Efficient (single process overhead)
- Clean separation of concerns

**Cons**:
- More complex to implement
- Requires process lifecycle management
- Need to handle cleanup and error recovery

#### Option 2: Session-Based Process
Create a process per request/session that stays alive for the duration of multiple tool calls in a single request chain.

**Pros**:
- Simpler than singleton (process dies with request)
- Natural cleanup when request completes
- Better resource management

**Cons**:
- Process creation overhead per request
- Still need to handle multi-request scenarios
- More complex than Option 1 in practice

#### Option 3: Atomic Operation Wrapper
Wrap navigation + screenshot into a single atomic tool call that executes both operations in one process invocation.

**Pros**:
- Simplest implementation
- No process lifecycle management needed
- Works with current architecture

**Cons**:
- Requires Playwright MCP to support combined operations (may not exist)
- Less flexible (can't chain arbitrary operations)
- Would need custom wrapper tool

### Recommended Implementation: Option 1 (Singleton Process Manager)

```typescript
// lib/playwright-client.ts (new file)
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

    this.process = spawn(command, config.args ?? [], {
      env: { ...process.env, ...(config.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
      shell: isWindows,
    })

    this.config = config
    this.setupProcessHandlers()
  }

  private setupProcessHandlers() {
    if (!this.process) return

    let stdout = ""
    let currentRequest: typeof this.requestQueue[0] | null = null

    this.process.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
      // Try to parse complete JSON response
      try {
        const parsed = JSON.parse(stdout.trim())
        if (currentRequest) {
          currentRequest.resolve(parsed)
          currentRequest = null
          stdout = ""
          this.processing = false
          this.processNextRequest()
        }
      } catch (e) {
        // JSON not complete yet, wait for more data
      }
    })

    this.process.stderr.on("data", (chunk) => {
      console.error(`[Playwright MCP] stderr:`, chunk.toString().trim())
    })

    this.process.on("error", (err) => {
      console.error(`[Playwright MCP] Process error:`, err)
      if (currentRequest) {
        currentRequest.reject(err)
        currentRequest = null
        this.processing = false
      }
      this.process = null
      this.processNextRequest()
    })

    this.process.on("close", (code) => {
      console.error(`[Playwright MCP] Process closed with code ${code}`)
      if (currentRequest) {
        currentRequest.reject(new Error(`Process closed with code ${code}`))
        currentRequest = null
        this.processing = false
      }
      this.process = null
      this.processNextRequest()
    })
  }

  async call(payload: JsonRpcEnvelope, config: McpServerConfig): Promise<JsonRpcResponse> {
    await this.ensureProcess(config)

    return new Promise((resolve, reject) => {
      this.requestQueue.push({ payload, resolve, reject })
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
    // Store reference for response handling
    const currentRequest = request

    try {
      if (!this.process.stdin || this.process.stdin.destroyed) {
        currentRequest.reject(new Error("Process stdin is not available"))
        this.processing = false
        this.processNextRequest()
        return
      }

      this.process.stdin.write(JSON.stringify(request.payload) + "\n")
    } catch (error) {
      currentRequest.reject(error as Error)
      this.processing = false
      this.processNextRequest()
    }
  }

  async cleanup() {
    if (this.process && !this.process.killed) {
      this.process.kill()
      this.process = null
    }
    this.requestQueue = []
    this.processing = false
  }
}

export const playwrightMcpManager = PlaywrightMcpManager.getInstance()
```

### Integration into Existing Code

Update `lib/mcpClient.ts` to use the persistent manager for Playwright:

```typescript
// In lib/mcpClient.ts
import { playwrightMcpManager } from "./playwright-client"

async function callStdioTransport(config: McpServerConfig, payload: JsonRpcEnvelope) {
  // Use persistent manager for Playwright
  if (config.id === "playwright") {
    return playwrightMcpManager.call(payload, config)
  }

  // Keep existing stateless implementation for other servers
  // ... (existing code)
}
```

### Cleanup on Application Shutdown

Add cleanup handler in application lifecycle:

```typescript
// In app/layout.tsx or appropriate lifecycle hook
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await playwrightMcpManager.cleanup()
  })
  process.on('SIGINT', async () => {
    await playwrightMcpManager.cleanup()
  })
}
```

## Alternative: Temporary Workaround

Until the persistent client is implemented, update the system message to inform the AI that Playwright tools cannot be chained:

**File**: `app/api/messages/route.ts`

```typescript
content: `... 

CRITICAL FOR PLAYWRIGHT: The browser does not keep state between tool calls. Each Playwright tool call creates a new browser session. You MUST use tools that perform complete operations in a single call if available, or understand that navigation and screenshot operations cannot be chained across separate tool calls.`
```

## Testing the Solution

1. **Verify Standalone Persistence**: 
   ```bash
   npx @playwright/mcp
   # Manually send JSON-RPC calls for navigation, then screenshot
   # If this works, confirms process lifecycle is the issue
   ```

2. **Test Persistent Manager**:
   - Call `browser_navigate` tool
   - Immediately call `browser_screenshot` tool
   - Verify screenshot is captured (browser context persisted)

3. **Test Process Cleanup**:
   - Make multiple tool calls
   - Verify process stays alive
   - Stop application and verify process cleanup

## Next Steps

1. Implement `PlaywrightMcpManager` singleton
2. Integrate into `callStdioTransport` for Playwright server
3. Add process cleanup handlers
4. Update system message as temporary workaround
5. Test with real Playwright operations
6. Monitor for process leaks or resource issues
