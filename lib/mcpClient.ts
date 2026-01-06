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

function getCaseInsensitiveHeader(
  headers: Record<string, string> | undefined,
  headerName: string
): string | undefined {
  if (!headers) return undefined
  const lowerName = headerName.toLowerCase()
  return Object.keys(headers).reduce<string | undefined>((value, key) => {
    if (value) return value
    if (key.toLowerCase() === lowerName) {
      return headers[key]
    }
    return undefined
  }, undefined)
}

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
  const headerKey = getCaseInsensitiveHeader(config.headers, "X-Goog-Api-Key")
  const envKey = process.env.GOOGLE_MAPS_GROUNDING_API_KEY
  const apiKey = headerKey || envKey

  if (!apiKey) {
    throw new Error("Missing Google Maps API key. Provide X-Goog-Api-Key in the request or set GOOGLE_MAPS_GROUNDING_API_KEY.")
  }

  // Validate API key format (Google API keys start with "AIza" and are typically 39 characters)
  const trimmedKey = apiKey.trim()
  if (!trimmedKey.startsWith("AIza")) {
    throw new Error(`Invalid Google Maps API key format. Key should start with "AIza". It looks like you may have pasted a curl command instead of just the API key. Please go to Settings and enter only the API key (e.g., AIzaSy...).`)
  }
  
  if (trimmedKey.length < 30 || trimmedKey.length > 200) {
    console.warn(`[MCP Client] Warning: Google Maps API key length (${trimmedKey.length}) seems unusual. Expected ~39 characters.`)
  }

  const source = headerKey ? "request config" : "GOOGLE_MAPS_GROUNDING_API_KEY"
  const preview = trimmedKey.length > 10 ? `${trimmedKey.substring(0, 6)}...` : trimmedKey
  console.log(`[MCP Client] Using Google Maps API key from ${source} (length: ${trimmedKey.length}, preview: ${preview})`)

  const userProjectHeader = getCaseInsensitiveHeader(config.headers, "X-Goog-User-Project")
  const userProjectEnv = process.env.GOOGLE_MAPS_GROUNDING_USER_PROJECT
  const userProject = userProjectHeader?.trim() || userProjectEnv?.trim()

  const headers: Record<string, string> = {
    ...config.headers,
    "X-Goog-Api-Key": trimmedKey,
  }

  // Only set X-Goog-User-Project if explicitly provided
  // This header is for billing attribution to a different project than the API key's project
  // If the API key already belongs to the correct project, we don't need this header
  if (userProject) {
    headers["X-Goog-User-Project"] = userProject
    console.log(`[MCP Client] Using Google billing project: ${userProject}`)
  } else {
    console.log(
      `[MCP Client] No X-Goog-User-Project header specified. ` +
        `Using API key's default project. If you need to bill to a different project, ` +
        `set X-Goog-User-Project header or GOOGLE_MAPS_GROUNDING_USER_PROJECT env var.`
    )
  }

  return {
    ...config,
    transport: "http",
    url: GOOGLE_GROUNDING_URL,
    headers,
  }
}

export function validateManagedServerConfig(config: McpServerConfig) {
  // Check for both "maps" and "google-maps-grounding" server IDs
  if (config.id === "maps" || config.id === "google-maps-grounding") {
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
      // Validate stdio config has required fields
      if (!this.config.command) {
        throw new Error("Stdio transport requires a command to execute")
      }
      // Use persistent manager for Playwright to maintain browser context across calls
      if (this.config.id === "playwright") {
        return playwrightMcpManager.call(payload, this.config)
      }
      // Use stateless transport for other servers
      return callStdioTransport(this.config, payload)
    }

    // HTTP/SSE transport requires a valid URL
    if (!this.config.url) {
      throw new Error("HTTP transport requires a target URL")
    }
    
    // Check if this is a REST-based MCP server (LangChain, etc.) vs SSE-based
    // REST servers typically have /mcp/invoke endpoint, SSE servers use the base URL
    const urlLower = this.config.url.toLowerCase()
    const idLower = this.config.id?.toLowerCase() || ''
    const nameLower = this.config.name?.toLowerCase() || ''
    
    const isRestServer = urlLower.includes('/mcp/invoke') || 
                        urlLower.includes('/invoke') ||
                        urlLower.includes('langchain') || 
                        urlLower.includes('exa.ai') ||
                        idLower.includes('langchain') ||
                        idLower.includes('exa') ||
                        nameLower.includes('langchain') ||
                        nameLower.includes('langchain agent') ||
                        nameLower.includes('exa')
    
    if (isRestServer) {
      console.log(`[MCP Client] Using REST transport for server: ${this.config.name} (${this.config.url})`)
      return callRestTransport(this.config, payload)
    }
    
    console.log(`[MCP Client] Using SSE transport for server: ${this.config.name} (${this.config.url})`)
    return callSseTransport(this.config, payload)
  }

  async health(): Promise<McpHealthResponse> {
    try {
      // For REST-based servers (like LangChain), try the /health endpoint first
      if (this.config.transport === "http" && this.config.url) {
        const urlLower = this.config.url.toLowerCase()
        const idLower = this.config.id?.toLowerCase() || ''
        const nameLower = this.config.name?.toLowerCase() || ''
        
        const isRestServer = urlLower.includes('/mcp/invoke') || 
                            urlLower.includes('/invoke') ||
                            urlLower.includes('langchain') || 
                            urlLower.includes('exa.ai') ||
                            idLower.includes('langchain') ||
                            idLower.includes('exa') ||
                            nameLower.includes('langchain') ||
                            nameLower.includes('langchain agent') ||
                            nameLower.includes('exa')
        
        if (isRestServer) {
          // Try the /health endpoint for REST servers
          const baseUrl = this.config.url.replace(/\/mcp\/invoke.*$/, '').replace(/\/$/, '')
          try {
            const healthResponse = await fetch(`${baseUrl}/health`, {
              method: "GET",
              headers: {
                Accept: "application/json",
                ...this.config.headers,
              },
            })
            
            if (healthResponse.ok) {
              const healthData = await healthResponse.json()
              return {
                healthy: true,
                message: healthData.status === "running" 
                  ? `Server is running (${healthData.name || 'LangChain MCP Server'})`
                  : `Server responded: ${JSON.stringify(healthData)}`,
                lastUpdatedAt: Date.now(),
              }
            }
          } catch (healthError) {
            // If /health fails, fall through to listTools check
            console.log(`[MCP Client] Health endpoint check failed, trying tools/list:`, healthError)
          }
        }
      }
      
      // Default: try to list tools
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
      // Log stderr in real-time for debugging (especially useful for Playwright and HTTP servers like Exa)
      if (chunkStr.trim()) {
        console.error(`[MCP Stdio] stderr from ${config.id || config.command}:`, chunkStr.trim())
      }
    })

    proc.on("error", (err) => {
      console.error(`[MCP Stdio] Process error for ${config.command}:`, err)
      reject(err)
    })

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error(`[MCP Stdio] Process exited with code ${code}. Server: ${config.id || 'unknown'}, Command: ${config.command} ${(config.args || []).slice(0, 2).join(" ")}...`)
        console.error(`[MCP Stdio] Full command: ${config.command} ${(config.args || []).map((arg, idx) => 
          (arg === '--brave-api-key' && config.args?.[idx + 1]) ? '--brave-api-key <REDACTED>' : arg
        ).join(" ")}`)
        console.error(`[MCP Stdio] stderr output:`, stderr.trim() || "<none>")
        console.error(`[MCP Stdio] stdout output (first 500 chars):`, stdout.substring(0, 500) || "<none>")
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

  // Log headers being sent (for debugging - especially X-Goog-User-Project)
  const headersToSend: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...config.headers,
  }
  const hasApiKey = !!(headersToSend["X-Goog-Api-Key"] || headersToSend["x-goog-api-key"])
  const projectIdValue = headersToSend["X-Goog-User-Project"] || headersToSend["x-goog-user-project"]
  const hasProjectId = !!projectIdValue
  console.log(`[MCP Client] Headers being sent: X-Goog-Api-Key: ${hasApiKey ? 'PRESENT' : 'MISSING'}, X-Goog-User-Project: ${hasProjectId ? projectIdValue : 'MISSING'}`)
  
  const response = await fetch(config.url, {
    method: "POST",
    headers: headersToSend,
    body: JSON.stringify(payload),
  })

  // Check if response is actually JSON (Google Maps returns JSON even when Accept: text/event-stream)
  const contentType = response.headers.get("content-type") || ""
  const isJsonResponse = contentType.includes("application/json")
  
  if (!response.ok) {
    const bodyText = await response.text().catch(() => 'Unable to read response body')
    const bodyPreview = typeof bodyText === 'string' && bodyText.length > 0 ? bodyText.substring(0, 500) : String(bodyText || 'empty response')
    
    // Try to parse as JSON to extract helpful error messages (especially for Google Maps)
    if (isJsonResponse && typeof bodyText === 'string' && bodyText.length > 0) {
      try {
        const errorJson = JSON.parse(bodyText)
        
        // Check for Google Maps error format (result with isError: true)
        if (errorJson.result && typeof errorJson.result === 'object' && errorJson.result.isError === true) {
          const errorText = errorJson.result.content?.find((c: any) => c.type === "text")?.text || 
                           JSON.stringify(errorJson.result)
          
          // Provide helpful guidance for common Maps API errors
          if (typeof errorText === 'string' && (errorText.includes("Maps Grounding Lite API has not been used") || 
              errorText.includes("disabled via MCP policy"))) {
            throw new Error(
              `Maps Grounding Lite API is not enabled for your Google Cloud project.\n\n` +
              `To fix this:\n` +
              `1. Go to https://console.cloud.google.com/apis/library/mapstools.googleapis.com\n` +
              `2. Select your project (ID: ${errorText.match(/project (\d+)/)?.[1] || 'your project'})\n` +
              `3. Click "Enable" to enable the Maps Grounding Lite API\n` +
              `4. Wait a few minutes for the change to propagate, then try again\n\n` +
              `Original error: ${errorText}`
            )
          }
          
          throw new Error(typeof errorText === 'string' ? errorText : String(errorText))
        }
        
        // Check for standard JSON-RPC error format
        if (errorJson.error) {
          throw new Error(errorJson.error.message || JSON.stringify(errorJson.error))
        }
      } catch (parseError) {
        // If JSON parsing fails, fall through to generic error
      }
    }
    
    // Generic error for non-JSON or unparseable responses
    throw new Error(
      `MCP HTTP transport responded with ${response.status}. Body: ${bodyPreview}`
    )
  }

  if (isJsonResponse) {
    // Parse as plain JSON instead of SSE
    // Read body as text first (can only read once), then parse as JSON
    let bodyText: string
    try {
      const textResult = await response.text()
      bodyText = typeof textResult === 'string' ? textResult : String(textResult || '')
      const preview = typeof bodyText === 'string' && bodyText.length > 0 ? bodyText.substring(0, 100) : 'empty'
      console.log(`[MCP Client] Maps API response body length: ${bodyText.length}, preview: ${preview}`)
    } catch (textError) {
      console.error(`[MCP Client] Error reading response body:`, textError)
      bodyText = 'Unable to read response body'
    }
    
    let jsonData: any
    try {
      jsonData = JSON.parse(bodyText || '{}')
      console.log(`[MCP Client] Successfully parsed JSON response`)
    } catch (parseError) {
      const preview = bodyText && typeof bodyText === 'string' && bodyText.length > 0 ? bodyText.substring(0, 500) : 'empty response'
      console.error(`[MCP Client] Failed to parse JSON. Status: ${response.status}, Body preview: ${preview}`)
      throw new Error(`Failed to parse JSON response from Maps API. Status: ${response.status}. Body: ${preview}`)
    }
    
    // Check for standard JSON-RPC error format
    if (jsonData?.error) {
      const errorMsg = jsonData.error.message || JSON.stringify(jsonData.error)
      throw new Error(typeof errorMsg === 'string' ? errorMsg : String(errorMsg))
    }
    
    // Check for Google Maps error format (result with isError: true)
    if (jsonData?.result && typeof jsonData.result === 'object' && jsonData.result.isError === true) {
      const errorText = jsonData.result.content?.find((c: any) => c.type === "text")?.text || 
                       JSON.stringify(jsonData.result)
      throw new Error(typeof errorText === 'string' ? errorText : String(errorText))
    }
    
    // Handle Google Maps response format: result.content[0].text contains JSON string
    if (jsonData?.result && typeof jsonData.result === 'object' && Array.isArray(jsonData.result.content)) {
      const textContent = jsonData.result.content.find((c: any) => c.type === "text")
      if (textContent && typeof textContent.text === 'string') {
        try {
          // Parse the JSON string in the text field
          const parsedContent = JSON.parse(textContent.text)
          console.log(`[MCP Client] Parsed Maps API content from text field`)
          return parsedContent
        } catch (parseError) {
          // If parsing fails, return the text as-is
          console.log(`[MCP Client] Maps API text content is not JSON, returning as string`)
          return textContent.text
        }
      }
    }
    
    return jsonData?.result ?? jsonData
  }

  // Otherwise, try to parse as SSE
  if (!response.body) {
    throw new Error("Response body is null or undefined")
  }
  
  const parsed = await readSseJson(response.body)
  if (parsed.error) {
    throw new Error(parsed.error.message || 'Unknown SSE error')
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

/**
 * Call MCP server via REST/JSON-RPC transport (for servers like LangChain MCP)
 * These servers use standard JSON-RPC POST requests instead of SSE
 */
async function callRestTransport(config: McpServerConfig, payload: JsonRpcEnvelope): Promise<JsonRpcResponse> {
  if (!config.url) {
    throw new Error("HTTP transport requires a target URL")
  }

  // Check if this is LangChain server (uses different API format)
  const isLangChain = config.id?.toLowerCase().includes('langchain') || 
                      config.name?.toLowerCase().includes('langchain') ||
                      config.url.toLowerCase().includes('langchain')
  
  // Check if this is Exa server (uses standard JSON-RPC at base URL)
  const isExa = config.id?.toLowerCase().includes('exa') || 
                config.name?.toLowerCase().includes('exa') ||
                config.url.toLowerCase().includes('exa.ai')
  
  // For REST-based MCP servers, determine the correct endpoint
  let invokeUrl = config.url
  if (isExa) {
    // Exa uses the base URL directly (https://mcp.exa.ai/mcp) for JSON-RPC
    invokeUrl = config.url.replace(/\/$/, '')
  } else if (!invokeUrl.includes('/mcp/invoke') && !invokeUrl.includes('/invoke')) {
    // Other servers: append /mcp/invoke if it's the base URL
    invokeUrl = invokeUrl.replace(/\/$/, '') + '/mcp/invoke'
  }

  // LangChain server uses a different format - convert JSON-RPC to LangChain format
  let requestBody: any
  if (isLangChain) {
    // LangChain expects: { tool: "tool_name", arguments: {...} }
    // For tools/list, try the /tools endpoint first (GET request)
    if (payload.method === "tools/list") {
      // Try using the base URL with /tools endpoint for listing
      const baseUrl = config.url.replace(/\/mcp\/invoke.*$/, '').replace(/\/$/, '')
      const toolsUrl = `${baseUrl}/tools`
      
      console.log(`[MCP Client] Trying GET ${toolsUrl} for LangChain tools list`)
      try {
        const toolsResponse = await fetch(toolsUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...config.headers,
          },
        })
        
        console.log(`[MCP Client] GET /tools response status: ${toolsResponse.status}`)
        
        if (toolsResponse.ok) {
          const toolsData = await toolsResponse.json()
          console.log(`[MCP Client] ✅ Got tools from /tools endpoint:`, JSON.stringify(toolsData).substring(0, 500))
          // Server returns: { tools: [...] } format
          const tools = Array.isArray(toolsData) ? toolsData : (toolsData.tools || [])
          const convertedTools = tools.map((t: any) => ({
            name: t.name || t.tool || "",
            description: t.description || "",
            inputSchema: t.inputSchema || t.schema || t.arguments || {},
          }))
          console.log(`[MCP Client] ✅ Converted ${convertedTools.length} tools from /tools endpoint to MCP format`)
          return {
            jsonrpc: "2.0",
            id: payload.id,
            result: {
              tools: convertedTools,
            },
          }
        } else {
          const errorText = await toolsResponse.text().catch(() => 'Unable to read error response')
          const errorPreview = typeof errorText === 'string' && errorText.length > 0 ? errorText.substring(0, 200) : String(errorText || 'empty response')
          console.log(`[MCP Client] /tools endpoint returned ${toolsResponse.status}: ${errorPreview}`)
          // Fall through to return empty array (client will use hardcoded tool)
        }
      } catch (e) {
        // Fall through to try /mcp/invoke with converted format
        console.log(`[MCP Client] /tools endpoint failed:`, e instanceof Error ? e.message : e)
      }
      
      // Server now supports /tools endpoint (as of Dec 26, 2024 update)
      // If /tools returned 404, the endpoint might not be available yet
      // Return empty array - client will use hardcoded tool as fallback
      console.log(`[MCP Client] ⚠️ LangChain /tools endpoint not available. Using fallback.`)
      return {
        jsonrpc: "2.0",
        id: payload.id,
        result: {
          tools: [],
        },
      }
    } else if (payload.method === "tools/call") {
      // Convert tools/call to LangChain format
      const toolName = (payload.params as any)?.name || ""
      const toolArgs = (payload.params as any)?.arguments || {}
      
      // For LangChain agent tool, use "agent_executor" as per the documentation
      // Reference: https://github.com/mcpmessenger/langchain-mcp
      if (toolName === "agent" || toolName === "langchain_agent" || toolName === "agent_executor") {
        const query = toolArgs.query || toolArgs.input || JSON.stringify(toolArgs)
        const queryStr = typeof query === 'string' ? query : JSON.stringify(query)
        
        // According to the documentation, the tool name is "agent_executor"
        // Server has been fixed (Dec 26, 2024) to properly handle system_instruction parameter
        // Build arguments - system_instruction is now supported (optional)
        const argumentsObj: any = {
          query: queryStr,
        }
        
        // Include system_instruction if provided (server now handles it correctly)
        if (toolArgs.system_instruction && typeof toolArgs.system_instruction === 'string' && toolArgs.system_instruction.trim()) {
          argumentsObj.system_instruction = toolArgs.system_instruction.trim()
          console.log(`[MCP Client] Including system_instruction in request`)
        }
        
        console.log(`[MCP Client] LangChain tool invocation - using "agent_executor" with query: ${queryStr.substring(0, 100)}`)
        requestBody = {
          tool: "agent_executor", // Correct tool name per documentation
          arguments: argumentsObj,
        }
      } else {
        requestBody = {
          tool: toolName,
          arguments: toolArgs,
        }
      }
    } else {
      // For other methods, try to convert
      requestBody = {
        tool: payload.method.replace("tools/", "").replace("/", "_"),
        arguments: payload.params || {},
      }
    }
  } else {
    // Standard JSON-RPC format for other REST servers
    requestBody = payload
  }

  console.log(`[MCP Client] Making REST request to: ${invokeUrl}`)
  console.log(`[MCP Client] Request body:`, JSON.stringify(requestBody).substring(0, 500))
  
  // Exa requires both application/json and text/event-stream in Accept header
  const acceptHeader = isExa 
    ? "application/json, text/event-stream"
    : "application/json"
  
  // Build headers - Accept must come after config.headers to ensure it's not overridden
  const headers = {
    "Content-Type": "application/json",
    ...config.headers,
    Accept: acceptHeader, // Set Accept last to ensure it's not overridden by config.headers
  }
  
  const response = await fetch(invokeUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  })
  
  console.log(`[MCP Client] Response status: ${response.status} ${response.statusText}`)

  if (!response.ok) {
    const bodyText = await response.text()
    console.log(`[MCP Client] Request body sent:`, JSON.stringify(requestBody).substring(0, 500))
    console.log(`[MCP Client] Response status: ${response.status}, body: ${bodyText.substring(0, 500)}`)
    
    // Try to parse error response for better error messages
    let errorMessage = bodyText
    try {
      const errorJson = JSON.parse(bodyText)
      // LangChain server returns errors in format: {"content": [{"type": "text", "text": "error message"}], "isError": true}
      if (errorJson.content && Array.isArray(errorJson.content)) {
        const textContent = errorJson.content.find((c: any) => c.type === "text")
        if (textContent && textContent.text) {
          errorMessage = textContent.text
          console.log(`[MCP Client] Extracted error message from LangChain response: ${errorMessage}`)
        }
      } else if (errorJson.error) {
        errorMessage = typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error)
      } else if (errorJson.detail) {
        errorMessage = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail)
      }
    } catch (e) {
      // If parsing fails, use the raw body text
      console.log(`[MCP Client] Could not parse error response as JSON, using raw text`)
    }
    
    // For LangChain servers, provide more context about connection errors
    if (isLangChain && errorMessage.includes("Connection error")) {
      errorMessage = `LangChain server connection error: The server is unable to connect to its dependencies (likely OpenAI API or other services). This is a server-side issue. Error: ${errorMessage}`
      console.error(`[MCP Client] ⚠️ LangChain server connection error detected. This indicates the server cannot reach its required services.`)
    }
    
    // For LangChain servers, if "run" fails, try without tool name (direct query)
    if (isLangChain && response.status === 400 && bodyText.includes("Unknown tool")) {
      console.log(`[MCP Client] "run" tool not recognized, trying direct query format`)
      // Try sending query directly without tool name
      const directRequestBody = {
        query: (requestBody as any)?.arguments?.query || (requestBody as any)?.arguments?.input || "",
      }
      
      const directResponse = await fetch(invokeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...config.headers,
        },
        body: JSON.stringify(directRequestBody),
      })
      
      if (directResponse.ok) {
        const directParsed = await directResponse.json()
        return {
          jsonrpc: "2.0",
          id: payload.id,
          result: directParsed.result || directParsed.content || directParsed,
        }
      }
    }
    
    throw new Error(
      `MCP REST transport responded with ${response.status}. ${errorMessage}`
    )
  }

  // REST servers return JSON directly, not SSE
  // Exa returns SSE format even with REST transport when Accept includes text/event-stream
  const contentType = response.headers.get("content-type") || ""
  
  // Handle Exa's SSE response format
  if (isExa && (contentType.includes("text/event-stream") || contentType.includes("text/plain"))) {
    const text = await response.text()
    console.log(`[MCP Client] Exa returned SSE format, parsing...`)
    
    // Parse SSE format: "event: message\ndata: {...}"
    const lines = text.split('\n')
    let dataLine = ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataLine = line.substring(6) // Remove "data: " prefix
        break
      }
    }
    
    if (!dataLine) {
      throw new Error(`Failed to parse REST response: ${text.substring(0, 200)}`)
    }
    
    try {
      const parsed = JSON.parse(dataLine)
      const jsonRpcResponse = parsed as JsonRpcResponse
      if (jsonRpcResponse.error) {
        throw new Error(JSON.stringify(jsonRpcResponse.error))
      }
      return jsonRpcResponse
    } catch (e) {
      throw new Error(`Failed to parse REST response: ${text.substring(0, 200)}`)
    }
  }
  
  if (contentType.includes("application/json")) {
    const parsed = await response.json()
    
    // LangChain server returns a different format - convert to JSON-RPC format
    if (isLangChain && payload.method === "tools/list") {
      // LangChain might return { tools: [...] } or just [...]
      const tools = Array.isArray(parsed) ? parsed : (parsed.tools || [])
      return {
        jsonrpc: "2.0",
        id: payload.id,
        result: {
          tools: tools.map((t: any) => ({
            name: t.name || t.tool || "",
            description: t.description || "",
            inputSchema: t.inputSchema || t.schema || t.arguments || {},
          })),
        },
      }
    } else if (isLangChain) {
      // For LangChain tool call responses, the server returns the result directly
      // The response might be in different formats, so handle all cases
      console.log(`[MCP Client] LangChain response format:`, JSON.stringify(parsed).substring(0, 500))
      
      // The response might be:
      // - { result: "..." } 
      // - { content: "..." }
      // - { output: "..." }
      // - Just the string directly
      // - { error: "..." }
      
      if (parsed.error) {
        throw new Error(parsed.error.message || parsed.error || JSON.stringify(parsed.error))
      }
      
      // Extract the actual result/content
      const result = parsed.result || parsed.content || parsed.output || parsed.response || parsed
      
      // If result is an object with content array (MCP format), extract it
      if (result && typeof result === 'object' && Array.isArray(result.content)) {
        return {
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            content: result.content,
            isError: result.isError || false,
          },
        }
      }
      
      // Otherwise return as-is
      return {
        jsonrpc: "2.0",
        id: payload.id,
        result: result,
      }
    } else {
      // Standard JSON-RPC response
      const jsonRpcResponse = parsed as JsonRpcResponse
      if (jsonRpcResponse.error) {
        throw new Error(jsonRpcResponse.error.message)
      }
      return jsonRpcResponse
    }
  } else {
    // Fallback: try to parse as JSON anyway
    const text = await response.text()
    try {
      const parsed = JSON.parse(text)
      
      // Handle LangChain format
      if (isLangChain && payload.method === "tools/list") {
        const tools = Array.isArray(parsed) ? parsed : (parsed.tools || [])
        return {
          jsonrpc: "2.0",
          id: payload.id,
          result: {
            tools: tools.map((t: any) => ({
              name: t.name || t.tool || "",
              description: t.description || "",
              inputSchema: t.inputSchema || t.schema || t.arguments || {},
            })),
          },
        }
      }
      
      const jsonRpcResponse = parsed as JsonRpcResponse
      if (jsonRpcResponse.error) {
        throw new Error(jsonRpcResponse.error.message)
      }
      return jsonRpcResponse
    } catch (error) {
      throw new Error(`Failed to parse REST response: ${text.substring(0, 200)}`)
    }
  }
}
