import OpenAI from 'openai'
import { McpClient, buildMcpConfig, type McpRouteConfigInput, type ToolSchema, ensureManagedGoogleConfig, validateManagedServerConfig } from './mcpClient'
import { supabase } from './supabase-client'
import { getAuthenticatedUser } from './get-user-session'

/**
 * Log tool invocation metrics to database (non-blocking)
 */
async function logToolMetric(params: {
  serverId: string
  toolName: string
  status: 'success' | 'failed'
  executionTimeMs: number
  errorMessage?: string | null
}): Promise<void> {
  try {
    // Get user ID if available (non-blocking if not available)
    let userId: string | null = null
    try {
      const user = await getAuthenticatedUser()
      userId = user?.id || null
    } catch (e) {
      // User not authenticated, continue without user_id
    }
    
    await supabase.from('task_metrics').insert({
      user_id: userId,
      server_id: params.serverId,
      tool_name: params.toolName,
      status: params.status,
      execution_time_ms: params.executionTimeMs,
      error_message: params.errorMessage || null,
    })
  } catch (error) {
    // Silently fail - metrics logging should not break tool execution
    console.warn(`[Tools Helper] Failed to log metric:`, error)
  }
}

/**
 * Get the authenticated GitHub user's username from the token
 */
async function getGitHubUsername(): Promise<string | null> {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN
  if (!token) {
    return null
  }

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (!response.ok) {
      console.warn(`[Tools Helper] Failed to get GitHub user: ${response.status} ${response.statusText}`)
      return null
    }

    const user = await response.json()
    return user.login || null
  } catch (error) {
    console.error(`[Tools Helper] Error getting GitHub user:`, error)
    return null
  }
}


interface SystemServer {
  id: string
  name: string
  config: Record<string, unknown>
  enabled: boolean
}

const GOOGLE_GROUNDING_ID = "google-maps-grounding"

/**
 * Apply server-specific config transformations (similar to registry.ts)
 */
function applyServerConfig(serverId: string, config: McpRouteConfigInput): McpRouteConfigInput {
  if (serverId === 'maps' || serverId === GOOGLE_GROUNDING_ID) {
    const existingHeader =
      config.headers?.['X-Goog-Api-Key'] ?? config.headers?.['x-goog-api-key']
    if (existingHeader || config.transport !== 'http') {
      return {
        ...config,
        headers: {
          ...(config.headers || {}),
          ...(existingHeader ? { 'X-Goog-Api-Key': existingHeader } : {}),
        },
      }
    }
    const apiKey = process.env.GOOGLE_MAPS_GROUNDING_API_KEY
    if (!apiKey) {
      console.warn(`[Tools Helper] Warning: GOOGLE_MAPS_GROUNDING_API_KEY environment variable not set. Maps tools will not work without an API key.`)
      return config
    }
    return {
      ...config,
      headers: {
        ...(config.headers || {}),
        'X-Goog-Api-Key': apiKey,
      },
    }
  }
  
  if (serverId === 'exa') {
    // Exa Search MCP server uses HTTP transport with x-api-key header
    const apiKey = process.env.EXA_API_KEY
    if (!apiKey) {
      console.warn(`[Tools Helper] Warning: EXA_API_KEY environment variable not set. Exa Search tools will not work without an API key.`)
    }
    if (apiKey && config.transport === 'http') {
      return {
        ...config,
        transport: 'http',
        url: config.url || 'https://mcp.exa.ai/mcp',
        headers: {
          ...(config.headers || {}),
          'Accept': 'application/json, text/event-stream', // Exa requires both
          'x-api-key': apiKey, // Exa uses x-api-key header, not Authorization
        },
      }
    }
  }
  
  if (serverId === 'playwright') {
    // Ensure Playwright uses stdio transport with headless and isolated mode
    // Headless mode prevents browser window flashing and reduces resource contention
    // Isolated mode allows multiple browser instances to run without conflicts
    return {
      ...config,
      transport: 'stdio',
      command: 'npx',
      args: ['@playwright/mcp@latest', '--headless', '--isolated'],
    }
  }
  
  if (serverId === 'github') {
    // GitHub MCP server uses stdio transport
    // The MCP server requires GITHUB_PERSONAL_ACCESS_TOKEN as an environment variable
    // Reference: https://github.com/github/github-mcp-server
    // The server can be run via:
    // 1. Binary: github-mcp-server (if installed globally or in PATH)
    // 2. Docker: ghcr.io/github/github-mcp-server
    // 3. npx: @modelcontextprotocol/server-github (if available as npm package)
    const apiKey = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN
    if (!apiKey) {
      console.warn(`[Tools Helper] Warning: GITHUB_PERSONAL_ACCESS_TOKEN environment variable not set. GitHub tools will not work without a token.`)
      // Try to use npx first, fallback to binary name
      return {
        ...config,
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
      }
    }
    // Try npx first (if package exists), otherwise use binary name
    // The binary should be in PATH if installed via GitHub releases
    return {
      ...config,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        ...(config.env || {}),
        GITHUB_PERSONAL_ACCESS_TOKEN: apiKey,
      },
    }
  }
  
  if (serverId === 'langchain') {
    // LangChain Agent MCP server uses REST/HTTP transport
    // Server URL: https://langchain-agent-mcp-server-554655392699.us-central1.run.app
    // Uses /mcp/invoke endpoint for JSON-RPC calls
    // No API key needed (server-side OPENAI_API_KEY is used)
    return {
      ...config,
      transport: 'http',
      url: config.url || 'https://langchain-agent-mcp-server-554655392699.us-central1.run.app',
    }
  }
  
  return config
}

/**
 * Convert MCP tool schema to OpenAI function definition
 */
function convertToolToOpenAIFunction(
  tool: ToolSchema,
  serverId: string
): OpenAI.Chat.Completions.ChatCompletionTool {
  // OpenAI function names must match pattern ^[a-zA-Z0-9_-]+$ (no slashes allowed)
  // Use underscore separator: server_toolname
  // Special handling: if tool name already starts with serverId, don't double-prefix
  let functionName: string
  if (tool.name.startsWith(`${serverId}_`)) {
    // Tool already has server prefix (e.g., exa_web_search_exa from Exa MCP server)
    functionName = tool.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  } else {
    // Add server prefix (e.g., browser_navigate -> playwright_browser_navigate)
    functionName = `${serverId}_${tool.name}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  // Extract parameters schema from tool.schema or tool.inputSchema
  const properties: Record<string, any> = {}
  const required: string[] = []

  // MCP tools can have schema or inputSchema
  const schemaSource = (tool.schema as any) || (tool as any).inputSchema || {}
  
  if (schemaSource && typeof schemaSource === 'object') {
    // Check for properties directly or nested in schema
    const schemaProps = schemaSource.properties || (schemaSource as any).properties || {}
    const schemaRequired = schemaSource.required || (schemaSource as any).required || []

    for (const [key, value] of Object.entries(schemaProps)) {
      properties[key] = value
      if (Array.isArray(schemaRequired) && schemaRequired.includes(key)) {
        required.push(key)
      }
    }
  }

  // Ensure we have at least an empty properties object
  const parameters: Record<string, unknown> = {
    type: 'object',
    properties: Object.keys(properties).length > 0 ? properties : {},
  }
  
  if (required.length > 0) {
    parameters.required = required
  }

  // Enhance description to include slash command format - when user types /serverId, use these tools
  let enhancedDescription = tool.description 
    ? `${tool.description} [MCP Server: /${serverId}]`
    : `${tool.name} tool from /${serverId} MCP server. When user requests /${serverId} or mentions ${serverId}, use this tool.`
  
  // Special handling for Playwright screenshot tool
  if (serverId === 'playwright' && functionName === 'playwright_browser_take_screenshot') {
    // Make screenshot tool EXTREMELY prominent for screenshot requests
    // Put critical info first - AI models often prioritize early information
    enhancedDescription = `SCREENSHOT TOOL - USE THIS WHEN USER ASKS FOR SCREENSHOTS/IMAGES: This tool captures a visual PNG/image screenshot of the current browser page and returns base64 image data. When user says "screenshot", "take a screenshot", "show me", "capture", or requests any image/visual of a webpage, you MUST call this tool (playwright_browser_take_screenshot) after navigating. This is the ONLY tool that produces images. Do NOT use browser_snapshot, browser_select_option, or any other tool. ${enhancedDescription}`
  }
  
  // Special handling for Maps tools
  if (serverId === 'maps' || serverId === GOOGLE_GROUNDING_ID) {
    // Make Maps tools highly prominent for location/place queries
    if (tool.name.toLowerCase().includes('search') || tool.name.toLowerCase().includes('place')) {
      enhancedDescription = `🎯 MANDATORY FOR LOCATION QUERIES: ${enhancedDescription} When users ask about places, locations, businesses, or directions, you MUST call this tool to get structured data. Do NOT just return Google Maps links - use this tool to get actual place information.`
    }
  }
  
  if (serverId === 'exa') {
    if (tool.name.toLowerCase().includes('web_search') || tool.name.toLowerCase().includes('search')) {
      enhancedDescription = `🔍 MANDATORY FOR SEARCH QUERIES AND /exa COMMANDS: ${enhancedDescription} When users type "/exa" followed by any text, or request a web search, you MUST call this tool (exa_web_search_exa or similar). DO NOT provide general knowledge - you MUST call this tool to get real, current search results. Example: User says "/exa ai developments in late 2025" → IMMEDIATELY call exa_web_search_exa with query="ai developments in late 2025".`
    } else if (tool.name.toLowerCase().includes('image')) {
      enhancedDescription = `🖼️ MANDATORY FOR IMAGE SEARCHES: ${enhancedDescription} When users request image searches or type "/exa" with image-related queries, use this tool.`
    } else if (tool.name.toLowerCase().includes('news')) {
      enhancedDescription = `📰 MANDATORY FOR NEWS SEARCHES: ${enhancedDescription} When users request news searches or type "/exa" with news-related queries, use this tool.`
    }
  }
  
  // Special handling for LangChain Agent tools
  if (serverId === 'langchain') {
    // Make LangChain tools EXTREMELY prominent for /langchain commands
    enhancedDescription = `🤖 MANDATORY FOR /langchain COMMANDS: ${enhancedDescription} When users type "/langchain" followed by ANY text, you MUST use this LangChain Agent tool. DO NOT use GitHub tools (github_search_repositories, github_get_repository, etc.), DO NOT use Exa Search, DO NOT use Playwright, DO NOT use Maps. You MUST call LangChain Agent tools (tools starting with "langchain_") to process the user's request. Example: User says "/langchain test" → IMMEDIATELY call this langchain_* tool, NOT github_search_repositories.`
  }
  
  // Note: browser_snapshot is filtered out before reaching this point, so no need to handle it here

  const functionDef: OpenAI.Chat.Completions.ChatCompletionTool = {
    type: 'function',
    function: {
      name: functionName,
      description: enhancedDescription,
      parameters,
    },
  }
  
  return functionDef
}

/**
 * Fetch tools from a single server using MCP client directly
 */
async function fetchToolsFromServer(
  server: SystemServer,
  options?: { googleMapsApiKey?: string | null; googleMapsProjectId?: string | null }
): Promise<ToolSchema[]> {
  try {
    console.log(`[Tools Helper] Attempting to fetch tools from server: ${server.id}`)
    
    // Special check for Exa - verify API key is set before attempting to connect
    if (server.id === 'exa') {
      const apiKey = process.env.EXA_API_KEY
      if (!apiKey) {
        console.error(`[Tools Helper] ❌ EXA_API_KEY environment variable is not set! Exa Search tools will not be available.`)
        console.error(`[Tools Helper] Please set EXA_API_KEY in your .env.local file and restart the dev server.`)
        console.error(`[Tools Helper] Get an API key at: https://docs.exa.ai/reference/exa-mcp`)
        return []
      }
      console.log(`[Tools Helper] ✅ EXA_API_KEY is set (length: ${apiKey.length}, starts with: ${apiKey.substring(0, 8)}...)`)
    }
    
    // Special check for GitHub - verify API key is set before attempting to connect
    if (server.id === 'github') {
      const apiKey = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN
      if (!apiKey) {
        console.error(`[Tools Helper] ❌ GITHUB_PERSONAL_ACCESS_TOKEN environment variable is not set! GitHub tools will not be available.`)
        console.error(`[Tools Helper] Please set GITHUB_PERSONAL_ACCESS_TOKEN in your .env.local file and restart the dev server.`)
        console.error(`[Tools Helper] Get a token at: https://github.com/settings/tokens`)
        return []
      }
      console.log(`[Tools Helper] ✅ GITHUB_PERSONAL_ACCESS_TOKEN is set (length: ${apiKey.length}, starts with: ${apiKey.substring(0, 8)}...)`)
    }
    
    // LangChain server uses REST transport - no special checks needed
    if (server.id === 'langchain') {
      console.log(`[Tools Helper] ✅ LangChain Agent server configured (REST transport)`)
    }
    
    let config = server.config as McpRouteConfigInput
    config.id = server.id
    config.name = server.name
    
    // Apply server-specific config transformations
    config = applyServerConfig(server.id, config)
    if (
      options?.googleMapsApiKey &&
      (server.id === 'maps' || server.id === GOOGLE_GROUNDING_ID)
    ) {
      config.headers = {
        ...(config.headers || {}),
        'X-Goog-Api-Key': options.googleMapsApiKey,
      }
      // Add Project ID header if provided (for tools/list calls)
      if (options?.googleMapsProjectId) {
        config.headers['X-Goog-User-Project'] = options.googleMapsProjectId
        console.log(`[Tools Helper] Added Maps Project ID to headers for tools/list: ${options.googleMapsProjectId}`)
      }
    }
    console.log(`[Tools Helper] Server ${server.id} config:`, JSON.stringify({ 
      transport: config.transport, 
      command: config.command, 
      hasArgs: !!config.args,
      argsCount: config.args?.length || 0,
      hasAuthorization: !!config.headers?.Authorization,
    }))
    
    let mcpConfig = buildMcpConfig(config)
    
    // Apply Google Maps config if needed (check both "maps" and "google-maps-grounding")
    if (server.id === 'maps' || server.id === GOOGLE_GROUNDING_ID) {
      try {
        mcpConfig = ensureManagedGoogleConfig(mcpConfig)
      } catch (error) {
        // If API key is missing, log warning but don't fail - let it fail when calling the API
        console.warn(`[Tools Helper] Warning: ${server.id} API key not configured. Tools may not work.`, error instanceof Error ? error.message : error)
      }
    }
    
    validateManagedServerConfig(mcpConfig)
    const client = new McpClient(mcpConfig)
    
    console.log(`[Tools Helper] Calling listTools() for ${server.id}...`)
    let tools: ToolSchema[] = []
    try {
      tools = await client.listTools()
      console.log(`[Tools Helper] Successfully fetched ${tools.length} tools from ${server.id}`)
    } catch (listToolsError) {
      console.error(`[Tools Helper] ❌ Error calling listTools() for ${server.id}:`, listToolsError)
      if (listToolsError instanceof Error) {
        console.error(`[Tools Helper] Error message: ${listToolsError.message}`)
        console.error(`[Tools Helper] Error stack (first 300 chars): ${listToolsError.stack?.substring(0, 300)}`)
      }
      // Re-throw to be caught by outer try-catch
      throw listToolsError
    }
    if (tools.length > 0) {
      console.log(`[Tools Helper] Sample tool from ${server.id}:`, JSON.stringify({
        name: tools[0].name,
        description: tools[0].description?.substring(0, 50),
        hasSchema: !!(tools[0].schema || (tools[0] as any).inputSchema)
      }))
    }
    return tools
  } catch (error) {
    console.error(`[Tools Helper] Error fetching tools from ${server.id}:`, error)
    if (error instanceof Error) {
      console.error(`[Tools Helper] Error message: ${error.message}`)
      console.error(`[Tools Helper] Error stack: ${error.stack?.substring(0, 200)}`)
    }
    return []
  }
}

/**
 * Get all available tools from system servers and convert to OpenAI format
 */
export async function getAvailableToolsAsOpenAIFunctions(
  options?: { googleMapsApiKey?: string | null; googleMapsProjectId?: string | null }
): Promise<
  OpenAI.Chat.Completions.ChatCompletionTool[]
> {
  try {
    // Use the shared Supabase client to ensure consistent configuration

    // Fetch enabled system servers
    const { data: servers, error } = await supabase
      .from('system_servers')
      .select('id, name, config, enabled')
      .eq('enabled', true)

    if (error || !servers) {
      console.error('[Tools Helper] Error fetching system servers:', error)
      return []
    }

    console.log(`[Tools Helper] Found ${servers.length} enabled system servers`)

    // Fetch tools from all servers in parallel
    const toolPromises = servers.map((server) =>
      fetchToolsFromServer(server as SystemServer, options)
    )
    const toolArrays = await Promise.all(toolPromises)

    // Flatten and convert to OpenAI format
    const openAIFunctions: OpenAI.Chat.Completions.ChatCompletionTool[] = []
    
    for (let i = 0; i < servers.length; i++) {
      const server = servers[i] as SystemServer
      const tools = toolArrays[i]
      
      console.log(`[Tools Helper] Server ${server.id}: ${tools.length} tools`)
      
      // Log all Playwright tool names for debugging
      if (server.id === 'playwright') {
        const toolNames = tools.map(t => t.name).sort()
        console.log(`[Tools Helper] Playwright tool names: ${toolNames.join(', ')}`)
        const screenshotTool = tools.find(t => t.name === 'browser_take_screenshot')
        if (screenshotTool) {
          console.log(`[Tools Helper] ✅ Found browser_take_screenshot tool in Playwright tools`)
        } else {
          console.warn(`[Tools Helper] ⚠️ browser_take_screenshot tool NOT found in Playwright tools!`)
        }
      }
      
      if (server.id === 'exa') {
        if (tools.length === 0) {
          console.warn(`[Tools Helper] ⚠️ Exa Search returned 0 tools! This usually means the MCP endpoint or credentials failed. Check https://docs.exa.ai for troubleshooting.`)
        } else {
          const toolNames = tools.map(t => t.name).sort()
          console.log(`[Tools Helper] Exa Search tool names: ${toolNames.join(', ')}`)
          const webSearchTool = tools.find(t => t.name.includes('web_search'))
          if (webSearchTool) {
            console.log(`[Tools Helper] ✅ Found web search tool in Exa Search tools`)
          }
        }
      }
      
      // Log all GitHub tool names for debugging
      if (server.id === 'github') {
        if (tools.length === 0) {
          console.warn(`[Tools Helper] ⚠️ GitHub returned 0 tools! This usually means the MCP server failed to start. Check if GITHUB_PERSONAL_ACCESS_TOKEN is set.`)
        } else {
          const toolNames = tools.map(t => t.name).sort()
          console.log(`[Tools Helper] GitHub tool names: ${toolNames.join(', ')}`)
          // The GitHub MCP server uses search_repositories (not list_repositories) for listing/searching repos
          const searchReposTool = tools.find(t => t.name === 'search_repositories' || (t.name.includes('search') && t.name.includes('repo')))
          if (searchReposTool) {
            console.log(`[Tools Helper] ✅ Found search repositories tool: ${searchReposTool.name} (will be namespaced as github_${searchReposTool.name})`)
            // Log the tool schema to understand what parameters it accepts
            const schema = (searchReposTool.schema as any) || (searchReposTool as any).inputSchema || {}
            console.log(`[Tools Helper] search_repositories tool schema:`, JSON.stringify(schema, null, 2))
          } else {
            console.warn(`[Tools Helper] ⚠️ Could not find search_repositories tool in GitHub tools`)
          }
        }
      }
      
      // Log LangChain tool names for debugging
      if (server.id === 'langchain') {
        if (tools.length === 0) {
          console.warn(`[Tools Helper] ⚠️ LangChain Agent returned 0 tools! Adding hardcoded tool as fallback.`)
          // Fallback: Add hardcoded tool if server doesn't return tools
          // Note: Server now supports /tools endpoint, so this should rarely be needed
          tools.push({
            name: 'agent_executor',
            description: 'Execute a complex, multi-step reasoning task using the LangChain Agent. The agent can analyze, reason, and execute multi-step tasks based on your request.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The task or query to execute using the LangChain Agent',
                },
                system_instruction: {
                  type: 'string',
                  description: 'Optional system-level instructions for the agent',
                },
              },
              required: ['query'],
            },
          })
          console.log(`[Tools Helper] ✅ Added hardcoded LangChain agent_executor tool as fallback`)
        } else {
          const toolNames = tools.map(t => t.name).sort()
          console.log(`[Tools Helper] ✅ LangChain Agent tool names (from /tools endpoint): ${toolNames.join(', ')}`)
        }
      }
      
      for (const tool of tools) {
        try {
          // STRUCTURAL ENFORCEMENT: Hard filter - Remove browser_snapshot entirely from tool list
          if (server.id === 'playwright' && tool.name === 'browser_snapshot') {
            console.log(`[Tools Helper] 🚫 PERMANENTLY FILTERING: ${server.id}_${tool.name} - removed from available tools (use browser_take_screenshot for images)`)
            continue
          }
          
          const openAIFunc = convertToolToOpenAIFunction(tool, server.id)
          openAIFunctions.push(openAIFunc)
          
          // Log when we add the screenshot tool
          if (server.id === 'playwright' && tool.name === 'browser_take_screenshot') {
            console.log(`[Tools Helper] ✅ Added playwright_browser_take_screenshot to OpenAI functions`)
          }
        } catch (err) {
          console.error(`[Tools Helper] Error converting tool ${tool.name}:`, err)
        }
      }
    }

    console.log(`[Tools Helper] Total OpenAI functions: ${openAIFunctions.length}`)
    return openAIFunctions
  } catch (error) {
    console.error('[Tools Helper] Error in getAvailableToolsAsOpenAIFunctions:', error)
    return []
  }
}

/**
 * Enhance Playwright navigation arguments to wait for network idle
 */
function enhancePlaywrightNavigationArgs(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  if (toolName === 'browser_navigate' && args.url) {
    // Force networkidle wait condition for reliable screenshots
    return {
      ...args,
      waitUntil: 'networkidle',
      timeout: 30000, // 30 second timeout
    }
  }
  return args
}

/**
 * Invoke a tool by its namespaced name (server_toolname)
 */
interface InvokeToolOptions {
  googleMapsApiKey?: string | null
  googleMapsProjectId?: string | null
}

export async function invokeToolByName(
  functionName: string,
  args: Record<string, unknown>,
  options?: InvokeToolOptions
): Promise<unknown> {
  // Parse server_toolname format (using _ separator, OpenAI compatible)
  // Find the first underscore to split server ID from tool name
  const underscoreIndex = functionName.indexOf('_')
  if (underscoreIndex === -1 || underscoreIndex === 0) {
    throw new Error(`Invalid function name format: ${functionName}. Expected format: server_toolname`)
  }

  const serverId = functionName.substring(0, underscoreIndex)
  let toolName = functionName.substring(underscoreIndex + 1)

  // STRUCTURAL ENFORCEMENT: Backend Interception
  // If AI calls browser_snapshot or browser_screenshot, transparently redirect to browser_take_screenshot
  if (serverId === 'playwright' && (toolName === 'browser_snapshot' || toolName === 'browser_screenshot')) {
    console.warn(`[Tools Helper] 🔄 INTERCEPTION: AI called 'playwright_${toolName}', redirecting to 'playwright_browser_take_screenshot'`)
    toolName = 'browser_take_screenshot' // Transparently swap the tool
  }

  // Use the shared Supabase client

  // Get server config
  const { data: server, error } = await supabase
    .from('system_servers')
    .select('id, name, config')
    .eq('id', serverId)
    .single()

  if (error || !server) {
    console.error(`[Tools Helper] ❌ Server not found: ${serverId}`, error)
    // Try to list all available servers for debugging
    const { data: allServers } = await supabase
      .from('system_servers')
      .select('id, name')
    console.error(`[Tools Helper] Available servers:`, allServers?.map(s => s.id).join(', ') || 'none')
    throw new Error(`Server not found: ${serverId}. Available servers: ${allServers?.map(s => s.id).join(', ') || 'none'}`)
  }

  let config = server.config as McpRouteConfigInput
  config.id = server.id
  config.name = server.name
  
  // For Maps servers, set user-provided key and project ID FIRST (before applyServerConfig)
  // so they take precedence over env vars
  if (
    options?.googleMapsApiKey &&
    (server.id === 'maps' || server.id === GOOGLE_GROUNDING_ID)
  ) {
    config.headers = {
      ...(config.headers || {}),
      'X-Goog-Api-Key': options.googleMapsApiKey.trim(),
    }
    // Add Project ID header if provided (critical for billing attribution)
    if (options?.googleMapsProjectId) {
      config.headers['X-Goog-User-Project'] = options.googleMapsProjectId.trim()
      console.log(`[Tools Helper] Using user-provided Maps Project ID: ${options.googleMapsProjectId.trim()}`)
    }
    console.log(`[Tools Helper] Using user-provided Maps API key (length: ${options.googleMapsApiKey.trim().length})`)
  }
  
  // Apply server-specific config transformations
  config = applyServerConfig(server.id, config)
  
  // Ensure user-provided key and project ID are still set (applyServerConfig might have overwritten them)
  if (
    options?.googleMapsApiKey &&
    (server.id === 'maps' || server.id === GOOGLE_GROUNDING_ID)
  ) {
    const trimmedKey = options.googleMapsApiKey.trim()
    config.headers = {
      ...(config.headers || {}),
      'X-Goog-Api-Key': trimmedKey,
    }
    // Ensure Project ID is set if provided
    if (options?.googleMapsProjectId) {
      config.headers['X-Goog-User-Project'] = options.googleMapsProjectId.trim()
      console.log(`[Tools Helper] ✅ Set user-provided Maps Project ID in headers: ${options.googleMapsProjectId.trim()}`)
    }
    console.log(`[Tools Helper] ✅ Set user-provided Maps API key in headers (length: ${trimmedKey.length}, starts with: ${trimmedKey.substring(0, 10)}...)`)
  }
  
  let mcpConfig = buildMcpConfig(config)
  
  // Apply Google Maps config if needed (check both "maps" and "google-maps-grounding")
  // ensureManagedGoogleConfig will prefer the header key if it exists
  if (server.id === 'maps' || server.id === GOOGLE_GROUNDING_ID) {
    try {
      const keyBefore = mcpConfig.headers['X-Goog-Api-Key'] || mcpConfig.headers['x-goog-api-key']
      mcpConfig = ensureManagedGoogleConfig(mcpConfig)
      const keyAfter = mcpConfig.headers['X-Goog-Api-Key'] || mcpConfig.headers['x-goog-api-key']
      const keyBeforeStr = (typeof keyBefore === 'string' && keyBefore.length > 0) ? `${keyBefore.substring(0, 10)}... (${keyBefore.length} chars)` : 'none'
      const keyAfterStr = (typeof keyAfter === 'string' && keyAfter.length > 0) ? `${keyAfter.substring(0, 10)}... (${keyAfter.length} chars)` : 'none'
      console.log(`[Tools Helper] Maps config applied. Key before: ${keyBeforeStr}, Key after: ${keyAfterStr}`)
    } catch (error) {
      // If API key is missing, log warning but don't fail - let it fail when calling the API
      console.warn(`[Tools Helper] Warning: ${server.id} API key not configured. Tools may not work.`, error instanceof Error ? error.message : error)
    }
  }
  
  validateManagedServerConfig(mcpConfig)
  
  // Enhance Playwright navigation arguments to wait for network idle
  let enhancedArgs = args
  if (serverId === 'playwright') {
    enhancedArgs = enhancePlaywrightNavigationArgs(toolName, args)
    if (JSON.stringify(enhancedArgs) !== JSON.stringify(args)) {
      console.log(`[Tools Helper] Enhanced Playwright navigation args:`, enhancedArgs)
    }
  }
  
  // GitHub-specific: Fix "user:me", "user:ACTUAL_USERNAME", or empty queries to use actual authenticated username
  if (serverId === 'github' && toolName === 'search_repositories') {
    const query = enhancedArgs.query ? String(enhancedArgs.query) : ''
    // Check if query contains placeholder text, "user:me", is empty, or needs the actual username
    const needsFix = !query || 
                     query.trim() === '' ||
                     query.includes('user:me') || 
                     query === 'user:me' || 
                     query.includes('user:@me') ||
                     query.includes('ACTUAL_USERNAME') ||
                     query.includes('USERNAME') && query.includes('user:')
    
    if (needsFix) {
      console.log(`[Tools Helper] 🔧 Intercepting GitHub search_repositories with query: "${query}", fetching actual username...`)
      const actualUsername = await getGitHubUsername()
      if (actualUsername) {
        // Use the actual username in the query
        const fixedQuery = `user:${actualUsername}`
        enhancedArgs = { ...enhancedArgs, query: fixedQuery }
        console.log(`[Tools Helper] ✅ Fixed query from "${query}" to "${fixedQuery}"`)
      } else {
        console.warn(`[Tools Helper] ⚠️ Could not get GitHub username from token. Check if GITHUB_PERSONAL_ACCESS_TOKEN is set correctly.`)
        // Still try with the original query, but log the issue
      }
    }
  }
  
  // Create MCP client and invoke tool
  const client = new McpClient(mcpConfig)
  
  // Check if the tool name already includes the server prefix
  // Some MCP servers (like Exa) return tools with names like "exa_web_search_exa"
  // In that case, we need to use the full functionName, not the parsed toolName
  let actualToolName = toolName
  try {
    console.log(`[Tools Helper] Fetching tools from ${serverId} to verify tool name "${toolName}"...`)
    const availableTools = await client.listTools()
    console.log(`[Tools Helper] Available tools from ${serverId}:`, availableTools.map(t => t.name).join(', '))
    
    // Check if functionName exactly matches a tool name (e.g., "brave_web_search")
    const exactMatch = availableTools.find(t => t.name === functionName)
    if (exactMatch) {
      actualToolName = functionName
      console.log(`[Tools Helper] Using full tool name "${actualToolName}" (tool already has server prefix)`)
    } else {
      // Check if parsed toolName matches (e.g., "web_search")
      const parsedMatch = availableTools.find(t => t.name === toolName)
      if (parsedMatch) {
        actualToolName = toolName
        console.log(`[Tools Helper] Using parsed tool name "${actualToolName}"`)
      } else {
        // Try to find a tool that ends with the parsed toolName (e.g., "brave_web_search" ends with "web_search")
        const suffixMatch = availableTools.find(t => t.name.endsWith(`_${toolName}`) || t.name === toolName)
        if (suffixMatch) {
          actualToolName = suffixMatch.name
          console.log(`[Tools Helper] Found tool by suffix match: "${actualToolName}"`)
        } else {
          // For LangChain, the tool name should be "agent_executor"
          if (serverId === 'langchain' && (toolName === 'agent' || toolName === 'agent_executor')) {
            actualToolName = 'agent_executor'
            console.log(`[Tools Helper] Using hardcoded LangChain tool name: "${actualToolName}"`)
          } else {
            console.warn(`[Tools Helper] ⚠️ Tool "${toolName}" not found in available tools. Available: ${availableTools.map(t => t.name).join(', ')}. Will try with parsed name.`)
          }
        }
      }
    }
  } catch (error) {
    // If we can't fetch tools, fall back to using parsed toolName
    console.warn(`[Tools Helper] Could not fetch tools to verify tool name, using parsed name: ${toolName}`, error)
    // For LangChain, use agent_executor as fallback
    if (serverId === 'langchain' && (toolName === 'agent' || toolName === 'agent_executor')) {
      actualToolName = 'agent_executor'
      console.log(`[Tools Helper] Using hardcoded LangChain tool name as fallback: "${actualToolName}"`)
    }
  }
  
  console.log(`[Tools Helper] Invoking tool: ${serverId}_${actualToolName} with args:`, JSON.stringify(enhancedArgs).substring(0, 200))
  
  // Track metrics: start time
  const startTime = Date.now()
  let executionStatus: 'success' | 'failed' = 'success'
  let errorMessage: string | null = null
  
  try {
    const response = await client.call('tools/call', {
      name: actualToolName,
      arguments: enhancedArgs,
    })
    
    if (response.error) {
      const errorMsg = response.error.message || `Failed to invoke tool ${functionName}`
      console.error(`[Tools Helper] ❌ Tool call error:`, errorMsg)
      console.error(`[Tools Helper] Full error response:`, JSON.stringify(response.error))
      executionStatus = 'failed'
      errorMessage = errorMsg
      throw new Error(errorMsg)
    }
    
    let result = response.result
    
    // Add Windows buffer delay after screenshot operations to allow frame buffer to capture
    if (serverId === 'playwright' && toolName === 'browser_take_screenshot' && process.platform === 'win32') {
      console.log(`[Tools Helper] Adding Windows buffer delay after screenshot...`)
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay for Windows
    }
    
    // Log successful tool invocation to metrics (non-blocking)
    const executionTime = Date.now() - startTime
    logToolMetric({
      serverId,
      toolName: actualToolName,
      status: 'success',
      executionTimeMs: executionTime,
    }).catch(err => {
      console.warn(`[Tools Helper] Failed to log metric:`, err)
    })
    
    return result
  } catch (error) {
    // Log failed tool invocation to metrics (non-blocking)
    const executionTime = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logToolMetric({
      serverId,
      toolName: actualToolName,
      status: 'failed',
      executionTimeMs: executionTime,
      errorMessage: errorMsg,
    }).catch(err => {
      console.warn(`[Tools Helper] Failed to log metric:`, err)
    })
    
    throw error
  }
}
