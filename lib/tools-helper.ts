import OpenAI from 'openai'
import { McpClient, buildMcpConfig, type McpRouteConfigInput, type ToolSchema, ensureManagedGoogleConfig, validateManagedServerConfig } from './mcpClient'
import { supabase } from './supabase-client'

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
    // Google Maps needs API key from env
    const apiKey = process.env.GOOGLE_MAPS_GROUNDING_API_KEY
    if (!apiKey) {
      console.warn(`[Tools Helper] Warning: GOOGLE_MAPS_GROUNDING_API_KEY environment variable not set. Maps tools will not work without an API key.`)
    }
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
  
  if (serverId === 'brave') {
    // Brave Search MCP server uses stdio transport with npx
    // The MCP server requires --brave-api-key as a command-line argument
    const apiKey = process.env.BRAVE_API_KEY
    if (!apiKey) {
      console.warn(`[Tools Helper] Warning: BRAVE_API_KEY environment variable not set. Brave Search tools will not work without an API key.`)
      // Return config without API key - will fail but at least won't crash
      return {
        ...config,
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@brave/brave-search-mcp-server'],
      }
    }
    return {
      ...config,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@brave/brave-search-mcp-server', '--brave-api-key', apiKey],
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
    // Tool already has server prefix (e.g., brave_web_search from Brave MCP server)
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
  
  // Special handling for Brave Search tools
  if (serverId === 'brave') {
    // Make Brave Search tools EXTREMELY prominent for search queries and /brave commands
    if (tool.name.toLowerCase().includes('web_search') || tool.name.toLowerCase().includes('search')) {
      enhancedDescription = `🔍 MANDATORY FOR SEARCH QUERIES AND /brave COMMANDS: ${enhancedDescription} When users type "/brave" followed by any text, or request a web search, you MUST call this tool (brave_web_search) with the query parameter. DO NOT provide general knowledge - you MUST call this tool to get real search results. Example: User says "/brave ai developments in late 2025" → IMMEDIATELY call brave_web_search with query="ai developments in late 2025".`
    } else if (tool.name.toLowerCase().includes('image')) {
      enhancedDescription = `🖼️ MANDATORY FOR IMAGE SEARCHES: ${enhancedDescription} When users request image searches or type "/brave" with image-related queries, use this tool.`
    } else if (tool.name.toLowerCase().includes('news')) {
      enhancedDescription = `📰 MANDATORY FOR NEWS SEARCHES: ${enhancedDescription} When users request news searches or type "/brave" with news-related queries, use this tool.`
    }
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
    
    // Special check for Brave - verify API key is set before attempting to connect
    if (server.id === 'brave') {
      const apiKey = process.env.BRAVE_API_KEY
      // Debug: Log all env vars that start with BRAVE to help troubleshoot
      const braveEnvVars = Object.keys(process.env).filter(key => key.includes('BRAVE'))
      console.log(`[Tools Helper] 🔍 Debug: Environment variables containing 'BRAVE': ${braveEnvVars.join(', ')}`)
      
      if (!apiKey) {
        console.error(`[Tools Helper] ❌ BRAVE_API_KEY environment variable is not set! Brave Search tools will not be available.`)
        console.error(`[Tools Helper] Please set BRAVE_API_KEY in your .env.local file and restart the dev server.`)
        console.error(`[Tools Helper] Current working directory: ${process.cwd()}`)
        console.error(`[Tools Helper] NODE_ENV: ${process.env.NODE_ENV}`)
        return []
      }
      console.log(`[Tools Helper] ✅ BRAVE_API_KEY is set (length: ${apiKey.length}, starts with: ${apiKey.substring(0, 8)}...)`)
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
    
    let config = server.config as McpRouteConfigInput
    config.id = server.id
    config.name = server.name
    
    // Apply server-specific config transformations
    config = applyServerConfig(server.id, config)
    console.log(`[Tools Helper] Server ${server.id} config:`, JSON.stringify({ 
      transport: config.transport, 
      command: config.command, 
      hasArgs: !!config.args,
      argsCount: config.args?.length || 0,
      // For Brave, log if API key is in args (but don't log the actual key)
      hasApiKeyArg: server.id === 'brave' ? config.args?.includes('--brave-api-key') : undefined
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
      
      // Log all Brave Search tool names for debugging
      if (server.id === 'brave') {
        if (tools.length === 0) {
          console.warn(`[Tools Helper] ⚠️ Brave Search returned 0 tools! This usually means the MCP server failed to start. Check if BRAVE_API_KEY is set.`)
        } else {
          const toolNames = tools.map(t => t.name).sort()
          console.log(`[Tools Helper] Brave Search tool names: ${toolNames.join(', ')}`)
          const webSearchTool = tools.find(t => t.name === 'brave_web_search' || t.name === 'web_search')
          if (webSearchTool) {
            console.log(`[Tools Helper] ✅ Found web search tool in Brave Search tools`)
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
  // Some MCP servers (like Brave) return tools with names like "brave_web_search"
  // In that case, we need to use the full functionName, not the parsed toolName
  let actualToolName = toolName
  try {
    const availableTools = await client.listTools()
    // Check if functionName exactly matches a tool name (e.g., "brave_web_search")
    const exactMatch = availableTools.find(t => t.name === functionName)
    if (exactMatch) {
      actualToolName = functionName
      console.log(`[Tools Helper] Using full tool name "${actualToolName}" (tool already has server prefix)`)
    } else {
      // Check if parsed toolName matches (e.g., "web_search")
      const parsedMatch = availableTools.find(t => t.name === toolName)
      if (!parsedMatch) {
        // Try to find a tool that ends with the parsed toolName (e.g., "brave_web_search" ends with "web_search")
        const suffixMatch = availableTools.find(t => t.name.endsWith(`_${toolName}`) || t.name === toolName)
        if (suffixMatch) {
          actualToolName = suffixMatch.name
          console.log(`[Tools Helper] Found tool by suffix match: "${actualToolName}"`)
        }
      }
    }
  } catch (error) {
    // If we can't fetch tools, fall back to using parsed toolName
    console.warn(`[Tools Helper] Could not fetch tools to verify tool name, using parsed name: ${toolName}`)
  }
  
  const response = await client.call('tools/call', {
    name: actualToolName,
    arguments: enhancedArgs,
  })
  
  if (response.error) {
    throw new Error(response.error.message || `Failed to invoke tool ${functionName}`)
  }
  
  let result = response.result
  
  // Add Windows buffer delay after screenshot operations to allow frame buffer to capture
  if (serverId === 'playwright' && toolName === 'browser_take_screenshot' && process.platform === 'win32') {
    console.log(`[Tools Helper] Adding Windows buffer delay after screenshot...`)
    await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay for Windows
  }
  
  return result
}
