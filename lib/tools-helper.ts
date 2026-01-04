import OpenAI from 'openai'
import { McpClient, buildMcpConfig, type McpRouteConfigInput, type ToolSchema, ensureManagedGoogleConfig, validateManagedServerConfig } from './mcpClient'
import { supabase } from './supabase-client'


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
    // Google Maps needs API key from env
    const apiKey = process.env.GOOGLE_MAPS_GROUNDING_API_KEY
    if (apiKey && config.transport === 'http') {
      return {
        ...config,
        headers: {
          ...(config.headers || {}),
          'X-Goog-Api-Key': apiKey,
        },
      }
    }
  }
  
  if (serverId === 'playwright') {
    // Ensure Playwright uses stdio transport with headless mode
    // Headless mode prevents browser window flashing and reduces resource contention
    return {
      ...config,
      transport: 'stdio',
      command: 'npx',
      args: ['@playwright/mcp@latest', '--headless'],
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
  const functionName = `${serverId}_${tool.name}`.replace(/[^a-zA-Z0-9_-]/g, '_')

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
  if (serverId === 'playwright' && functionName === 'playwright_browser_screenshot') {
    // Make screenshot tool highly prominent for screenshot requests
    enhancedDescription = `🎯 MANDATORY FOR SCREENSHOTS: Captures a visual PNG/image screenshot of the current browser page. Returns base64 image data. Use this tool when users request screenshots, images, or visual captures. ${enhancedDescription}`
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
async function fetchToolsFromServer(server: SystemServer): Promise<ToolSchema[]> {
  try {
    console.log(`[Tools Helper] Attempting to fetch tools from server: ${server.id}`)
    let config = server.config as McpRouteConfigInput
    config.id = server.id
    config.name = server.name
    
    // Apply server-specific config transformations
    config = applyServerConfig(server.id, config)
    console.log(`[Tools Helper] Server ${server.id} config:`, JSON.stringify({ transport: config.transport, command: config.command, hasArgs: !!config.args }))
    
    let mcpConfig = buildMcpConfig(config)
    
    // Apply Google Maps config if needed
    if (server.id === GOOGLE_GROUNDING_ID) {
      mcpConfig = ensureManagedGoogleConfig(mcpConfig)
    }
    
    validateManagedServerConfig(mcpConfig)
    const client = new McpClient(mcpConfig)
    
    console.log(`[Tools Helper] Calling listTools() for ${server.id}...`)
    const tools = await client.listTools()
    console.log(`[Tools Helper] Successfully fetched ${tools.length} tools from ${server.id}`)
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
export async function getAvailableToolsAsOpenAIFunctions(): Promise<
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
    const toolPromises = servers.map((server) => fetchToolsFromServer(server as SystemServer))
    const toolArrays = await Promise.all(toolPromises)

    // Flatten and convert to OpenAI format
    const openAIFunctions: OpenAI.Chat.Completions.ChatCompletionTool[] = []
    
    for (let i = 0; i < servers.length; i++) {
      const server = servers[i] as SystemServer
      const tools = toolArrays[i]
      
      console.log(`[Tools Helper] Server ${server.id}: ${tools.length} tools`)
      
      for (const tool of tools) {
        try {
          // STRUCTURAL ENFORCEMENT: Hard filter - Remove browser_snapshot entirely from tool list
          if (server.id === 'playwright' && tool.name === 'browser_snapshot') {
            console.log(`[Tools Helper] 🚫 PERMANENTLY FILTERING: ${server.id}_${tool.name} - removed from available tools (use browser_screenshot for images)`)
            continue
          }
          
          const openAIFunc = convertToolToOpenAIFunction(tool, server.id)
          openAIFunctions.push(openAIFunc)
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
export async function invokeToolByName(
  functionName: string,
  args: Record<string, unknown>
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
  // If AI calls browser_snapshot, transparently redirect to browser_screenshot
  if (serverId === 'playwright' && toolName === 'browser_snapshot') {
    console.warn(`[Tools Helper] 🔄 INTERCEPTION: AI called 'playwright_browser_snapshot', redirecting to 'playwright_browser_screenshot'`)
    toolName = 'browser_screenshot' // Transparently swap the tool
  }

  // Use the shared Supabase client

  // Get server config
  const { data: server, error } = await supabase
    .from('system_servers')
    .select('id, name, config')
    .eq('id', serverId)
    .single()

  if (error || !server) {
    throw new Error(`Server not found: ${serverId}`)
  }

  let config = server.config as McpRouteConfigInput
  config.id = server.id
  config.name = server.name
  
  // Apply server-specific config transformations
  config = applyServerConfig(server.id, config)
  
  let mcpConfig = buildMcpConfig(config)
  
  // Apply Google Maps config if needed
  if (server.id === GOOGLE_GROUNDING_ID) {
    mcpConfig = ensureManagedGoogleConfig(mcpConfig)
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
  
  // Create MCP client and invoke tool
  const client = new McpClient(mcpConfig)
  const response = await client.call('tools/call', {
    name: toolName,
    arguments: enhancedArgs,
  })
  
  if (response.error) {
    throw new Error(response.error.message || `Failed to invoke tool ${functionName}`)
  }
  
  let result = response.result
  
  // Add Windows buffer delay after screenshot operations to allow frame buffer to capture
  if (serverId === 'playwright' && toolName === 'browser_screenshot' && process.platform === 'win32') {
    console.log(`[Tools Helper] Adding Windows buffer delay after screenshot...`)
    await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay for Windows
  }
  
  return result
}
