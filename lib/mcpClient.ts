import { spawn } from "child_process"
import { playwrightMcpManager } from "./playwright-client"

type TransportType = "http" | "stdio"

export interface ToolSchema {
  id?: string
  name: string
  description?: string
  schema?: Record<string, unknown>
  inputSchema?: Record<string, unknown> // MCP protocol uses inputSchema
  categories?: string[]
}

export interface McpServerConfig {
  id: string
  name: string
  transport: TransportType
  url?: string
  headers: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
  tools?: ToolSchema[]
}

export interface McpRouteConfigInput {
  id?: string
  name?: string
  transport?: TransportType
  url?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
  tools?: ToolSchema[]
}

export interface McpRouteRequest {
  action: "list_tools" | "invoke" | "health"
  method?: string
  params?: Record<string, unknown>
  config: McpRouteConfigInput
}

export interface McpHealthResponse {
  healthy: boolean
  message?: string
  lastUpdatedAt?: number
}

interface JsonRpcEnvelope {
  jsonrpc: "2.0"
  id: string
  method: string
  params: Record<string, unknown>
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0"
  id?: string
  result?: T
  error?: {
    code?: number
    message: string
    data?: unknown
  }
}

const SCHEMA_CACHE_TTL_MS = 45_000

interface SchemaCacheEntry {
  schema: ToolSchema[]
  updatedAt: number
}

const schemaCache = new Map<string, SchemaCacheEntry>()

const GOOGLE_GROUNDING_URL = "https://mapstools.googleapis.com/mcp"

export function buildMcpConfig(input: McpRouteConfigInput): McpServerConfig {
  return {
    id: input.id ?? `mcp-${crypto.randomUUID()}`,
    name: input.name ?? "MCP Server",
    transport: input.transport ?? "http",
    url: input.url,
    headers: { ...(input.headers ?? {}) },
    command: input.command,
    args: input.args,
    env: input.env,
    tools: input.tools,
  }
}

export function getCachedToolSchema(serverId: string): ToolSchema[] | undefined {
  const entry = schemaCache.get(serverId)
  if (!entry) return undefined
  if (Date.now() - entry.updatedAt > SCHEMA_CACHE_TTL_MS) {
    schemaCache.delete(serverId)
    return undefined
  }
  // STRUCTURAL ENFORCEMENT: Filter browser_snapshot from cached tools for Playwright
  if (serverId === 'playwright' && entry.schema) {
    const filtered = entry.schema.filter(tool => tool.name !== 'browser_snapshot')
    if (filtered.length !== entry.schema.length) {
      console.log(`[MCP Client] Filtered browser_snapshot from cached Playwright tools`)
      return filtered
    }
  }
  return entry.schema
}

/**
 * Clear tool cache for a specific server (useful for forcing refresh after filtering changes)
 */
export function clearToolSchemaCache(serverId?: string): void {
  if (serverId) {
    schemaCache.delete(serverId)
    console.log(`[MCP Client] Cleared tool cache for ${serverId}`)
  } else {
    schemaCache.clear()
    console.log(`[MCP Client] Cleared all tool caches`)
  }
}

export function cacheToolSchema(serverId: string, schema: ToolSchema[]) {
  schemaCache.set(serverId, { schema, updatedAt: Date.now() })
}

export function ensureManagedGoogleConfig(config: McpServerConfig): McpServerConfig {
  const apiKey = process.env.GOOGLE_MAPS_GROUNDING_API_KEY
  if (!apiKey) {
    throw new Error("Missing GOOGLE_MAPS_GROUNDING_API_KEY environment variable")
  }

  return {
    ...config,
    transport: "http",
    url: GOOGLE_GROUNDING_URL,
    headers: {
      ...config.headers,
      "X-Goog-Api-Key": apiKey,
    },
  }
}

export function validateManagedServerConfig(config: McpServerConfig) {
  if (config.id === "google-maps-grounding") {
    if (config.transport !== "http") {
      throw new Error("Google Maps Grounding Lite must use HTTP/SSE transport")
    }
    if (config.url !== GOOGLE_GROUNDING_URL) {
      throw new Error("Google Maps Grounding Lite must target https://mapstools.googleapis.com/mcp")
    }
    if (!config.headers["X-Goog-Api-Key"]) {
      throw new Error("Google Maps Grounding Lite requires an API key header")
    }
  }
}

export class McpClient {
  constructor(public config: McpServerConfig) {}

  async listTools(): Promise<ToolSchema[]> {
    const cached = getCachedToolSchema(this.config.id)
    if (cached) {
      return cached
    }
    const response = await this.call("tools/list", {})
    const tools = extractTools(response)
    const finalTools = tools.length ? tools : this.config.tools ?? []
    cacheToolSchema(this.config.id, finalTools)
    return finalTools
  }

  async call(method: string, params: Record<string, unknown> = {}) {
    const payload: JsonRpcEnvelope = {
      jsonrpc: "2.0",
      id: `mcp-${crypto.randomUUID()}`,
      method,
      params,
    }

    if (this.config.transport === "stdio") {
      // Use persistent manager for Playwright to maintain browser context across calls
      if (this.config.id === "playwright") {
        return playwrightMcpManager.call(payload, this.config)
      }
      // Use stateless transport for other servers
      return callStdioTransport(this.config, payload)
    }

    return callSseTransport(this.config, payload)
  }

  async health(): Promise<McpHealthResponse> {
    try {
      const tools = await this.listTools()
      return {
        healthy: true,
        message: `Responding with ${tools.length} tool(s)`,
        lastUpdatedAt: Date.now(),
      }
    } catch (error) {
      if (error instanceof Error) {
        return { healthy: false, message: error.message, lastUpdatedAt: Date.now() }
      }
      return { healthy: false, message: "Unknown error", lastUpdatedAt: Date.now() }
    }
  }
}

function extractTools(response: JsonRpcResponse): ToolSchema[] {
  if (!response) return []
  const candidate = response.result ?? response
  if (Array.isArray(candidate)) {
    return candidate as ToolSchema[]
  }
  if (typeof candidate === "object" && candidate !== null && "tools" in candidate) {
    const raw = (candidate as { tools?: unknown }).tools
    if (Array.isArray(raw)) {
      return raw as ToolSchema[]
    }
  }
  return []
}

async function callStdioTransport(config: McpServerConfig, payload: JsonRpcEnvelope) {
  if (!config.command) {
    throw new Error("Stdio transport requires a command to spawn")
  }

  return new Promise<JsonRpcResponse>((resolve, reject) => {
    // On Windows, npx needs to be run through the shell or as npx.cmd
    const isWindows = process.platform === "win32"
    const command = isWindows && config.command === "npx" ? "npx.cmd" : config.command
    
    const proc = spawn(command, config.args ?? [], {
      env: { ...process.env, ...(config.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
      shell: isWindows, // Use shell on Windows to handle .cmd files properly
    })

    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })

    proc.stderr.on("data", (chunk) => {
      const chunkStr = chunk.toString()
      stderr += chunkStr
      // Log stderr in real-time for debugging (especially useful for Playwright)
      if (chunkStr.trim()) {
        console.error(`[MCP Stdio] stderr from ${config.command}:`, chunkStr.trim())
      }
    })

    proc.on("error", (err) => {
      console.error(`[MCP Stdio] Process error for ${config.command}:`, err)
      reject(err)
    })

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error(`[MCP Stdio] Process exited with code ${code}. Command: ${config.command} ${(config.args || []).join(" ")}`)
        console.error(`[MCP Stdio] stderr output:`, stderr.trim() || "<none>")
        reject(
          new Error(
            `Local MCP process exited with code ${code}. stderr: ${stderr.trim() || "<none>"}`
          )
        )
        return
      }

      try {
        const parsed = JSON.parse(stdout)
        resolve(parsed)
      } catch (error) {
        console.error(`[MCP Stdio] Failed to parse JSON response. Command: ${config.command}`)
        console.error(`[MCP Stdio] stdout (first 500 chars):`, stdout.substring(0, 500))
        console.error(`[MCP Stdio] stderr:`, stderr.trim() || "<none>")
        reject(
          new Error(
            `Unable to parse MCP stdio response: ${(error as Error).message}. Raw output: ${stdout.substring(0, 200)}...`
          )
        )
      }
    })

    // MCP stdio protocol requires newline-delimited JSON
    proc.stdin.write(JSON.stringify(payload) + "\n")
    proc.stdin.end()
  })
}

async function callSseTransport(config: McpServerConfig, payload: JsonRpcEnvelope) {
  if (!config.url) {
    throw new Error("HTTP transport requires a target URL")
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...config.headers,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const bodyText = await response.text()
    throw new Error(
      `MCP HTTP transport responded with ${response.status}. Body: ${bodyText}`
    )
  }

  const parsed = await readSseJson(response.body)
  if (parsed.error) {
    throw new Error(parsed.error.message)
  }

  return parsed.result ?? parsed
}

async function readSseJson(stream: ReadableStream<Uint8Array> | null): Promise<JsonRpcResponse> {
  if (!stream) {
    throw new Error("Empty SSE stream")
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let lastPayload: JsonRpcResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split("\n\n")
    buffer = chunks.pop() ?? ""
    for (const chunk of chunks) {
      const event = chunk.trim()
      if (!event) continue
      const dataLine = event
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith("data:"))
      if (!dataLine) continue
      const payload = dataLine.slice("data:".length).trim()
      if (!payload || payload === "[DONE]") continue
      try {
        lastPayload = JSON.parse(payload)
      } catch (error) {
        console.warn("Unable to parse SSE payload", error)
      }
    }
  }

  if (buffer) {
    const dataLine = buffer
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("data:"))
    if (dataLine) {
      const payload = dataLine.slice("data:".length).trim()
      if (payload && payload !== "[DONE]") {
        try {
          lastPayload = JSON.parse(payload)
        } catch (error) {
          console.warn("Unable to parse trailing SSE payload", error)
        }
      }
    }
  }

  if (!lastPayload) {
    throw new Error("No JSON-RPC payload received from SSE stream")
  }

  return lastPayload
}
